/**
 * Type Guards - централизованные функции проверки типов узлов
 *
 * Устраняет дублирование между form-node.ts, validation-applicator.ts и validation-context.ts
 *
 * @example
 * ```typescript
 * import { isFieldNode, isGroupNode } from '@/core/utils/type-guards';
 *
 * if (isFieldNode(node)) {
 *   // TypeScript знает, что node это FieldNode
 *   node.validators;
 * }
 * ```
 */

import type { FormNode } from '../nodes/form-node';
import type { FieldNode } from '../nodes/field-node';
import type { GroupNode } from '../nodes/group-node';
import type { ArrayNode } from '../nodes/array-node';
import type { FormValue } from '../types';

/**
 * Проверить, является ли значение любым FormNode
 *
 * Проверяет базовые свойства, общие для всех типов узлов
 *
 * @param value - Значение для проверки
 * @returns true если value является FormNode
 *
 * @example
 * ```typescript
 * if (isFormNode(value)) {
 *   value.setValue(newValue);
 *   value.validate();
 * }
 * ```
 */
export function isFormNode(value: unknown): value is FormNode<FormValue> {
  if (value === null || value === undefined) {
    return false;
  }

  return (
    typeof value === 'object' &&
    'value' in value &&
    'setValue' in value &&
    'getValue' in value &&
    'validate' in value
  );
}

/**
 * Проверить, является ли значение FieldNode (примитивное поле)
 *
 * FieldNode представляет примитивное поле формы (string, number, boolean и т.д.)
 * и имеет валидаторы, но не имеет вложенных полей или элементов массива
 *
 * @param value - Значение для проверки
 * @returns true если value является FieldNode
 *
 * @example
 * ```typescript
 * if (isFieldNode(node)) {
 *   node.validators; //  OK
 *   node.asyncValidators; //  OK
 *   node.markAsTouched(); //  OK
 * }
 * ```
 */
export function isFieldNode(value: unknown): value is FieldNode<FormValue> {
  if (value === null || value === undefined) {
    return false;
  }

  return (
    isFormNode(value) &&
    'validators' in value &&
    'asyncValidators' in value &&
    // FieldNode имеет markAsTouched метод
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (value as any).markAsTouched === 'function' &&
    // У FieldNode нет fields или items
    !('fields' in value) &&
    !('items' in value)
  );
}

/**
 * Проверить, является ли значение GroupNode (объект с вложенными полями)
 *
 * GroupNode представляет объект с вложенными полями формы
 * и имеет методы для применения validation/behavior схем
 *
 * @param value - Значение для проверки
 * @returns true если value является GroupNode
 *
 * @example
 * ```typescript
 * if (isGroupNode(node)) {
 *   node.applyValidationSchema(schema); //  OK
 *   node.getFieldByPath('user.email'); //  OK
 * }
 * ```
 */
export function isGroupNode(value: unknown): value is GroupNode<Record<string, FormValue>> {
  if (value === null || value === undefined) {
    return false;
  }

  return (
    isFormNode(value) &&
    'applyValidationSchema' in value &&
    'applyBehaviorSchema' in value &&
    'getFieldByPath' in value &&
    // GroupNode НЕ имеет items/push/removeAt (это ArrayNode)
    !('items' in value) &&
    !('push' in value) &&
    !('removeAt' in value)
  );
}

/**
 * Проверить, является ли значение ArrayNode (массив форм)
 *
 * ArrayNode представляет массив вложенных форм (обычно GroupNode)
 * и имеет array-like методы (push, removeAt, at)
 *
 * @param value - Значение для проверки
 * @returns true если value является ArrayNode
 *
 * @example
 * ```typescript
 * if (isArrayNode(node)) {
 *   node.push(); //  OK - добавить элемент
 *   node.removeAt(0); //  OK - удалить элемент
 *   const item = node.at(0); //  OK - получить элемент
 * }
 * ```
 */
export function isArrayNode(value: unknown): value is ArrayNode<Record<string, FormValue>> {
  if (value === null || value === undefined) {
    return false;
  }

  return (
    isFormNode(value) &&
    'items' in value &&
    'length' in value &&
    'push' in value &&
    'removeAt' in value &&
    'at' in value &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (value as any).push === 'function' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (value as any).removeAt === 'function'
  );
}

/**
 * Получить тип узла как строку (для отладки)
 *
 * Полезно для логирования и отладки
 *
 * @param node - Узел для проверки
 * @returns Строковое название типа узла
 *
 * @example
 * ```typescript
 * console.log('Node type:', getNodeType(node)); // "FieldNode" | "GroupNode" | "ArrayNode" | "FormNode" | "Unknown"
 * ```
 */
export function getNodeType(node: unknown): string {
  if (isFieldNode(node)) return 'FieldNode';
  if (isGroupNode(node)) return 'GroupNode';
  if (isArrayNode(node)) return 'ArrayNode';
  if (isFormNode(node)) return 'FormNode';
  return 'Unknown';
}
