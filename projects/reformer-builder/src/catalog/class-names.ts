/**
 * Словарь CSS-классов активного кита для редактора `className` в инспекторе.
 *
 * Источник — блок `kit.styles.classNames` каталога (см. `@reformer/ui-kit`
 * `src/styles/class-catalog.ts`). Своего списка билдер НЕ держит: имена семантических токенов
 * (`bg-muted`, `text-foreground`) знает только дизайн-система, а для кита со `styles.mode:
 * 'standalone'` Tailwind-подсказки были бы просто неверны. Кит словаря не прислал — подсказок нет,
 * поле остаётся обычным свободным вводом.
 *
 * Кит может ограничить, ЧЕМ разрешено стилизовать конкретный компонент (`classGroups` записи или
 * `classGroupsByRole`): типовой случай — полю формы доступны только отступы, потому что его вид
 * задаёт дизайн-система. Разрешение уже посчитано в `kits/descriptor` и лежит в
 * `KitDescriptor.classGroupPolicy`.
 *
 * @module reformer-builder/catalog/class-names
 */

import { getActiveDescriptor } from '../kits/active';
import { getCatalog } from './index';

/** Мемо по имени компонента: словарь и политика на время жизни модуля неизменны (см. ниже). */
const cache = new Map<string, string[]>();

/**
 * Ключ мемо для словаря БЕЗ сужения политикой ({@link knownClassNames}). Скобки делают его
 * недостижимым для имени компонента — те приходят из каталога и скобок не содержат.
 */
const ALL_CLASSES_KEY = '(all)';

/**
 * Классы, которыми кит разрешает стилизовать компонент: плоский список в курируемом порядке групп,
 * дубли между группами схлопнуты (класс — React-ключ в выпадашке).
 *
 * Пустой список означает «подсказывать нечего» — и когда кит словаря не прислал, и когда он явно
 * запретил все группы (`classGroups: []`). Для поля это одно и то же: оно остаётся свободным вводом.
 */
export function classNamesFor(componentName: string): string[] {
  const hit = cache.get(componentName);
  if (hit) return hit;

  // Дескриптор кладёт сборка каталога, а до неё работает фолбэк на дефолты билдера — у него
  // словаря нет. Вызов гарантирует, что читаем уже настоящий дескриптор (мемо: второй раз каталог
  // не строится). Тот же приём, что в `catalog/compound`.
  getCatalog();
  const { styles, classGroupPolicy } = getActiveDescriptor();
  const allowed = classGroupPolicy.get(componentName);
  const groups = allowed ? styles.classNames.filter((g) => allowed.has(g.id)) : styles.classNames;

  const flat = Array.from(new Set(groups.flatMap((g) => g.classes)));
  cache.set(componentName, flat);
  return flat;
}

/**
 * ВЕСЬ словарь активного кита, без сужения политикой групп — «что кит вообще умеет отрисовать».
 *
 * Отличие от {@link classNamesFor} существенно: та отвечает на вопрос «что ПРЕДЛАГАТЬ для этого
 * компонента» (полю формы — только отступы), а этот — «какие классы точно попадут в CSS». Словарь
 * уезжает в safelist сборки (`scripts/gen-kit-safelist.mjs`), поэтому он же и есть список
 * гарантированно живых классов; всё вне его Tailwind сгенерирует, только если встретил в коде.
 *
 * Пустой список = кит словаря не прислал; тогда проверять нечего (см. {@link unknownClasses}).
 */
export function knownClassNames(): string[] {
  const hit = cache.get(ALL_CLASSES_KEY);
  if (hit) return hit;

  getCatalog();
  const flat = Array.from(
    new Set(getActiveDescriptor().styles.classNames.flatMap((g) => g.classes))
  );
  cache.set(ALL_CLASSES_KEY, flat);
  return flat;
}

/**
 * Классы значения, которых нет в словаре кита — кандидаты «не отрисуется в превью». Порядок
 * сохраняется, дубли схлопнуты.
 *
 * Это ПОДСКАЗКА, а не запрет: класс вне словаря работает, если встречается в исходниках билдера
 * или кита (`sm:max-w-lg` из компонентов кита — рабочий), а произвольные значения
 * (`grid-cols-[1fr_2fr]`) словарём не покрываются в принципе. Поэтому формулировка в UI —
 * «может не отрисоваться», и ввод остаётся свободным.
 *
 * Пустой словарь (кит его не прислал) отключает проверку целиком: иначе инспектор пометил бы
 * подозрительным вообще всё.
 */
export function unknownClasses(all: readonly string[], value: string): string[] {
  if (!all.length) return [];
  const known = new Set(all);
  return Array.from(new Set(value.split(/\s+/).filter(Boolean))).filter((t) => !known.has(t));
}

/**
 * Подсказки по токену под кареткой: подстрочный фильтр минус уже использованные классы.
 * Пустой токен списка не даёт — иначе выпадашка открывалась бы на каждый фокус пустого поля.
 *
 * Вынесено из компонента, чтобы поведение покрывалось node-тестом (jsdom в билдере не настроен).
 */
export function suggestClasses(
  all: readonly string[],
  token: string,
  used: ReadonlySet<string>,
  limit: number
): string[] {
  const needle = token.toLowerCase();
  if (!needle) return [];
  const out: string[] = [];
  for (const c of all) {
    // `c === token` оставляет в списке класс, который пользователь дописывает прямо сейчас.
    if (c.toLowerCase().includes(needle) && (c === token || !used.has(c))) out.push(c);
    if (out.length === limit) break;
  }
  return out;
}

/**
 * Сбросить мемо. В рантайме не нужен: смена кита идёт перезагрузкой страницы (см. `kits/selection`),
 * поэтому словарь на время жизни модуля неизменен. Нужен тестам, подменяющим активный дескриптор.
 */
export function resetClassNamesCache(): void {
  cache.clear();
}
