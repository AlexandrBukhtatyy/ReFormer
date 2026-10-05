/**
 * Плагин «Проект»: с чем приложение работает и как это сохранить.
 *
 * «Открыть папку…», недавно открытые, стартовая страница, «Сохранить» и «Сохранить всё» —
 * то, без чего оболочка не приложение вовсе: открыть проект нужно ДО любого внешнего кода,
 * а сохранять должен уметь любой состав, какими бы редакторами он ни был собран. Поэтому
 * плагин встроенный и остаётся им, когда дерево файлов и редакторы уезжают в плагины приложения:
 * оболочка, которая не может открыть проект без скачанных плагинов, хрупка.
 *
 * **Почему это плагин, а не часть оболочки.** У корневого реестра вкладов нет `contribute`
 * вовсе: команда или пункт меню, внесённые самой оболочкой, невыразимы. Вопрос «откуда здесь
 * этот пункт» обязан иметь ответ, и здесь он — «его внёс `project`». Организация, которой
 * открытие каталога не нужно (проект задан запуском), выключает плагин поправкой состава.
 *
 * **Портов у плагина нет.** Всё, что он делает, выражено службами SDK:
 *
 * ```text
 * reformer.workspace.resources   открыть каталог, недавние проекты   (право workspace.resources)
 * reformer.workspace.save        сохранить документ, сохранить всё   (право workspace.save)
 * reformer.workspace             активная вкладка, открыт ли проект
 * ```
 *
 * Обе привилегированные службы необязательны: без права `get` отдаёт `undefined`, и это
 * названная деградация — команда недоступна, а не падает при нажатии.
 *
 * @module plugins/base/project/plugin
 */

import { createElement } from 'react';
import {
  definePlugin,
  DocumentsServiceToken,
  MenuPoint,
  PanelPoint,
  PromptServiceToken,
  WorkspaceResourcesServiceToken,
  WorkspaceSaveServiceToken,
  type CommandContribution,
  type DocumentsService,
  type MenuContribution,
  type Plugin,
  type WorkspaceResourcesService,
  type WorkspaceSaveService,
} from '@reformer/builder-plugin-api';
import {
  OPEN_PROJECT_COMMAND_ID,
  OPEN_RECENT_COMMAND_ID,
  PROJECT_PLUGIN_ID,
  PROJECT_WELCOME_PANEL_ID,
  SAVE_ALL_COMMAND_ID,
  SAVE_COMMAND_ID,
} from './contract';
import { PROJECT_MESSAGES } from './messages';
import { recentCommands, recentMenuItems } from './recent';
import { WelcomePage } from './ui/WelcomePage';

export { PROJECT_PLUGIN_ID };

/** Службы, на которых стоят команды. Спрашиваются в момент обращения. */
export interface ProjectCommandsDeps {
  /** Открытие каталога. `undefined` — право `workspace.resources` не подтверждено. */
  readonly resources: () =>
    | Pick<WorkspaceResourcesService, 'canOpenProject' | 'openProject'>
    | undefined;
  /** Сохранение. `undefined` — право `workspace.save` не подтверждено. */
  readonly saving: () => Pick<WorkspaceSaveService, 'save' | 'saveAll'> | undefined;
  readonly documents: () => Pick<DocumentsService, 'activeResource' | 'hasProject'> | undefined;
}

/**
 * Команды плагина.
 *
 * Заголовки разрешаются словарём ВЛАДЕЛЬЦА, то есть этого плагина: и палитра, и меню зовут
 * `i18n.forPlugin(command.pluginId).t(titleKey)`.
 *
 * `mod+s` помечен `allowInEditable`: сохранять надо ровно тогда, когда курсор в тексте,
 * то есть почти всегда.
 */
export function projectCommands(deps: ProjectCommandsDeps): readonly CommandContribution[] {
  return [
    {
      // Открыть каталог — привилегированная операция: она меняет то, с чем работает всё
      // приложение, и спрашивает человека диалогом браузера. Без права команда недоступна,
      // а не падает при нажатии.
      id: OPEN_PROJECT_COMMAND_ID,
      titleKey: 'command.openProject',
      enabled: () => deps.resources()?.canOpenProject() ?? false,
      run: () => deps.resources()?.openProject() ?? Promise.resolve(false),
    },
    {
      id: SAVE_COMMAND_ID,
      titleKey: 'command.save',
      keybinding: 'mod+s',
      allowInEditable: true,
      // «Есть открытая вкладка» — состояние платформы, поэтому оно выражено данными и
      // отсекает нажатие до вызова предиката.
      when: 'activeEditorId != null',
      enabled: (ctx) => ctx.activeEditorId !== null && deps.saving() !== undefined,
      run: () => {
        const active = deps.documents()?.activeResource() ?? null;
        // Применимость уже проверена реестром, но между проверкой и запуском вкладку могли
        // закрыть: сохранять «активный документ», которого нет, — это записать не тот файл.
        if (active === null) return Promise.resolve(false);
        return deps.saving()?.save([active]) ?? Promise.resolve(false);
      },
    },
    {
      id: SAVE_ALL_COMMAND_ID,
      titleKey: 'command.saveAll',
      keybinding: 'mod+alt+s',
      allowInEditable: true,
      enabled: () => (deps.documents()?.hasProject() ?? false) && deps.saving() !== undefined,
      run: () => deps.saving()?.saveAll() ?? Promise.resolve(false),
    },
  ];
}

/**
 * Пункты меню «Файл».
 *
 * Своего заголовка ни у одного нет: имя приходит от команды, на которую пункт ссылается.
 * Поэтому переименование команды меняет палитру и меню одновременно, а разойтись им негде.
 *
 * Две группы, а не разделитель вручную: «открыть» и «сохранить» — разные по силе действия,
 * и линия между ними появится сама, пока в обеих есть хоть один видимый пункт.
 */
export function projectMenuItems(): readonly { id: string; value: MenuContribution }[] {
  return [
    {
      id: 'project.menu.openProject',
      value: { kind: 'item', menu: 'file', command: OPEN_PROJECT_COMMAND_ID, group: '1_open' },
    },
    {
      id: 'project.menu.save',
      value: { kind: 'item', menu: 'file', command: SAVE_COMMAND_ID, group: '2_save' },
    },
    {
      id: 'project.menu.saveAll',
      value: {
        kind: 'item',
        menu: 'file',
        command: SAVE_ALL_COMMAND_ID,
        group: '2_save',
        order: 10,
      },
    },
  ];
}

/**
 * Собирает плагин.
 *
 * `activate` только регистрирует — как и требует контракт: ни выбора каталога, ни чтения
 * хранилища здесь нет. Список недавних при активации не читается: читают его меню и страница
 * при показе.
 */
export function createProjectPlugin(): Plugin {
  return definePlugin({
    id: PROJECT_PLUGIN_ID,
    activate(ctx) {
      for (const [locale, messages] of Object.entries(PROJECT_MESSAGES)) {
        ctx.i18n.contribute(locale, messages);
      }

      const resources = () => ctx.services.get(WorkspaceResourcesServiceToken);
      for (const command of projectCommands({
        resources,
        saving: () => ctx.services.get(WorkspaceSaveServiceToken),
        documents: () => ctx.services.get(DocumentsServiceToken),
      })) {
        ctx.subscriptions.push(ctx.commands.register(command));
      }
      for (const item of projectMenuItems()) {
        ctx.subscriptions.push(ctx.extensions.contribute(MenuPoint, item.value, { id: item.id }));
      }

      // Недавние — только там, где служба записей проекта есть: без права ни подменю,
      // ни команд списка плагин не вносит, а «Открыть папку…» остаётся — недоступной.
      const recent = resources()?.recentProjects;
      if (recent !== undefined) {
        const prompt = ctx.services.get(PromptServiceToken) ?? null;
        for (const command of recentCommands({ recent, prompt })) {
          ctx.subscriptions.push(ctx.commands.register(command));
        }
        for (const item of recentMenuItems(recent)) {
          ctx.subscriptions.push(ctx.extensions.contribute(MenuPoint, item.value, { id: item.id }));
        }
      }

      // Страница зовёт команды, а не службы: щелчок здесь и пункт меню — одно действие.
      const run = (commandId: string, args?: unknown): void => {
        void ctx.commands.execute(commandId, args).catch((error: unknown) => {
          console.error(`[project] команда «${commandId}» отказала`, error);
        });
      };
      // «Можно ли выбрать каталог» — ответ привилегированной службы, и он приходит странице
      // значением: о правах она не знает и знать не должна.
      const canOpenFolder = resources()?.canOpenProject() ?? false;

      // Стартовая страница — в центре, пока открытых вкладок нет: слот `editor.main` для неё
      // и заведён. Здесь — потому что это тот же вопрос, что у «Открыть папку…»: с чем работать.
      ctx.subscriptions.push(
        ctx.extensions.contribute(
          PanelPoint,
          {
            id: PROJECT_WELCOME_PANEL_ID,
            slot: 'editor.main',
            titleKey: 'welcome.title',
            Body: () =>
              createElement(WelcomePage, {
                i18n: ctx.i18n,
                recent,
                canOpenFolder,
                openFolder: () => {
                  run(OPEN_PROJECT_COMMAND_ID);
                },
                openRecent: (id) => {
                  run(OPEN_RECENT_COMMAND_ID, id === undefined ? undefined : { id });
                },
              }),
          },
          { id: PROJECT_WELCOME_PANEL_ID }
        )
      );
    },
  });
}
