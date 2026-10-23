/**
 * Рабочая область ассистента, собранная из ВОЗМОЖНОСТЕЙ — а не полученная портом.
 *
 * То же решение, что у генерации кода и шаблонов (`plugins/reformer/codegen/workspace`), и здесь оно
 * закрывает порт ПОЛНОСТЬЮ: у ассистента не осталось ни одной названной дыры. Всё, что он
 * делает с рабочей областью, выражено тремя глаголами — узнать активную вкладку, прочитать
 * её буфер, записать в него, — и все три есть в службе документов.
 *
 * Знания о формате формы здесь нет: каталог кита, корпус знаний, модуль формы и составная форма —
 * у стека форм (`./stack/workspace`). Документ ассистент читает как есть; свою дверь к нему стек
 * даёт сам (`FormStackSession.door`).
 *
 * ## Запись идёт ТОЙ ЖЕ дверью, что у человека
 *
 * `writeText` службы документов — это `Workspace.writeText`, и ничего сверх: наружу только
 * через сохранение оболочки. Отдельного канала записи у ассистента нет, и это граница прав,
 * а не неудобство. Пометка происхождения (`origin: 'agent'`) при этом ОБЯЗАТЕЛЬНА к пробросу:
 * без неё ход ассистента попадает в журнал как правка человека, то есть аудит теряет главное.
 * Компилятор потерю третьего аргумента не ловит — реализация с меньшим числом параметров
 * присваивается функции с бо́льшим, — поэтому она проверяется тестом.
 *
 * ## Почему переводов два
 *
 * `useTranslate` — хук для панели: локаль меняется, и компонент обязан перерисоваться.
 * `translate` — обычная функция для МОСТА: замечание к ходу («правки не применены — форма
 * закрыта») пишется в ленту вне React, там хука быть не может, а строка обязана быть
 * переведённой в момент записи. Разные вызывающие, разные формы одной службы.
 *
 * @module plugins/reformer/ai/workspace
 */

import {
  DocumentModelsCapability,
  DocumentsServiceToken,
  resourceNameOf,
  useTranslate,
  WorkspaceFilesServiceToken,
  type PluginContext,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import type { AiDocument, AiFiles, AiHost, WriteMark } from './host';

/**
 * Собирает рабочую область ассистента.
 *
 * Службы рабочей области берутся `require` — их даёт сама оболочка; модели документов `get` —
 * их дают плагины, вправе подняться позже.
 */
export function aiWorkspace(ctx: PluginContext): AiHost {
  const documents = ctx.services.require(DocumentsServiceToken);
  const files = ctx.services.require(WorkspaceFilesServiceToken);

  /**
   * Файлы рабочей копии — для режима файлов и сопутствующих файлов стека.
   *
   * Читается СЫРОЙ текст, а не собранная схема: модель правит файлы, и корень разбитой формы для
   * неё — скелет со ссылками на шаги, а не собранный визард. Открытый документ перед чтением
   * выталкивает отложенную печать модели (`flush`): пока текстовый редактор в фокусе, буфер может
   * отставать от правки в структурном редакторе.
   *
   * Пишется ВСЕГДА службой документов, и у составной формы тоже: запись корня — обычная правка
   * буфера, а запись файла шага рабочая область сама разносит в открытую форму.
   */
  const workspaceFiles: AiFiles = {
    async read(id) {
      if (documents.documentOf(id) !== null) {
        await documents.flush(id);
        const open = documents.documentOf(id);
        if (open !== null) return open.getText();
      }
      return files.readText(id);
    },
    write: (id, text, options) => documents.writeText(id, text, options),
    list: (dir) => files.list(dir),
    exists: (id) => files.exists(id),
    resolve: (dir, ...segments) => files.resolve(dir, ...segments),
    parentOf: (id) => files.parentOf(id),
    pathOf: (id) => resourceNameOf(id).path,
  };

  return {
    files: workspaceFiles,
    // Именованная функция: правила хуков опознают хук по имени объявления.
    useTranslate: function useAiTranslate() {
      return useTranslate(ctx.i18n);
    },
    translate: (key, params) => ctx.i18n.t(key, params),

    activeResource: () => documents.activeResource(),
    onDidChangeActive: (cb) => documents.onDidChange(cb),
    flush: async (id) => {
      await documents.flush(id);
    },
    open: (id) => documents.open(id, { preview: false }),
    documentOf: (id: ResourceId): AiDocument | null => {
      const document = documents.documentOf(id);
      if (document === null) return null;
      // Провайдер — у ручки модельного документа: у текстового её нет, и провайдера тоже. По нему
      // ассистент выбирает стек форм.
      const providerId = ctx.services.get(DocumentModelsCapability)?.handleOf(id)
        ?.document.providerId;
      if (providerId === undefined) return document;
      return { ref: document.ref, providerId, getText: () => document.getText() };
    },

    // Третий аргумент обязателен к пробросу, и компилятор потерю НЕ ловит: без него ход
    // ассистента лёг бы в журнал как правка человека.
    writeText: (id: ResourceId, text: string, options?: WriteMark) =>
      documents.writeText(id, text, options),
  };
}
