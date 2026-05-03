/**
 * Реализация контекста валидации
 *
 * Использует паттерн наследования для устранения дублирования кода
 * между различными типами контекстов валидации.
 */

import type { GroupNode } from '../nodes/group-node';
import type { FieldNode } from '../nodes/field-node';
import type { FormProxy } from '../types/form-proxy';
import type { FormContext } from '../types/form-context';
import { isFormNode } from '../utils/type-guards';

// ============================================================================
// Base Validation Context (общая логика)
// ============================================================================

/**
 * Базовый класс контекста валидации
 * Содержит общую логику для всех типов контекстов
 * @internal
 */
abstract class BaseValidationContext<TForm> implements FormContext<TForm> {
  protected readonly _form: GroupNode<TForm>;

  /**
   * Форма с типизированным Proxy-доступом к полям
   */
  public readonly form: FormProxy<TForm>;

  constructor(form: GroupNode<TForm>) {
    this._form = form;

    // Получаем Proxy для типизированного доступа
    // Кэшируем proxy если он уже создан, иначе создаём новый
    this.form = ((form as unknown as { _proxyInstance?: FormProxy<TForm> })._proxyInstance ||
      form.getProxy()) as FormProxy<TForm>;
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

  /**
   * Получить поле формы по строковому пути
   */
  getFieldByPath(path: string) {
    return this._form.getFieldByPath(path);
  }
}

// ============================================================================
// Field Validation Context (для обычных валидаторов)
// ============================================================================

/**
 * Контекст валидации одного поля. Создаётся фреймворком и передаётся в валидаторы
 * (`required`, `validate`, …) — напрямую инстанцировать не нужно.
 *
 * @example
 * ```typescript
 * import { validate } from '@reformer/core/validators';
 *
 * validate(path.password, (value, ctx) => {
 *   // ctx — экземпляр ValidationContextImpl, доступ к ctx.form для cross-field логики
 *   if (value !== ctx.form.confirmPassword.value) {
 *     return { code: 'mismatch', message: 'Пароли не совпадают' };
 *   }
 *   return null;
 * });
 * ```
 */
export class ValidationContextImpl<TForm, TField> extends BaseValidationContext<TForm> {
  private control: FieldNode<TField>;

  constructor(form: GroupNode<TForm>, _fieldKey: keyof TForm, control: FieldNode<TField>) {
    super(form);
    this.control = control;
  }

  /**
   * Получить текущее значение поля (внутренний метод для validation-applicator)
   * @internal
   */
  value(): TField {
    return this.control.value.value;
  }
}

// ============================================================================
// Tree Validation Context (для cross-field валидаторов)
// ============================================================================

/**
 * Контекст cross-field валидации. Передаётся в `validateTree`/`validateForm`
 * callback'и — напрямую инстанцировать не нужно.
 *
 * @example
 * ```typescript
 * import { validateForm } from '@reformer/core';
 *
 * validateForm(form, (ctx) => {
 *   // ctx — экземпляр TreeValidationContextImpl
 *   if (ctx.form.startDate.value > ctx.form.endDate.value) {
 *     return [{ code: 'date-range', message: 'Дата начала позже даты окончания' }];
 *   }
 *   return [];
 * });
 * ```
 */
export class TreeValidationContextImpl<TForm> extends BaseValidationContext<TForm> {
  constructor(form: GroupNode<TForm>) {
    super(form);
  }
}

// ============================================================================
// Array Validation Context (для валидации ArrayNode)
// ============================================================================

/**
 * Контекст валидации для ArrayNode
 * Предоставляет доступ к значению массива
 */
export class ArrayValidationContextImpl<TForm, TItem> extends BaseValidationContext<TForm> {
  private arrayValue: TItem[];

  constructor(form: GroupNode<TForm>, _fieldKey: keyof TForm, arrayValue: TItem[]) {
    super(form);
    this.arrayValue = arrayValue;
  }

  /**
   * Получить текущее значение массива (для валидатора)
   * @internal
   */
  value(): TItem[] {
    return this.arrayValue;
  }
}
