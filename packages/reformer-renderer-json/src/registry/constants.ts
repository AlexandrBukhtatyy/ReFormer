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
 *   reg.container(FIELD_WRAPPER, FormField);
 * });
 * ```
 */
export const FIELD_WRAPPER = '$fieldWrapper';
