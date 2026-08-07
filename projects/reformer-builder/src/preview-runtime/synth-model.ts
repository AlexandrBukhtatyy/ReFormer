/**
 * Синтез модели для Runtime-preview из `$model`-путей схемы (спека §9: «модель — пустые сигналы
 * из `$model`-путей»). Дефолт листа выбирается по компоненту (Checkbox/Switch→false, Slider→min|0,
 * Input type=number→null, иначе ''); array-путь→[]. Пути внутри `item.$template` относительны —
 * не собираются (их подмодель строит конвертер).
 *
 * @module reformer-builder/preview-runtime/synth-model
 */

import { createModel, type FormModel } from '@reformer/core';
import {
  isArrayNode,
  isContainerNode,
  isFieldNode,
  parseOperator,
  type JsonContainerNode,
  type JsonFieldNode,
  type JsonFormSchema,
  type JsonNode,
} from '@reformer/renderer-json';
import { isNodeLike } from '../model';

/** Пара «путь модели → дефолтное значение». */
export interface FieldDefault {
  path: string;
  value: unknown;
}

/** Дефолт значения листа по его компоненту/типу. */
function defaultForField(node: JsonFieldNode): unknown {
  const component = parseOperator(node.component)?.arg;
  // Файловые контролы держат список файлов и зовут `value.map(...)` — строка их роняет. `null`,
  // а не `[]`: массив в начальном значении модель превратила бы в ModelArray (не лист-сигнал).
  if (component === 'FileUpload' || component === 'FileUploadAvatar' || component === 'Attachment')
    return null;
  if (component === 'Checkbox' || component === 'Switch' || component === 'Toggle') return false;
  if (component === 'Slider') {
    const min = node.componentProps?.min;
    return typeof min === 'number' ? min : 0;
  }
  if (node.componentProps?.type === 'number') return null;
  return '';
}

/** Верхнеуровневые дефолты полей/массивов (без спуска в `item.$template`). */
export function collectFieldDefaults(schema: JsonFormSchema): FieldDefault[] {
  const out: FieldDefault[] = [];
  const rec = (node: JsonNode) => {
    if (isArrayNode(node)) {
      const p = parseOperator(node.array);
      if (p?.op === 'model') out.push({ path: p.arg, value: [] });
      return;
    }
    if (isFieldNode(node)) {
      const p = parseOperator(node.value);
      if (p?.op === 'model') out.push({ path: p.arg, value: defaultForField(node) });
      return;
    }
    if (isContainerNode(node)) {
      const c = node as JsonContainerNode;
      // Текстовые части `children` полей не объявляют — спускаемся только в узлы.
      c.children?.forEach((child) => isNodeLike(child) && rec(child as JsonNode));
      const steps = c.componentProps?.steps;
      if (Array.isArray(steps)) steps.forEach((s) => isNodeLike(s) && rec(s as JsonNode));
    }
  };
  if (isNodeLike(schema.root)) rec(schema.root);
  return out;
}

/** Вложенный объект начальных значений из плоских дот-путей. */
export function buildInitialValues(defaults: FieldDefault[]): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const { path, value } of defaults) setNested(root, path.split('.'), value);
  return root;
}

function setNested(obj: Record<string, unknown>, segs: string[], value: unknown): void {
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const k = segs[i];
    if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  const last = segs[segs.length - 1];
  if (!(last in cur)) cur[last] = value;
}

/** Модель preview из схемы: пустые/дефолтные значения по всем верхнеуровневым `$model`-путям. */
export function synthModel(schema: JsonFormSchema): FormModel<Record<string, unknown>> {
  return createModel(buildInitialValues(collectFieldDefaults(schema)));
}
