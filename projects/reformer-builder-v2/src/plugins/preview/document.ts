/**
 * Что превью считает своим документом и как достаёт из него схему.
 *
 * ## Применимость решается по адресу и виду, а не по содержимому
 *
 * `PreviewSurface.applies` синхронна и дешева по контракту — её зовут на каждое открытие
 * и на каждую смену вкладки, для каждой поверхности. Читать ради неё текст значило бы
 * заплатить разбором за один вопрос «показывать ли переключатель».
 *
 * `kind === 'model'` — настоящий признак: модельным документ становится ровно тогда, когда
 * провайдер схемы согласился его разобрать. `application/json` рядом — это «пока»: композиция
 * ещё не подключила `document.model` (заведено первым приоритетом в журнале решений Э6),
 * и без второй строки превью не показалось бы вообще ни на одной форме. Строка уйдёт вместе
 * с этим «пока».
 *
 * ## Схема берётся из МОДЕЛИ, а разбор текста — запасной путь
 *
 * Модель уже разобрана и согласована с буфером; разбирать текст ещё раз означало бы получить
 * ДРУГОЙ объект и потерять structural sharing, на котором держится дешевизна сравнения.
 * Разбор остаётся ровно для документа без провайдера модели.
 *
 * @module plugins/preview/document
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import { isFormSchema } from '@/lib/form-model/normalize';
import type { DocumentRef } from '@/sdk';
import type { PreviewDocument } from './host';

/** Медиатип, под которым сегодня открывается схема формы, пока документы текстовые. */
const SCHEMA_MEDIA_TYPE = 'application/json';

/** Берётся ли превью за такой документ. Дёшево и синхронно — см. шапку модуля. */
export function isFormDocument(doc: DocumentRef): boolean {
  return doc.kind === 'model' || doc.ref.mediaType === SCHEMA_MEDIA_TYPE;
}

/**
 * Схема документа либо `null`.
 *
 * `null` — законное состояние, а не ошибка: буфер могли оставить недописанным, и превью обязано
 * сказать об этом словами, а не показать пустоту. Исключение разбора наружу не выпускает
 * по той же причине — «JSON не разобрался» это не сбой превью.
 */
export function schemaOf(doc: PreviewDocument): JsonFormSchema | null {
  const model = doc.model();
  if (isFormSchema(model)) return model;
  try {
    const parsed: unknown = JSON.parse(doc.getText());
    return isFormSchema(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
