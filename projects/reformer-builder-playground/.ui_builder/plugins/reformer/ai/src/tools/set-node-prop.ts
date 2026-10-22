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
 * @module plugins/reformer/ai/tools/set-node-prop
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { toInspectorProps } from '../../../core/catalog';
import { setComponentProp, setTextChild, textChildIndex } from '../../../core/form-model';
import { catalogEntry, type Catalog } from '../model/catalog-digest';
import { isLeafComponent, isStepsHost, kindOf } from '../../../core/form-model';
import { type JsonPath } from '../../../core/form-model';
import { commitBatch, type BatchEntry, type OpDescription } from '../loop/gate';
import type { NodeExpectation } from '../model/node-ref';
import { componentOf, isResolved, labelOf, nodeRef, resolveRef } from '../model/node-ref';
import { fail, type AgentTool, type ToolOutcome } from '../model/types';
import { EXPECT_PROP } from './params';
import { isNodeKey, nodeKeyRefusal, setNodeKeyValue } from './node-keys';

/** Значение свойства — любое значение JSON (варианты списка — массив); `null` его убирает. */
type PropValue = unknown;

/** Параметры вызова. */
interface Params {
  /** Узлы, получающие одни и те же `props`. */
  refs?: string[];
  props?: Record<string, PropValue>;
  /**
   * Свои свойства каждому узлу: адрес → свойства. Без них разные значения (заголовки семи шагов)
   * шли семью вызовами: `props` одни на все `refs`, и модель упиралась в форму инструмента, а не
   * нарушала просьбу промпта править пачкой (ReFormer-kuj).
   */
  edits?: Record<string, Record<string, PropValue>>;
  expect?: NodeExpectation;
}

/**
 * Значения свойств в схеме параметров. Массивы и объекты — тоже: без них варианты готового
 * списка (`options`) менялись только пересозданием узла. Тип значения сверяет гейт по схеме
 * свойств компонента из каталога.
 */
const PROP_VALUES = { type: ['string', 'number', 'boolean', 'null', 'array', 'object'] };

export const setNodePropTool: AgentTool<Params> = {
  name: 'set_node_prop',
  // Оставлено только то, что не выводится из схемы: спецключ `text` — единственный способ задать
  // содержимое узла, и без этой фразы модель перебирала пропы по кругу.
  description:
    'Set component properties (label, placeholder, required, …). props go to every node in refs; ' +
    "edits gives each node its own props. The special key text sets the node's own content " +
    'instead: a tab caption, a button label, a heading. $disabled locks a field for good; ' +
    '$newRow is the object a new array row starts from.',
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
        additionalProperties: PROP_VALUES,
      },
      edits: {
        type: 'object',
        description: 'address → its own props',
        additionalProperties: { type: 'object', additionalProperties: PROP_VALUES },
      },
      expect: EXPECT_PROP,
    },
    additionalProperties: false,
  },
  readOnly: false,
  run(params, ctx) {
    // Пары «узел → свойства»: общие props на каждый адрес refs, затем свои — из edits.
    const shared = params.props ?? {};
    const pairs: Array<[string, Record<string, PropValue>]> = [
      ...(params.refs ?? []).map((ref): [string, Record<string, PropValue>] => [ref, shared]),
      ...Object.entries(params.edits ?? {}),
    ];
    if (pairs.length === 0 || pairs.some(([, props]) => Object.keys(props).length === 0)) {
      return fail(
        'INVALID_PARAMS',
        'Pass refs with props (same props for every node) and/or edits (address → its own props).'
      );
    }
    // Сверка ожидания имеет смысл только при одном узле: она описывает ОДИН узел, и на списке
    // означала бы «все эти узлы одинаковы» — утверждение, которое модель не имела в виду.
    if (params.expect && pairs.length > 1) {
      return fail(
        'INVALID_PARAMS',
        'expect describes a single node — pass it only when the call edits exactly one node.'
      );
    }

    let draft = ctx.draft;
    const entries: BatchEntry[] = [];

    for (const [ref, props] of pairs) {
      const found = resolveRef(draft, ref, params.expect);
      if (!isResolved(found)) return found;

      // Содержимое узла живёт в children, а не в componentProps, поэтому ключ `text` уходит своим
      // путём — и вперёд остальных: он может отказать, а отказ обязан оставить черновик чистым.
      let node = found.node;
      let path = found.path;
      for (const [key, value] of Object.entries(props)) {
        const step =
          key === TEXT_KEY
            ? setText(ctx.catalog, draft, ref, { node, path }, value)
            : isNodeKey(key)
              ? setNodeKeyStep(draft, { node, path }, key, value)
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

/** Особый ключ узла (`./node-keys`) — в сам узел, а не в `componentProps`. */
function setNodeKeyStep(
  draft: JsonFormSchema,
  found: { node: JsonNode; path: JsonPath },
  key: string,
  value: PropValue
): PropStep {
  const refused = nodeKeyRefusal(found.node, key, value);
  if (refused !== null) return { error: fail('INVALID_PARAMS', refused) };
  const name = labelOf(found.node) ?? componentOf(found.node) ?? nodeRef(found.path);
  const text = value === null ? 'removed' : JSON.stringify(value);
  return {
    schema: setNodeKeyValue(draft, found.path, key, value),
    describe: {
      kind: 'update',
      summary: `${name} → ${key} = ${value === null ? 'убрано' : JSON.stringify(value)}`,
      report: `${name} → ${key} = ${text}`,
    },
  };
}

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
function captionPropOf(catalog: Catalog, node: JsonNode): string | undefined {
  const name = componentOf(node);
  const entry = name ? catalogEntry(catalog, name) : undefined;
  if (!entry) return undefined;
  const keys = new Set(toInspectorProps(entry.propsSchema).map((p) => p.key));
  return CAPTION_PROPS.find((k) => keys.has(k));
}

/** Записать содержимое узла текстовой частью `children`. */
function setText(
  catalog: Catalog,
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
  const caption = captionPropOf(catalog, found.node);
  if (caption) {
    return {
      error: fail(
        'INVALID_PARENT',
        `${componentOf(found.node) ?? ref} is captioned by its "${caption}" property, not by ` +
          `content: set "${caption}" instead of "text" on ${ref}.`
      ),
    };
  }
  // У визарда `children` — слот шагов: текстовая часть встала бы в него наравне с шагами. Пока
  // шаги лежали отдельно от детей, такая запись была мусорным ключом; теперь она портит сам список
  // шагов, поэтому отказ явный.
  if (isStepsHost(found.node)) {
    return {
      error: fail(
        'INVALID_PARENT',
        `Node ${ref} is a wizard: it holds steps only and has no content of its own.`
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
