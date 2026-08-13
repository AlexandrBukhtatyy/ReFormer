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

import type { JsonNode } from '@reformer/renderer-json';
import { getCatalogEntry, toInspectorProps } from '../../../catalog';
import {
  isLeafComponent,
  kindOf,
  setComponentProp,
  setTextChild,
  textChildIndex,
  type JsonPath,
} from '../../../model';
import { commitMutation } from '../gate';
import { componentOf, isResolved, labelOf, resolveRef } from '../node-ref';
import { fail, type AgentTool, type ToolContext, type ToolOutcome } from '../types';
import { EXPECT_PROP, REF_PROP, type RefParams } from './params';

/** Параметры вызова. */
interface Params extends RefParams {
  key: string;
  value: string | number | boolean | null;
}

export const setNodePropTool: AgentTool<Params> = {
  name: 'set_node_prop',
  description:
    'Set one component property (label, placeholder, required, …). value: null removes the ' +
    'property. Allowed keys and types come from describe_component. The special key text sets the ' +
    "node's own content: a tab caption, a button label, a heading.",
  inputSchema: {
    type: 'object',
    properties: {
      ref: REF_PROP,
      key: { type: 'string', description: 'Property name' },
      value: {
        type: ['string', 'number', 'boolean', 'null'],
        description: 'Value; null removes the property',
      },
      expect: EXPECT_PROP,
    },
    required: ['ref', 'key', 'value'],
    additionalProperties: false,
  },
  readOnly: false,
  run(params, ctx) {
    const found = resolveRef(ctx.draft, params.ref, params.expect);
    if (!isResolved(found)) return found;

    if (params.key === TEXT_KEY) return setText(params, ctx, found);

    // JSON не умеет выражать undefined, поэтому «убрать свойство» приходит как null.
    const value = params.value === null ? undefined : params.value;
    const result = setComponentProp(ctx.draft, found.path, params.key, value);
    const name = labelOf(found.node) ?? componentOf(found.node) ?? params.ref;
    return commitMutation(ctx, result, () => ({
      kind: 'update',
      summary:
        value === undefined
          ? `${name} → свойство ${params.key} убрано`
          : `${name} → ${params.key} = ${JSON.stringify(value)}`,
      report:
        value === undefined
          ? `${name} → property ${params.key} removed`
          : `${name} → ${params.key} = ${JSON.stringify(value)}`,
    }));
  },
};

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
  params: Params,
  ctx: ToolContext,
  found: { node: JsonNode; path: JsonPath }
): ToolOutcome {
  // Содержимое бывает только у контейнера, который его рисует: у поля подпись — это `label`, а у
  // листа (Icon, Separator, <br>) содержимого нет вовсе. Условие дословно повторяет инспектор.
  if (kindOf(found.node) !== 'container' || isLeafComponent(found.node)) {
    return fail(
      'INVALID_PARENT',
      `Node ${params.ref} has no content of its own. A field's caption is its "label" property.`
    );
  }
  // У части контейнеров подпись — собственный проп, а `children` держат СОДЕРЖИМОЕ: у шага мастера
  // это `title` и тело шага. Наблюдалось вживую: модель переименовывала шаг ключом `text`, и слово
  // «Шаг 2» вставало абзацем над полями, а заголовок оставался прежним. Отправляем в правильный
  // проп вместо того, чтобы молча испортить тело.
  const caption = captionPropOf(found.node);
  if (caption) {
    return fail(
      'INVALID_PARENT',
      `${componentOf(found.node) ?? params.ref} is captioned by its "${caption}" property, not by ` +
        `content: call set_node_prop ${params.ref} with key "${caption}".`
    );
  }
  // Несколько текстовых частей — это шаблон вида ['Платёж: ', '$model(x)', ' ₽']. Заменить его
  // строкой значит потерять привязку, поэтому инспектор в таком случае показывает read-only, а
  // агенту честнее отказать, чем молча схлопнуть структуру.
  if (textChildIndex(found.node) === null) {
    return fail(
      'SCHEMA_INVALID',
      `Content of ${params.ref} is assembled from several parts (text and bindings) — a plain ` +
        `string would drop the bindings, so it is not replaced.`
    );
  }

  const text = params.value === null ? '' : String(params.value);
  const result = setTextChild(ctx.draft, found.path, text);
  const name = componentOf(found.node) ?? params.ref;
  return commitMutation(ctx, result, () => ({
    kind: 'update',
    summary: text ? `${name} → текст «${text}»` : `${name} → текст убран`,
    report: text ? `${name} → text "${text}"` : `${name} → text removed`,
  }));
}
