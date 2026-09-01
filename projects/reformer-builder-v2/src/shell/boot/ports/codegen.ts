/**
 * Порт генерации кода, собранный из платформы.
 *
 * Ближайший родственник — порт превью: обоим нужен кит целиком, а не сведения о нём. Разница
 * в том, что превью кит РИСУЕТ, а генерация им ПИШЕТ: из дескриптора берутся спецификатор
 * импорта, потребность в шимах и имена экспортов. Кита нет — генерация отказывается, и умолчания
 * здесь нет намеренно: напечатать `@reformer/ui-kit` в проекте с чужим китом хуже, чем не
 * напечатать ничего.
 *
 * @module app/codegen-host
 */

import { useSyncExternalStore } from 'react';
import type { Disposable } from '@/shell/platform/primitives/disposable';
import { makeResourceId, type ResourceId } from '@/shell/platform/primitives/resource';
import type { ServiceRegistry } from '@/shell/platform/primitives/service';
import type { RootI18nService } from '@/shell/platform/services/i18n/i18n';
import { useLocale } from '@/shell/platform/ui/chrome/usePanels';
import type { CatalogEntry } from '@/lib/catalog/types';
import type { KitDescriptor } from '@/lib/kits/types';
import { KitsServiceToken } from '@/plugins/kits/service';
import { CODEGEN_PLUGIN_ID } from '@/plugins/codegen';
import type { CodegenDocument, CodegenHost, Translate } from '@/plugins/codegen';
import { fromRoot, parentOf, resolve } from '../resource-paths';
import type { ProjectHost } from '@/shell/boot/project/project';

export interface CodegenHostDeps {
  readonly project: ProjectHost;
  readonly i18n: RootI18nService;
  readonly services: ServiceRegistry;
}

const NO_CATALOG: readonly CatalogEntry[] = Object.freeze([]);

function makeUseTranslate(i18n: RootI18nService): () => Translate {
  const view = i18n.forPlugin(CODEGEN_PLUGIN_ID);
  function useTranslate(): Translate {
    useLocale(i18n);
    return (key, params) => view.t(key, params);
  }
  return useTranslate;
}

export function createCodegenHost(deps: CodegenHostDeps): CodegenHost {
  const { project, i18n, services } = deps;

  function useActiveDocument(): ResourceId | null {
    return useSyncExternalStore(
      (cb) => {
        const session = project.get();
        if (session === null) return () => {};
        const off = session.documents.subscribe(cb);
        return () => {
          off.dispose();
        };
      },
      () => project.get()?.documents.get().activeId ?? null,
      () => null
    );
  }

  return {
    useTranslate: makeUseTranslate(i18n),
    useActiveDocument,

    documentOf: (id: ResourceId): CodegenDocument | null =>
      (project.get()?.documents.documentOf(id) as CodegenDocument | null) ?? null,

    // Право на запись объявляет ИСТОЧНИК, а не билдер: сгенерированные файлы уезжают туда же,
    // откуда приехала схема. Источник только для чтения — генерация обязана сказать это ДО
    // первой записи, а не после половины напечатанных файлов.
    sourceOf: (id: ResourceId) => {
      void id;
      const source = project.get()?.source;
      return source === undefined ? null : { write: source.capabilities?.write === true };
    },

    catalog: () => services.get(KitsServiceToken)?.catalog() ?? NO_CATALOG,
    kit: (): KitDescriptor | null => services.get(KitsServiceToken)?.descriptor() ?? null,
    onDidChangeKit: (cb: () => void): Disposable =>
      services.get(KitsServiceToken)?.onDidChange(cb) ?? { dispose: () => {} },

    parentOf,
    resolve,

    // Корень ИСТОЧНИКА, а не каталог открытого файла: цели пользователя лежат в одном
    // месте на весь проект — тем же приёмом, что и каталог шаблонов форм.
    projectRoot: (): ResourceId | null => {
      const source = project.get()?.source;
      return source === undefined ? null : makeResourceId(source.id, '');
    },
    // Фикстура предпросмотра лежит в отдельном дереве проекта, а не в каталоге модуля формы.
    resolveFromRoot: fromRoot,

    async exists(id: ResourceId) {
      const session = project.get();
      if (session === null) return false;
      // Отсутствие ресурса — обычный ответ источника, а не авария: генерация спрашивает это
      // ровно затем, чтобы не затереть чужой файл, и отказ здесь означал бы «не знаю».
      return (await session.workspace.stat(id).catch(() => null)) !== null;
    },

    // Один уровень каталога — им генерация из дерева находит схему в щёлкнутой папке.
    // Отказ листинга (каталога нет, источник не отвечает) отдаётся пустым списком: «схемы
    // здесь не нашлось» — тот же ответ для человека, и различать его нечем.
    async list(id: ResourceId) {
      const session = project.get();
      if (session === null) return [];
      return session.workspace.list(id).catch(() => []);
    },

    async readText(id: ResourceId) {
      const session = project.get();
      if (session === null) return null;
      return session.workspace.readText(id).catch(() => null);
    },

    writeText(id: ResourceId, text: string) {
      const session = project.get();
      if (session === null) {
        return Promise.reject(new Error(`проект не открыт: писать некуда (${id})`));
      }
      return session.workspace.writeText(id, text);
    },

    async save(ids: readonly ResourceId[]) {
      const session = project.get();
      if (session === null) return false;
      const results = await Promise.all(ids.map((id) => session.workspace.save(id)));
      session.divergence.noteConflicts(results.flatMap((r) => r.conflicts ?? []));
      return results.every((r) => r.ok);
    },

    openResource(id: ResourceId) {
      const session = project.get();
      if (session === null) return;
      void session.documents.open(id, { preview: false }).catch((error: unknown) => {
        console.error(`[codegen] открыть «${id}» не удалось`, error);
      });
    },

    // `format` и `rulesOf` не передаются, и оба — честная неполнота, а не забывчивость:
    // форматирование проектным prettier требует его конфигурации из открытого проекта
    // (её чтение ещё не написано), а сайдкар правил формы в v2 не проброшен ни к кому —
    // ассистент держит правила в памяти сессии и говорит об этом вслух.
  };
}
