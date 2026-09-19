/**
 * Императивный handle поля. Контракт и базовая реализация живут в `@reformer/core`: handle строит
 * обёртка поля (`FormField.Control` / рендерер) из DOM-узла контрола, а композиты со своим handle
 * расширяют {@link FieldHandle}. Реэкспорт — чтобы композиты кита импортировали его по-прежнему
 * из `@/fields/field-handle`.
 */
export { makeElementFieldHandle } from '@reformer/core';
export type { FieldHandle } from '@reformer/core';
