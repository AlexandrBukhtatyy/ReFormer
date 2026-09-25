/**
 * Недавно открытые проекты: команды и подменю «Файл › Недавно открытые».
 *
 * ## Почему здесь, а не в оболочке
 *
 * Список платформенный — записи рабочих областей держит держатель проекта. А решение «показать
 * его подменю «Файл» и открывать проект вот этой командой» — предметное, то же, что у «Открыть
 * папку…». Поэтому данные и глагол «открыть по id» приходят портом (`FilesHost.recent`),
 * а подменю, команды и стартовую страницу вносит плагин.
 *
 * ## Одна команда на «открыть недавний»
 *
 * `files.openRecent` с `{ id }` открывает этот проект, без аргументов — показывает весь список.
 * Пункты подменю и строки стартовой страницы ссылаются на неё же: одно действие — одна
 * команда в палитре, в меню, у клавиши и у ассистента.
 *
 * @module plugins/base/files/recent
 */

import type {
  CommandContribution,
  MenuContribution,
  MenuDynamicItem,
  PromptPickItem,
  PromptService,
} from '@reformer/builder-plugin-api';
import type { FilesRecentProject, FilesRecentProjects } from './host';
import { FILES_PLUGIN_ID } from './plugin';

/** Открыть недавний проект: с `{ id }` — этот, без аргументов — выбор из списка. */
export const OPEN_RECENT_COMMAND_ID = 'files.openRecent';

/** Убрать из списка все недавние проекты, кроме открытого. */
export const CLEAR_RECENT_COMMAND_ID = 'files.clearRecent';

/** Адрес подменю «Файл › Недавно открытые». */
export const RECENT_SUBMENU = 'file/recent';

/** Сколько проектов показывает подменю — столько же, сколько VS Code. */
export const MENU_RECENT_LIMIT = 10;

/** Сколько проектов показывает стартовая страница; остальное — за «Ещё…». */
export const WELCOME_RECENT_LIMIT = 5;

export interface RecentCommandsDeps {
  readonly recent: FilesRecentProjects;
  /** Служба запросов. Без неё список не показать и очистку не подтвердить. */
  readonly prompt?: PromptService | null;
  /** Подпись даты у пункта списка. Параметр — ради тестов: `Intl` зависит от окружения. */
  readonly formatDate?: (timestamp: number) => string;
}

/** Идентификатор проекта из аргументов команды. Проверяется, а не приводится. */
function projectIdOf(args: unknown): string | null {
  if (typeof args !== 'object' || args === null) return null;
  const id = (args as { id?: unknown }).id;
  return typeof id === 'string' && id !== '' ? id : null;
}

/**
 * Дата последнего открытия — в локали браузера.
 *
 * Нужна не для красоты: File System Access не даёт пути, и два каталога с именем `forms`
 * различимы в списке только тем, когда их открывали.
 */
function defaultFormatDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    timestamp
  );
}

function pickItem(
  project: FilesRecentProject,
  formatDate: (timestamp: number) => string
): PromptPickItem {
  return { id: project.id, label: project.label, description: formatDate(project.lastOpenedAt) };
}

export function recentCommands(deps: RecentCommandsDeps): readonly CommandContribution[] {
  const { recent } = deps;
  const formatDate = deps.formatDate ?? defaultFormatDate;

  return [
    {
      id: OPEN_RECENT_COMMAND_ID,
      titleKey: 'files.command.openRecent',
      keybinding: 'mod+r',
      // Сочетание обязано работать и в поле ввода, и в Monaco: браузер отдаёт `Ctrl+R`
      // странице, только если правило сработало, — иначе страница перезагрузится.
      allowInEditable: true,
      // `enabled` нет намеренно, по той же причине: недоступная команда не гасит нажатие,
      // и `Ctrl+R` при пустом списке перезагружал бы страницу. Пустой список — это список,
      // в котором написано «недавних нет».
      async run(args) {
        const id = projectIdOf(args);
        if (id !== null) return recent.open(id);

        const prompt = deps.prompt;
        if (prompt == null) return false;
        // Повторное `Ctrl+R` при открытом списке доходит сюда же: область окна даёт приоритет,
        // а не исключительность. Второй список в очереди за первым был бы окном, которое
        // открывается само, стоит закрыть первое.
        if (prompt.current() !== null) return false;

        const chosen = await prompt.pick({
          titleKey: 'recent.pick.title',
          placeholderKey: 'recent.pick.placeholder',
          emptyKey: 'recent.pick.empty',
          items: recent.list().map((project) => pickItem(project, formatDate)),
          remove: {
            labelKey: 'recent.pick.remove',
            run: (projectId) => recent.forget(projectId),
          },
          pluginId: FILES_PLUGIN_ID,
        });
        if (chosen === null) return false;
        return recent.open(chosen);
      },
    },
    {
      id: CLEAR_RECENT_COMMAND_ID,
      titleKey: 'files.command.clearRecent',
      enabled: () => deps.prompt != null && recent.list().length > 0,
      async run() {
        const prompt = deps.prompt;
        if (prompt == null) return false;
        const confirmed = await prompt.confirm({
          titleKey: 'recent.clear.title',
          descriptionKey: 'recent.clear.description',
          confirmKey: 'recent.clear.confirm',
          pluginId: FILES_PLUGIN_ID,
        });
        if (!confirmed) return false;
        await recent.clear();
        return true;
      },
    },
  ];
}

/**
 * Подменю «Файл › Недавно открытые»: до десяти проектов, «Ещё…» и очистка.
 *
 * Три группы, а не список с разделителями вручную: линии между проектами, «Ещё…» и очисткой
 * появятся сами. Подменю остаётся и при пустом списке — «Ещё…» и очистка в нём есть всегда,
 * и меню не меняет состав от того, открывал ли человек что-нибудь раньше.
 */
export function recentMenuItems(
  recent: FilesRecentProjects
): readonly { id: string; value: MenuContribution }[] {
  const onDidChange = (cb: () => void) => recent.onDidChange(cb);

  return [
    {
      id: 'files.menu.recent',
      value: {
        kind: 'submenu',
        menu: 'file',
        submenu: RECENT_SUBMENU,
        titleKey: 'menu.recent',
        // Сразу за «Открыть папку…»: тот же вопрос «с чем работать», другой ответ.
        group: '1_open',
        order: 10,
        onDidChange,
      },
    },
    {
      id: 'files.menu.recent.projects',
      value: {
        kind: 'dynamic',
        menu: RECENT_SUBMENU,
        group: '1_projects',
        items: (): readonly MenuDynamicItem[] =>
          recent
            .list()
            .slice(0, MENU_RECENT_LIMIT)
            .map((project) => ({
              id: project.id,
              command: OPEN_RECENT_COMMAND_ID,
              args: { id: project.id },
              // Готовая строка, а не ключ: имя каталога не переводится.
              title: project.label,
            })),
        onDidChange,
      },
    },
    {
      id: 'files.menu.recent.more',
      value: {
        kind: 'item',
        menu: RECENT_SUBMENU,
        group: '2_more',
        // Та же команда без аргументов — весь список. У пункта без аргументов меню показывает
        // сочетание, то есть `Ctrl+R`: так человек узнаёт, что сюда можно и не ходить.
        command: OPEN_RECENT_COMMAND_ID,
        titleKey: 'menu.recent.more',
      },
    },
    {
      id: 'files.menu.recent.clear',
      value: {
        kind: 'item',
        menu: RECENT_SUBMENU,
        group: '3_clear',
        command: CLEAR_RECENT_COMMAND_ID,
      },
    },
  ];
}
