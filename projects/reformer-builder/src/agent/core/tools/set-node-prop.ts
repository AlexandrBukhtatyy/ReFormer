/**
 * `set_node_prop` — задать или убрать одно свойство компонента.
 *
 * Ключ `text` — особый: содержимое узла (подпись вкладки, текст кнопки, заголовок) живёт не в
 * `componentProps`, а текстовой частью в `children`, и рендерер берёт его только оттуда. Инспектор
 * это уже знает — он правит содержимое через `setTextChild` и намеренно прячет проп `text` из
 * props-схемы, чтобы не появилось второе поле, пишущее не туда. Агент ходит тем же путём: иначе
 * переименовать вкладку ему было бы нечем, а `set_node_prop(key: 'text')` тихо писал бы значение в
 * место, которого никто не читает.
 *
 * @module reformer-builder/agent/core/tools/set-node-prop
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { getCatalogEntry, toInspectorProps } from '../../../catalog';
import {
  isLeafComponent,
  kindOf,
  setComponentProp,
  setTextChild,
  textChildIndex,
  type JsonPath,
} from '../../../model';
import { commitBatch, type BatchEntry, type OpDescription } from '../gate';
import type { NodeExpectation } from '../node-ref';
import { componentOf, isResolved, labelOf, nodeRef, resolveRef } from '../node-ref';
import { fail, type AgentTool, type ToolOutcome } from '../types';
import { EXPECT_PROP } from './params';

/** Значение свойства; `null` его убирает. */
type PropValue = string | number | boolean | null;

/** Параметры вызова. */
interface Params {
  refs: string[];
  props: Record<string, PropValue>;
  expect?: NodeExpectation;
}

export const setNodePropTool: AgentTool<Params> = {
  name: 'set_node_prop',
  // Оставлено только то, что не выводится из схемы: спецключ `text` — единственный способ задать
  // содержимое узла, и без этой фразы модель перебирала пропы по кругу.
  description:
    'Set component properties (label, placeholder, required, …). The same props go to every node ' +
    "in refs. The special key text sets the node's own content instead: a tab caption, a button " +
    'label, a heading.',
  inputSchema: {
    type: 'object',
    properties: {
      refs: {
        type: 'array',
        minItems: 1,
        items: { type: 'string' },
        description: 'Node addresses',
      },
      props: {
        type: 'object',
        minProperties: 1,
        description: 'name → value; null removes the property',
        additionalProperties: { type: ['string', 'number', 'boolean', 'null'] },
      },
      expect: EXPECT_PROP,
    },
    required: ['refs', 'props'],
    additionalProperties: false,
  },
  readOnly: false,
  run(params, ctx) {
    // Сверка ожидания имеет смысл только при одном адресе: она описывает ОДИН узел, и на списке
    // означала бы «все эти узлы одинаковы» — утверждение, которое модель не имела в виду.
    if (params.expect && params.refs.length > 1) {
      return fail(
        'INVALID_PARAMS',
        'expect describes a single node — pass it only when refs holds exactly one address.'
      );
    }

    let draft = ctx.draft;
    const entries: BatchEntry[] = [];

    for (const ref of params.refs) {
      const found = resolveRef(draft, ref, params.expect);
      if (!isResolved(found)) return found;

      // Содержимое узла живёт в children, а не в componentProps, поэтому ключ `text` уходит своим
      // путём — и вперёд остальных: он может отказать, а отказ обязан оставить черновик чистым.
      let node = found.node;
      let path = found.path;
      for (const [key, value] of Object.entries(params.props)) {
        const step =
          key === TEXT_KEY
            ? setText(draft, ref, { node, path }, value)
            : setPlainProp(draft, { node, path }, key, value);
        if ('error' in step) return step.error;
        draft = step.schema;
        // Узел перечитывается: предыдущее свойство уже сделало его другим объектом.
        const again = resolveRef(draft, ref);
        if (!isResolved(again)) return again;
        node = again.node;
        path = again.path;
        entries.push({ ref, ...step.describe });
      }
    }

    return commitBatch(ctx, draft, entries);
  },
};

/** Результат одной правки свойства: новая схема с описанием либо отказ. */
type PropStep = { schema: JsonFormSchema; describe: OpDescription } | { error: ToolOutcome };

/** Обычное свойство — в `componentProps`. */
function setPlainProp(
  draft: JsonFormSchema,
  found: { node: JsonNode; path: JsonPath },
  key: string,
  raw: PropValue
): PropStep {
  // JSON не умеет выражать undefined, поэтому «убрать свойство» приходит как null.
  const value = raw === null ? undefined : raw;
  const result = setComponentProp(draft, found.path, key, value);
  const name = labelOf(found.node) ?? componentOf(found.node) ?? nodeRef(found.path);
  return {
    schema: result.schema,
    describe: {
      kind: 'update',
      summary:
        value === undefined
          ? `${name} → свойство ${key} убрано`
          : `${name} → ${key} = ${JSON.stringify(value)}`,
      report:
        value === undefined
          ? `${name} → property ${key} removed`
          : `${name} → ${key} = ${JSON.stringify(value)}`,
    },
  };
}

/** Ключ содержимого узла — пишется в `children`, а не в `componentProps` (см. шапку модуля). */
const TEXT_KEY = 'text';

/** Пропы, которыми компонент подписывает сам себя (в порядке предпочтения). */
const CAPTION_PROPS = ['title', 'label'];

/**
 * Проп-подпись компонента, если он у него есть.
 *
 * Признак берётся из каталога — той же props-схемы, что показывает `describe_component`, поэтому
 * правило само собой распространяется на любой кит: где подпись объявлена пропом, туда её и пишем.
 */
function captionPropOf(node: JsonNode): string | undefined {
  const name = componentOf(node);
  const entry = name ? getCatalogEntry(name) : undefined;
  if (!entry) return undefined;
  const keys = new Set(toInspectorProps(entry.propsSchema).map((p) => p.key));
  return CAPTION_PROPS.find((k) => keys.has(k));
}

/** Записать содержимое узла текстовой частью `children`. */
function setText(
  draft: JsonFormSchema,
  ref: string,
  found: { node: JsonNode; path: JsonPath },
  raw: PropValue
): PropStep {
  // Содержимое бывает только у контейнера, который его рисует: у поля подпись — это `label`, а у
  // листа (Icon, Separator, <br>) содержимого нет вовсе. Условие дословно повторяет инспектор.
  if (kindOf(found.node) !== 'container' || isLeafComponent(found.node)) {
    return {
      error: fail(
        'INVALID_PARENT',
        `Node ${ref} has no content of its own. A field's caption is its "label" property.`
      ),
    };
  }
  // У части контейнеров подпись — собственный проп, а `children` держат СОДЕРЖИМОЕ: у шага мастера
  // это `title` и тело шага. Наблюдалось вживую: модель переименовывала шаг ключом `text`, и слово
  // «Шаг 2» вставало абзацем над полями, а заголовок оставался прежним. Отправляем в правильный
  // проп вместо того, чтобы молча испортить тело.
  const caption = captionPropOf(found.node);
  if (caption) {
    return {
      error: fail(
        'INVALID_PARENT',
        `${componentOf(found.node) ?? ref} is captioned by its "${caption}" property, not by ` +
          `content: set "${caption}" instead of "text" on ${ref}.`
      ),
    };
  }
  // Несколько текстовых частей — это шаблон вида ['Платёж: ', '$model(x)', ' ₽']. Заменить его
  // строкой значит потерять привязку, поэтому инспектор в таком случае показывает read-only, а
  // агенту честнее отказать, чем молча схлопнуть структуру.
  if (textChildIndex(found.node) === null) {
    return {
      error: fail(
        'SCHEMA_INVALID',
        `Content of ${ref} is assembled from several parts (text and bindings) — a plain ` +
          `string would drop the bindings, so it is not replaced.`
      ),
    };
  }

  const text = raw === null ? '' : String(raw);
  const result = setTextChild(draft, found.path, text);
  const name = componentOf(found.node) ?? ref;
  return {
    schema: result.schema,
    describe: {
      kind: 'update',
      summary: text ? `${name} → текст «${text}»` : `${name} → текст убран`,
      report: text ? `${name} → text "${text}"` : `${name} → text removed`,
    },
  };
}
