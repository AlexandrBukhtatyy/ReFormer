/**
 * Дайджест каталога — единственный легальный источник имён компонентов для агента.
 *
 * Смысл ровно в этом: модель не знает вашего кита и по умолчанию выдумывает правдоподобные имена
 * (`TextInput`, `EmailField`). Поэтому имена она обязана БРАТЬ отсюда, а не сочинять, а строгий
 * гейт (`core/validate` с `strict: true`) ловит те случаи, когда она всё же сочинила.
 *
 * Каталог — это «то, что можно поставить в форму»: записи с `palette: false` отсеиваются на
 * границе источника (`lib/catalog/contract`). Он намеренно у́же множества имён, которые ПРОХОДЯТ
 * валидацию (строгий гейт добавляет к нему INFRA-имена вроде `List`): вставлять инфраструктурные
 * обёртки агент не должен, а встретить их в чужой схеме — может.
 *
 * Каталог приходит ПАРАМЕТРОМ, а не читается синглтоном, как в v1: см. `ToolContext.catalog`.
 *
 * @module plugins/ai/core/catalog-digest
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import { isCompoundPart, partNamesOf } from '@/lib/catalog/compound';
import { makeNodeFor } from '@/lib/catalog/make-node';
import type { CatalogEntry, CatalogRole } from '@/lib/catalog/types';
import { toInspectorProps } from '@/lib/catalog/widgets';
import { buildOutline, renderOutline } from './outline';
import { joinWithinBudget } from './render-budget';

/** Каталог активного кита — то же значение, что лежит в `ToolContext.catalog`. */
export type Catalog = readonly CatalogEntry[];

/** Запись каталога по имени компонента; `undefined` — имени в каталоге нет. */
export function catalogEntry(catalog: Catalog, name: string): CatalogEntry | undefined {
  return catalog.find((e) => e.name === name);
}

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
export function componentNames(catalog: Catalog): string[] {
  return catalog.map((e) => e.name);
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
export function listComponents(
  catalog: Catalog,
  filter?: ListComponentsFilter
): ComponentSummary[] {
  const q = filter?.query?.trim().toLowerCase();
  return catalog
    .filter((e) => (filter?.role ? e.role === filter.role : true))
    .filter((e) => (q ? true : !isCompoundPart(e)))
    .filter((e) =>
      q ? e.name.toLowerCase().includes(q) || (e.category ?? '').toLowerCase().includes(q) : true
    )
    .map((e) => ({ name: e.name, role: e.role, ...(e.category ? { category: e.category } : {}) }));
}

/**
 * Свойства, которые есть у ВСЕХ компонентов роли.
 *
 * Нужны системному промпту: правило «проверь имя свойства через describe_component» стоит целого
 * обхода «модель → инструмент → модель» ради `label` и `required`, которые есть у каждого поля
 * любого кита. Пересечение считается по каталогу, а не задаётся списком, — иначе на первом же
 * новом ките промпт начал бы обещать свойства, которых там нет.
 *
 * Порядок — как в props-схеме первого компонента роли: стабильный, чтобы промпт не менялся между
 * запусками и не сбрасывал кэш префикса.
 */
export function commonProps(catalog: Catalog, role: CatalogRole): string[] {
  const entries = catalog.filter((e) => e.role === role && !isCompoundPart(e));
  if (!entries.length) return [];
  const keySets = entries.map((e) => new Set(toInspectorProps(e.propsSchema).map((p) => p.key)));
  return toInspectorProps(entries[0].propsSchema)
    .map((p) => p.key)
    .filter((key) => keySets.every((keys) => keys.has(key)));
}

/** Описание одного компонента, либо `undefined`, если имени нет в каталоге. */
export function describeComponent(catalog: Catalog, name: string): ComponentDetail | undefined {
  const entry = catalogEntry(catalog, name);
  if (!entry) return undefined;
  const parts = partNamesOf(catalog, entry.name);
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
 * Сколько записей неполевой категории берётся за один круг обхода.
 *
 * Мало намеренно: круг должен успеть дойти до последней категории в пределах бюджета, иначе
 * малочисленные, но незаменимые категории («Мастер» из `Wizard` и `Step») не показываются вовсе.
 */
const CATEGORY_QUOTA = 3;

/** Есть ли в категории то, ради чего форму заполняют, — поля ввода или массивы. */
function holdsInput(items: readonly ComponentSummary[]): boolean {
  return items.some((i) => i.role === 'field' || i.role === 'array');
}

/**
 * Категории в порядке полезности агенту: сперва те, где лежат поля ввода и массивы.
 *
 * Порядок не косметический. Каталог кита алфавитный, категории до правки шли в порядке появления,
 * и «Контейнеры» с «Отображением» съедали весь бюджет ответа: из шестнадцати полей боевого кита до
 * модели доходило ОДНО, а `Wizard`, `Step` и `FormArray` не доходили вовсе. Модель, спросившая «что
 * есть», не видела ни `Input`, ни `Select` — и либо звала список повторно с `query`, либо выдумывала
 * имя, которое отвергал гейт. И то и другое стоит целого обхода «модель → инструмент → модель».
 *
 * Признак — роль записи, а не имя категории: список меток свой у каждого кита, и захардкоженный
 * порядок разошёлся бы с ним на первом же новом ките.
 */
function orderedCategories(byCategory: ReadonlyMap<string, ComponentSummary[]>): string[] {
  const keys = [...byCategory.keys()];
  const input = (c: string) => holdsInput(byCategory.get(c) ?? []);
  return [...keys.filter(input), ...keys.filter((c) => !input(c))];
}

/**
 * Порядок отбора записей: круговой обход категорий, пока они не кончатся.
 *
 * Полевые категории отдаются целиком в первый же круг: полей во всём ките пара десятков, стоят они
 * сотни символов, а заменить их нечем — форма без полей бессмысленна. Неполевым достаётся квота,
 * потому что контейнеров сотня и модели нужнее знать, что категория существует и что примерно в
 * ней лежит, чем получить её исчерпывающий перечень.
 */
function* pickOrder(
  categories: readonly string[],
  byCategory: ReadonlyMap<string, ComponentSummary[]>
): Generator<ComponentSummary> {
  const taken = new Map<string, number>(categories.map((c) => [c, 0]));
  for (let progressed = true; progressed; ) {
    progressed = false;
    for (const category of categories) {
      const list = byCategory.get(category) ?? [];
      const from = taken.get(category) ?? 0;
      if (from >= list.length) continue;
      const slice = list.slice(from, from + (holdsInput(list) ? list.length : CATEGORY_QUOTA));
      taken.set(category, from + slice.length);
      progressed = true;
      yield* slice;
    }
  }
}

/** Выбранное — в строки, по строке на категорию, в порядке приоритета. */
function renderChosen(
  categories: readonly string[],
  chosen: ReadonlyMap<string, ComponentSummary[]>
): string[] {
  return categories
    .filter((c) => chosen.has(c))
    .map((c) => `${c}: ${(chosen.get(c) ?? []).map(label).join(', ')}`);
}

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
  const categories = orderedCategories(byCategory);
  const notice = (shown: number) => `… showing ${shown} of ${items.length}; narrow it with query`;

  const chosen = new Map<string, ComponentSummary[]>();
  let shown = 0;
  for (const item of pickOrder(categories, byCategory)) {
    const key = item.category ?? 'Other';
    const candidate = new Map(chosen).set(key, [...(chosen.get(key) ?? []), item]);
    const fits =
      [...renderChosen(categories, candidate), notice(shown + 1)].join('\n').length <= budget;
    // Первая запись показывается даже при заведомо тесном бюджете: список из одной подсказки
    // «сузьте выборку» не помогает никому.
    if (!fits && shown > 0) {
      return [...renderChosen(categories, chosen), notice(shown)].join('\n');
    }
    chosen.set(key, candidate.get(key) as ComponentSummary[]);
    shown += 1;
  }
  return renderChosen(categories, chosen).join('\n');
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
