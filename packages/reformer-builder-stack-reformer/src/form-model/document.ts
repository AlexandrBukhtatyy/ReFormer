/**
 * Чей это документ: схема формы ReFormer или чужой.
 *
 * Отвечает провайдер модели — ещё при открытии, пробой содержимого, — и дальше его ответ
 * только читают: `DocumentRef.providerId`. До появления этого поля плагины стека узнавали
 * свой документ по медиатипу, а `.json` бывает схемой ЛЮБОГО стека: валидатор и превью
 * ReFormer брались бы за формы другого стека и находили в них «ошибки».
 *
 * Идентификатор живёт в пакете стека, а не в плагине редактора схемы: его сравнивают
 * валидатор, превью, кодоген и ассистент, а плагины друг друга не импортируют.
 *
 * @module @reformer/builder-stack-reformer/form-model/document
 */

/** Идентификатор провайдера модели схемы формы ReFormer. */
export const FORM_SCHEMA_PROVIDER_ID = 'form.schema';

/** То, что о документе известно без чтения: вид и провайдер (структурно — `DocumentRef`). */
export interface DocumentIdentity {
  readonly kind: string;
  readonly providerId?: string;
}

/** Документ — схема формы ReFormer: модельный, и разобрал его провайдер схемы формы. */
export function isFormSchemaDocument(doc: DocumentIdentity): boolean {
  return doc.kind === 'model' && doc.providerId === FORM_SCHEMA_PROVIDER_ID;
}
