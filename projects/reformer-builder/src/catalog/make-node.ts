/**
 * Фабрики узлов по умолчанию (для дропа из палитры). Реконструируются из `role`+`name` — так
 * каталог-JSON остаётся чисто декларативным (без функций), а билдер восстанавливает `makeNode`
 * (спека §5).
 *
 * @module reformer-builder/catalog/make-node
 */

import type { JsonNode } from '@reformer/renderer-json';
import type { CatalogRole } from './types';
import { htmlTagSpec } from './html-tags';
import { LEAF_COMPONENT_NAMES } from '../model/node-kind';

export function fieldNode(name: string): JsonNode {
  return {
    value: '$model(newField)',
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
  return { component, text: spec.defaultText ?? 'Текст' };
}

/**
 * Узел части compound'а (`AlertTitle`, `CardHeader`, `TableCell`…). Без `className` — раскладку
 * задаёт сама часть (`col-start-2` и т.п.), лишний `space-y-4` её ломает. Текстовым частям кладём
 * `text`, структурным — пустой `children`.
 */
export function partNode(name: string, text?: string): JsonNode {
  const component = `$component(${name})` as `$component(${string})`;
  return text === undefined ? { component, children: [] } : { component, text };
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
            text: 'Вкладка 1',
          },
          {
            component: '$component(TabsTrigger)',
            componentProps: { value: 'tab-2' },
            text: 'Вкладка 2',
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
            children: [{ component: '$component(PaginationLink)', text: '1' }],
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

export function arrayNode(): JsonNode {
  return {
    array: '$model(items)',
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
 * Визард: шаги живут в `componentProps.steps` (НЕ в `children` — иначе drop/insert уходили бы в
 * `children`, а не в слот `steps`). Сеем один шаг, чтобы слот `steps` сразу был активен
 * (`childSlots` показывает его только при непустом `steps`, см. `node-kind`).
 */
export function wizardNode(): JsonNode {
  return {
    component: '$component(Wizard)',
    componentProps: { steps: [stepNode('Шаг 1')] },
  };
}

/**
 * Узел по умолчанию для записи каталога (по `role`/`name`). `compoundParent` приходит из записи
 * каталога (часть compound'а) — по нему узел собирается без `className`-обёртки контейнера.
 */
export function makeNodeFor(name: string, role: CatalogRole, compoundParent?: string): JsonNode {
  if (role === 'array') return arrayNode();
  if (name.startsWith('$html(')) return htmlNodeFor(name);
  if (role === 'field') return fieldNode(name);
  if (name === 'Wizard') return wizardNode();
  if (name === 'Step') return stepNode();
  if (LEAF_COMPONENT_NAMES.has(name)) return leafComponentNode(name);
  // Корень compound'а — сразу собранная композиция; часть — узел без `className` (раскладку задаёт
  // сама часть). Проверяем ДО containerNode, чей `space-y-4` тем и другим только мешает.
  const template = COMPOUND_TEMPLATES[name];
  if (template) return template();
  if (compoundParent) return partNode(name, defaultPartText(name));
  return containerNode(name);
}
