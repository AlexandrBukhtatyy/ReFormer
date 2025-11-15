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
export class BehaviorContextImpl<TForm extends Record<string, any>>
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
    this.formNode = ((form as any)._proxyInstance || form) as GroupNodeWithControls<TForm>;
  }

  /**
   * Получить значение поля по строковому пути
   * Поддерживает вложенные пути: "address.city"
   */
  getField<_K extends keyof TForm>(path: string): any {
    return this.resolveFieldValue(path);
  }

  /**
   * Установить значение поля по строковому пути
   * Использует emitEvent: false для избежания циклов
   */
  setField<_K extends keyof TForm>(path: string, value: any): void {
    const node = this.resolveFieldNode(path);
    if (node) {
      node.setValue(value, { emitEvent: false });
    }
  }

  /**
   * Обновить componentProps поля
   */
  updateComponentProps(field: FieldPathNode<TForm, any>, props: Record<string, any>): void {
    const node = this.resolveFieldNode(field.__path);
    if (node && 'updateComponentProps' in node) {
      (node as any).updateComponentProps(props);
    }
  }

  /**
   * Перевалидировать поле
   */
  async validateField(field: FieldPathNode<TForm, any>): Promise<boolean> {
    const node = this.resolveFieldNode(field.__path);
    if (node) {
      return await node.validate();
    }
    return true;
  }

  /**
   * Установить ошибки поля
   */
  setErrors(field: FieldPathNode<TForm, any>, errors: ValidationError[]): void {
    const node = this.resolveFieldNode(field.__path);
    if (node) {
      node.setErrors(errors);
    }
  }

  /**
   * Очистить ошибки поля
   */
  clearErrors(field: FieldPathNode<TForm, any>): void {
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
  getFieldNode(path: string): FormNode<any> | undefined {
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
    pathOrNode: string | FieldPathNode<TForm, any>
  ): FormNode<any> | undefined {
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
  private resolveFieldValue(path: string): any {
    const node = this.resolveFieldNode(path);
    return node?.value.value;
  }
}
