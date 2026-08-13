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

import type { JsonFormSchema } from '@reformer/renderer-json';
import {
  getCatalog,
  getCatalogEntry,
  isCompoundPart,
  makeNodeFor,
  partNamesOf,
  toInspectorProps,
  type CatalogRole,
} from '../../catalog';
import { buildOutline, renderOutline } from './outline';
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
  /** Корень compound'а, частью которого компонент является (`TabsTrigger` → `Tabs`). */
  compoundParent?: string;
  /** Части, из которых компонент собирается при вставке (`Tabs` → `TabsList`, `TabsTrigger`, …). */
  parts?: string[];
  /**
   * Что появится в форме при вставке — дайджест узла-по-умолчанию с ОТНОСИТЕЛЬНЫМИ адресами.
   *
   * Нужен потому, что compound приходит собранным: без этого модель узнаёт состав только постфактум
   * и успевает создать части повторно. Для одиночных компонентов пуст.
   */
  skeleton?: string;
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

/**
 * Компоненты каталога, опционально отфильтрованные.
 *
 * Части compound'ов (`TabsList`, `CardHeader`, `AccordionItem`…) в общий список не попадают — то же
 * правило, что у палитры (`PalettePanel`, `groupByCategory`). Причина не в эстетике: частей в ките
 * больше половины записей, и в бюджет ответа они не пускают поля — модель, спросившая «что есть»,
 * получала список из `TabsTrigger` и `CardFooter`, не видя ни одного `Input`. Вставлять часть
 * отдельно всё равно незачем: она приходит вместе со своим корнем (`makeNodeFor`).
 *
 * Поиском части находятся всегда: имя каждой начинается с имени корня, а категория у неё —
 * категория корня, поэтому `query: 'tabs'` возвращает и `Tabs`, и все его части.
 */
export function listComponents(filter?: ListComponentsFilter): ComponentSummary[] {
  const q = filter?.query?.trim().toLowerCase();
  return getCatalog()
    .filter((e) => (filter?.role ? e.role === filter.role : true))
    .filter((e) => (q ? true : !isCompoundPart(e)))
    .filter((e) =>
      q ? e.name.toLowerCase().includes(q) || (e.category ?? '').toLowerCase().includes(q) : true
    )
    .map((e) => ({ name: e.name, role: e.role, ...(e.category ? { category: e.category } : {}) }));
}

/** Описание одного компонента, либо `undefined`, если имени нет в каталоге. */
export function describeComponent(name: string): ComponentDetail | undefined {
  const entry = getCatalogEntry(name);
  if (!entry) return undefined;
  const parts = partNamesOf(entry.name);
  return {
    name: entry.name,
    role: entry.role,
    ...(entry.category ? { category: entry.category } : {}),
    ...(entry.compoundParent ? { compoundParent: entry.compoundParent } : {}),
    ...(parts.length ? { parts } : {}),
    ...(skeletonOf(entry.name, entry.role, entry.compoundParent) ?? {}),
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
 * Состав узла-по-умолчанию — тем же дайджестом, каким агент видит форму.
 *
 * Строится из `makeNodeFor`, то есть из ТОЙ ЖЕ фабрики, что отработает при вставке: второй
 * источник правды разошёлся бы с первым на первом же изменении шаблона.
 */
function skeletonOf(
  name: string,
  role: CatalogRole,
  compoundParent?: string
): { skeleton: string } | undefined {
  const node = makeNodeFor(name, role, compoundParent);
  const inside = buildOutline({ version: '1.0', root: node } as JsonFormSchema).slice(1);
  if (!inside.length) return undefined;
  return {
    skeleton: renderOutline(
      // Адрес печатается СУФФИКСОМ (`/children/0`), а не от корня: приклеив его к адресу, который
      // вернёт insert_node, модель получает готовый указатель на часть. Полный путь с `/root`
      // читался бы как адрес в текущей форме — и увёл бы правку в чужой узел.
      inside.map((e) => ({ ...e, ref: e.ref.slice('/root'.length), depth: e.depth - 1 })),
      SKELETON_BUDGET
    ),
  };
}

/** Сколько символов отдаётся под состав вставки: это подсказка, а не карта формы. */
const SKELETON_BUDGET = 400;

/**
 * Список компонентов в текст, сгруппированный по категории. При превышении бюджета обрезается
 * с подсказкой сузить выборку — модель дозапросит с `query`, а не будет считать список полным.
 *
 * Обрезка идёт ПОКОМПОНЕНТНО, а не по границе категории: одна категория крупного кита сама по себе
 * шире любого разумного бюджета, и обрезка «по категориям» его бы просто не соблюдала.
 */
export function renderComponentList(items: readonly ComponentSummary[], budget: number): string {
  if (!items.length) return 'No matching components in the catalog.';
  const byCategory = new Map<string, ComponentSummary[]>();
  for (const item of items) {
    // Названия категорий приходят из каталога кита — это данные дизайн-системы, а не наш текст,
    // поэтому они остаются на языке кита. Переводить их значило бы врать про то, что в нём лежит.
    const key = item.category ?? 'Other';
    byCategory.set(key, [...(byCategory.get(key) ?? []), item]);
  }
  const notice = (shown: number) => `… showing ${shown} of ${items.length}; narrow it with query`;

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

/**
 * Строки о структуре компонента: чья он часть и что принесёт с собой.
 *
 * Идут перед свойствами, потому что отвечают на вопрос «куда это вставлять и надо ли собирать
 * руками» — без них `Wizard` описывался одним `className`, и состав узнавался только по факту.
 */
function structureLines(detail: ComponentDetail): string[] {
  const lines: string[] = [];
  if (detail.compoundParent) {
    lines.push(`Part of ${detail.compoundParent} — inserted together with it.`);
  }
  if (detail.parts?.length) {
    lines.push(`Assembled from parts: ${detail.parts.join(', ')} — created automatically.`);
  }
  if (detail.skeleton) {
    lines.push(
      "On insert you get (a part's address = address of the new node + the suffix shown):",
      detail.skeleton
    );
  }
  return lines;
}

/** Описание компонента в текст. */
export function renderComponentDetail(detail: ComponentDetail, budget: number): string {
  const headline = `${detail.name} — role ${detail.role}${detail.category ? `, category «${detail.category}»` : ''}`;
  const head = [headline, ...structureLines(detail)].join('\n');
  if (!detail.props.length) return `${head}\nNo configurable properties.`;
  const propLines = detail.props.map((p) => {
    const bits = [`  ${p.key}: ${p.widget}`];
    if (p.options?.length) bits.push(`= ${p.options.join(' | ')}`);
    if (p.default !== undefined) bits.push(`(default ${JSON.stringify(p.default)})`);
    // Описание пропа — текст props-схемы кита; он на языке кита и переводу здесь не подлежит.
    if (p.description) bits.push(`— ${p.description}`);
    return bits.join(' ');
  });
  return joinWithinBudget(
    [head, 'Properties:'],
    propLines,
    budget,
    (shown, total) => `  … ${total - shown} more propert(ies)`
  );
}
