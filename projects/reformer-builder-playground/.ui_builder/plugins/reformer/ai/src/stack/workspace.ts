/**
 * Рабочая область стека ReFormer: то, что стек берёт у оболочки сам, мимо ассистента.
 *
 * Ассистенту — общему для стеков — каталог кита, корпус знаний о библиотеке, раскладка модуля
 * формы и составная форма ни к чему: это знание ReFormer. Поэтому стек собирает их из
 * возможностей контекста сам — тем же приёмом, что и рабочая область ассистента (`../workspace`).
 *
 * ## Корпус знаний читается из ПРОЕКТА
 *
 * `projectFiles` отвечает на один вопрос — «прочитай файл по пути», — и нужен затем, чтобы
 * ассистент знал версии `@reformer/*`, которые стоят у пользователя, а не те, с которыми
 * собран билдер. Путь здесь от корня проекта, поэтому собирается он адресацией рабочей
 * области; отсутствие файла остаётся ОТКАЗОМ, а не пустой строкой: покалеченный `llms.txt`
 * нельзя принимать за «пакета нет».
 *
 * ## Составная форма — своей дверью
 *
 * Ассистент правит ТЕКСТ формы. У разбитой формы (визард по шагам) текст корня — скелет со
 * ссылками на шаги, и править его значило бы не видеть шагов вовсе. Поэтому такой документ ход
 * видит собранной схемой, а записывает операцией через ручку модели: раскладку по файлам делает
 * документ, и ход остаётся одной записью истории. Форма одним файлом идёт обычной дверью — текстом.
 *
 * @module plugins/reformer/ai/stack/workspace
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import {
  DocumentModelsCapability,
  DocumentsServiceToken,
  KitsCapability,
  WorkspaceFilesServiceToken,
  type FormDocumentDoor,
  type ModelDocumentHandle,
  type PluginContext,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import { projectCatalog, type CatalogEntry } from '../../../core/catalog';
import {
  moduleRootOfDocument,
  moduleRootPathOf,
  modulePlacementOf,
} from '../../../core/codegen/layout';
import type { FileScope } from '../files/scope';
import type { PackageFiles } from '../knowledge';
import { parseSchemaText, printSchemaText } from '../model/schema-text';

const NO_CATALOG: readonly CatalogEntry[] = Object.freeze([]);

/** Что стек берёт у оболочки. */
export interface SchemaStackWorkspace {
  /**
   * Каталог активного кита. Функция, а не список: кит переключают, и ход обязан идти против того
   * каталога, который действует СЕЙЧАС, а не против того, что был на активации плагина.
   */
  catalog(): readonly CatalogEntry[];
  /** Чтение файлов открытого проекта — источник корпуса знаний; `undefined` — проекта нет. */
  projectFiles(): PackageFiles | undefined;
  /** Модуль формы документа или `null`: документа нет либо у него нет своей папки модуля. */
  scopeOf(id: ResourceId): FileScope | null;
  /** Дверь составной формы; `null` — форма одним файлом, и ход правит её текст как есть. */
  door(id: ResourceId): FormDocumentDoor | null;
}

/**
 * Собрать рабочую область стека. Службы рабочей области берутся `require` — их даёт сама
 * оболочка; кит и модели документов `get` — их дают плагины, вправе подняться позже.
 */
export function schemaStackWorkspace(ctx: PluginContext): SchemaStackWorkspace {
  const documents = ctx.services.require(DocumentsServiceToken);
  const files = ctx.services.require(WorkspaceFilesServiceToken);

  /** Ручка документа из нескольких файлов — или `null`. */
  const compositeOf = (id: ResourceId): ModelDocumentHandle<unknown> | null => {
    const handle = ctx.services.get(DocumentModelsCapability)?.handleOf(id) ?? null;
    const parts = handle?.document.getComposition?.()?.parts.length ?? 0;
    return handle !== null && parts > 0 ? handle : null;
  };

  return {
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

    door(id) {
      const handle = compositeOf(id);
      if (handle === null) return null;
      return {
        getText: () => printSchemaText(handle.document.getModel() as JsonFormSchema),
        write: (text, mark) => {
          // Пометка — дальше, в запись каждого файла, который ход трогает: корня и шагов.
          const outcome = handle.apply(
            { type: 'replace-schema', params: { schema: parseSchemaText(text) } },
            mark === undefined ? undefined : { write: mark }
          );
          return outcome.status === 'applied'
            ? Promise.resolve()
            : Promise.reject(new Error(`форма не принимает правку: ${outcome.reason}`));
        },
      };
    },
  };
}
