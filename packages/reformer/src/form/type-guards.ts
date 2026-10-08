/**
 * Type Guards - централизованные функции проверки типов узлов
 *
 * Устраняет дублирование между form-node.ts, validation-applicator.ts и validation-context.ts
 *
 * @group Utilities
 * @category Type Guards
 *
 * @example
 * ```typescript
 * import { isFieldNode, isGroupNode } from '@/core/utils/type-guards';
 *
 * if (isFieldNode(node)) {
 *   // TypeScript знает, что node это FieldNode
 *   node.updateComponentProps({ placeholder: 'Email' });
 * }
 * ```
 */

import type { FormNode } from './nodes/form-node';
import type { FieldNode } from './nodes/field-node';
import type { GroupNode } from './nodes/group-node';
import type { ModelArrayNode } from './nodes/model-array-node';
import type { FormValue } from './types/index';

/**
 * Проверить, является ли значение любым FormNode
 *
 * Проверяет базовые свойства, общие для всех типов узлов
 *
 * @group Utilities
 * @category Type Guards
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
 * FieldNode представляет поле формы над сигналом модели: несёт пропсы компонента
 * и не имеет вложенных полей или элементов массива
 *
 * @group Utilities
 * @category Type Guards
 *
 * @param value - Значение для проверки
 * @returns true если value является FieldNode
 *
 * @example
 * ```typescript
 * if (isFieldNode(node)) {
 *   node.componentProps.value; //  OK
 *   node.markAsTouched(); //  OK
 * }
 * ```
 */
export function isFieldNode(value: unknown): value is FieldNode<FormValue> {
  return (
    isFormNode(value) &&
    // Пропсы компонента есть только у поля
    'componentProps' in value &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (value as any).updateComponentProps === 'function' &&
    // У FieldNode нет fields или items
    !('fields' in value) &&
    !('items' in value)
  );
}

/**
 * Проверить, является ли значение GroupNode (объект с вложенными полями)
 *
 * GroupNode представляет объект с вложенными полями формы: имеет навигацию по полям
 * (`getFieldByPath`/`fields`) и НЕ имеет array-методов (`items`/`push`/`removeAt`).
 *
 * @param value - Значение для проверки
 * @returns true если value является GroupNode
 *
 * @example
 * ```typescript
 * if (isGroupNode(node)) {
 *   node.getFieldByPath('user.email'); //  OK
 * }
 * ```
 */
export function isGroupNode(value: unknown): value is GroupNode<object> {
  return (
    isFormNode(value) &&
    'getFieldByPath' in value &&
    'fields' in value &&
    // GroupNode НЕ имеет items/push/removeAt (это ModelArrayNode)
    !('items' in value) &&
    !('push' in value) &&
    !('removeAt' in value)
  );
}

/**
 * Проверить, является ли значение узлом массива под-форм ({@link ModelArrayNode})
 *
 * Узел массива держит формы строк (GroupNode)
 * и имеет array-like методы (push, removeAt, at)
 *
 * @param value - Значение для проверки
 * @returns true если value является узлом массива под-форм
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
export function isArrayNode(value: unknown): value is ModelArrayNode<object> {
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
