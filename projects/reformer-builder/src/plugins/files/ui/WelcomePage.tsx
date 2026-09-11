/**
 * Стартовая страница: «Открыть папку…» и недавно открытые проекты.
 *
 * Стоит в центре, пока открытых вкладок нет, — и без проекта, и с ним (слот `editor.main`).
 * Вторая половина — тот же список, что в «Файл › Недавно открытые» и по `Ctrl+R`: одна проекция
 * записей рабочих областей, три места показа.
 *
 * Страница ничего не делает сама: «открыть папку» и «открыть недавний» — команды плагина,
 * и она их только зовёт. Поэтому щелчок здесь и пункт меню не могут разойтись в поведении.
 *
 * @module plugins/files/ui/WelcomePage
 */

import { useCallback, useSyncExternalStore, type ReactElement } from 'react';
import { FolderOpen } from 'lucide-react';
import { Button } from '@reformer/ui-kit/button';
import type { FilesHost, FilesRecentProject, FilesRecentProjects } from '../host';
import { WELCOME_RECENT_LIMIT } from '../recent';

/** Что страница зовёт. Команды живут в плагине — сюда приходят готовые вызовы. */
export interface WelcomePageActions {
  /** «Открыть папку…» — выбор каталога. */
  openFolder(): void;
  /** Недавний проект: с идентификатором — этот, без — весь список (`Ctrl+R`). */
  openRecent(id?: string): void;
}

export interface WelcomePageProps extends WelcomePageActions {
  readonly host: FilesHost;
}

/** Пустой список: одна ссылка вместо нового массива — её сравнивает `useSyncExternalStore`. */
const NO_PROJECTS: readonly FilesRecentProject[] = Object.freeze([]);

/** Недавние как состояние React: снимок порта стабилен между изменениями. */
function useRecentProjects(recent: FilesRecentProjects | undefined): readonly FilesRecentProject[] {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (recent === undefined) return () => undefined;
      const subscription = recent.onDidChange(listener);
      return () => {
        subscription.dispose();
      };
    },
    [recent]
  );
  const snapshot = useCallback(() => recent?.list() ?? NO_PROJECTS, [recent]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function WelcomePage({ host, openFolder, openRecent }: WelcomePageProps): ReactElement {
  const t = host.useTranslate();
  const projects = useRecentProjects(host.recent);
  const canOpen = host.canOpenProject();
  const shown = projects.slice(0, WELCOME_RECENT_LIMIT);

  return (
    <div className="flex min-h-0 flex-1 overflow-auto">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-8 py-16">
        <h1 className="text-lg font-semibold">{t('welcome.title')}</h1>

        <section aria-labelledby="files-welcome-start" className="flex flex-col gap-2">
          <h2 id="files-welcome-start" className="text-muted-foreground text-xs font-medium">
            {t('welcome.start')}
          </h2>
          <div>
            <Button
              variant="link"
              size="sm"
              className="h-auto px-0"
              disabled={!canOpen}
              onClick={openFolder}
            >
              <FolderOpen />
              {t('files.command.openProject')}
            </Button>
          </div>
          {!canOpen && <p className="text-muted-foreground text-xs">{t('welcome.unsupported')}</p>}
        </section>

        {host.recent !== undefined && (
          <section aria-labelledby="files-welcome-recent" className="flex flex-col gap-2">
            <h2 id="files-welcome-recent" className="text-muted-foreground text-xs font-medium">
              {t('welcome.recent')}
            </h2>
            {shown.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('welcome.recent.empty')}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {shown.map((project) => (
                  <li key={project.id}>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto px-0"
                      onClick={() => {
                        openRecent(project.id);
                      }}
                    >
                      {project.label}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {projects.length > WELCOME_RECENT_LIMIT && (
              <div>
                <Button
                  variant="link"
                  size="sm"
                  className="text-muted-foreground h-auto px-0"
                  onClick={() => {
                    openRecent();
                  }}
                >
                  {t('menu.recent.more')}
                </Button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
