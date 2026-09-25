/**
 * Адрес документа для вопроса поверхностям «берётесь ли вы за него».
 *
 * Провайдер модели идёт в адрес ОБЯЗАТЕЛЬНО, когда он есть: по нему поверхность стека узнаёт
 * документ своего стека. Без него остаются вид и медиатип, а `.json` бывает схемой любого стека,
 * и поверхность ReFormer бралась бы за форму другого.
 *
 * Контекст поверхности (схема, выделение, значения, находки) собирает живой вид
 * ({@link '../live/live-service'}): схему он берёт у редактора, а не из буфера. Прежняя фабрика
 * контекста над буфером документа ушла вместе с панелью превью — после неё её звал только тест.
 *
 * @module plugins/base/preview/surface/document-ref
 */

import type { DocumentRef } from '@reformer/builder-plugin-api';
import type { LiveDocument } from '../host';

export function documentRefOf(document: LiveDocument): DocumentRef {
  return document.providerId === undefined
    ? { id: document.id, ref: document.ref, kind: document.kind }
    : { id: document.id, ref: document.ref, kind: document.kind, providerId: document.providerId };
}
