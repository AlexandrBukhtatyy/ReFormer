/**
 * Порт плагина файлов, собранный из платформы.
 *
 * Здесь и только здесь встречаются две стороны: структурные типы, которые объявил плагин
 * (`plugins/files/host`), и настоящие вещи Host — дерево, рабочая область, вкладки, словарь.
 * Компиляция этого модуля и есть проверка того, что копии не разошлись с оригиналами:
 * разойдись `PanelContribution` со своей структурной копией — ошибка будет тут, в одном месте,
 * а не в плагине, который про оболочку ничего не знает.
 *
 * Все методы читают ТЕКУЩУЮ сессию в момент вызова. Захватывать её в замыкание нельзя:
 * проект закрывают и открывают заново, а плагин активируется один раз — захваченная сессия
 * означала бы «сохранить» в область, которой больше нет.
 *
 * @module shell/boot/ports/files
 */

import { createElement, type ReactElement } from 'react';
import { isTextMediaType, type ResourceId } from '@/shell/platform/primitives/resource';
import type { CommandRegistry } from '@/shell/platform/primitives/command';
import type { RootI18nService } from '@/shell/platform/services/i18n/i18n';
import type { WhenContextStore } from '@/shell/platform/ui/state/when-context-store';
import { actionTargets, flattenTree } from '@/shell/platform/ui/state/resource-tree';
import type { ExtensionReader } from '@/shell/platform/ui/chrome/usePanels';
import { useLocale } from '@/shell/platform/ui/chrome/usePanels';
import type { FilesDocument, FilesHost, Translate } from '@/plugins/files/host';
import { FILES_PLUGIN_ID } from '@/plugins/files/plugin';
import { makeUseDiagnosticMessage, makeUseHostMessage } from './monaco';
import { ProjectTree } from '@/shell/boot/project/ProjectTree';
import type { ProjectHost } from '@/shell/boot/project/project';

export interface FilesHostDeps {
  readonly project: ProjectHost;
  readonly extensions: ExtensionReader;
  readonly i18n: RootI18nService;
  /** Реестр команд: его получает дерево — контекстное меню строки состоит из них. */
  readonly commands?: CommandRegistry;
  /** Контекст применимости: по нему меню решает, какие пункты гасить. */
  readonly whenContext?: WhenContextStore;
}

/**
 * Реактивный перевод в пространстве имён плагина.
 *
 * Именованная функция, а не метод объекта: правила хуков опознают хук по имени объявления,
 * и метод `useTranslate() {}` в литерале для них — обычная функция.
 */
function makeUseTranslate(i18n: RootI18nService): () => Translate {
  const view = i18n.forPlugin(FILES_PLUGIN_ID);
  function useTranslate(): Translate {
    useLocale(i18n);
    return (key, params) => view.t(key, params);
  }
  return useTranslate;
}

export function createFilesHost(deps: FilesHostDeps): FilesHost {
  const { project, extensions, i18n, commands, whenContext } = deps;

  const ResourceTreePanel = (): ReactElement =>
    createElement(ProjectTree, { project, extensions, i18n, commands, whenContext });

  return {
    ResourceTreePanel,
    useTranslate: makeUseTranslate(i18n),
    useDiagnosticMessage: makeUseDiagnosticMessage(i18n),
    // Заголовок исправления — ГОТОВЫЙ ключ словаря Host, без приставки: приставка `errors.`
    // существует для кодов диагностик, а у исправления кода нет.
    useQuickFixTitle: makeUseHostMessage(i18n),

    // Без этого строки панели проблем — список, а не навигация. Открываем НЕ в режиме
    // предпросмотра: человек пришёл чинить находку, а не посмотреть, и вкладка обязана
    // остаться после следующего щелчка.
    openResource(id: ResourceId) {
      const session = project.get();
      if (session === null) return;
      void session.documents.open(id, { preview: false }).catch((error: unknown) => {
        console.error(`[files] переход к «${id}» не удался`, error);
      });
    },

    canOpenProject: () => project.canOpen(),
    hasProject: () => project.get() !== null,
    openProject: () => project.open(),

    // Отказ-конфликт виден ТОЛЬКО тому, кто позвал сохранение: `SaveResult` не событие,
    // а возврат. Значит каждое место вызова обязано провести отказ в наблюдение само —
    // иначе найденное источником расхождение никуда не попадёт и счётчик останется нулём.
    async save(id: ResourceId) {
      const session = project.get();
      if (session === null) return false;
      const result = await session.workspace.save(id);
      session.divergence.noteConflicts(result.conflicts ?? []);
      return result.ok;
    },

    async saveAll() {
      const session = project.get();
      if (session === null) return false;
      const result = await session.workspace.save();
      session.divergence.noteConflicts(result.conflicts ?? []);
      return result.ok;
    },

    activeResource: () => project.get()?.documents.get().activeId ?? null,
    isDirty: () => project.get()?.workspace.isDirty() ?? false,

    documentOf: (id: ResourceId): FilesDocument | null =>
      project.get()?.documents.documentOf(id) ?? null,

    writeText(id: ResourceId, text: string) {
      const session = project.get();
      // Отказ, а не тишина: правка, ушедшая в никуда, выглядит как сохранённая.
      if (session === null) {
        return Promise.reject(new Error(`проект не открыт: писать некуда (${id})`));
      }
      return session.workspace.writeText(id, text);
    },

    isTextual: (mediaType: string) => isTextMediaType(mediaType),

    // Операции читаются из ТЕКУЩЕЙ сессии на каждый вызов: проект закрывают и открывают
    // заново, а плагин активируется один раз — захваченные операции писали бы в источник,
    // которого уже нет.
    resources: () => project.get()?.resources ?? null,

    // К чему применится действие, вызванное С КЛАВИШИ: у пункта меню цель приходит
    // аргументом, а у клавиши аргументов нет вовсе. Правило «набор, если фокус внутри
    // него, иначе одна строка» — платформенное (`actionTargets`), и повторять его здесь
    // значило бы получить два разных ответа на один вопрос.
    treeSelection: () => {
      const session = project.get();
      if (session === null) return [];
      return actionTargets(flattenTree(session.tree.get()));
    },

    treeRoot: () => project.get()?.tree.get().rootId ?? null,
  };
}
