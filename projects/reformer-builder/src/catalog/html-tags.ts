/**
 * Единый источник данных о презентационных `$html(...)`-тегах палитры (спека §5/§6): какой тег
 * рисуем, как он держит содержимое (`container` — children, `text` — текстовый проп, `void` —
 * самозакрывающийся) и какие props редактируются в инспекторе поверх базовых `className`/`text`.
 * Все презентационные теги живут в одном разделе палитры «HTML» (категория назначается в
 * `synthetic-entries`); раздел «Типографика» отведён под ui-kit `Typography*`-компоненты, туда
 * нативные теги не мешаем.
 *
 * Таблица — ОДНО место, откуда и {@link './synthetic-entries'} (записи каталога), и
 * {@link './make-node'} (узел-по-умолчанию для дропа) берут форму тега; раньше список тегов и
 * множество контейнеров дублировались в обоих модулях и расходились. Набор тегов — подмножество
 * `ALLOWED_HTML_TAGS` из `@reformer/renderer-json` (иначе валидатор отвергнет узел); инвариант
 * стережёт `html-tags.test.ts`.
 *
 * @module reformer-builder/catalog/html-tags
 */

import type { PropsSchema } from '@reformer/ui-kit/meta';
import type { PropGroup } from './types';

/** Как тег держит содержимое: контейнер (children) / текстовый / самозакрывающийся. */
export type HtmlContent = 'container' | 'text' | 'void';

/** Описание одного `$html`-тега палитры. */
export interface HtmlTagSpec {
  /** Имя тега (`div`, `h1`, `a`, …) — аргумент оператора `$html(tag)`. */
  tag: string;
  /** Модель содержимого. */
  content: HtmlContent;
  /** Дефолтный `className` узла-по-умолчанию (только для `container`). */
  defaultClass?: string;
  /** Дефолтный текст узла-по-умолчанию (только для `text`). */
  defaultText?: string;
  /** Тег-специфичные props поверх базовых (`className`, и `text` для текстовых). */
  props?: Record<string, PropsSchema>;
}

/** Строковый проп с `x-doc` (виджет — input; для `enum` инспектор сам даёт select). */
function str(group: PropGroup, description?: string): PropsSchema {
  return {
    type: 'string',
    ...(description ? { description } : {}),
    'x-doc': { group, type: 'string' },
  };
}

/** Числовой проп с `x-doc` (виджет — number). */
function num(group: PropGroup, description?: string): PropsSchema {
  return {
    type: 'number',
    ...(description ? { description } : {}),
    'x-doc': { group, type: 'number' },
  };
}

/** Булев проп с `x-doc` (виджет — switch). */
function bool(group: PropGroup, description?: string): PropsSchema {
  return {
    type: 'boolean',
    ...(description ? { description } : {}),
    'x-doc': { group, type: 'boolean' },
  };
}

/** Строковый проп с `enum` (виджет — select по вариантам). */
function choice(group: PropGroup, values: readonly string[], description?: string): PropsSchema {
  return {
    type: 'string',
    enum: [...values],
    ...(description ? { description } : {}),
    'x-doc': { group, type: 'string' },
  };
}

/** Базовый проп `className` — редактор CSS-классов с автодополнением Tailwind (общий для всех тегов). */
const classNameProp: PropsSchema = {
  type: 'string',
  description: 'CSS-класс (Tailwind: flex, grid, gap-*).',
  'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
};

/** Базовый проп `text` — текстовое содержимое (для `content: 'text'`). */
const textProp: PropsSchema = {
  type: 'string',
  description: 'Текстовое содержимое.',
  'x-doc': { group: 'Control', type: 'string' },
};

/**
 * Презентационные теги палитры (все в разделе «HTML»). Порядок = порядок отображения внутри раздела:
 * блоки → заголовки → текст → списки → разделитель/медиа.
 */
export const HTML_TAG_SPECS: readonly HtmlTagSpec[] = [
  // ─── Блоки и структура ───────────────────────────────────────────────────
  { tag: 'div', content: 'container', defaultClass: 'flex gap-4' },
  { tag: 'section', content: 'container', defaultClass: 'space-y-4' },
  { tag: 'article', content: 'container', defaultClass: 'space-y-4' },
  { tag: 'aside', content: 'container', defaultClass: 'space-y-4' },
  { tag: 'header', content: 'container', defaultClass: 'space-y-4' },
  { tag: 'footer', content: 'container', defaultClass: 'space-y-4' },
  { tag: 'nav', content: 'container', defaultClass: 'flex gap-4' },
  { tag: 'main', content: 'container', defaultClass: 'space-y-4' },
  { tag: 'fieldset', content: 'container', defaultClass: 'space-y-4' },

  // ─── Заголовки ───────────────────────────────────────────────────────────
  { tag: 'h1', content: 'text', defaultText: 'Заголовок' },
  { tag: 'h2', content: 'text', defaultText: 'Заголовок' },
  { tag: 'h3', content: 'text', defaultText: 'Заголовок' },
  { tag: 'h4', content: 'text', defaultText: 'Заголовок' },
  { tag: 'h5', content: 'text', defaultText: 'Заголовок' },
  { tag: 'h6', content: 'text', defaultText: 'Заголовок' },

  // ─── Текст ───────────────────────────────────────────────────────────────
  { tag: 'p', content: 'text', defaultText: 'Текст' },
  { tag: 'span', content: 'text', defaultText: 'Текст' },
  { tag: 'strong', content: 'text', defaultText: 'Текст' },
  { tag: 'em', content: 'text', defaultText: 'Текст' },
  { tag: 'small', content: 'text', defaultText: 'Текст' },
  {
    tag: 'blockquote',
    content: 'text',
    defaultText: 'Цитата',
    props: { cite: str('Options', 'URL источника цитаты.') },
  },
  { tag: 'code', content: 'text', defaultText: 'code' },
  { tag: 'pre', content: 'text', defaultText: 'Текст' },
  {
    tag: 'a',
    content: 'text',
    defaultText: 'Ссылка',
    props: {
      href: str('Control', 'URL ссылки.'),
      target: choice('Options', ['_self', '_blank', '_parent', '_top'], 'Где открыть ссылку.'),
      rel: str('Options', 'Отношение (напр. noopener noreferrer).'),
    },
  },
  {
    tag: 'label',
    content: 'text',
    defaultText: 'Подпись',
    props: { htmlFor: str('Options', 'ID связанного поля (атрибут for).') },
  },
  { tag: 'br', content: 'void' },

  // ─── Списки ──────────────────────────────────────────────────────────────
  { tag: 'ul', content: 'container', defaultClass: 'list-disc space-y-1 pl-5' },
  {
    tag: 'ol',
    content: 'container',
    defaultClass: 'list-decimal space-y-1 pl-5',
    props: {
      start: num('Options', 'Начальный номер списка.'),
      reversed: bool('Behavior', 'Обратный порядок нумерации.'),
      type: choice('Options', ['1', 'a', 'A', 'i', 'I'], 'Стиль маркера нумерации.'),
    },
  },
  { tag: 'li', content: 'container' },

  // ─── Разделитель и медиа ─────────────────────────────────────────────────
  { tag: 'hr', content: 'void' },
  {
    tag: 'img',
    content: 'void',
    props: {
      src: str('Control', 'URL изображения.'),
      alt: str('Control', 'Альтернативный текст (доступность).'),
      width: num('Options', 'Ширина, px.'),
      height: num('Options', 'Высота, px.'),
      loading: choice('Behavior', ['lazy', 'eager'], 'Стратегия загрузки.'),
    },
  },
];

const SPEC_BY_TAG: ReadonlyMap<string, HtmlTagSpec> = new Map(
  HTML_TAG_SPECS.map((spec) => [spec.tag, spec])
);

/** Спецификация тега по имени (`div` → {@link HtmlTagSpec}); `undefined` для тега вне палитры. */
export function htmlTagSpec(tag: string): HtmlTagSpec | undefined {
  return SPEC_BY_TAG.get(tag);
}

/**
 * `propsSchema` для инспектора: `className` (всегда) + `text` (для текстовых) + тег-специфичные
 * props из {@link HtmlTagSpec.props}. Порядок ключей = порядок строк инспектора внутри секции.
 */
export function htmlPropsSchema(spec: HtmlTagSpec): PropsSchema {
  const properties: Record<string, PropsSchema> = { className: classNameProp };
  if (spec.content === 'text') properties.text = textProp;
  if (spec.props) Object.assign(properties, spec.props);
  return { type: 'object', properties };
}
