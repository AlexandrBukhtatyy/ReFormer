/**
 * Дерево проекта как тело панели: связывает платформенное дерево с открытой сессией.
 *
 * Компонент живёт в композиции, а не в Host и не в плагине, потому что связывает как раз то,
 * что знает только она: платформенный {@link ResourceTree} с одной стороны и время жизни
 * проекта — с другой. Host про открытый проект не знает вовсе (его дерево получает хранилище
 * параметром), а плагин не вправе импортировать оболочку.
 *
 * Пустое состояние здесь не то же, что пустое состояние дерева: «проект не открыт» и «в проекте
 * пусто» — разные вещи, и человек обязан их различать, не открывая консоль.
 *
 * @module app/ProjectTree
 */

import type { ReactElement } from 'react';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@reformer/ui-kit/empty';
import type { ResourceId } from '@/shell/platform/primitives/resource';
import type { CommandRegistry } from '@/shell/platform/primitives/command';
import type { RootI18nService } from '@/shell/platform/services/i18n/i18n';
import type { WhenContextStore } from '@/shell/platform/ui/state/when-context-store';
import { ResourceTree } from '@/shell/platform/ui/state/ResourceTree';
import { useLocale, type ExtensionReader } from '@/shell/platform/ui/chrome/usePanels';
import type { ProjectReader } from './useProject';
import { useProjectSession } from './useProject';

export interface ProjectTreeProps {
  readonly project: ProjectReader;
  readonly extensions: ExtensionReader;
  readonly i18n: RootI18nService;
  /**
   * Реестр команд — для контекстного меню строки.
   *
   * Необязателен: без него дерево работает целиком, но меню не показывает. Это честная
   * деградация, а не поломка — пункт меню есть ссылка на команду, и без реестра ссылке
   * некуда вести.
   */
  readonly commands?: CommandRegistry;
  /**
   * Контекст применимости. Читается в момент открытия меню, поэтому передаётся хранилищем,
   * а не значением: подписываться на него ради дерева значило бы перерисовывать список
   * файлов на каждое движение фокуса.
   */
  readonly whenContext?: WhenContextStore;
}

export function ProjectTree({
  project,
  extensions,
  i18n,
  commands,
  whenContext,
}: ProjectTreeProps): ReactElement {
  const session = useProjectSession(project);
  // Перевод не является React-состоянием: подписка на локаль — то, что делает `t()` реактивным.
  useLocale(i18n);
  const { t } = i18n;

  if (session === null) {
    return (
      <Empty className="border-0">
        <EmptyHeader>
          <EmptyTitle className="text-sm font-medium">
            {t('shell.status.workspace.none')}
          </EmptyTitle>
          <EmptyDescription className="text-xs">{t('app.project.empty')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ResourceTree
      // Дерево пересоздаётся вместе с проектом: раскрытые уровни и выделение принадлежат
      // конкретному источнику, и переносить их на следующий было бы неверно.
      key={session.workspaceId}
      tree={session.tree}
      extensions={extensions}
      i18n={i18n}
      onOpen={(id: ResourceId, options) => {
        void session.documents.open(id, options).catch((error: unknown) => {
          console.error(`[app] ресурс не открылся: ${id}`, error);
        });
      }}
      // Чтение — ТОЛЬКО для проб декораций: само дерево содержимого не читает никогда.
      readText={(id: ResourceId) => session.workspace.readText(id)}
      commands={commands}
      whenContext={whenContext === undefined ? undefined : () => whenContext.get()}
    />
  );
}
