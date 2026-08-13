/**
 * Дайджест каталога — единственный легальный источник имён компонентов для агента.
 *
 * Смысл ровно в этом: модель не знает вашего кита и по умолчанию выдумывает правдоподобные имена
 * (`TextInput`, `EmailField`). Поэтому имена она обязана БРАТЬ отсюда, а не сочинять, а строгий
 * гейт (`io/validate` с `strict: true`) ловит те случаи, когда она всё же сочинила.
 *
 * Каталог (`getCatalog()`) — это «то, что можно поставить в форму»: записи с `palette: false`
 * отсеиваются на границе источника (`catalog/contract`). Он намеренно у́же множества имён,
 * которые ПРОХОДЯТ валидацию (`knownComponentNames()` добавляет INFRA-имена вроде `List`):
 * вставлять инфраструктурные обёртки агент не должен, а встретить их в чужой схеме — может.
 *
 * @module reformer-builder/agent/core/catalog-digest
 */

import { getCatalog, getCatalogEntry, toInspectorProps, type CatalogRole } from '../../catalog';
import { joinWithinBudget } from './render-budget';

/** Строка списка компонентов. */
export interface ComponentSummary {
  name: string;
  role: CatalogRole;
  category?: string;
}

/** Один проп компонента в дайджесте. */
export interface ComponentProp {
  key: string;
  /** Виджет инспектора — достаточно точный признак типа значения. */
  widget: string;
  /** Допустимые значения, если проп — перечисление. */
  options?: Array<string | number>;
  description?: string;
  default?: unknown;
}

/** Полное описание компонента. */
export interface ComponentDetail extends ComponentSummary {
  props: ComponentProp[];
}

/** Фильтр списка компонентов. */
export interface ListComponentsFilter {
  role?: CatalogRole;
  /** Подстрока имени или категории (регистронезависимо). */
  query?: string;
}

/** Все каталожные имена — для проверок и подсказок. */
export function componentNames(): string[] {
  return getCatalog().map((e) => e.name);
}

/** Компоненты каталога, опционально отфильтрованные. */
export function listComponents(filter?: ListComponentsFilter): ComponentSummary[] {
  const q = filter?.query?.trim().toLowerCase();
  return getCatalog()
    .filter((e) => (filter?.role ? e.role === filter.role : true))
    .filter((e) =>
      q ? e.name.toLowerCase().includes(q) || (e.category ?? '').toLowerCase().includes(q) : true
    )
    .map((e) => ({ name: e.name, role: e.role, ...(e.category ? { category: e.category } : {}) }));
}

/** Описание одного компонента, либо `undefined`, если имени нет в каталоге. */
export function describeComponent(name: string): ComponentDetail | undefined {
  const entry = getCatalogEntry(name);
  if (!entry) return undefined;
  return {
    name: entry.name,
    role: entry.role,
    ...(entry.category ? { category: entry.category } : {}),
    props: toInspectorProps(entry.propsSchema).map((p) => ({
      key: p.key,
      widget: p.widget,
      ...(p.options ? { options: p.options } : {}),
      ...(p.description ? { description: p.description } : {}),
      ...(p.default !== undefined ? { default: p.default } : {}),
    })),
  };
}

/**
 * Список компонентов в текст, сгруппированный по категории. При превышении бюджета обрезается
 * с подсказкой сузить выборку — модель дозапросит с `query`, а не будет считать список полным.
 *
 * Обрезка идёт ПОКОМПОНЕНТНО, а не по границе категории: одна категория крупного кита сама по себе
 * шире любого разумного бюджета, и обрезка «по категориям» его бы просто не соблюдала.
 */
export function renderComponentList(items: readonly ComponentSummary[], budget: number): string {
  if (!items.length) return 'Подходящих компонентов в каталоге нет.';
  const byCategory = new Map<string, ComponentSummary[]>();
  for (const item of items) {
    const key = item.category ?? 'Прочее';
    byCategory.set(key, [...(byCategory.get(key) ?? []), item]);
  }
  const notice = (shown: number) =>
    `… показано ${shown} из ${items.length}; сузь выборку параметром query`;

  const lines: string[] = [];
  let shown = 0;
  for (const [category, list] of byCategory) {
    const chunk: string[] = [];
    let truncated = false;
    for (const item of list) {
      const candidate = [...lines, `${category}: ${[...chunk, label(item)].join(', ')}`];
      const fits = [...candidate, notice(shown)].join('\n').length <= budget;
      if (!fits && shown > 0) {
        truncated = true;
        break;
      }
      chunk.push(label(item));
      shown += 1;
    }
    if (chunk.length) lines.push(`${category}: ${chunk.join(', ')}`);
    if (truncated) {
      lines.push(notice(shown));
      break;
    }
  }
  return lines.join('\n');
}

function label(item: ComponentSummary): string {
  return `${item.name} (${item.role})`;
}

/** Описание компонента в текст. */
export function renderComponentDetail(detail: ComponentDetail, budget: number): string {
  const head = `${detail.name} — роль ${detail.role}${detail.category ? `, категория «${detail.category}»` : ''}`;
  if (!detail.props.length) return `${head}\nНастраиваемых свойств нет.`;
  const propLines = detail.props.map((p) => {
    const bits = [`  ${p.key}: ${p.widget}`];
    if (p.options?.length) bits.push(`= ${p.options.join(' | ')}`);
    if (p.default !== undefined) bits.push(`(по умолчанию ${JSON.stringify(p.default)})`);
    if (p.description) bits.push(`— ${p.description}`);
    return bits.join(' ');
  });
  return joinWithinBudget(
    [head, 'Свойства:'],
    propLines,
    budget,
    (shown, total) => `  … ещё ${total - shown} свойств(а)`
  );
}
