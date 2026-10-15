/**
 * Где лежит модуль формы, которой принадлежит документ, — ответ стека.
 *
 * ## Зачем точка, если у плагинов есть своё правило
 *
 * Модуль формы — каталог с её кодом: правила, поведение, точка входа для приложения. Где он лежит
 * относительно документа, решает раскладка СТЕКА, и она бывает не «рядом с документом». У ReFormer
 * документ лежит в `<модуль>/schema/`, а документ со свободным именем (`forms/credit.schema.json`)
 * своего каталога не имеет вовсе: модуль ему кодоген заводит подкаталогом по имени документа
 * (`forms/credit/`). Общие плагины — жизнь состояния превью, превью приложением — стека не знают и
 * отвечали своим правилом («каталог документа, а если он `schema` — его родитель»). Для документа
 * со свободным именем оно указывало на каталог, где лежат модули ДРУГИХ форм.
 *
 * Поэтому место модуля называет стек вкладом в {@link FormModulePoint}, а общие плагины спрашивают
 * точку и только без ответа берут своё правило.
 *
 * ## Ответ — по адресу, без диска
 *
 * Синхронно и дёшево: по пути документа и провайдеру модели. Каталога может ещё не быть — код
 * по документу не генерировали; что в нём лежит, проверяет спрашивающий.
 *
 * @module @reformer/builder-plugin-api/services/form-module
 */

import { defineExtensionPoint, type ExtensionPoint } from '../primitives/extension-point.js';
import type { ResourceId } from '../primitives/resource.js';
import type { DocumentRef } from './validation/types.js';

/** Вклад стека в {@link FormModulePoint}. */
export interface FormModuleLocator {
  /**
   * Каталог модуля формы, которой принадлежит документ, либо `null` — документ не этого стека.
   * Синхронно и без чтения диска: решает по адресу (`doc.ref.path`) и провайдеру модели
   * (`doc.providerId`).
   */
  moduleOf(doc: DocumentRef): ResourceId | null;
}

/** Точка расширения мест модулей форм. Заполняется только вкладами. */
export const FormModulePoint: ExtensionPoint<FormModuleLocator> =
  defineExtensionPoint<FormModuleLocator>('forms.module');

/**
 * Ответ точки: первый вклад, который взялся за документ; `null` — не взялся никто (тогда
 * спрашивающий берёт своё общее правило). Сбой вклада — не ответ: точку спрашивают на каждый
 * документ, и исключение одного стека не должно лишать места модуля документы остальных.
 */
export function locateFormModule(
  locators: readonly FormModuleLocator[],
  doc: DocumentRef
): ResourceId | null {
  for (const locator of locators) {
    try {
      const found = locator.moduleOf(doc);
      if (found !== null) return found;
    } catch {
      // Следующий вклад либо общее правило.
    }
  }
  return null;
}
