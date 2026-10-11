/**
 * Фабрика пустой схемы (Mode A «новая форма») и мягкое приведение распарсенного JSON
 * к `JsonFormSchema`. Валидация против мета-схемы — отдельно (`validateFormSchema`);
 * здесь только структурный дискриминатор, заготовка и перевод документов прежних форматов.
 *
 * ## Документ в билдере — всегда формата 2
 *
 * Файл на диске может быть прежнего формата (`value` / `array`, шаги в `componentProps.steps`).
 * Он переводится один раз, на входе — {@link ensureSchema}, — и дальше ни одно место домена
 * прежних ключей не знает. Обратно на диск уходит формат 2: открыть, поправить и сохранить
 * документ значит перевести его.
 *
 * @module plugins/reformer/core/form-model/normalize
 */

import {
  isModelOp,
  migrateJsonSchema,
  parseOperator,
  type ComponentOp,
  type HtmlOp,
  type JsonFormSchema,
  type JsonNode,
} from '@reformer/renderer-json';
import { STEPS_HOST_NAMES, isRawNodeLike } from './node-kind';

/** Пустая схема для standalone-режима: корень — Box со `space-y-4`, без детей. */
export function emptySchema(opts?: {
  version?: string;
  rootComponent?: ComponentOp | HtmlOp;
  $schema?: string;
}): JsonFormSchema {
  const root: JsonNode = {
    component: opts?.rootComponent ?? '$component(Box)',
    componentProps: { className: 'space-y-4' },
    children: [],
  };
  // `$schema` и `format` первыми — так документ читается сверху вниз, и так же его ставит перевод.
  return {
    ...(opts?.$schema ? { $schema: opts.$schema } : {}),
    format: 2,
    version: opts?.version ?? '1.0',
    root,
  };
}

/**
 * Структурный дискриминатор «это форма-схема?» (спека §7.2): значение — объект с полем
 * `root`, а `root` — узел. Отсекает саму `form-schema.schema.json` (draft-07 JSON Schema) и
 * произвольные JSON.
 *
 * Узнаёт документ ЛЮБОГО формата: вопрос задаётся файлу с диска, до перевода. Сужение типа до
 * формата 2 честно только после {@link ensureSchema} — он и переводит.
 */
export function isFormSchema(value: unknown): value is JsonFormSchema {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false;
  const root = (value as Record<string, unknown>).root;
  return isRawNodeLike(root);
}

/**
 * Привести распарсенный JSON к `JsonFormSchema` формата 2 или бросить. Ключи и неизвестные
 * операторы сохраняются as-is (требование round-trip). Преобразований два, оба — для документов,
 * написанных раньше: {@link migrateTextNodes} (текст из ключа `text` в `children`) и
 * {@link migrateSchemaFormat} (прежний формат в формат 2).
 *
 * @throws Если структура не проходит {@link isFormSchema}.
 */
export function ensureSchema(value: unknown): JsonFormSchema {
  if (!isFormSchema(value)) {
    throw new Error('ensureSchema: JSON не похож на JsonFormSchema (нет узла в `root`)');
  }
  return migrateSchemaFormat(migrateTextNodes(value));
}

/**
 * Документ прежнего формата — в формат 2: `value` / `array` становятся `model`, шаги визарда
 * переезжают из `componentProps.steps` в `children`, документ получает `format: 2`. Документ
 * формата 2 возвращается ПО ТОЙ ЖЕ ссылке, поэтому round-trip нетронутых файлов не страдает.
 *
 * Визарды называются списком билдера ({@link STEPS_HOST_NAMES}): он же решает, у какого узла
 * `children` — слот шагов, и два списка разойтись не должны.
 */
export function migrateSchemaFormat(schema: unknown): JsonFormSchema {
  return migrateJsonSchema(schema, { stepHosts: [...STEPS_HOST_NAMES] });
}

/**
 * Узел прежнего формата (файл шага) — в формат 2.
 *
 * Отдельная функция, потому что у файла шага нет ни `root`, ни `format`: перевод документа его
 * не узнает. Формат узла определяется по признакам прежнего ({@link hasLegacyShape}); узел без
 * них возвращается ПО ТОЙ ЖЕ ссылке. Переводить всё подряд нельзя: перевод принимает за узел
 * любой объект в пропсах с оператором в `value`, и в узле формата 2 такой проп был бы испорчен.
 */
export function migrateNodeFormat(node: unknown): JsonNode {
  if (!hasLegacyShape(node)) return node as JsonNode;
  return migrateJsonSchema({ root: node }, { stepHosts: [...STEPS_HOST_NAMES] }).root;
}

/**
 * Есть ли в поддереве признаки прежнего формата: привязка в `value` или `array` у узла либо шаги
 * визарда в `componentProps.steps`. Обход идёт только по местам узлов — в пропсы не заглядывает.
 */
function hasLegacyShape(value: unknown): boolean {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false;
  const node = value as Record<string, unknown>;
  if ('model' in node) return false;
  if (isModelOp(node.value) || isModelOp(node.array)) return true;

  const props = node.componentProps as { steps?: unknown } | undefined;
  const hostName = parseOperator(node.component)?.arg;
  const steps = hostName !== undefined && STEPS_HOST_NAMES.has(hostName) ? props?.steps : undefined;
  if (Array.isArray(steps)) return true;

  const children = Array.isArray(node.children) ? node.children : [];
  const template = (node.item as { $template?: unknown } | undefined)?.$template;
  return [...children, template, node.wrapper].some(hasLegacyShape);
}

/**
 * Схемы прошлых версий держали содержимое в отдельном ключе `text` (`{ component, text: 'Итого' }`);
 * теперь текст — такая же часть `children`, как вложенный узел, и `text` мета-схемой отвергается.
 * Переписываем его в текстовые дети ПЕРЕД `children` — ровно там он и рендерился.
 *
 * Проход по всему значению (а не только по узлам): `text` встречается и внутри `componentProps`
 * (шаги мастера, слоты компонентов). Если `text` нет — возвращается исходная ссылка, поэтому
 * round-trip нетронутых файлов не страдает.
 */
export function migrateTextNodes<T>(value: T): T {
  let touched = false;
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) {
      const items = v.map(walk);
      return touched ? items : v;
    }
    if (v == null || typeof v !== 'object') return v;
    const src = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src)) {
      // Сырой узел: `text` принадлежит документам, написанным ещё и до формата 2.
      if (key === 'text' && isRawNodeLike(src)) {
        const parts = Array.isArray(src.text) ? src.text : [src.text];
        const kids = Array.isArray(src.children) ? (src.children as unknown[]).map(walk) : [];
        out.children = [...parts, ...kids];
        touched = true;
        continue;
      }
      // `children` уже собран веткой выше — второй раз его не переписываем.
      if (key === 'children' && out.children !== undefined) continue;
      out[key] = walk(src[key]);
    }
    return touched ? out : v;
  };
  const next = walk(value);
  return touched ? (next as T) : value;
}
