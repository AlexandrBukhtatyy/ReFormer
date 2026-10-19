/**
 * Рабочая область ассистента, собранная из ВОЗМОЖНОСТЕЙ — а не полученная портом.
 *
 * То же решение, что у генерации кода и шаблонов (`plugins/reformer/codegen/workspace`), и здесь оно
 * закрывает порт ПОЛНОСТЬЮ: у ассистента не осталось ни одной названной дыры. Всё, что он
 * делает с рабочей областью, выражено тремя глаголами — узнать активную вкладку, прочитать
 * её буфер, записать в него, — и все три есть в службе документов.
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
 * ## Корпус знаний читается из ПРОЕКТА
 *
 * `projectFiles` отвечает на один вопрос — «прочитай файл по пути», — и нужен затем, чтобы
 * ассистент знал версии `@reformer/*`, которые стоят у пользователя, а не те, с которыми
 * собран билдер. Путь здесь от корня проекта, поэтому собирается он адресацией рабочей
 * области; отсутствие файла остаётся ОТКАЗОМ, а не пустой строкой: покалеченный `llms.txt`
 * нельзя принимать за «пакета нет».
 *
 * @module plugins/reformer/ai/workspace
 */

import { projectCatalog, type CatalogEntry } from '../../core/catalog';
import type { JsonFormSchema } from '@reformer/renderer-json';
import {
  KitsCapability,
  DocumentModelsCapability,
  DocumentsServiceToken,
  useTranslate,
  WorkspaceFilesServiceToken,
  type ModelDocumentHandle,
  type PluginContext,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import {
  moduleRootOfDocument,
  moduleRootPathOf,
  modulePlacementOf,
} from '../../core/codegen/layout';
import { parseSchemaText, printSchemaText } from './model/schema-text';
import type { AiDocument, AiFiles, AiHost, FileScope, WriteMark } from './host';
import type { PackageFiles } from './knowledge';

const NO_CATALOG: readonly CatalogEntry[] = Object.freeze([]);

/**
 * Собирает рабочую область ассистента.
 *
 * Службы рабочей области берутся `require` — их даёт сама оболочка; кит `get` — он плагин
 * и вправе подняться позже или не подняться вовсе.
 */
export function aiWorkspace(ctx: PluginContext): AiHost {
  const documents = ctx.services.require(DocumentsServiceToken);
  const files = ctx.services.require(WorkspaceFilesServiceToken);

  /**
   * Ручка документа из нескольких файлов (визард, разбитый по шагам) — или `null`.
   *
   * Ассистент правит ТЕКСТ формы. У разбитой формы текст корня — скелет со ссылками на шаги, и
   * править его значило бы не видеть шагов вовсе. Поэтому такой документ ассистент видит
   * собранной схемой, а записывает операцией через ручку: раскладку по файлам делает документ,
   * и ход остаётся одной записью истории. Форма одним файлом идёт прежним путём — текстом.
   */
  const compositeOf = (id: ResourceId): ModelDocumentHandle<unknown> | null => {
    const handle = ctx.services.get(DocumentModelsCapability)?.handleOf(id) ?? null;
    const parts = handle?.document.getComposition?.()?.parts.length ?? 0;
    return handle !== null && parts > 0 ? handle : null;
  };

  /**
   * Файлы модуля формы — для режима файлов.
   *
   * Читается СЫРОЙ текст, а не собранная схема, как в `documentOf` выше: модель правит файлы, и
   * корень разбитой формы для неё — скелет со ссылками на шаги, а не собранный визард. Открытый
   * документ перед чтением выталкивает отложенную печать модели (`flush`): пока текстовый редактор
   * в фокусе, буфер может отставать от правки в структурном редакторе.
   *
   * Пишется ВСЕГДА службой документов, и у составной формы тоже: запись корня — обычная правка
   * буфера, а запись файла шага рабочая область сама разносит в открытую форму.
   */
  const moduleFiles: AiFiles = {
    scopeOf(id): FileScope | null {
      const document = documents.documentOf(id);
      if (document === null) return null;
      const path = document.ref.path;
      // Документу со свободным именем своей папки модуля ещё не заведено: модуль появится при
      // генерации кода, а до неё модели некуда писать правила.
      if (modulePlacementOf(path).kind === 'detached') return null;
      const rootPath = moduleRootPathOf(path);
      return {
        root: moduleRootOfDocument(files, id, path),
        rootPath,
        document: id,
        schemaPath: rootPath === '' ? path : path.slice(rootPath.length + 1),
      };
    },
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
  };

  return {
    files: moduleFiles,
    // Именованная функция: правила хуков опознают хук по имени объявления.
    useTranslate: function useAiTranslate() {
      return useTranslate(ctx.i18n);
    },
    translate: (key, params) => ctx.i18n.t(key, params),

    activeResource: () => documents.activeResource(),
    documentOf: (id: ResourceId): AiDocument | null => {
      const document = documents.documentOf(id);
      if (document === null) return null;
      const handle = compositeOf(id);
      if (handle === null) return document;
      const text = (): string => printSchemaText(handle.document.getModel() as JsonFormSchema);
      return {
        ref: document.ref,
        getText: text,
        onDidChangeContent: (cb) => handle.document.onDidChangeModel(() => cb(text())),
      };
    },

    // Третий аргумент обязателен к пробросу, и компилятор потерю НЕ ловит: без него ход
    // ассистента лёг бы в журнал как правка человека.
    writeText: (id: ResourceId, text: string, options?: WriteMark) => {
      const handle = compositeOf(id);
      if (handle === null) return documents.writeText(id, text, options);
      // Пометка — дальше, в запись каждого файла, который ход трогает: корня и шагов.
      const outcome = handle.apply(
        { type: 'replace-schema', params: { schema: parseSchemaText(text) } },
        options === undefined ? undefined : { write: options }
      );
      return outcome.status === 'applied'
        ? Promise.resolve()
        : Promise.reject(new Error(`форма не принимает правку: ${outcome.reason}`));
    },

    // Записи — ReFormer-проекция сырого каталога службы китов: служба нейтральна.
    catalog: () => {
      const kits = ctx.services.get(KitsCapability);
      return kits === undefined ? NO_CATALOG : projectCatalog(kits.catalogJson()).entries;
    },

    projectFiles: (): PackageFiles | undefined => {
      const root = files.projectRoot();
      if (root === null) return undefined;
      return {
        read: async (path: string) => {
          const text = await files.readText(files.fromRoot(root, path));
          // Отказ, а не пустая строка: у источника это так, и принять покалеченный файл
          // за отсутствующий значило бы молча подменить корпус знаний вшитым.
          if (text === null) throw new Error(`файл не прочитан: ${path}`);
          return { text };
        },
      };
    },
  };
}
