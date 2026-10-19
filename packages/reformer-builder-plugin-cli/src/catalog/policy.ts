/**
 * Политика отбора пропсов: какой проп записи попадает в `properties`, а какой — в `x-inherits`.
 *
 * Перенесена из генератора `@reformer/ui-kit` (`scripts/props-policy.ts`) с обобщением на любой
 * кит. Каталог описывает **свойства компонентов, а не HTML-атрибуты**: реальные типы — это
 * `HTMLAttributes & {…}`, сотни пропсов на компонент, а инспектор билдера рисует каждый проп из
 * `properties`. Поэтому решает происхождение пропа — уровень владения файла объявления:
 *
 * | Уровень   | Откуда                                           | Куда                          |
 * | --------- | ------------------------------------------------ | ----------------------------- |
 * | `kit`     | исходники самого кита (каталог конфига)          | `properties`                  |
 * | `own`     | пакеты дизайн-системы (`ownership.packages`)     | `properties`                  |
 * | `infra`   | `@types/react`, `csstype`, библиотеки TypeScript | `x-inherits.react`            |
 * | `foreign` | все остальные пакеты (`antd`, `rc-*`)            | `x-inherits.packages`         |
 *
 * Поверх уровней — правила по имени, как у ui-kit: `className` остаётся всегда (стилевой шов
 * кита), структурные `children`/`key`/`ref`/`style` — никогда, aria/data-атрибуты и DOM-события
 * (имена из `DOMAttributes` самого `@types/react`, а не захардкоженный список) — тоже. Пропы
 * с `@deprecated` не попадают никуда. Чужой проп, который всё же нужен, возвращает
 * `props.pick` конфига.
 *
 * ## Почему `onOpenChange` остаётся, а `onClick` — нет
 *
 * Выкинуть всё `on*` нельзя: управляемая пара `open`/`onOpenChange` без второй половины намертво
 * фиксирует состояние в схеме. Оставить всё нельзя: библиотеки переобъявляют DOM-события у себя.
 * Поэтому `on*` уходит, только если его имя объявлено в `DOMAttributes` из `@types/react`
 * (или это обработчик фазы перехвата `on*Capture`).
 *
 * @module @reformer/builder-plugin-cli/catalog/policy
 */

import type { CatalogInherits } from '@reformer/builder-plugin-api';

/** Уровень владения пропом — по файлу, в котором он объявлен. */
export type PropLevel = 'kit' | 'own' | 'infra' | 'foreign';

/** Пакеты, чьи пропсы — HTML/React-инфраструктура, а не свойства компонента. */
export const INFRA_PACKAGES: ReadonlySet<string> = new Set([
  '@types/react',
  '@types/react-dom',
  '@types/prop-types',
  'csstype',
  'typescript',
]);

/** Оставляем всегда, даже из инфраструктуры: стилевой шов кита, у билдера для него свой редактор. */
export const ALWAYS_KEEP: ReadonlySet<string> = new Set(['className']);

/**
 * Не бывают пропсами схемы по устройству DSL: содержимое — `children[]` схемы, `key`/`ref` —
 * реконсиляция React, `style` — инлайн-стиль (стилизуем через `className`),
 * `dangerouslySetInnerHTML` небезопасен в декларативной схеме. `props.pick` их не возвращает.
 */
export const NEVER_KEEP: ReadonlySet<string> = new Set([
  'children',
  'key',
  'ref',
  'style',
  'dangerouslySetInnerHTML',
]);

/** Откуда пришёл проп. */
export interface PropOrigin {
  readonly name: string;
  /** npm-пакет объявления; для исходников кита — `kit`. */
  readonly pkg: string;
  readonly level: PropLevel;
  /** Интерфейс/тип объявления (`DOMAttributes`, `SliderProps`); `?` — не определён. */
  readonly iface: string;
  /** У объявления есть JSDoc-тег `@deprecated`. */
  readonly deprecated: boolean;
}

/** Имена, собранные из типов React: отличают DOM-событие от колбэка компонента. */
export interface ReactNameSets {
  /** Имена из `DOMAttributes` `@types/react` (`onClick`, `onKeyDown`, …). */
  readonly domEvents: ReadonlySet<string>;
}

/** Файл в `node_modules` → имя пакета (`@scope/name` или `name`); вне — `undefined`. */
export function packageFromPath(file: string): string | undefined {
  const normalized = file.replace(/\\/g, '/');
  const at = normalized.lastIndexOf('/node_modules/');
  if (at < 0) return undefined;
  const parts = normalized.slice(at + '/node_modules/'.length).split('/');
  const first = parts[0] ?? '';
  return first.startsWith('@') ? `${first}/${parts[1] ?? ''}` : first;
}

/** Уровень владения пакета (исходники кита — уровень `kit`, его решает вызывающий). */
export function levelOfPackage(pkg: string, ownPackages: ReadonlySet<string>): PropLevel {
  if (ownPackages.has(pkg)) return 'own';
  if (INFRA_PACKAGES.has(pkg)) return 'infra';
  return 'foreign';
}

function isAriaOrData(name: string): boolean {
  return name.startsWith('aria-') || name.startsWith('data-');
}

/**
 * Обработчик фазы перехвата (`onPointerEnterCapture`). Свежий `@types/react` часть таких имён
 * уже не объявляет, а библиотеки — объявляют; суффикс `Capture` у `on*` бывает только у
 * DOM-событий, поэтому режем по форме имени.
 */
function isCapturePhaseHandler(name: string): boolean {
  return /^on[A-Z]\w*Capture$/.test(name);
}

function isDomEvent(name: string, sets: ReactNameSets): boolean {
  return sets.domEvents.has(name) || isCapturePhaseHandler(name);
}

/** Попадает ли проп в `properties` записи (до правок `props.pick/omit` конфига). */
export function keepProp(origin: PropOrigin, sets: ReactNameSets): boolean {
  const { name } = origin;
  if (origin.deprecated) return false;
  if (ALWAYS_KEEP.has(name)) return true;
  if (NEVER_KEEP.has(name)) return false;
  if (isAriaOrData(name)) return false;
  // DOM-событие остаётся DOM-событием, даже если библиотека переобъявила его у себя.
  if (isDomEvent(name, sets)) return false;
  return origin.level === 'kit' || origin.level === 'own';
}

/** Почему пропа нет в `properties` — для аудита и сообщений об отказе. */
export function skipReason(origin: PropOrigin, sets: ReactNameSets): string {
  const { name } = origin;
  if (origin.deprecated) return 'помечен @deprecated';
  if (NEVER_KEEP.has(name)) return 'структурный (children/key/ref/style) — не пропс схемы';
  if (isAriaOrData(name)) return 'ARIA/data-атрибут разметки';
  if (isDomEvent(name, sets)) return 'DOM-событие (React DOMAttributes)';
  if (origin.level === 'infra') return `HTML/React-атрибут (${origin.pkg})`;
  if (origin.level === 'foreign') return `проп чужого пакета (${origin.pkg})`;
  return 'по политике не включён';
}

/**
 * Маркер `x-inherits`: что компонент принимает сверх `properties`. Пишется, чтобы отсутствие
 * `onClick`/`aria-label` не читалось как «компонент их не принимает». `null` — нечего сказать.
 */
export function inheritsOf(
  skipped: readonly PropOrigin[],
  sets: ReactNameSets
): CatalogInherits | null {
  const react = new Set<string>();
  const packages = new Set<string>();
  for (const origin of skipped) {
    // Свой устаревший проп — не наследство: компонент его просто больше не рекламирует.
    if (origin.deprecated && (origin.level === 'kit' || origin.level === 'own')) continue;
    if (isDomEvent(origin.name, sets)) react.add('DOMAttributes');
    else if (origin.name.startsWith('aria-')) react.add('AriaAttributes');
    else if (origin.level === 'infra')
      react.add(origin.iface === '?' ? 'HTMLAttributes' : origin.iface);
    if (origin.level === 'foreign') packages.add(origin.pkg);
  }
  if (react.size === 0 && packages.size === 0) return null;
  return {
    react: [...react].sort(compareCodePoints),
    packages: [...packages].sort(compareCodePoints),
  };
}

/**
 * Сравнение строк по кодовым точкам — порядок, не зависящий от локали машины (`localeCompare`
 * на разных ОС и версиях ICU расставляет регистр и дефисы по-разному, и каталог «дрейфовал» бы
 * от машины к машине).
 */
export function compareCodePoints(a: string, b: string): number {
  if (a === b) return 0;
  const left = a[Symbol.iterator]();
  const right = b[Symbol.iterator]();
  for (;;) {
    const x = left.next();
    const y = right.next();
    if (x.done === true) return y.done === true ? 0 : -1;
    if (y.done === true) return 1;
    const delta = (x.value.codePointAt(0) ?? 0) - (y.value.codePointAt(0) ?? 0);
    if (delta !== 0) return delta < 0 ? -1 : 1;
  }
}
