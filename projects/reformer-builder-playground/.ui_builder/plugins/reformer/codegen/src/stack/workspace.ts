/**
 * Рабочая область стека генерации: кит ReFormer и то, чем пишет команда фикстуры.
 *
 * Модуль формы пишет хозяин генерации — у стека записи модуля нет. Своё стеку нужно на три вещи:
 *
 * - **кит** — ReFormer-проекция сырого каталога службы китов: служба нейтральна, а узлы по
 *   умолчанию и синтетика билдера — знание стека. Спрашивается на каждый вызов: кит переключают
 *   без перезагрузки, и захваченный дескриптор дал бы импорты от предыдущего кита;
 * - **печать по заказу** — возможность `reformer.codegen.printer` (шаблоны форм) печатает тем же
 *   китом;
 * - **фикстура предпросмотра** — артефакт превью, а не файл модуля: её пишет команда стека по
 *   явной просьбе, тем же маркером происхождения, что и модуль.
 *
 * Службы берутся `require`, а не `get`: документы и записи рабочей области даёт САМА оболочка,
 * они существуют с запуска и без проекта отвечают `null`, `false` и пустым списком. Кит и
 * сохранение — `get` на каждый вызов: плагин кита вправе подняться позже, а право сохранения —
 * быть подтверждённым позже, чем собрана рабочая область.
 *
 * @module plugins/reformer/codegen/stack/workspace
 */

import { projectCatalog, type CatalogEntry } from '../../../core/catalog';
import {
  DocumentsServiceToken,
  KitsCapability,
  WorkspaceFilesServiceToken,
  WorkspaceSaveServiceToken,
  type Disposable,
  type KitDescriptor,
  type ModelDocument,
  type PluginContext,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import type { FixtureHost } from './fixture-command';

/** Пустой каталог: одна замороженная ссылка вместо нового массива на каждый вызов. */
const NO_CATALOG: readonly CatalogEntry[] = Object.freeze([]);

/** Рабочая область стека. */
export interface CodegenStackWorkspace extends FixtureHost {
  /** Дескриптор активного кита; `null` — кита нет. */
  kit(): KitDescriptor | null;
  /** Кит сменился. */
  onDidChangeKit(cb: () => void): Disposable;
  /** Показать ресурс — открыть вкладку записанной фикстуры. */
  openResource(id: ResourceId): void;
  /** Ресурс активной вкладки — команде фикстуры без аргументов. */
  activeResource(): ResourceId | null;
}

/** Собрать рабочую область стека из служб контекста активации. */
export function codegenStackWorkspace(ctx: PluginContext): CodegenStackWorkspace {
  const documents = ctx.services.require(DocumentsServiceToken);
  const files = ctx.services.require(WorkspaceFilesServiceToken);
  const kits = () => ctx.services.get(KitsCapability);
  const projection = () => {
    const service = kits();
    return service === undefined ? undefined : projectCatalog(service.catalogJson());
  };

  return {
    kit: () => projection()?.descriptor ?? null,
    catalog: () => projection()?.entries ?? NO_CATALOG,
    onDidChangeKit: (cb) => kits()?.onDidChange(cb) ?? { dispose: () => {} },

    // Модель — только СОГЛАСОВАННАЯ с буфером: по устаревшей фикстура описала бы форму, которой
    // в тексте перед человеком уже нет.
    documentOf: (id) => {
      const document = documents.documentOf(id);
      if (document === null) return null;
      const model = document.kind === 'model' ? (document as ModelDocument) : null;
      return {
        id: document.id,
        ref: document.ref,
        model: () =>
          model !== null && model.getSyncState() === 'synced' ? model.getModel() : undefined,
      };
    },
    sourceOf: (id) => (documents.hasProject() ? { write: files.canWrite(id) } : null),
    resolveFromRoot: files.fromRoot,
    readText: files.readText,
    // Запись — той же дверью, которой правит человек и ассистент: пометка происхождения живёт у
    // неё, и второй путь означал бы записи, не попавшие в журнал как чужие.
    writeText: (id, text) => documents.writeText(id, text),
    save: async (ids) => (await ctx.services.get(WorkspaceSaveServiceToken)?.save(ids)) ?? false,
    activeResource: () => documents.activeResource(),
    openResource: (id) => {
      void documents.open(id, { preview: false }).catch((error: unknown) => {
        console.error(`[codegen] открыть «${id}» не удалось`, error);
      });
    },
  };
}
