/**
 * Имя папки шага визарда: `kebab(заголовка)`, «Контакты» → `kontakty`.
 *
 * Живёт в модели формы, а не в кодогене: папку шагу выбирают двое — кодоген (где печатать код
 * шага) и разбиение схемы (куда положить `form.schema.json` шага), и ответ у них обязан совпадать.
 *
 * Номера в имени нет намеренно — порядок шагов задаёт `steps/index.ts`, поэтому перестановка
 * шагов не переименовывает папки. Заголовок-оператор (`$i18n(...)`) или пустой — селектор шага
 * без `-section`, иначе `step-<N>`. Совпадения разводит вызывающий суффиксом: `kontakty-2`.
 *
 * @module @reformer/builder-stack-reformer/form-model/step-dir
 */

import { kebab } from '@reformer/builder-toolkit';

/** Предел длины имени папки шага. */
const DIR_LIMIT = 32;

/**
 * Заголовок-оператор (`$i18n(...)`, `$model(...)`) словами не является.
 *
 * По форме `$имя(...)`, а не `parseOperator`: тот знает только операторы рендерера, а заголовок
 * бывает и под оператором приложения (`$i18n`) — из него вышло бы имя папки `i18nstepscontacts`.
 */
export function isOperatorText(value: string): boolean {
  return /^\$[A-Za-z_]\w*\(.*\)$/s.test(value.trim());
}

/** Обрезать kebab-имя по границе слова. */
function clip(slug: string): string {
  if (slug.length <= DIR_LIMIT) return slug;
  const cut = slug.slice(0, DIR_LIMIT);
  const dash = cut.lastIndexOf('-');
  return (dash > 0 ? cut.slice(0, dash) : cut).replace(/-+$/, '');
}

/**
 * Имя папки шага БЕЗ учёта соседей: по заголовку, иначе по селектору, иначе по номеру.
 *
 * @param index - Номер шага, с единицы.
 * @param title - `componentProps.title` шага.
 * @param selector - Селектор узла шага.
 */
export function stepDirName(index: number, title: unknown, selector: string | null): string {
  if (typeof title === 'string' && title.trim() !== '' && !isOperatorText(title)) {
    const slug = clip(kebab(title));
    if (slug !== '') return slug;
  }
  if (selector !== null) {
    const slug = clip(kebab(selector.replace(/-section$/, '')));
    if (slug !== '') return slug;
  }
  return `step-${index}`;
}

/**
 * Имя, свободное среди занятых: `base`, `base-2`, `base-3`… Найденное сразу занимается.
 *
 * @param base - Желаемое имя.
 * @param taken - Занятые имена; пополняется.
 */
export function uniqueStepDir(base: string, taken: Set<string>): string {
  let dir = base;
  let n = 2;
  while (taken.has(dir)) {
    dir = `${base}-${n}`;
    n += 1;
  }
  taken.add(dir);
  return dir;
}
