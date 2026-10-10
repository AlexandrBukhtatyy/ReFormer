/**
 * Метка вида ноды формы — по ней гарды {@link isFormControl}, {@link isFormGroup},
 * {@link isFormArray} различают ноды, не перебирая их члены.
 *
 * `Symbol.for`: метка одна и та же у двух копий рантайма в одном приложении (дубликат пакета в
 * бандле), иначе нода одной копии не распознавалась бы гардом другой.
 *
 * @internal
 * @module form/nodes/node-kind
 */

import type { FormNode } from '../types/nodes';

export const NODE_KIND: unique symbol = Symbol.for('@reformer/core/form-node-kind') as never;

/** Сырой узел за прокси группы: внутренним вызовам нужен он, а не лицо с полями. */
export const RAW_NODE: unique symbol = Symbol.for('@reformer/core/form-node-raw') as never;

export type NodeKind = 'control' | 'group' | 'array';

/** Внутренние члены ноды: их зовут сборка, раннер валидации и массив строк. */
export interface InternalFormNode<T = unknown> extends FormNode<T> {
  readonly [NODE_KIND]: NodeKind;
  /** Раннер валидации: начало и конец async-правил; у группы и массива — ничего. */
  setPending(pending: boolean): void;
  /** Снять подписки ноды и её детей. */
  dispose(): void;
}

/** Вид ноды либо `undefined`, если значение — не нода формы. */
export function kindOf(value: unknown): NodeKind | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const kind = (value as { [NODE_KIND]?: unknown })[NODE_KIND];
  return kind === 'control' || kind === 'group' || kind === 'array' ? kind : undefined;
}

/** Сырой узел: за прокси группы — её класс, у остальных — сама нода. */
export function rawNode<N extends object>(node: N): InternalFormNode {
  return ((node as { [RAW_NODE]?: unknown })[RAW_NODE] ?? node) as InternalFormNode;
}
