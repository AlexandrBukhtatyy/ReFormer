/**
 * BehaviorContext - контекст для behavior callback функций
 *
 * Предоставляет методы для работы с формой в behavior схемах
 */

import type { GroupNode } from '../nodes/group-node';
import type { FormNode } from '../nodes/form-node';
import type { FieldPathNode, ValidationError } from '../types';
import type { GroupNodeWithControls } from '../types/group-node-proxy';
import type { BehaviorContext } from './types';

/**
 * Реализация BehaviorContext
 * Используется в callback функциях behavior схем
 */
export class BehaviorContextImpl<TForm extends Record<string, unknown>>
  implements BehaviorContext<TForm>
{
  /**
   * Корневой узел формы с проксированными полями
   * Позволяет обращаться к полям напрямую: ctx.formNode.properties.clear()
   */
  public readonly formNode: GroupNodeWithControls<TForm>;

  private form: GroupNode<TForm>;

  constructor(form: GroupNode<TForm>) {
    this.form = form;
    //  Используем _proxyInstance если доступен, иначе fallback на form
    // _proxyInstance устанавливается в GroupNode конструкторе перед применением behavior схем
    this.formNode = ((form as unknown as { _proxyInstance?: GroupNodeWithControls<TForm> })
      ._proxyInstance || form) as GroupNodeWithControls<TForm>;
  }

  /**
   * Получить значение поля по строковому пути
   * Поддерживает вложенные пути: "address.city"
   */
  getField(path: string): unknown {
    return this.resolveFieldValue(path);
  }

  /**
   * Установить значение поля по строковому пути
   * Использует emitEvent: false для избежания циклов
   */
  setField(path: string, value: unknown): void {
    const node = this.resolveFieldNode(path);
    if (node) {
      node.setValue(value, { emitEvent: false });
    }
  }

  /**
   * Обновить componentProps поля
   */
  updateComponentProps(field: FieldPathNode<TForm, unknown>, props: Record<string, unknown>): void {
    const node = this.resolveFieldNode(field.__path);
    if (node && 'updateComponentProps' in node) {
      (
        node as unknown as { updateComponentProps: (props: Record<string, unknown>) => void }
      ).updateComponentProps(props);
    }
  }

  /**
   * Перевалидировать поле
   */
  async validateField(field: FieldPathNode<TForm, unknown>): Promise<boolean> {
    const node = this.resolveFieldNode(field.__path);
    if (node) {
      return await node.validate();
    }
    return true;
  }

  /**
   * Установить ошибки поля
   */
  setErrors(field: FieldPathNode<TForm, unknown>, errors: ValidationError[]): void {
    const node = this.resolveFieldNode(field.__path);
    if (node) {
      node.setErrors(errors);
    }
  }

  /**
   * Очистить ошибки поля
   */
  clearErrors(field: FieldPathNode<TForm, unknown>): void {
    const node = this.resolveFieldNode(field.__path);
    if (node) {
      node.clearErrors();
    }
  }

  /**
   * Получить всю форму целиком
   */
  getForm(): TForm {
    return this.form.getValue();
  }

  /**
   * Получить узел формы (FormNode) по строковому пути
   * @param path - Путь к полю (например, "properties", "address.city")
   * @returns FormNode или undefined если путь не найден
   */
  getFieldNode(path: string): FormNode<unknown> | undefined {
    return this.resolveFieldNode(path);
  }

  /**
   * Разрешить FieldPathNode или строковый путь в FormNode
   * @private
   *
   * ✅ Использует GroupNode.getFieldByPath для правильного парсинга путей
   * Поддерживает вложенные пути и массивы: "address.city", "items[0].name"
   */
  private resolveFieldNode(
    pathOrNode: string | FieldPathNode<TForm, unknown>
  ): FormNode<unknown> | undefined {
    const fieldPath = typeof pathOrNode === 'string' ? pathOrNode : pathOrNode.__path;

    if (!fieldPath) return undefined;

    //  Используем getFieldByPath вместо ручного парсинга
    // getFieldByPath использует FieldPathNavigator внутри
    return this.form.getFieldByPath(fieldPath);
  }

  /**
   * Получить значение поля по пути
   *
   * Разрешает путь и возвращает значение узла.
   * Это упрощенный метод для получения только значения.
   *
   * @param path - Путь к полю (например, 'address.city', 'items[0].title')
   * @returns Значение поля или undefined, если путь не найден
   * @private
   *
   * @example
   * ```typescript
   * const city = this.resolveFieldValue('address.city');
   * // 'Moscow'
   * ```
   */
  private resolveFieldValue(path: string): unknown {
    const node = this.resolveFieldNode(path);
    return node?.value.value;
  }
}
