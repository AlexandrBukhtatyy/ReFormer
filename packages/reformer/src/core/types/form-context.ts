/**
 * Единый контекст для работы с формой
 *
 * Используется в:
 * - Behavior схемах (watchField, copyFrom, transformValue, etc.)
 * - Validation схемах (validate, validateAsync, validateTree)
 *
 * @example
 * ```typescript
 * // Behavior
 * watchField(path.country, (country, ctx) => {
 *   ctx.form.city.updateComponentProps({ options: cities });
 *   ctx.setFieldValue('city', null);
 * });
 *
 * // Validation
 * validate(path.email, (value, ctx) => {
 *   if (!value) return { code: 'required', message: 'Required' };
 *   const confirm = ctx.form.confirmEmail.value.value;
 *   if (value !== confirm) return { code: 'mismatch', message: 'Emails must match' };
 *   return null;
 * });
 * ```
 */

import type { FormProxy } from './form-proxy';
import type { FieldPathNode } from './field-path';
import type { FormNode } from '../nodes/form-node';
import type { FormValue } from './index';

/**
 * Единый контекст для работы с формой
 *
 * Предоставляет:
 * - `form` - типизированный Proxy-доступ к полям формы
 * - `setFieldValue` - безопасная установка значения (emitEvent: false)
 */
export interface FormContext<TForm> {
  /**
   * Форма с типизированным Proxy-доступом к полям
   *
   * Позволяет обращаться к полям напрямую через точечную нотацию:
   * - `ctx.form.email` → FieldNode
   * - `ctx.form.address.city` → FieldNode (вложенный)
   * - `ctx.form.items` → ArrayNode
   *
   * @example
   * ```typescript
   * // Получить значение
   * ctx.form.email.value.value
   *
   * // Установить значение (⚠️ может вызвать цикл в behavior!)
   * ctx.form.email.setValue('new@mail.com')
   *
   * // Безопасно установить значение
   * ctx.form.email.setValue('new@mail.com', { emitEvent: false })
   *
   * // Обновить пропсы компонента
   * ctx.form.city.updateComponentProps({ options: cities })
   *
   * // Валидация поля
   * await ctx.form.email.validate()
   *
   * // Работа с массивами
   * ctx.form.items.push({ title: 'New' })
   * ctx.form.items.clear()
   * ```
   */
  readonly form: FormProxy<TForm>;

  /**
   * Безопасно установить значение поля по строковому пути или FieldPath
   *
   * Автоматически использует `emitEvent: false` для предотвращения
   * бесконечных циклов в behavior схемах.
   *
   * @param path - Путь к полю (строка или FieldPath)
   * @param value - Новое значение
   *
   * @example
   * ```typescript
   * // Сброс города при смене страны (строковый путь)
   * watchField(path.country, (country, ctx) => {
   *   ctx.setFieldValue('city', null);
   * });
   *
   * // Использование FieldPath напрямую (более типобезопасно)
   * watchField(path.country, (country, ctx) => {
   *   ctx.setFieldValue(path.city, null);
   * });
   * ```
   */
  setFieldValue(path: string | FieldPathNode<TForm, unknown>, value: unknown): void;

  /**
   * Получить поле формы по строковому пути
   *
   * Используется для динамического доступа к вложенным полям,
   * особенно в модульных behavior схемах, применяемых через apply().
   *
   * @param path - Строковый путь к полю (например "address.city")
   * @returns FormNode или undefined если поле не найдено
   *
   * @example
   * ```typescript
   * // В модульной behavior схеме, применяемой к вложенному полю:
   * // apply([path.registrationAddress, path.residenceAddress], addressBehavior)
   *
   * watchField(path.region, (region, ctx) => {
   *   // path.city.__path = "registrationAddress.city" или "residenceAddress.city"
   *   const cityField = ctx.getFieldByPath(path.city.__path);
   *   cityField?.updateComponentProps({ options: cities });
   * });
   * ```
   */
  getFieldByPath(path: string): FormNode<FormValue> | undefined;
}
