/**
 * Рабочая область генерации, собранная из ВОЗМОЖНОСТЕЙ — а не полученная портом.
 *
 * ## Что изменилось
 *
 * Раньше весь {@link CodegenHost} собирала композиция (`shell/boot/ports/codegen`): она знала,
 * что генерации нужны документы, каталог кита, листинг каталога и путевая арифметика, — и
 * подставляла всё это параметром. Плагину из каталога проекта такой порт не соберёт никто,
 * поэтому написать «второй кодоген» было нельзя в принципе.
 *
 * Теперь тот же объект собирается ЗДЕСЬ, из служб контекста активации. Ни одна из них
 * не является привилегированной: все четыре (документы, записи рабочей области, активный кит,
 * словарь) видны любому плагину через `ctx`.
 *
 * ## Что осталось порту и почему
 *
 * Два члена: `format` и `rulesOf`. Это не остаток переноса, а названная неполнота.
 *
 * `save` отсюда ушёл: он и был тем местом, ради которого завели политику прав. Теперь это
 * привилегированная служба (`WorkspaceSaveServiceToken`), плагин просит право `workspace.save`
 * манифестом, а человек его подтверждает.
 *
 * - **`format`** требует конфигурации prettier из открытого проекта — её чтение не написано.
 * - **`rulesOf`** — сайдкар правил формы, который в v2 не проброшен ни к кому.
 *
 * @module plugins/codegen/workspace
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
} from '@reformer/builder-plugin-api';
import type { CodegenDocument, CodegenHost, CodegenSourceCapabilities } from './host';

/**
 * Активный кит в объёме, нужном генерации: каталог, дескриптор и «он сменился».
 *
 * Структурная копия, а не импорт из плагина китов: `plugins/**` не импортируют друг друга.
 * Находит она ту же службу, потому что реестр ключуется СТРОКОЙ.
 */
export interface KitReader {
  catalog(): readonly CatalogEntry[];
  descriptor(): KitDescriptor;
  onDidChange(cb: () => void): Disposable;
}

/** Возможность «активный кит» — тот же идентификатор, что у провайдера. */
export const KitCapability = defineCapability<KitReader>({
  id: 'reformer.kit.catalog',
  version: '1.0.0',
});

/** Пустой каталог: одна замороженная ссылка вместо нового массива на каждый вызов. */
const NO_CATALOG: readonly CatalogEntry[] = Object.freeze([]);

/** Один файл напечатанного модуля: путь от каталога формы и содержимое. */
export interface PrintedFile {
  readonly path: string;
  readonly content: string;
}

/** Чем затравка дополняет схему: правила формы и мок источников данных. */
export interface PrintSeed {
  readonly rules?: unknown;
  readonly mock?: unknown;
}

/**
 * Возможность «напечатать модуль формы» — то, ради чего у генерации кода есть потребители
 * помимо её собственной панели.
 *
 * Заведена ради шаблонов: встроенный шаблон формы — это схема, которую надо превратить
 * в модуль, и печатает его ровно тот же конвейер, что и панель экспорта. Раньше переходник
 * жил в композиции и тянул кодоген динамическим импортом МИМО состава: профиль без генерации
 * всё равно печатал бы шаблоны её кодом. Теперь это возможность, и «нет кодогена — нет
 * встроенных шаблонов» стало честной деградацией вместо тихого исключения из правил.
 *
 * Версия `1.0.0` — исходная.
 */
export const ModulePrinterCapability = defineCapability<ModulePrinterService>({
  id: 'reformer.codegen.printer',
  version: '1.0.0',
});

export interface ModulePrinterService {
  /** Схема и имя формы — набор файлов модуля. Пустой список означает «печатать нечем». */
  print(schema: unknown, formName: string, seed?: PrintSeed): Promise<readonly PrintedFile[]>;
}

/** То, чему в возможностях места пока нет. Всё остальное собирается из служб. */
export type CodegenGaps = Pick<CodegenHost, 'format' | 'rulesOf'>;

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
  const kit = (): KitReader | undefined => ctx.services.get(KitCapability);

  return {
    // Именованные функции: правила хуков опознают хук по имени объявления, а метод
    // в литерале для них — обычная функция.
    useTranslate: function useCodegenTranslate() {
      return useTranslate(ctx.i18n);
    },
    useActiveDocument: function useCodegenActiveDocument() {
      return useActiveDocument(documents);
    },

    documentOf: (id: ResourceId): CodegenDocument | null =>
      (documents.documentOf(id) as CodegenDocument | null) ?? null,

    // Право на запись объявляет ИСТОЧНИК, а не билдер: сгенерированные файлы уезжают туда же,
    // откуда приехала схема, и сказать «сюда писать нельзя» надо ДО первого файла.
    sourceOf: (id: ResourceId): CodegenSourceCapabilities | null =>
      documents.hasProject() ? { write: files.canWrite(id) } : null,

    catalog: () => kit()?.catalog() ?? NO_CATALOG,
    kit: (): KitDescriptor | null => kit()?.descriptor() ?? null,
    onDidChangeKit: (cb: () => void): Disposable => kit()?.onDidChange(cb) ?? { dispose: () => {} },

    parentOf: files.parentOf,
    resolve: files.resolve,
    resolveFromRoot: files.fromRoot,
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
