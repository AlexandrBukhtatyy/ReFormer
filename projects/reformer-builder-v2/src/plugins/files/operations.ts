/**
 * Операции над записями дерева: команды и пункты контекстного меню.
 *
 * ## Почему это команды, а не обработчики пунктов
 *
 * Иначе «Переименовать» существовало бы только в меню: ни с клавиши, ни из палитры, ни
 * ассистенту оно не досталось бы. Здесь каждое действие — команда с сочетанием и предикатом,
 * а пункт меню на неё только ссылается (`MenuItemContribution.command`), поэтому все четыре
 * двери ведут в одно тело.
 *
 * ## Цель действия приходит двумя путями, и оба обязательны
 *
 * Пункт меню знает, по чему щёлкнули, и передаёт адреса аргументом ({@link ResourceCommandArgs}).
 * Клавиша не знает ничего — у неё аргументов нет вовсе, — поэтому команда без аргументов
 * спрашивает дерево (`host.treeSelection()`). Свести это к одному пути нельзя: щелчок правой
 * кнопкой по строке ВНЕ набора действует на неё одну, а `Delete` с клавиши — на весь набор,
 * и оба ответа правильные для своего случая.
 *
 * ## Предикат «фокус в дереве» защищает от чужого Delete
 *
 * `Delete` в редакторе схемы удаляет узел, а не файл, поэтому команды удаления и копирования
 * доступны только при фокусе в дереве. Открытое контекстное меню фокус не отнимает: его
 * содержимое объявлено зоной `tree` (см. `host/ui/ResourceTree`), иначе Radix гасил бы каждый
 * пункт ровно в тот момент, когда его собираются нажать.
 *
 * @module plugins/files/operations
 */

import {
  RESOURCE_CONTEXT_MENU,
  argsOfResource,
  selectedIds,
  validateResourceName,
  whenResource,
  type MenuContribution,
  type NotificationsService,
  type PromptService,
  type ResourceClipboardService,
  type ResourceId,
  type ResourceRef,
} from '@/sdk';
import type { FilesHost, FilesResourceOperations, Translate } from './host';
import type { FilesCommand } from './plugin';

export const NEW_FILE_COMMAND_ID = 'files.newFile';
export const NEW_FOLDER_COMMAND_ID = 'files.newFolder';
export const RENAME_COMMAND_ID = 'files.rename';
export const DELETE_COMMAND_ID = 'files.delete';
export const COPY_COMMAND_ID = 'files.copy';
export const CUT_COMMAND_ID = 'files.cut';
export const PASTE_COMMAND_ID = 'files.paste';
export const COPY_PATH_COMMAND_ID = 'files.copyPath';
export const REFRESH_COMMAND_ID = 'files.refresh';

/**
 * Аргументы команд дерева.
 *
 * Оба поля необязательны: без них команда берёт цель из выделения дерева — то, что нужно
 * вызову с клавиши и из палитры.
 */
export interface ResourceCommandArgs {
  /** К каким записям применить. */
  readonly ids?: readonly ResourceId[];
  /** Внутрь какого каталога действовать (создание, вставка). */
  readonly dir?: ResourceId;
}

export interface FilesOperationsDeps {
  readonly host: FilesHost;
  /** Запросы к человеку. Без них команды, которым нужно имя или согласие, недоступны. */
  readonly prompt?: PromptService | null;
  /** Буфер записей. Без него копирование и вставка недоступны. */
  readonly clipboard?: ResourceClipboardService | null;
  /** Уведомления: отказ операции обязан быть виден, а не лежать в консоли. */
  readonly notifications?: NotificationsService | null;
  /** Перевод словарём ПЛАГИНА — для заголовков диалогов и подписей ошибок имени. */
  readonly translate?: Translate;
  /**
   * Запись в системный буфер обмена — для «Копировать путь».
   *
   * Портом, а не прямым `navigator.clipboard`: доступ к нему зависит от разрешения
   * и от контекста безопасности, а команда обязана быть проверяемой без браузера.
   */
  readonly writeSystemClipboard?: (text: string) => Promise<void>;
}

/** Разбирает непрозрачные аргументы команды. Чужая форма — то же, что их отсутствие. */
export function parseArgs(args: unknown): ResourceCommandArgs {
  if (typeof args !== 'object' || args === null) return {};
  const candidate = args as ResourceCommandArgs;
  const ids = Array.isArray(candidate.ids) ? candidate.ids : undefined;
  const dir = typeof candidate.dir === 'string' ? candidate.dir : undefined;
  return { ids, dir };
}

/** К чему применить: аргументы пункта меню важнее выделения — щёлкнули именно по этой строке. */
function targets(args: unknown, host: FilesHost): readonly ResourceId[] {
  const parsed = parseArgs(args);
  if (parsed.ids !== undefined && parsed.ids.length > 0) return parsed.ids;
  return host.treeSelection().map((ref) => ref.id);
}

/** Первая цель — для операций над одной записью (переименование). */
function singleTarget(args: unknown, host: FilesHost): ResourceId | null {
  return targets(args, host)[0] ?? null;
}

/** Куда создавать: каталог из аргументов, иначе каталог выделенной записи, иначе корень. */
function directory(args: unknown, host: FilesHost): ResourceId | null {
  const parsed = parseArgs(args);
  if (parsed.dir !== undefined) return parsed.dir;

  const selected: ResourceRef | undefined = host.treeSelection()[0];
  if (selected === undefined) return host.treeRoot();
  if (selected.kind === 'directory') return selected.id;
  return parentOf(selected.id) ?? host.treeRoot();
}

/** Родительский каталог адреса; `null` — адрес и так корень источника. */
function parentOf(id: ResourceId): ResourceId | null {
  const colon = id.indexOf(':');
  if (colon === -1) return null;
  const source = id.slice(0, colon + 1);
  const path = id.slice(colon + 1);
  if (path === '') return null;
  const slash = path.lastIndexOf('/');
  return slash === -1 ? source : `${source}${path.slice(0, slash)}`;
}

/** Имя записи из адреса — для заголовка диалога и начального значения поля. */
export function nameOf(id: ResourceId): string {
  const path = id.slice(id.indexOf(':') + 1);
  const slash = path.lastIndexOf('/');
  return slash === -1 ? path : path.slice(slash + 1);
}

/**
 * Проверка имени для поля ввода: возвращает КЛЮЧ сообщения словаря плагина.
 *
 * Правила берутся у платформы (`validateResourceName`), а не пишутся заново: имя, которое
 * не создастся в Windows, не должно создаваться и здесь, а два свода правил разошлись бы
 * на первом же `aux.ts`.
 */
export function nameValidator(): (value: string) => string | null {
  return (value) => {
    const rejection = validateResourceName(value);
    return rejection === null ? null : `ops.name.${rejection}`;
  };
}

/** Сообщение об отказе — человеку, а не в консоль. */
function report(deps: FilesOperationsDeps, messageKey: string, error?: unknown): void {
  if (error !== undefined) console.error(`[files] ${messageKey}`, error);
  deps.notifications?.error(messageKey);
}

/** Операции открытого проекта или отказ с уведомлением: без проекта делать нечего. */
function operationsOf(deps: FilesOperationsDeps): FilesResourceOperations | null {
  const operations = deps.host.resources();
  if (operations === null) report(deps, 'files.notify.noProject');
  return operations;
}

/**
 * Команды операций.
 *
 * Заголовки разрешаются словарём Host (`files.command.*`) — тем же, что у остальных команд
 * плагина: их рисует палитра и меню, а не сам плагин.
 */
export function filesOperationCommands(deps: FilesOperationsDeps): readonly FilesCommand[] {
  const { host } = deps;
  const inTree = (ctx: { readonly focus: string }): boolean => ctx.focus === 'tree';

  const ask = async (titleKey: string, value = '', select?: 'stem'): Promise<string | null> => {
    if (deps.prompt === undefined || deps.prompt === null) return null;
    return deps.prompt.input({
      titleKey,
      value,
      select,
      labelKey: 'ops.name.label',
      pluginId: 'files',
      validate: nameValidator(),
    });
  };

  return [
    {
      id: NEW_FILE_COMMAND_ID,
      titleKey: 'files.command.newFile',
      enabled: () => host.hasProject() && deps.prompt != null,
      run: async (args) => {
        const operations = operationsOf(deps);
        const dir = directory(args, host);
        if (operations === null || dir === null) return false;
        const name = await ask('ops.newFile.title');
        if (name === null) return false;
        try {
          await operations.createFile(dir, name);
          return true;
        } catch (error) {
          report(deps, 'files.notify.create.failed', error);
          return false;
        }
      },
    },
    {
      id: NEW_FOLDER_COMMAND_ID,
      titleKey: 'files.command.newFolder',
      enabled: () => host.hasProject() && deps.prompt != null,
      run: async (args) => {
        const operations = operationsOf(deps);
        const dir = directory(args, host);
        if (operations === null || dir === null) return false;
        const name = await ask('ops.newFolder.title');
        if (name === null) return false;
        try {
          await operations.createDirectory(dir, name);
          return true;
        } catch (error) {
          report(deps, 'files.notify.create.failed', error);
          return false;
        }
      },
    },
    {
      id: RENAME_COMMAND_ID,
      titleKey: 'files.command.rename',
      keybinding: 'f2',
      // Клавиша принадлежит дереву, поэтому предикат смотрит на фокус: `F2` в редакторе
      // схемы означает совсем другое.
      enabled: (ctx) => inTree(ctx) && host.hasProject() && deps.prompt != null,
      run: async (args) => {
        const operations = operationsOf(deps);
        const id = singleTarget(args, host);
        if (operations === null || id === null) return false;
        // Начальное значение — текущее имя, выделено без расширения: меняют обычно основу.
        const name = await ask('ops.rename.title', nameOf(id), 'stem');
        if (name === null) return false;
        try {
          await operations.rename(id, name);
          return true;
        } catch (error) {
          report(deps, 'files.notify.rename.failed', error);
          return false;
        }
      },
    },
    {
      id: DELETE_COMMAND_ID,
      titleKey: 'files.command.delete',
      keybinding: 'delete',
      enabled: (ctx) => inTree(ctx) && host.hasProject() && deps.prompt != null,
      run: async (args) => {
        const operations = operationsOf(deps);
        const ids = targets(args, host);
        if (operations === null || ids.length === 0) return false;

        const agreed = await deps.prompt?.confirm({
          titleKey: 'ops.delete.title',
          descriptionKey: 'ops.delete.message',
          params: { count: ids.length, name: nameOf(ids[0] ?? '') },
          confirmKey: 'ops.delete.confirm',
          tone: 'danger',
          pluginId: 'files',
        });
        if (agreed !== true) return false;

        const result = await operations.remove(ids);
        // Частичный отказ — норма для набора: сообщаем ровно о том, что не удалось.
        if (result.failed.length > 0) report(deps, 'files.notify.delete.failed');
        return result.failed.length === 0;
      },
    },
    {
      id: COPY_COMMAND_ID,
      titleKey: 'files.command.copy',
      keybinding: 'mod+c',
      enabled: (ctx) => inTree(ctx) && deps.clipboard != null,
      run: (args) => {
        const ids = targets(args, host);
        if (ids.length === 0) return false;
        deps.clipboard?.copy(ids);
        return true;
      },
    },
    {
      id: CUT_COMMAND_ID,
      titleKey: 'files.command.cut',
      keybinding: 'mod+x',
      enabled: (ctx) => inTree(ctx) && deps.clipboard != null,
      run: (args) => {
        const ids = targets(args, host);
        if (ids.length === 0) return false;
        deps.clipboard?.cut(ids);
        return true;
      },
    },
    {
      id: PASTE_COMMAND_ID,
      titleKey: 'files.command.paste',
      keybinding: 'mod+v',
      // Гаснет, когда вставлять нечего: пункт, обещающий вставку пустоты, — обещание,
      // которое не исполнится.
      enabled: (ctx) => inTree(ctx) && host.hasProject() && (deps.clipboard?.size() ?? 0) > 0,
      run: async (args) => {
        const operations = operationsOf(deps);
        const dir = directory(args, host);
        const state = deps.clipboard?.get();
        if (operations === null || dir === null || state === undefined) return false;
        if (state.items.length === 0) return false;

        if (state.mode === 'cut') {
          let moved = 0;
          for (const id of state.items) {
            try {
              await operations.move(id, dir);
              moved += 1;
            } catch (error) {
              report(deps, 'files.notify.paste.failed', error);
            }
          }
          // Вырезанное вставляется ОДИН раз: после переноса исходников больше нет,
          // и второй «Вставить» пытался бы перенести то, чего не существует.
          if (moved > 0) deps.clipboard?.clear();
          return moved === state.items.length;
        }

        const result = await operations.copy(state.items, dir);
        if (result.failed.length > 0) report(deps, 'files.notify.paste.failed');
        return result.failed.length === 0;
      },
    },
    {
      id: COPY_PATH_COMMAND_ID,
      titleKey: 'files.command.copyPath',
      enabled: (ctx) => inTree(ctx) && deps.writeSystemClipboard !== undefined,
      run: async (args) => {
        const ids = targets(args, host);
        if (ids.length === 0 || deps.writeSystemClipboard === undefined) return false;
        // Путь без источника: в буфер уходит то, что человек вставит в терминал или в код,
        // а `fs:` перед путём там значит ровно ничего.
        const text = ids.map((id) => id.slice(id.indexOf(':') + 1)).join('\n');
        try {
          await deps.writeSystemClipboard(text);
          deps.notifications?.info('files.notify.path.copied');
          return true;
        } catch (error) {
          report(deps, 'files.notify.path.failed', error);
          return false;
        }
      },
    },
    {
      id: REFRESH_COMMAND_ID,
      titleKey: 'files.command.refresh',
      enabled: () => host.hasProject(),
      run: async (args) => {
        const operations = operationsOf(deps);
        const dir = directory(args, host);
        if (operations === null || dir === null) return false;
        // Перечитывание уровня выражено пустым копированием? Нет: у операций для этого
        // есть собственный глагол — дерево чинит тот, кто его же и портит.
        await operations.refresh(dir);
        return true;
      },
    },
  ];
}

/**
 * Пункты контекстного меню дерева.
 *
 * Групп три, и они дают ровно те две линии, что были в v1: «правка» (копировать, вставить,
 * переименовать), «создание» (файл, папка) и «опасное» (удалить). Разделители не вносятся —
 * они появляются между непустыми группами сами.
 */
export function filesContextMenuItems(): readonly {
  readonly id: string;
  readonly value: MenuContribution;
}[] {
  const overResource = whenResource((target) => target.ref !== null);
  const args = argsOfResource((target) => ({ ids: selectedIds(target), dir: target.dir }));

  return [
    {
      id: 'files.context.copy',
      value: {
        kind: 'item',
        menu: RESOURCE_CONTEXT_MENU,
        command: COPY_COMMAND_ID,
        group: '2_edit',
        when: overResource,
        argsOf: args,
      },
    },
    {
      id: 'files.context.cut',
      value: {
        kind: 'item',
        menu: RESOURCE_CONTEXT_MENU,
        command: CUT_COMMAND_ID,
        group: '2_edit',
        order: 10,
        when: overResource,
        argsOf: args,
      },
    },
    {
      id: 'files.context.paste',
      value: {
        kind: 'item',
        menu: RESOURCE_CONTEXT_MENU,
        command: PASTE_COMMAND_ID,
        group: '2_edit',
        order: 20,
        argsOf: args,
      },
    },
    {
      id: 'files.context.copyPath',
      value: {
        kind: 'item',
        menu: RESOURCE_CONTEXT_MENU,
        command: COPY_PATH_COMMAND_ID,
        group: '2_edit',
        order: 30,
        when: overResource,
        argsOf: args,
      },
    },
    {
      id: 'files.context.newFile',
      value: {
        kind: 'item',
        menu: RESOURCE_CONTEXT_MENU,
        command: NEW_FILE_COMMAND_ID,
        group: '3_create',
        argsOf: args,
      },
    },
    {
      id: 'files.context.newFolder',
      value: {
        kind: 'item',
        menu: RESOURCE_CONTEXT_MENU,
        command: NEW_FOLDER_COMMAND_ID,
        group: '3_create',
        order: 10,
        argsOf: args,
      },
    },
    {
      id: 'files.context.refresh',
      value: {
        kind: 'item',
        menu: RESOURCE_CONTEXT_MENU,
        command: REFRESH_COMMAND_ID,
        group: '3_create',
        order: 20,
        argsOf: args,
      },
    },
    {
      id: 'files.context.rename',
      value: {
        kind: 'item',
        menu: RESOURCE_CONTEXT_MENU,
        command: RENAME_COMMAND_ID,
        group: '9_danger',
        when: overResource,
        argsOf: args,
      },
    },
    {
      id: 'files.context.delete',
      value: {
        kind: 'item',
        menu: RESOURCE_CONTEXT_MENU,
        command: DELETE_COMMAND_ID,
        group: '9_danger',
        order: 10,
        when: overResource,
        argsOf: args,
      },
    },
  ];
}
