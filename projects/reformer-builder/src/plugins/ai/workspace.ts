/**
 * Рабочая область ассистента, собранная из ВОЗМОЖНОСТЕЙ — а не полученная портом.
 *
 * То же решение, что у генерации кода и шаблонов (`plugins/codegen/workspace`), и здесь оно
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
 * @module plugins/ai/workspace
 */

import type { CatalogEntry } from '@reformer/builder-stack-reformer/catalog';
import type { JsonFormSchema } from '@reformer/renderer-json';
import {
  defineCapability,
  DocumentModelsCapability,
  DocumentsServiceToken,
  useTranslate,
  WorkspaceFilesServiceToken,
  type Disposable,
  type ModelDocumentHandle,
  type PluginContext,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import { parseSchemaText, printSchemaText } from './model/schema-text';
import type { AiDocument, AiHost, WriteMark } from './host';
import type { PackageFiles } from './knowledge';

/** Активный кит в объёме, нужном ассистенту: только каталог. */
export interface KitReader {
  catalog(): readonly CatalogEntry[];
  onDidChange(cb: () => void): Disposable;
}

/** Возможность «активный кит» — структурная копия с тем же идентификатором, что у провайдера. */
export const KitCapability = defineCapability<KitReader>({
  id: 'reformer.kit.catalog',
  version: '1.0.0',
});

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

  return {
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
      const outcome = handle.apply({
        type: 'replace-schema',
        params: { schema: parseSchemaText(text) },
      });
      return outcome.status === 'applied'
        ? Promise.resolve()
        : Promise.reject(new Error(`форма не принимает правку: ${outcome.reason}`));
    },

    catalog: () => ctx.services.get(KitCapability)?.catalog() ?? NO_CATALOG,

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
