/** Документ раскладки формы (формат 2) и обход шагов мастера в дереве layout. */

import type { LayoutNode } from './intent.js';

/** Узел документа формата 2. Чем он является, решают ключи: `item` — массив, `part` — подформа. */
export interface SchemaDocNode {
  selector?: string;
  model?: string;
  /** Постоянная блокировка поля — ключ узла, а не проп компонента. */
  disabled?: boolean;
  component?: string;
  componentProps?: Record<string, unknown>;
  /** Шаблон строки массива: `$part(name)`. */
  item?: string;
  /** Подформа: `$part(name)`. */
  part?: string;
  /** Дети: узлы и текстовые части — строки (заголовок, абзац, подпись кнопки). */
  children?: Array<SchemaDocNode | string>;
}

/** Документ JSON-DSL формата 2. */
export interface SchemaDocument {
  format: 2;
  parts?: Record<string, SchemaDocNode>;
  root: SchemaDocNode;
}

/**
 * Ключ шага — `selector` узла шага и идентификатор шага в потоке (`flow.steps[].id`).
 *
 * Берётся заданный в intent `selector`; у шага без него — `step<N>`. Ключ обязан быть одним и
 * тем же в разметке и в правилах, поэтому считается здесь, в одном месте, для обоих эмиттеров.
 */
export function stepKeyOf(step: { selector?: string }, index: number): string {
  return step.selector?.trim() || `step${index + 1}`;
}

/** Шаги визарда в порядке обхода разметки. */
export function collectSteps(root: LayoutNode): Array<Extract<LayoutNode, { kind: 'step' }>> {
  const steps: Array<Extract<LayoutNode, { kind: 'step' }>> = [];
  const walk = (node: LayoutNode): void => {
    if (node.kind === 'step') steps.push(node);
    if (node.kind === 'container' || node.kind === 'step') node.children.forEach(walk);
  };
  walk(root);
  return steps;
}
