/**
 * Реализация контекста валидации
 */

import type { GroupNode } from '../nodes/group-node';
import type { FieldNode } from '../nodes/field-node';
import type { FormNode } from '../nodes/form-node';
import type { ValidationContext, TreeValidationContext } from '../types/validation-schema';
import { FieldPathNavigator } from '../utils/field-path-navigator';
import { isFormNode } from '../utils/type-guards';

/**
 * Реализация ValidationContext для валидации отдельного поля
 */
export class ValidationContextImpl<TForm extends Record<string, any> = any, TField = any>
  implements ValidationContext<TForm, TField>
{
  private form: GroupNode<TForm>;
  // @ts-ignore
  private fieldKey: keyof TForm;
  private control: FieldNode<TField>;
  private readonly pathNavigator = new FieldPathNavigator();
  private readonly contextName = 'ValidationContext';

  constructor(form: GroupNode<TForm>, fieldKey: keyof TForm, control: FieldNode<TField>) {
    this.form = form;
    this.fieldKey = fieldKey;
    this.control = control;
  }

  value(): TField {
    return this.control.value.value;
  }

  /**
   * Получить значение поля по ключу или пути
   * @param path - ключ поля (type-safe) или строковый путь для вложенных полей
   * @returns значение поля
   * @example
   * ```typescript
   * ctx.getField('email')         // Type-safe доступ
   * ctx.getField('address.city')  // Вложенный путь
   * ```
   */
  getField<K extends keyof TForm>(path: K): TForm[K];
  getField(path: string): any;
  getField(path: any): any {
    // Все пути (и простые ключи, и вложенные пути) обрабатываем через resolveFieldValue
    // FieldPathNavigator умеет работать как с простыми ключами, так и с путями
    return this.resolveFieldValue(String(path));
  }

  /**
   * Получить FormNode по пути
   *
   * Разрешает путь к узлу формы (FieldNode, GroupNode, ArrayNode).
   * Используется для получения ссылки на узел для дальнейших операций.
   *
   * @param path - Путь к полю (например, 'address.city', 'items[0].title')
   * @returns FormNode или undefined, если путь не найден
   * @private
   *
   * @example
   * ```typescript
   * const cityNode = this.resolveFieldNode('address.city');
   * if (cityNode) {
   *   cityNode.markAsTouched();
   * }
   * ```
   */
  private resolveFieldNode(path: string): FormNode<any> | undefined {
    const node = this.pathNavigator.getNodeByPath(this.form, path);
    return node ?? undefined;
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
    // Проверка на пустой путь
    if (path === '' || path == null) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[${this.contextName}] Cannot get field value for empty path`);
      }
      return undefined;
    }

    // ✅ Используем getFieldByPath из GroupNode вместо прямой навигации
    // Это работает с Proxy правильно
    const node = this.form.getFieldByPath(path);
    if (node && isFormNode(node)) {
      return node.value.value;
    }

    // Предупреждение, если поле не найдено
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[${this.contextName}] Path '${path}' not found in form`);
    }
    return undefined;
  }

  /**
   * Установить значение поля по ключу или пути
   * @param path - ключ поля (type-safe) или строковый путь для вложенных полей
   * @param value - новое значение
   * @example
   * ```typescript
   * ctx.setField('email', 'test@example.com')  // Type-safe доступ
   * ctx.setField('address.city', 'Moscow')     // Вложенный путь
   * ```
   */
  setField(path: string, value: any): void;
  setField<K extends keyof TForm>(path: K, value: TForm[K]): void;
  setField(path: any, value: any): void {
    // Все пути (и простые ключи, и вложенные пути) обрабатываем через setNestedPath
    // getFieldByPath умеет работать как с простыми ключами, так и с путями
    this.setNestedPath(String(path), value);
  }

  /**
   * Установить значение по вложенному пути (например, 'address.city')
   * @private
   */
  private setNestedPath(path: string, value: any): void {
    // Используем getFieldByPath для правильного доступа к полям
    const field = this.form.getFieldByPath(path);

    if (!field) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[ValidationContext] Path '${path}' not found in form`);
      }
      return;
    }

    // Используем type guard
    if (isFormNode(field)) {
      field.setValue(value);
    } else {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[ValidationContext] Path '${path}' is not a FormNode`);
      }
    }
  }

  formValue(): TForm {
    return this.form.getValue();
  }

  getControl(): FieldNode<TField> {
    return this.control;
  }

  getForm(): GroupNode<TForm> {
    // ✅ Возвращаем Proxy вместо настоящего GroupNode
    // Это обеспечивает согласованность с тем, что пользователь получает из makeForm
    return this.form.getProxy() as GroupNode<TForm>;
  }
}

/**
 * Реализация TreeValidationContext для cross-field валидации
 */
export class TreeValidationContextImpl<TForm extends Record<string, any> = any>
  implements TreeValidationContext<TForm>
{
  private form: GroupNode<TForm>;
  private readonly pathNavigator = new FieldPathNavigator();
  private readonly contextName = 'TreeValidationContext';

  constructor(form: GroupNode<TForm>) {
    this.form = form;
  }

  /**
   * Получить значение поля по ключу или пути
   * @param path - ключ поля (type-safe) или строковый путь для вложенных полей
   * @returns значение поля
   * @example
   * ```typescript
   * ctx.getField('email')         // Type-safe доступ
   * ctx.getField('address.city')  // Вложенный путь
   * ```
   */
  getField<K extends keyof TForm>(path: K): TForm[K];
  getField(path: string): any;
  getField(path: any): any {
    // Все пути (и простые ключи, и вложенные пути) обрабатываем через resolveFieldValue
    // FieldPathNavigator умеет работать как с простыми ключами, так и с путями
    return this.resolveFieldValue(String(path));
  }

  /**
   * Получить FormNode по пути
   *
   * Разрешает путь к узлу формы (FieldNode, GroupNode, ArrayNode).
   * Используется для получения ссылки на узел для дальнейших операций.
   *
   * @param path - Путь к полю (например, 'address.city', 'items[0].title')
   * @returns FormNode или undefined, если путь не найден
   * @private
   *
   * @example
   * ```typescript
   * const cityNode = this.resolveFieldNode('address.city');
   * if (cityNode) {
   *   cityNode.markAsTouched();
   * }
   * ```
   */
  private resolveFieldNode(path: string): FormNode<any> | undefined {
    const node = this.pathNavigator.getNodeByPath(this.form, path);
    return node ?? undefined;
  }

  /**
   * Получить значение поля по пути
   *
   * Разрешает путь и возвращает значение узла.
   * Это упрощенный метод для получения только значения.
   *
   * ✅ Делегирование FieldPathNavigator - устранение дублирования
   * ✅ Поддерживает массивы (items[0].name)
   *
   * @param path - Путь к полю (например, 'address.city', 'items[0].title')
   * @returns Значение поля или undefined, если путь не найден
   * @private
   *
   * @example
   * ```typescript
   * const city = this.resolveFieldValue('address.city');
   * // 'Moscow'
   *
   * const itemTitle = this.resolveFieldValue('items[0].title');
   * // 'Item 1'
   * ```
   */
  private resolveFieldValue(path: string): any {
    // Проверка на пустой путь
    if (path === '' || path == null) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[${this.contextName}] Cannot get field value for empty path`);
      }
      return undefined;
    }

    // ✅ Используем getFieldByPath из GroupNode вместо прямой навигации
    // Это работает с Proxy правильно
    const node = this.form.getFieldByPath(path);
    if (node && isFormNode(node)) {
      return node.value.value;
    }

    // Предупреждение, если поле не найдено
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[${this.contextName}] Path '${path}' not found in form`);
    }
    return undefined;
  }

  formValue(): TForm {
    return this.form.getValue();
  }

  getForm(): GroupNode<TForm> {
    // ✅ Возвращаем Proxy вместо настоящего GroupNode
    // Это обеспечивает согласованность с тем, что пользователь получает из makeForm
    return this.form.getProxy() as GroupNode<TForm>;
  }
}
