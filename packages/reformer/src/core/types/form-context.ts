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

import type { GroupNodeWithControls } from './group-node-proxy';

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
  readonly form: GroupNodeWithControls<TForm>;

  /**
   * Безопасно установить значение поля по строковому пути
   *
   * Автоматически использует `emitEvent: false` для предотвращения
   * бесконечных циклов в behavior схемах.
   *
   * @param path - Путь к полю (например, "address.city", "items[0].name")
   * @param value - Новое значение
   *
   * @example
   * ```typescript
   * // Сброс города при смене страны
   * watchField(path.country, (country, ctx) => {
   *   ctx.setFieldValue('city', null);
   * });
   * ```
   */
  setFieldValue(path: string, value: unknown): void;
}
