/**
 * Снять подписки формы в тесте: `dispose` — внутренний метод сырого узла группы, в контракт
 * {@link FormGroup} он не входит.
 */

import { rawNode } from '../../src/form/nodes/node-kind';

export function disposeForm(form: object): void {
  rawNode(form).dispose();
}
