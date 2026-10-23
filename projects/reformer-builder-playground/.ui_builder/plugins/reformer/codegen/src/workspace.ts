/**
 * Рабочая область генерации, собранная из ВОЗМОЖНОСТЕЙ — а не полученная портом.
 *
 * ## Что изменилось
 *
 * Раньше весь {@link CodegenHost} собирала композиция (`shell/boot/ports/codegen`): она знала,
 * что генерации нужны документы, листинг каталога и путевая арифметика, — и подставляла всё это
 * параметром. Плагину из каталога проекта такой порт не соберёт никто, поэтому написать «второй
 * кодоген» было нельзя в принципе.
 *
 * Теперь тот же объект собирается ЗДЕСЬ, из служб контекста активации. Ни одна из них
 * не является привилегированной, кроме сохранения: документы, записи рабочей области, служба
 * китов и словарь видны любому плагину через `ctx`.
 *
 * ## Чего здесь нет
 *
 * Каталога кита и правил формы: оба — знание стека, и их читает стек (`CodegenStack`). Кит
 * здесь — только подпись в панели, прямо у службы китов SDK.
 *
 * ## Что осталось порту и почему
 *
 * Один член — `format`. Это не остаток переноса, а названная неполнота: форматирование требует
 * конфигурации prettier из открытого проекта, а её чтение не написано.
 *
 * `save` — привилегированная служба (`WorkspaceSaveServiceToken`): плагин просит право
 * `workspace.save` манифестом, а человек его подтверждает.
 *
 * @module plugins/reformer/codegen/workspace
 */

import {
  KitsCapability,
  DocumentsServiceToken,
  useActiveDocument,
  useTranslate,
  WorkspaceFilesServiceToken,
  WorkspaceSaveServiceToken,
  type Disposable,
  type Document,
  type KitDescriptor,
  type ModelDocument,
  type PluginContext,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import type { CodegenDocument, CodegenHost, CodegenSourceCapabilities } from './host';

/**
 * Возможность «сгенерировать код формы» — прогон панели экспорта по заказу другого плагина.
 * Контракт — в SDK: заказчик (ассистент) живёт в другом домене (`./pipeline/generate-for`).
 */
export { ModuleGeneratorCapability } from '@reformer/builder-plugin-api';
export type { ModuleGeneratorService } from '@reformer/builder-plugin-api';

/** То, чему в возможностях места пока нет. Всё остальное собирается из служб. */
export type CodegenGaps = Pick<CodegenHost, 'format'>;

/**
 * Документ службы в объёме генерации.
 *
 * Переходник, а не приведение типа: у документа службы модель — `getModel()` модельного вида,
 * а генерации нужна модель, СОГЛАСОВАННАЯ с буфером (`model()`), раскладка составного документа
 * и вид ресурса, по которому выбирается стек. Вид — тот же, что оболочка кладёт в
 * `activeResourceKind`: провайдер модели у модельного документа, тип содержимого у текстового.
 */
export function asCodegenDocument(document: Document): CodegenDocument {
  const modelDocument = document.kind === 'model' ? (document as ModelDocument) : null;
  return {
    id: document.id,
    ref: document.ref,
    resourceKind: modelDocument?.providerId ?? document.ref.mediaType,
    getText: () => document.getText(),
    model: () =>
      modelDocument !== null && modelDocument.getSyncState() === 'synced'
        ? modelDocument.getModel()
        : undefined,
    composition: () => modelDocument?.getComposition?.(),
  };
}

/**
 * Собирает рабочую область генерации.
 *
 * Службы берутся `require`, а не `get`: документы и записи рабочей области даёт САМА оболочка
 * (`platform/services/host-capabilities`), они существуют с запуска и без проекта отвечают
 * `null`, `false` и пустым списком. Правило «сервис ищется в момент использования» касается
 * сервисов ЧУЖИХ плагинов; кит поэтому и берётся `get` — его плагин вправе подняться позже
 * или не подняться вовсе.
 */
export function codegenWorkspace(ctx: PluginContext, gaps: CodegenGaps = {}): CodegenHost {
  const documents = ctx.services.require(DocumentsServiceToken);
  const files = ctx.services.require(WorkspaceFilesServiceToken);
  const kits = () => ctx.services.get(KitsCapability);

  return {
    // Именованные функции: правила хуков опознают хук по имени объявления, а метод
    // в литерале для них — обычная функция.
    useTranslate: function useCodegenTranslate() {
      return useTranslate(ctx.i18n);
    },
    useActiveDocument: function useCodegenActiveDocument() {
      return useActiveDocument(documents);
    },

    documentOf: (id: ResourceId): CodegenDocument | null => {
      const document = documents.documentOf(id);
      return document === null ? null : asCodegenDocument(document);
    },

    // Право на запись объявляет ИСТОЧНИК, а не билдер: сгенерированные файлы уезжают туда же,
    // откуда приехала схема, и сказать «сюда писать нельзя» надо ДО первого файла.
    sourceOf: (id: ResourceId): CodegenSourceCapabilities | null =>
      documents.hasProject() ? { write: files.canWrite(id) } : null,

    kit: (): KitDescriptor | null => kits()?.descriptor() ?? null,
    onDidChangeKit: (cb: () => void): Disposable =>
      kits()?.onDidChange(cb) ?? { dispose: () => {} },

    parentOf: files.parentOf,
    resolve: files.resolve,
    projectRoot: files.projectRoot,
    exists: files.exists,
    list: files.list,
    readText: files.readText,

    // Запись — ОДНОЙ дверью, той же, которой правит человек и ассистент: пометка происхождения
    // живёт у неё, и второй путь означал бы записи, не попавшие в журнал как чужие.
    writeText: (id: ResourceId, text: string) => documents.writeText(id, text),

    openResource: (id: ResourceId) => {
      void documents.open(id, { preview: false }).catch((error: unknown) => {
        console.error(`[codegen] открыть «${id}» не удалось`, error);
      });
    },

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
