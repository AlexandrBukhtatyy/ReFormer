/**
 * Реализация контекста валидации
 */

import type { GroupNode } from '../nodes/group-node';
import type { FieldNode } from '../nodes/field-node';
import type { GroupNodeWithControls } from '../types/group-node-proxy';
import type { FormContext } from '../types/form-context';
import { isFormNode } from '../utils/type-guards';

// ============================================================================
// Field Validation Context (для обычных валидаторов)
// ============================================================================

/**
 * Реализация контекста валидации для отдельного поля
 * Реализует FormContext
 */
export class ValidationContextImpl<TForm, TField> implements FormContext<TForm> {
  private _form: GroupNode<TForm>;
  private control: FieldNode<TField>;

  /**
   * Форма с типизированным Proxy-доступом к полям
   */
  public readonly form: GroupNodeWithControls<TForm>;

  constructor(form: GroupNode<TForm>, _fieldKey: keyof TForm, control: FieldNode<TField>) {
    this._form = form;
    this.control = control;

    // Получаем Proxy для типизированного доступа
    this.form = ((form as unknown as { _proxyInstance?: GroupNodeWithControls<TForm> })
      ._proxyInstance || form.getProxy()) as GroupNodeWithControls<TForm>;
  }

  /**
   * Получить текущее значение поля (внутренний метод для validation-applicator)
   * @internal
   */
  value(): TField {
    return this.control.value.value;
  }

  /**
   * Безопасно установить значение поля по строковому пути
   * Автоматически использует emitEvent: false для предотвращения циклов
   */
  setFieldValue(path: string, value: unknown): void {
    const node = this._form.getFieldByPath(path);
    if (node && isFormNode(node)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      node.setValue(value as any, { emitEvent: false });
    }
  }
}

// ============================================================================
// Tree Validation Context (для cross-field валидаторов)
// ============================================================================

/**
 * Реализация контекста для cross-field валидации
 * Реализует FormContext
 */
export class TreeValidationContextImpl<TForm> implements FormContext<TForm> {
  private _form: GroupNode<TForm>;

  /**
   * Форма с типизированным Proxy-доступом к полям
   */
  public readonly form: GroupNodeWithControls<TForm>;

  constructor(form: GroupNode<TForm>) {
    this._form = form;

    // Получаем Proxy для типизированного доступа
    this.form = ((form as unknown as { _proxyInstance?: GroupNodeWithControls<TForm> })
      ._proxyInstance || form.getProxy()) as GroupNodeWithControls<TForm>;
  }

  /**
   * Безопасно установить значение поля по строковому пути
   * Автоматически использует emitEvent: false для предотвращения циклов
   */
  setFieldValue(path: string, value: unknown): void {
    const node = this._form.getFieldByPath(path);
    if (node && isFormNode(node)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      node.setValue(value as any, { emitEvent: false });
    }
  }
}

// ============================================================================
// Array Validation Context (для валидации ArrayNode)
// ============================================================================

/**
 * Реализация контекста валидации для ArrayNode
 * Позволяет валидаторам типа notEmpty работать с массивами
 */
export class ArrayValidationContextImpl<TForm, TItem> implements FormContext<TForm> {
  private _form: GroupNode<TForm>;
  private arrayValue: TItem[];

  /**
   * Форма с типизированным Proxy-доступом к полям
   */
  public readonly form: GroupNodeWithControls<TForm>;

  constructor(form: GroupNode<TForm>, _fieldKey: keyof TForm, arrayValue: TItem[]) {
    this._form = form;
    this.arrayValue = arrayValue;

    // Получаем Proxy для типизированного доступа
    this.form = ((form as unknown as { _proxyInstance?: GroupNodeWithControls<TForm> })
      ._proxyInstance || form.getProxy()) as GroupNodeWithControls<TForm>;
  }

  /**
   * Получить текущее значение массива (для валидатора)
   * @internal
   */
  value(): TItem[] {
    return this.arrayValue;
  }

  /**
   * Безопасно установить значение поля по строковому пути
   * Автоматически использует emitEvent: false для предотвращения циклов
   */
  setFieldValue(path: string, value: unknown): void {
    const node = this._form.getFieldByPath(path);
    if (node && isFormNode(node)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      node.setValue(value as any, { emitEvent: false });
    }
  }
}
