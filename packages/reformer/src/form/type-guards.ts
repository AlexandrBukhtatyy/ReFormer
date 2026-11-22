/**
 * Гарды нод формы: различают ноды по метке вида, а не по набору членов.
 *
 * @group Utilities
 * @category Type Guards
 * @module form/type-guards
 */

import type { FormArray, FormControl, FormGroup, FormNode } from './types/nodes';
import { kindOf } from './nodes/node-kind';

/**
 * Нода формы любого вида — поле, группа или массив под-форм.
 *
 * @example
 * ```typescript
 * const node = getNodeForSignal(model.$.email);
 * if (isFormNode(node)) node.markAsTouched();
 * ```
 */
export function isFormNode(value: unknown): value is FormNode<unknown> {
  return kindOf(value) !== undefined;
}

/**
 * Поле формы — нода над листом модели с пропсами компонента.
 *
 * @example
 * ```typescript
 * if (isFormControl(node)) node.updateComponentProps({ placeholder: 'Email' });
 * ```
 */
export function isFormControl(value: unknown): value is FormControl<unknown> {
  return kindOf(value) === 'control';
}

/**
 * Группа полей — её прокси с нодами полей по именам.
 *
 * @example
 * ```typescript
 * if (isFormGroup(node)) node.markAsTouched();
 * ```
 */
export function isFormGroup(value: unknown): value is FormGroup<Record<string, unknown>> {
  return kindOf(value) === 'group';
}

/**
 * Массив под-форм.
 *
 * @example
 * ```typescript
 * if (isFormArray(node)) node.push();
 * ```
 */
export function isFormArray(value: unknown): value is FormArray<object> {
  return kindOf(value) === 'array';
}
