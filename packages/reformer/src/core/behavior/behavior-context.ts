/**
 * BehaviorContext - контекст для behavior callback функций
 *
 * Реализует FormContext для behavior схем
 */

import type { GroupNode } from '../nodes/group-node';
import type { FormProxy } from '../types/form-proxy';
import type { FormContext } from '../types/form-context';
import type { FieldPathNode } from '../types/field-path';

/**
 * Реализация BehaviorContext (FormContext)
 *
 * Предоставляет:
 * - `form` - прямой типизированный доступ к форме
 * - `setFieldValue` - безопасная установка значения (emitEvent: false)
 */
export class BehaviorContextImpl<TForm> implements FormContext<TForm> {
  /**
   * Форма с типизированным Proxy-доступом к полям
   */
  public readonly form: FormProxy<TForm>;

  private _form: GroupNode<TForm>;

  constructor(form: GroupNode<TForm>) {
    this._form = form;
    // Используем _proxyInstance если доступен, иначе fallback на form
    const proxy = ((form as unknown as { _proxyInstance?: FormProxy<TForm> })._proxyInstance ||
      form) as FormProxy<TForm>;

    this.form = proxy;
  }

  /**
   * Безопасно установить значение поля по строковому пути или FieldPath
   *
   * Автоматически использует emitEvent: false для предотвращения циклов
   *
   * @param path - Строковый путь к полю или FieldPath объект
   * @param value - Новое значение
   */
  setFieldValue(path: string | FieldPathNode<TForm, unknown>, value: unknown): void {
    // Преобразуем FieldPath в строку если необходимо
    const pathStr = typeof path === 'string' ? path : path.__path;
    const node = this._form.getFieldByPath(pathStr);
    if (node) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      node.setValue(value as any, { emitEvent: false });
    }
  }

  /**
   * Получить поле формы по строковому пути
   *
   * Используется для динамического доступа к вложенным полям, например:
   * - `ctx.getFieldByPath('address.city')` -> FieldNode
   * - `ctx.getFieldByPath(path.city.__path)` -> FieldNode (для nested behaviors)
   *
   * @param path - Строковый путь к полю (например "address.city")
   * @returns FieldNode или undefined если поле не найдено
   */
  getFieldByPath(path: string) {
    return this._form.getFieldByPath(path);
  }
}
