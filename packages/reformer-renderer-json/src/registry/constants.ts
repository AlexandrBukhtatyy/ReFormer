/**
 * Зарезервированный ключ реестра для контейнера-обёртки полей.
 *
 * Зарегистрируй компонент под этим именем (обычно `FormField` из `@reformer/ui-kit`),
 * чтобы каждое поле получало label, error и hint автоматически.
 *
 * @example
 * ```typescript
 * import { defineRegistry, FIELD_WRAPPER } from '@reformer/renderer-json';
 * import { FormField } from '@reformer/ui-kit';
 *
 * const registry = defineRegistry((reg) => {
 *   reg.component(FIELD_WRAPPER, FormField);
 * });
 * ```
 */
export const FIELD_WRAPPER = '$fieldWrapper';

/**
 * Зарезервированный ключ реестра для единственного сервиса локализации.
 *
 * `reg.locale(...)` кладёт сервис под этот ключ; оператор `"$locale(key)"` резолвится через него
 * (`registry.getLocale()`). Ключ намеренно отличается от имени оператора, чтобы `$dataSource`/`$fn`
 * не могли достать сервис локализации по имени.
 *
 * @example
 * ```typescript
 * import { defineRegistry, createLocaleResolver } from '@reformer/renderer-json';
 *
 * const registry = defineRegistry((reg) => {
 *   reg.locale(createLocaleResolver({ 'fields.email.label': 'Email' }));
 * });
 * ```
 */
export const LOCALE_SERVICE = '$localeService';
