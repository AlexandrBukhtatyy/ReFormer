/**
 * Рабочая область шаблонов, собранная из ВОЗМОЖНОСТЕЙ — а не полученная портом.
 *
 * То же решение и по той же причине, что у соседа (`plugins/codegen/workspace`): порт из
 * двадцати пяти членов собирала композиция, и плагину из каталога проекта такой порт
 * не соберёт никто. Теперь он собирается здесь, из служб контекста активации.
 *
 * ## Печатник модуля — ВОЗМОЖНОСТЬ соседнего плагина
 *
 * Встроенный шаблон формы — это схема, которую надо превратить в модуль, а печатает его
 * генерация кода. Раньше переходник жил в композиции и тянул кодоген динамическим импортом
 * МИМО состава: профиль без генерации всё равно печатал бы шаблоны её кодом. Теперь это
 * возможность `codegen.modules`, и «нет кодогена — нет встроенных шаблонов» стало честной
 * деградацией вместо тихого исключения из правил.
 *
 * Спрашивается она в момент ПЕЧАТИ, а не при сборке: оба плагина ленивые, порядок активации
 * незначим, и захваченное здесь значение было бы `undefined` навсегда.
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
 * @module plugins/templates/workspace
 */

import type { CatalogEntry } from '@reformer/builder-stack-reformer/catalog';
import type { KitDescriptor } from '@reformer/builder-stack-reformer/kits';
import {
  defineCapability,
  DocumentsServiceToken,
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
import type { ModulePrinter } from './stores/builtin';

/** Активный кит в объёме, нужном шаблонам: каталог, дескриптор и «он сменился». */
export interface KitReader {
  catalog(): readonly CatalogEntry[];
  descriptor(): KitDescriptor;
  onDidChange(cb: () => void): Disposable;
}

/** Возможность «активный кит» — структурная копия с тем же идентификатором, что у провайдера. */
export const KitCapability = defineCapability<KitReader>({
  id: 'reformer.kit.catalog',
  version: '1.0.0',
});

/** Печатник модуля формы в объёме, нужном шаблонам. */
export interface ModulePrinterService {
  print(
    schema: unknown,
    formName: string,
    seed?: { readonly rules?: unknown; readonly mock?: unknown }
  ): Promise<readonly { readonly path: string; readonly content: string }[]>;
}

/** Возможность «напечатать модуль формы». Объявляет её генерация кода. */
export const ModulePrinterCapability = defineCapability<ModulePrinterService>({
  id: 'reformer.codegen.printer',
  version: '1.0.0',
});

const NO_CATALOG: readonly CatalogEntry[] = Object.freeze([]);

/** То, чему в возможностях места пока нет. */
/**
 * Дыр у шаблонов не осталось: `save` стал привилегированной службой. Тип сохранён пустым
 * намеренно — параметр `gaps` есть у обоих плагинов, и убирать его в одном из двух значило бы
 * развести их формы ради одной строки.
 */
export type TemplatesGaps = Partial<Pick<TemplatesHost, never>>;

/**
 * Печатник поверх возможности: спрашивает её на каждую печать.
 *
 * Пустой список, когда возможности нет, — тот же ответ, что и у кодогена без кита: «печатать
 * нечем». Встроенные шаблоны в этом случае просто не показываются.
 */
function printerOver(ctx: PluginContext): ModulePrinter {
  return async (schema, formName, seed) => {
    const printer = ctx.services.get(ModulePrinterCapability);
    if (printer === undefined) return [];
    return printer.print(schema, formName, seed);
  };
}

/**
 * Собирает рабочую область шаблонов.
 *
 * Службы рабочей области берутся `require`: их даёт САМА оболочка, они есть с запуска
 * и без проекта отвечают `null`, `false` и пустым списком. Кит и печатник — `get`: это
 * плагины, и они вправе подняться позже или не подняться вовсе.
 */
export function templatesWorkspace(ctx: PluginContext, gaps: TemplatesGaps = {}): TemplatesHost {
  const documents = ctx.services.require(DocumentsServiceToken);
  const files = ctx.services.require(WorkspaceFilesServiceToken);
  const kit = (): KitReader | undefined => ctx.services.get(KitCapability);

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

    catalog: () => kit()?.catalog() ?? NO_CATALOG,
    kit: (): KitDescriptor | null => kit()?.descriptor() ?? null,
    onDidChangeKit: (cb: () => void): Disposable => kit()?.onDidChange(cb) ?? { dispose: () => {} },

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

/** Печатник встроенных шаблонов: отдаётся отдельно, потому что он не член рабочей области. */
export function templatesPrinter(ctx: PluginContext): ModulePrinter {
  return printerOver(ctx);
}

/**
 * Есть ли чем печатать прямо сейчас.
 *
 * Спрашивается на каждый вопрос «доступны ли встроенные шаблоны», а не один раз при сборке:
 * генерация кода — ленивый плагин и вправе подняться позже шаблонов. Ответ, снятый при
 * активации, оставил бы раздел встроенных пустым навсегда.
 */
export function hasPrinter(ctx: PluginContext): boolean {
  return ctx.services.get(ModulePrinterCapability) !== undefined;
}
