/**
 * Реализация контекста валидации
 */

import type { GroupNode } from '../nodes/group-node';
import type { FieldNode } from '../nodes/field-node';
import type { FormNode } from '../nodes/form-node';
import type { ValidationContext, TreeValidationContext } from '../types/validation-schema';
import { FieldPathNavigator } from '../utils/field-path-navigator';

/**
 * Type guard для проверки, является ли объект FormNode
 */
function isFormNode(value: any): value is FormNode<any> {
  return (
    value &&
    typeof value === 'object' &&
    'value' in value &&
    'valid' in value &&
    'setValue' in value &&
    'getValue' in value
  );
}

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
    if (typeof path !== 'string') {
      // Type-safe доступ через ключ
      const field = (this.form as any)[path];

      if (!field) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[ValidationContext] Path '${String(path)}' not found in form`);
        }
        return undefined;
      }

      // Используем type guard вместо duck typing
      return isFormNode(field) ? field.value.value : field;
    }

    // String path для вложенных полей
    return this.resolveNestedPath(path);
  }

  /**
   * Resolve вложенного пути (например, 'address.city')
   *
   * ✅ Делегирование FieldPathNavigator - устранение дублирования
   *
   * @private
   */
  private resolveNestedPath(path: string): any {
    // ✅ Используем FieldPathNavigator вместо ручной логики
    return this.pathNavigator.getFormNodeValue(this.form, path);
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
    if (typeof path !== 'string') {
      // Type-safe доступ через ключ
      const field = (this.form as any)[path];

      if (!field) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[ValidationContext] Path '${String(path)}' not found in form`);
        }
        return;
      }

      // Используем type guard для проверки наличия setValue
      if (isFormNode(field)) {
        field.setValue(value);
      } else {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[ValidationContext] Path '${String(path)}' is not a FormNode`);
        }
      }
      return;
    }

    // String path для вложенных полей
    this.setNestedPath(path, value);
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
    return this.form;
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
    if (typeof path !== 'string') {
      // Type-safe доступ через ключ
      const field = (this.form as any)[path];

      if (!field) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[TreeValidationContext] Path '${String(path)}' not found in form`);
        }
        return undefined;
      }

      // Используем type guard вместо duck typing
      return isFormNode(field) ? field.value.value : field;
    }

    // String path для вложенных полей
    return this.resolveNestedPath(path);
  }

  /**
   * Resolve вложенного пути (например, 'address.city', 'items[0].title')
   *
   * ✅ Делегирование FieldPathNavigator - устранение дублирования
   * ✅ Теперь поддерживает массивы (items[0].name)
   *
   * @private
   */
  private resolveNestedPath(path: string): any {
    // ✅ Используем FieldPathNavigator вместо ручной логики split('.')
    // Теперь корректно обрабатывает массивы!
    return this.pathNavigator.getFormNodeValue(this.form, path);
  }

  formValue(): TForm {
    return this.form.getValue();
  }

  getForm(): GroupNode<TForm> {
    return this.form;
  }
}
