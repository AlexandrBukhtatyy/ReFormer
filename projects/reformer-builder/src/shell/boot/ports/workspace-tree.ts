/**
 * Дерево проекта — служба `reformer.workspace.tree`, собранная из платформы.
 *
 * Тело панели — платформенный компонент (`shell/boot/project/ProjectTree`): навигация по ресурсам
 * не предметна и живёт в оболочке целиком. А место для неё выбирает плагин — он берёт панель
 * отсюда и вносит её вкладом. Раньше тело приезжало портом плагина файлов, то есть внести
 * дерево мог только он.
 *
 * Сессия читается в момент вызова: проект закрывают и открывают заново, а служба
 * регистрируется один раз на запуск.
 *
 * @module shell/boot/ports/workspace-tree
 */

import { createElement, type ReactElement } from 'react';
import type { CommandRegistry, WorkspaceTreeService } from '@reformer/builder-plugin-api/internal';
import type { RootI18nService } from '@/shell/platform/services/i18n/i18n';
import type { ExtensionReader } from '@/shell/platform/ui/chrome/usePanels';
import { actionTargets, flattenTree } from '@/shell/platform/ui/state/resource-tree';
import type { WhenContextStore } from '@/shell/platform/ui/state/when-context-store';
import { ProjectTree } from '@/shell/boot/project/ProjectTree';
import type { ProjectHost } from '@/shell/boot/project/project';

export interface WorkspaceTreeDeps {
  readonly project: ProjectHost;
  readonly extensions: ExtensionReader;
  readonly i18n: RootI18nService;
  /** Реестр команд: его получает дерево — контекстное меню строки состоит из них. */
  readonly commands?: CommandRegistry;
  /** Контекст применимости: по нему меню решает, какие пункты гасить. */
  readonly whenContext?: WhenContextStore;
}

export function createWorkspaceTreeService(deps: WorkspaceTreeDeps): WorkspaceTreeService {
  const { project, extensions, i18n, commands, whenContext } = deps;

  // Объявлена ОДИН раз: React сравнивает тип элемента по ссылке, и новая функция на каждый
  // вопрос размонтировала бы дерево вместе с его раскрытием и прокруткой.
  const Panel = (): ReactElement =>
    createElement(ProjectTree, { project, extensions, i18n, commands, whenContext });

  return {
    Panel,

    // К чему применится действие, вызванное С КЛАВИШИ: у пункта меню цель приходит
    // аргументом, а у клавиши аргументов нет вовсе. Правило «набор, если фокус внутри
    // него, иначе одна строка» — платформенное (`actionTargets`), и повторять его у плагина
    // значило бы получить два разных ответа на один вопрос.
    selection: () => {
      const session = project.get();
      if (session === null) return [];
      return actionTargets(flattenTree(session.tree.get()));
    },
  };
}
