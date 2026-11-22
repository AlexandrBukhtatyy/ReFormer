/**
 * Фабрики узлов по умолчанию (для дропа из палитры). Реконструируются из `role`+`name` — так
 * каталог-JSON остаётся чисто декларативным (без функций), а билдер восстанавливает `makeNode`
 * (спека §5).
 *
 * @module plugins/reformer/core/catalog/make-node
 */

import { parseOperator, type JsonNode } from '@reformer/renderer-json';
import type { CatalogRole } from './types';
import { htmlTagSpec } from './html-tags';
import { LEAF_COMPONENT_NAMES } from '../kits/defaults';

/**
 * Ритм корня формы, которую собирает сам билдер, — затравки встроенных шаблонов.
 *
 * Здесь, а не у затравок, по той же причине, что `defaultClass` тегов: класс попадает в превью
 * ДАННЫМИ, а не разметкой плагина, и правило для него везёт таблица стилей превью, которая
 * сканирует ядро (`--with ../core`).
 */
export const FORM_ROOT_CLASS = 'space-y-6';

export function fieldNode(name: string): JsonNode {
  return {
    model: '$model(newField)',
    component: `$component(${name})`,
    componentProps: { label: name },
  };
}

export function containerNode(name: string): JsonNode {
  return {
    component: `$component(${name})`,
    componentProps: { className: 'space-y-4' },
    children: [],
  };
}

/** Листовой компонент (Icon/Separator/…): самодостаточный визуал, без `children`. */
export function leafComponentNode(name: string): JsonNode {
  return {
    component: `$component(${name})`,
    componentProps: {},
  };
}

export function htmlNodeFor(name: string): JsonNode {
  const tag = name.slice('$html('.length, -1); // '$html(div)' → 'div'
  const component = `$html(${tag})` as `$html(${string})`;
  const spec = htmlTagSpec(tag);
  // Неизвестный тег трактуем как контейнер (безопасный дефолт — можно вкладывать детей).
  if (!spec || spec.content === 'container') {
    const componentProps = spec?.defaultClass ? { className: spec.defaultClass } : {};
    return { component, componentProps, children: [] };
  }
  if (spec.content === 'void') return { component, componentProps: {} };
  return { component, children: [spec.defaultText ?? 'Текст'] };
}

/**
 * Узел части compound'а (`AlertTitle`, `CardHeader`, `TableCell`…). Без `className` — раскладку
 * задаёт сама часть (`col-start-2` и т.п.), лишний `space-y-4` её ломает. Текстовым частям кладём
 * в `children` заготовку текста, структурным — пустой `children`.
 */
export function partNode(name: string, text?: string): JsonNode {
  const component = `$component(${name})` as `$component(${string})`;
  return { component, children: text === undefined ? [] : [text] };
}

/**
 * Суффиксы частей, чей визуал — это их собственный текст (`AlertTitle`, `TableCell`, `BreadcrumbLink`).
 * Такой части при дропе кладём заготовку текста, иначе на canvas появится пустое место.
 */
const TEXTUAL_PART_SUFFIXES = [
  'Title',
  'Description',
  'Text',
  'Trigger',
  'Link',
  'Page',
  'Caption',
  'Head',
  'Cell',
  'Fallback',
];

/** Заготовка текста для части (по суффиксу имени); структурным частям — `undefined`. */
function defaultPartText(name: string): string | undefined {
  return TEXTUAL_PART_SUFFIXES.some((s) => name.endsWith(s)) ? 'Текст' : undefined;
}

/**
 * Композиции compound-компонентов по умолчанию: корень собирается ТОЛЬКО из своих частей, поэтому
 * дроп из палитры сразу даёт рабочий вид, а не пустой контейнер, в который нечего положить.
 *
 * Это же множество отвечает на вопрос «можно ли узлу задать голый текст»: у корня из этого списка
 * содержимое живёт в частях (см. `hasCompoundTemplate` и секцию «Содержимое» инспектора). Пример
 * цены ошибки — `Alert`: его корень `grid grid-cols-[0_1fr]`, голый текст падает анонимным grid item
 * в колонку нулевой ширины и печатается по одному слову в строке.
 *
 * Обязательные пропсы частей (Radix-`value` у Tabs/Accordion) задаются здесь же — иначе компонент
 * не работает сразу после дропа.
 */
export const COMPOUND_TEMPLATES: Record<string, () => JsonNode> = {
  Alert: () => ({
    component: '$component(Alert)',
    children: [partNode('AlertTitle', 'Заголовок'), partNode('AlertDescription', 'Описание')],
  }),
  Card: () => ({
    component: '$component(Card)',
    children: [
      {
        component: '$component(CardHeader)',
        children: [partNode('CardTitle', 'Заголовок'), partNode('CardDescription', 'Описание')],
      },
      partNode('CardContent'),
      partNode('CardFooter'),
    ],
  }),
  Accordion: () => ({
    component: '$component(Accordion)',
    componentProps: { type: 'single', collapsible: true },
    children: [
      {
        component: '$component(AccordionItem)',
        componentProps: { value: 'item-1' },
        children: [partNode('AccordionTrigger', 'Секция 1'), partNode('AccordionContent')],
      },
    ],
  }),
  Tabs: () => ({
    component: '$component(Tabs)',
    componentProps: { defaultValue: 'tab-1' },
    children: [
      {
        component: '$component(TabsList)',
        children: [
          {
            component: '$component(TabsTrigger)',
            componentProps: { value: 'tab-1' },
            children: ['Вкладка 1'],
          },
          {
            component: '$component(TabsTrigger)',
            componentProps: { value: 'tab-2' },
            children: ['Вкладка 2'],
          },
        ],
      },
      { component: '$component(TabsContent)', componentProps: { value: 'tab-1' }, children: [] },
      { component: '$component(TabsContent)', componentProps: { value: 'tab-2' }, children: [] },
    ],
  }),
  Table: () => ({
    component: '$component(Table)',
    children: [
      {
        component: '$component(TableHeader)',
        children: [
          {
            component: '$component(TableRow)',
            children: [partNode('TableHead', 'Колонка 1'), partNode('TableHead', 'Колонка 2')],
          },
        ],
      },
      {
        component: '$component(TableBody)',
        children: [
          {
            component: '$component(TableRow)',
            children: [partNode('TableCell', 'Значение 1'), partNode('TableCell', 'Значение 2')],
          },
        ],
      },
    ],
  }),
  Breadcrumb: () => ({
    component: '$component(Breadcrumb)',
    children: [
      {
        component: '$component(BreadcrumbList)',
        children: [
          {
            component: '$component(BreadcrumbItem)',
            children: [partNode('BreadcrumbLink', 'Главная')],
          },
          partNode('BreadcrumbSeparator'),
          {
            component: '$component(BreadcrumbItem)',
            children: [partNode('BreadcrumbPage', 'Текущая страница')],
          },
        ],
      },
    ],
  }),
  Empty: () => ({
    component: '$component(Empty)',
    children: [
      {
        component: '$component(EmptyHeader)',
        children: [
          partNode('EmptyTitle', 'Нет данных'),
          partNode('EmptyDescription', 'Здесь пока пусто'),
        ],
      },
      partNode('EmptyContent'),
    ],
  }),
  Item: () => ({
    component: '$component(Item)',
    children: [
      {
        component: '$component(ItemContent)',
        children: [partNode('ItemTitle', 'Заголовок'), partNode('ItemDescription', 'Описание')],
      },
      partNode('ItemActions'),
    ],
  }),
  InputGroup: () => ({
    component: '$component(InputGroup)',
    children: [
      {
        component: '$component(InputGroupAddon)',
        componentProps: { align: 'inline-start' },
        children: [],
      },
      partNode('InputGroupInput'),
    ],
  }),
  Pagination: () => ({
    component: '$component(Pagination)',
    children: [
      {
        component: '$component(PaginationContent)',
        children: [
          { component: '$component(PaginationItem)', children: [partNode('PaginationPrevious')] },
          {
            component: '$component(PaginationItem)',
            children: [{ component: '$component(PaginationLink)', children: ['1'] }],
          },
          { component: '$component(PaginationItem)', children: [partNode('PaginationNext')] },
        ],
      },
    ],
  }),
  Avatar: () => ({
    component: '$component(Avatar)',
    children: [partNode('AvatarImage'), partNode('AvatarFallback', 'ИИ')],
  }),
  Message: () => ({
    component: '$component(Message)',
    children: [partNode('MessageAvatar'), partNode('MessageContent', 'Текст сообщения')],
  }),
  Bubble: () => ({
    component: '$component(Bubble)',
    children: [partNode('BubbleContent', 'Текст сообщения')],
  }),
  Collapsible: () => ({
    component: '$component(Collapsible)',
    children: [partNode('CollapsibleTrigger', 'Показать'), partNode('CollapsibleContent')],
  }),
  Carousel: () => ({
    component: '$component(Carousel)',
    children: [
      { component: '$component(CarouselContent)', children: [partNode('CarouselItem')] },
      partNode('CarouselPrevious'),
      partNode('CarouselNext'),
    ],
  }),
};

/** Собирается ли компонент из частей (есть композиция по умолчанию) — значит голого текста не держит. */
export function hasCompoundTemplate(name: string): boolean {
  return Object.hasOwn(COMPOUND_TEMPLATES, name);
}

/** Все `$component`-имена дерева шаблона — корень первым, затем потомки в порядке обхода. */
export function templateComponentNames(node: JsonNode): string[] {
  const self = parseOperator((node as { component?: unknown }).component);
  // Текстовые дети (`'Вкладка 1'`) ни компонента, ни своих детей не несут — дают пустой список.
  const children = ((node as { children?: JsonNode[] }).children ?? []).flatMap(
    templateComponentNames
  );
  return self?.op === 'component' ? [self.arg, ...children] : children;
}

/** Запись каталога глазами шаблонов: имя и корень compound'а, частью которого она объявлена. */
export interface CompoundRecord {
  readonly name: string;
  readonly compoundParent?: string;
}

/**
 * Композиции из {@link COMPOUND_TEMPLATES}, которые кит способен собрать из своих частей.
 *
 * Шаблоны билдера написаны по частям ui-kit: `Card` — из `CardHeader`/`CardContent`/…, `Alert` —
 * из `AlertTitle`/`AlertDescription`. У другого кита корень с тем же именем бывает, а частей нет
 * (у HexaUI `Card` без `CardHeader`), и дроп вставлял бы ссылки на компоненты, которых в ките нет:
 * в превью — заглушки, в реестре модуля — импорты несуществующих символов. Поэтому шаблон
 * остаётся, только если его корень есть в каталоге и КАЖДАЯ часть шаблона — запись с
 * `compoundParent === корень`; иначе корень вставляется обычным контейнером.
 *
 * Сверка по `compoundParent`, а не по одному имени: одноимённая запись, которую кит частью этого
 * корня не объявил, — другой компонент, и раскладки шаблона она не обещает.
 *
 * @param records - Записи каталога кита (обычно склеенного с синтетикой билдера).
 */
export function compoundTemplatesFor(
  records: readonly CompoundRecord[]
): Record<string, () => JsonNode> {
  const parentOf = new Map(records.map((record) => [record.name, record.compoundParent]));
  const out: Record<string, () => JsonNode> = {};
  for (const [root, make] of Object.entries(COMPOUND_TEMPLATES)) {
    if (!parentOf.has(root)) continue;
    const [, ...parts] = templateComponentNames(make());
    if (parts.every((part) => parentOf.get(part) === root)) out[root] = make;
  }
  return out;
}

/**
 * Узел-массив по умолчанию.
 *
 * @param component - Компонент кита, которым массив рисуется (`FieldArray`). Без `component`
 *   рендерер кладёт строки одну за другой — без заголовка и без кнопок «добавить» / «удалить»:
 *   форма с таким массивом выглядит недоделанной, а человек не понимает, чего ей не хватает.
 *   Поэтому компонент ставится сразу, если кит его поставляет; у кита без такого компонента
 *   узел остаётся без него — ссылка на несуществующий компонент дала бы заглушку вместо строк.
 */
export function arrayNode(component?: string): JsonNode {
  return {
    model: '$model(items)',
    ...(component === undefined ? {} : { component: `$component(${component})` as const }),
    item: {
      $template: {
        component: '$component(Box)',
        componentProps: { className: 'space-y-3' },
        children: [],
      },
    },
    componentProps: { addButtonLabel: '+ Добавить элемент' },
  };
}

/** Шаг визарда: контейнер `$component(Step)` с подписью и телом (`children`). */
export function stepNode(title = 'Шаг'): JsonNode {
  return {
    component: '$component(Step)',
    componentProps: { title },
    children: [],
  };
}

/**
 * Визард: шаги — его `children`, и для `childSlots` это слот шагов (см. `node-kind`). Сеем один
 * шаг: визард без шагов рисовать нечем, и первым делом человек всё равно его добавит.
 */
export function wizardNode(): JsonNode {
  return {
    component: '$component(Wizard)',
    children: [stepNode('Шаг 1')],
  };
}

/**
 * Часть дескриптора кита, от которой зависит узел-по-умолчанию.
 *
 * В v1 обе величины брались из `getActiveDescriptor()` — из СОСТОЯНИЯ «какой кит активен сейчас».
 * В v2 это состояние живёт сервисом плагина (`plugins/forms/kits/`), домену не видно, поэтому оно
 * приходит ПАРАМЕТРОМ. Тот же шов, что и у `form-model/node-kind.isLeafComponentRef`; без
 * параметра действуют запасные значения стека (`kits/defaults`) — листья встроенного кита.
 */
export interface MakeNodeKit {
  /** Листья кита; по умолчанию — {@link LEAF_COMPONENT_NAMES}. */
  leafComponents?: ReadonlySet<string>;
  /**
   * Композиции compound'ов, которые кит способен собрать ({@link compoundTemplatesFor});
   * `undefined` — все встроенные {@link COMPOUND_TEMPLATES} (вызов без кита).
   */
  compoundTemplates?: Record<string, () => JsonNode>;
  /**
   * Компонент кита, которым рисуется массив; `undefined` — кит его не поставляет, и узел-массив
   * создаётся без `component` (см. {@link arrayNode}).
   */
  arrayComponent?: string;
}

/**
 * Узел по умолчанию для записи каталога (по `role`/`name`). `compoundParent` приходит из записи
 * каталога (часть compound'а) — по нему узел собирается без `className`-обёртки контейнера.
 *
 * @param kit - Листья и композиции активного кита (см. {@link MakeNodeKit}).
 */
export function makeNodeFor(
  name: string,
  role: CatalogRole,
  compoundParent?: string,
  kit?: MakeNodeKit
): JsonNode {
  if (role === 'array') return arrayNode(kit?.arrayComponent);
  if (name.startsWith('$html(')) return htmlNodeFor(name);
  if (role === 'field') return fieldNode(name);
  if (name === 'Wizard') return wizardNode();
  if (name === 'Step') return stepNode();
  if ((kit?.leafComponents ?? LEAF_COMPONENT_NAMES).has(name)) return leafComponentNode(name);
  // Корень compound'а — сразу собранная композиция; часть — узел без `className` (раскладку задаёт
  // сама часть). Проверяем ДО containerNode, чей `space-y-4` тем и другим только мешает.
  // Композиции приходят от кита (те встроенные, что он способен собрать); `undefined` — все
  // встроенные шаблоны билдера. Корень без шаблона ниже становится обычным контейнером.
  const template = (kit?.compoundTemplates ?? COMPOUND_TEMPLATES)[name];
  if (template) return template();
  if (compoundParent) return partNode(name, defaultPartText(name));
  return containerNode(name);
}
