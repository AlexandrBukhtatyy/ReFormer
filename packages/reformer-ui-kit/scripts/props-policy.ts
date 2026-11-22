/**
 * Политика отбора пропсов для интроспекции ({@link './introspect-props'}).
 *
 * Каталог описывает **свойства компонентов, а не HTML-атрибуты**. Реальные типы вариантов —
 * `React.ComponentProps<'button'> & VariantProps<typeof cva> & {…}`, то есть 87 533 пропса на 392
 * экспорта, из которых 84 500 — глобальный слой React (`DOMAttributes` 170 обработчиков,
 * `AriaAttributes` 53, `HTMLAttributes` 55, `ref`/`key`) и element-specific HTML-атрибуты. Они не
 * «свойства компонента» и в палитру/инспектор не идут: инспектор билдера рендерит КАЖДЫЙ проп из
 * `properties` — 300 полей на компонент сделали бы его нечитаемым.
 *
 * Остаётся ≈1 500 пропсов: собственные пропсы ui-kit, cva-варианты (`variant`/`size` — объявлены
 * мапнутым типом прямо в исходнике кита) и пропсы библиотек компонентов (radix-ui, cmdk, vaul,
 * recharts, react-day-picker, react-resizable-panels, input-otp). Плюс `className` — единственный
 * HTML-атрибут-исключение: он стилевой шов кита и присутствует в каждой схеме сегодня.
 *
 * ## Почему `onOpenChange` остаётся, а `onClick` — нет
 *
 * Наивное правило «выкинуть всё `on*` из библиотек» ломает управляемые пары: `open` попадает в
 * каталог, а `onOpenChange` — нет, и проп в декларативной схеме намертво фиксирует состояние
 * (это независимо нашли аудиты context-menu, dropdown-menu, hover-card, navigation-menu, tabs).
 * Но и оставить всё `on*` нельзя: recharts переобъявляет все 159 DOM-событий в собственном
 * `DOMAttributesAdaptChildEvent`, то есть формально «в библиотеке».
 *
 * Различаем машинно: {@link ReactNameSets.domEvents} — имена, объявленные в `DOMAttributes`
 * из `@types/react`, собранные из самих типов при обходе (а не захардкоженным списком). Проп
 * `on*` выбрасывается, только если его имя есть в этом наборе — `onClick`/`onKeyDown` уходят,
 * `onOpenChange`/`onValueChange`/`onSelect` остаются.
 *
 * @module reformer-ui-kit/scripts/props-policy
 */

/** Откуда пришёл проп: файл объявления и интерфейс, в котором он объявлен. */
export interface PropOrigin {
  name: string;
  declFile: string;
  /** Имя интерфейса/типа объявления (`DOMAttributes`, `SliderProps`, …); `?` — не определено. */
  iface: string;
}

/**
 * Наборы имён, собранные из типов React при первом проходе интроспекции. Позволяют отличить
 * DOM-событие от коллбэка компонента, не завися от захардкоженного списка.
 */
export interface ReactNameSets {
  /** Имена из `DOMAttributes` (`onClick`, `onKeyDown`, … — 170 штук). */
  domEvents: Set<string>;
}

/** Пакеты, чьи пропсы — HTML/React-инфраструктура, а не свойства компонента. */
const INFRA_PACKAGES = new Set(['@types/react', '@types/react-dom', 'csstype', 'typescript']);

/**
 * Оставляем всегда, даже когда объявлено в инфраструктурном пакете. `className` — стилевой шов
 * кита (в каждой схеме сегодня), его редактор в билдере отдельный.
 */
const ALWAYS_KEEP = new Set(['className']);

/**
 * Не попадают в `componentProps` по устройству DSL: содержимое приходит из `children[]` схемы
 * рендера, `key`/`ref` — реконсиляция React, `style` — инлайн-стиль (стилизуем через `className`),
 * `dangerouslySetInnerHTML` небезопасен в декларативной схеме.
 */
const NEVER_KEEP = new Set(['children', 'key', 'ref', 'style', 'dangerouslySetInnerHTML']);

/** Проп объявлен в исходниках самого кита (собственные пропсы + cva-варианты). */
export function isKitSource(declFile: string): boolean {
  return !declFile.replace(/\\/g, '/').includes('node_modules/');
}

/** npm-пакет, в котором объявлен проп (`ui-kit-src` для исходников кита). */
export function packageOf(declFile: string): string {
  const file = declFile.replace(/\\/g, '/');
  const at = file.lastIndexOf('node_modules/');
  if (at < 0) return 'ui-kit-src';
  const parts = file.slice(at + 'node_modules/'.length).split('/');
  return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
}

/** ARIA/data-атрибуты — разметочный слой, не свойства компонента. */
function isAriaOrData(name: string): boolean {
  return name.startsWith('aria-') || name.startsWith('data-');
}

/**
 * Обработчик фазы перехвата (`onPointerEnterCapture`). Набор {@link ReactNameSets.domEvents}
 * строится из установленного `@types/react`, а он часть таких имён уже не объявляет — при этом
 * recharts продолжает объявлять их в своём `DOMAttributesAdaptChildEvent`, и они проскакивали
 * фильтр. Суффикс `Capture` у `on*` бывает только у DOM-событий, поэтому режем по форме имени.
 */
function isCapturePhaseHandler(name: string): boolean {
  return /^on[A-Z]\w*Capture$/.test(name);
}

/** Решение по одному пропу: попадает ли он в `properties` записи каталога. */
export function keepProp(origin: PropOrigin, sets: ReactNameSets): boolean {
  const { name, declFile } = origin;
  if (ALWAYS_KEEP.has(name)) return true;
  if (NEVER_KEEP.has(name)) return false;
  if (isAriaOrData(name)) return false;
  // DOM-событие остаётся DOM-событием, даже если библиотека переобъявила его у себя (recharts).
  if (sets.domEvents.has(name) || isCapturePhaseHandler(name)) return false;
  if (isKitSource(declFile)) return true;
  return !INFRA_PACKAGES.has(packageOf(declFile));
}

/** Причина исключения — для аудита (почему пропа нет в каталоге). */
export function skipReason(origin: PropOrigin, sets: ReactNameSets): string {
  const { name, declFile } = origin;
  if (NEVER_KEEP.has(name)) return 'структурный (children/key/ref/style) — не componentProps';
  if (isAriaOrData(name)) return 'ARIA/data-атрибут разметки';
  if (sets.domEvents.has(name) || isCapturePhaseHandler(name))
    return 'DOM-событие (React DOMAttributes)';
  const pkg = packageOf(declFile);
  if (INFRA_PACKAGES.has(pkg)) return `HTML/React-атрибут (${pkg})`;
  return 'по политике не включён';
}

/**
 * Маркер `x-inherits`: что компонент принимает сверх перечисленных `properties`. Пишется в запись
 * каталога, чтобы отсутствие `onClick`/`aria-label` не читалось как «компонент их не принимает».
 */
export function inheritsOf(
  skipped: PropOrigin[],
  sets: ReactNameSets
): { react: string[]; packages: string[] } | null {
  if (!skipped.length) return null;
  const react = new Set<string>();
  const packages = new Set<string>();
  for (const origin of skipped) {
    const pkg = packageOf(origin.declFile);
    if (sets.domEvents.has(origin.name)) react.add('DOMAttributes');
    else if (origin.name.startsWith('aria-')) react.add('AriaAttributes');
    else if (INFRA_PACKAGES.has(pkg))
      react.add(origin.iface !== '?' ? origin.iface : 'HTMLAttributes');
    if (pkg !== 'ui-kit-src' && !INFRA_PACKAGES.has(pkg)) packages.add(pkg);
  }
  return { react: [...react].sort(), packages: [...packages].sort() };
}
