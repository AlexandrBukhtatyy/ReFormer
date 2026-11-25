/**
 * Текст узла схемы: склейка частей и отбор узлов для компонентов, которые ведут детей сами.
 *
 * @module render/text
 */

import { isValueSignal } from '../model/model-signals-proxy';
import type { CompiledChild, CompiledNode, SchemaTextPart } from '../form/schema/compiled';

/**
 * Склейка частей текста в строку: сигналы читаются, `null` и `undefined` дают пустую строку.
 * Читает сигналы — вызывать там, где чтение отслеживается, чтобы текст обновлялся на месте.
 */
export function joinTextParts(parts: readonly SchemaTextPart[]): string {
  let out = '';
  for (const part of parts) {
    const value: unknown = isValueSignal(part) ? part.value : part;
    if (value != null) out += String(value);
  }
  return out;
}

/**
 * Только узлы — для компонентов, которые обходят детей сами (визард, вкладки) и ждут узлы
 * скомпилированной схемы. Второе значение — сколько текстовых частей отброшено: текст в таком
 * слоте — ошибка автора схемы, о ней предупреждает рендерер.
 */
export function nodesOnly(children: readonly CompiledChild[]): {
  nodes: CompiledNode[];
  dropped: number;
} {
  const nodes: CompiledNode[] = [];
  let dropped = 0;
  for (const child of children) {
    if (child.kind === 'text') dropped += 1;
    else nodes.push(child);
  }
  return { nodes, dropped };
}
