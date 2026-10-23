/**
 * Рабочая область шаблонов, собранная из ВОЗМОЖНОСТЕЙ — а не полученная портом.
 *
 * То же решение и по той же причине, что у генерации кода: порт из двадцати пяти членов собирала
 * композиция, и плагину из каталога проекта такой порт не соберёт никто. Теперь он собирается
 * здесь, из служб контекста активации.
 *
 * ## Формата формы здесь нет
 *
 * Каталог кита, печатник модуля, документ формы — знание стека: его вклады в `TemplateStackPoint`
 * и `TemplateStorePoint` (встроенные шаблоны). Рабочей области хозяина остаются ресурсы проекта,
 * запись, сохранение, стеки списком и событие смены кита — по нему перечитываются встроенные
 * шаблоны, которые стек печатает под кит.
 *
 * ## Что осталось композиции и чего нет ни у кого
 *
 * `save` — единственная операция, выносящая написанное наружу, и до появления политики прав
 * отдать её службой было нельзя. Политика появилась: служба привилегированная, право
 * `workspace.save` объявлено манифестом плагина и подтверждается человеком.
 *
 * `local` и `remove` не заполняются ВООБЩЕ, и это прежний осознанный отказ, а не потеря
 * при переезде. Постоянного хранилища у плагинов пока нет — `ctx.storage` живёт памятью
 * сессии, — и подставь мы его, локальные шаблоны исчезали бы при перезагрузке страницы без
 * всякого признака, а человек считал бы их сохранёнными. Удаления ресурса у рабочей области
 * нет вовсе: `Source.remove` до неё не проброшен.
 *
 * @module plugins/reformer/templates/workspace
 */

import {
  KitsCapability,
  DocumentsServiceToken,
  TemplateStackPoint,
  useActiveDocument,
  useTranslate,
  WorkspaceFilesServiceToken,
  WorkspaceSaveServiceToken,
  type Disposable,
  type PluginContext,
  type ResourceId,
  type ResourceRef,
} from '@reformer/builder-plugin-api';
import type { TemplatesHost, TemplatesSourceCapabilities } from './host';

/**
 * Возможность «создать форму»: список шаблонов и создание модуля формы — из шаблона или пустого.
 * Контракт — в SDK: заказчик (ассистент) живёт в другом домене (`./content/create-for`).
 */
export { FormCreatorCapability } from '@reformer/builder-plugin-api';
export type { FormCreatorService } from '@reformer/builder-plugin-api';

/**
 * Дыр у шаблонов не осталось: `save` стал привилегированной службой. Тип сохранён пустым
 * намеренно — параметр `gaps` есть у обоих плагинов, и убирать его в одном из двух значило бы
 * развести их формы ради одной строки.
 */
export type TemplatesGaps = Partial<Pick<TemplatesHost, never>>;

/**
 * Собирает рабочую область шаблонов.
 *
 * Службы рабочей области берутся `require`: их даёт САМА оболочка, они есть с запуска
 * и без проекта отвечают `null`, `false` и пустым списком. Кит — `get`: это плагин, и он вправе
 * подняться позже или не подняться вовсе.
 */
export function templatesWorkspace(ctx: PluginContext, gaps: TemplatesGaps = {}): TemplatesHost {
  const documents = ctx.services.require(DocumentsServiceToken);
  const files = ctx.services.require(WorkspaceFilesServiceToken);

  return {
    // Именованные функции: правила хуков опознают хук по имени объявления.
    useTranslate: function useTemplatesTranslate() {
      return useTranslate(ctx.i18n);
    },
    useActiveDocument: function useTemplatesActiveDocument() {
      return useActiveDocument(documents);
    },

    refOf: (id: ResourceId): ResourceRef | null => documents.documentOf(id)?.ref ?? null,

    projectRoot: files.projectRoot,
    parentOf: files.parentOf,
    resolve: files.resolve,
    list: files.list,
    exists: files.exists,
    readText: files.readText,
    invalidate: files.refresh,

    // Запись — ОДНОЙ дверью, той же, которой правит человек: пометка происхождения живёт
    // у неё, и второй путь означал бы записи, не попавшие в журнал как чужие.
    writeText: (id: ResourceId, text: string) => documents.writeText(id, text),

    sourceOf: (id: ResourceId): TemplatesSourceCapabilities | null =>
      documents.hasProject() ? { write: files.canWrite(id) } : null,

    openResource: (id: ResourceId) => {
      void documents.open(id, { preview: false }).catch((error: unknown) => {
        console.error(`[templates] открыть «${id}» не удалось`, error);
      });
    },

    // Стеки — лениво, на каждый вопрос: вклады вносят и снимают, а захваченный список показывал
    // бы состав на момент активации.
    stacks: () => ctx.extensions.get(TemplateStackPoint).map((contribution) => contribution.value),

    onDidChangeKit: (cb: () => void): Disposable =>
      ctx.services.get(KitsCapability)?.onDidChange(cb) ?? { dispose: () => {} },

    /**
     * Сохранение — ПРИВИЛЕГИРОВАННАЯ служба, и спрашивается она на каждый вызов.
     *
     * `get`, а не `require`, и не разовый захват в замыкание: право может быть не подтверждено
     * (тогда службы нет вовсе), а подтверждено — позже, чем собрана рабочая область. Отказ
     * сохранения — названная деградация: файлы остаются в рабочей копии, и это ровно то же
     * поведение, что было у плагина без порта.
     */
    save: async (ids) => (await ctx.services.get(WorkspaceSaveServiceToken)?.save(ids)) ?? false,

    ...gaps,
  };
}
