/**
 * Плагин файлов: панель проекта, текстовый редактор и команды работы с источником.
 *
 * **Почему это плагин, а не часть Host.** Дерево ресурсов платформенно, а вот РЕШЕНИЕ
 * «показывать его слева, называть его так-то, открывать проект вот этой командой» —
 * предметное. У корневого реестра вкладов нет `contribute` вовсе, поэтому панель, внесённая
 * самим Host, невыразима: вопрос «откуда здесь эта панель» обязан иметь ответ, и здесь
 * он — «её внёс `files`».
 *
 * **Что плагин делает сам, а что получает.** Сам: идентификатор, словарь, состав вкладов,
 * тексты команд и их применимость, тело редактора и своё место в меню «Файл». Получает: тело
 * панели с деревом (компонент платформенный) и четыре глагола рабочей области — см. `./host`.
 * Граница ровно там, где кончается предметное решение и начинается платформа.
 *
 * **Команд быстрых исправлений здесь нет** — как и у валидатора: их владелец тот, кто умеет
 * править документ. Плагин файлов их только ПОКАЗЫВАЕТ (панель проблем) и запускает через
 * общий реестр, поэтому исправление, чей владелец выключен, у него просто не рисуется.
 *
 * ## Диагностика: пометка на файле и панель проблем — тоже отсюда
 *
 * Не потому, что плагин её находит (находит валидатор), а потому, что он владеет ПОКАЗОМ
 * проекта: дерево ресурсов внёс он, и пометка на строке дерева — продолжение того же
 * решения. Служба диагностик при этом берётся из `ctx.services`, а не портом: она
 * объявлена в `@/sdk`, и второй канал к ней через композицию означал бы два ответа
 * на вопрос «где свод».
 *
 * @module plugins/files/plugin
 */

import { createElement, type ReactElement } from 'react';
import { CircleAlert, FolderTree } from 'lucide-react';
import {
  definePlugin,
  DiagnosticsServiceToken,
  NotificationsServiceToken,
  PromptServiceToken,
  ResourceClipboardServiceToken,
  MenuPoint,
  ResourceDecorationPoint,
  type DiagnosticsService,
  type Plugin,
  type PluginContext,
  type MenuContribution,
  type ResourceDecorationContribution,
  type ResourceId,
} from '@/sdk';
import { diagnosticDecoration, type CommandAccess } from './diagnostics';
import { filesContextMenuItems, filesOperationCommands } from './operations';
import type { ExtensionPointRef, FilesEditorSpec, FilesHost, FilesPanelSpec } from './host';
import { ProblemsBadge } from './ui/ProblemsBadge';
import { ProblemsPanel } from './ui/ProblemsPanel';
import { TextEditor } from './ui/TextEditor';

/** Идентификатор плагина: пространство имён во всех реестрах и в словаре. */
export const FILES_PLUGIN_ID = 'files';

/** Панель с деревом ресурсов. */
export const FILES_TREE_PANEL_ID = 'files.tree';

/** Панель проблем: весь свод диагностик списком. */
export const FILES_PROBLEMS_PANEL_ID = 'files.problems';

/** Пометка на файле, у которого есть находки. */
export const FILES_DIAGNOSTICS_DECORATION_ID = 'files.diagnostics';

/** Текстовый редактор — тот, что берётся за файл, если не взялся никто другой. */
export const FILES_TEXT_EDITOR_ID = 'files.text';

export const OPEN_PROJECT_COMMAND_ID = 'files.openProject';
export const SAVE_COMMAND_ID = 'files.save';
export const SAVE_ALL_COMMAND_ID = 'files.saveAll';

/**
 * Команда в том виде, в каком её принимает реестр.
 *
 * Тип извлечён из `PluginContext`, а не импортирован: `@/sdk` его не экспортирует, а
 * дотягиваться до `@/shell` плагину нельзя. Извлечение даёт ТОТ ЖЕ тип, а не его копию,
 * поэтому разойтись они не могут.
 */
export type FilesCommand = Parameters<PluginContext['commands']['register']>[0];

/**
 * Приоритет текстового редактора.
 *
 * Единица — минимальный осмысленный: этот редактор берётся за всё, что читается текстом,
 * и обязан проигрывать любому, кто знает про содержимое больше (редактору схемы формы,
 * редактору markdown). Сделать его нулём нельзя — ноль это тоже согласие, но неотличимое
 * по смыслу от «мне всё равно».
 */
export const TEXT_EDITOR_PRIORITY = 1;

/**
 * Значок панели в рейле.
 *
 * Обёртка ради размера: контракт панели объявляет значок компонентом БЕЗ пропсов (рейл рисует
 * `<Icon />`), а значок lucide по умолчанию 24 пикселя — в кнопке рейла это перелив. Размер —
 * решение того, кто значок выбрал, поэтому он задаётся здесь, а не в оболочке.
 */
const TreeIcon = (): ReactElement => createElement(FolderTree, { className: 'size-4' });
const ProblemsIcon = (): ReactElement => createElement(CircleAlert, { className: 'size-4' });

/** Панель проекта. Слот левый: навигация по проекту — то, что стоит слева во всех редакторах. */
export function filesTreePanel(host: FilesHost): FilesPanelSpec {
  return {
    id: FILES_TREE_PANEL_ID,
    slot: 'panel.left',
    titleKey: 'panel.title',
    icon: TreeIcon,
    Body: host.ResourceTreePanel,
    order: 10,
  };
}

/**
 * Панель проблем. Слот нижний — там, где её ищут: список находок читают ВМЕСТЕ с текстом,
 * а не вместо него, поэтому боковой док, отнимающий ширину у редактора, ей не подходит.
 */
export function filesProblemsPanel(
  host: FilesHost,
  diagnostics: DiagnosticsService | null,
  commands: CommandAccess | null = null
): FilesPanelSpec {
  return {
    id: FILES_PROBLEMS_PANEL_ID,
    slot: 'panel.bottom',
    titleKey: 'problems.title',
    // Значок виден и когда док свёрнут в полосу — ради этого свёрнутый вид и заведён.
    Badge: () => createElement(ProblemsBadge, { diagnostics }),
    icon: ProblemsIcon,
    Body: () => createElement(ProblemsPanel, { host, diagnostics, commands }),
    order: 10,
  };
}

/**
 * Пометка на файле с находками.
 *
 * `decorate` синхронна и зовётся на каждую строку каждой перерисовки — поэтому здесь
 * только чтение свода (поиск по карте) и чистая функция над ним. Проба содержимого
 * не трогается вовсе: диагностику публикуют по адресу ресурса, и читать ради неё тела
 * файлов значило бы превратить раскрытие каталога в N чтений.
 *
 * `onDidChange` — то, без чего пометка была бы одноразовой: находки приходят от
 * валидатора, и дереву перерисовываться не с чего. Подписка отдаётся без своего сужения
 * по ресурсу: дерево спрашивает `decorate` заново для всех видимых строк разом,
 * и фильтр означал бы обновление одной строки при перерисовке всех.
 */
export function filesDiagnosticsDecoration(
  diagnostics: DiagnosticsService
): ResourceDecorationContribution {
  return {
    id: FILES_DIAGNOSTICS_DECORATION_ID,
    decorate: (ref) =>
      // У каталога своего свода нет, а сложить в него находки детей нечем: состав
      // каталога знает дерево, а не вклад. Отсутствие пометки честнее выдуманной.
      ref.kind === 'directory' ? null : diagnosticDecoration(diagnostics.get(ref.id)),
    onDidChange: (cb) =>
      diagnostics.onDidChange(() => {
        cb();
      }),
  };
}

/** Текстовый редактор: берётся за всё, что читается текстом, и с наименьшим приоритетом. */
export function filesTextEditor(host: FilesHost): FilesEditorSpec {
  return {
    id: FILES_TEXT_EDITOR_ID,
    canOpen(ref) {
      // Решение по медиатипу, а не по содержимому: пробу читают те, кто разбирает файл,
      // а «это вообще текст» источник и таблица расширений уже ответили.
      return host.isTextual(ref.mediaType) ? TEXT_EDITOR_PRIORITY : false;
    },
    Body: ({ documentId }: { documentId: ResourceId }) =>
      createElement(TextEditor, { host, documentId }),
  };
}

/**
 * Команды плагина.
 *
 * Заголовки разрешаются словарём ВЛАДЕЛЬЦА, то есть этого плагина: и палитра, и меню зовут
 * `i18n.forPlugin(command.pluginId).t(titleKey)`. Поэтому ключи `files.command.*` лежат
 * в `./messages`, а не в словаре Host — пока они лежали там, на их месте показывался маркер
 * промаха (см. шапку `./messages`).
 *
 * `mod+s` помечен {@link allowInEditable}: сохранять надо ровно тогда, когда курсор в тексте,
 * то есть почти всегда.
 */
export function filesCommands(host: FilesHost): readonly FilesCommand[] {
  return [
    {
      id: OPEN_PROJECT_COMMAND_ID,
      titleKey: 'files.command.openProject',
      enabled: () => host.canOpenProject(),
      run: () => host.openProject(),
    },
    {
      id: SAVE_COMMAND_ID,
      titleKey: 'files.command.save',
      keybinding: 'mod+s',
      allowInEditable: true,
      // «Есть открытая вкладка» — состояние платформы, поэтому оно выражено данными и
      // отсекает нажатие до вызова предиката.
      when: 'activeEditorId != null',
      enabled: (ctx) => ctx.activeEditorId !== null,
      run: () => {
        const active = host.activeResource();
        // Применимость уже проверена реестром, но между проверкой и запуском вкладку могли
        // закрыть: сохранять «активный документ», которого нет, — это записать не тот файл.
        if (active === null) return Promise.resolve(false);
        return host.save(active);
      },
    },
    {
      id: SAVE_ALL_COMMAND_ID,
      titleKey: 'files.command.saveAll',
      keybinding: 'mod+alt+s',
      allowInEditable: true,
      enabled: () => host.hasProject(),
      run: () => host.saveAll(),
    },
  ];
}

/**
 * Пункты меню «Файл».
 *
 * Своего заголовка ни у одного нет: имя приходит от команды, на которую пункт ссылается.
 * Поэтому переименование команды меняет палитру и меню одновременно, а разойтись им негде —
 * и именно поэтому «Открыть папку…» переименовано у КОМАНДЫ, а не здесь.
 *
 * Две группы, а не разделитель вручную: «открыть» и «сохранить» — разные по силе действия,
 * и линия между ними появится сама, пока в обеих есть хоть один видимый пункт.
 */
export function filesMenuItems(): readonly { id: string; value: MenuContribution }[] {
  return [
    {
      id: 'files.menu.openProject',
      value: { kind: 'item', menu: 'file', command: OPEN_PROJECT_COMMAND_ID, group: '1_open' },
    },
    {
      id: 'files.menu.save',
      value: { kind: 'item', menu: 'file', command: SAVE_COMMAND_ID, group: '2_save' },
    },
    {
      id: 'files.menu.saveAll',
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

export interface FilesPluginOptions {
  readonly host: FilesHost;
  /** Точка расширения панелей оболочки. Подставляется композицией — см. `./host`. */
  readonly panelPoint: ExtensionPointRef<FilesPanelSpec>;
  /** Точка расширения редакторов. */
  readonly editorPoint: ExtensionPointRef<FilesEditorSpec>;
}

/**
 * Собирает плагин.
 *
 * `activate` только регистрирует — как и требует контракт: ни выбора каталога, ни чтения
 * хранилища здесь нет. Восстановление проекта идёт своим ходом (шаг 7 запуска) и вкладов
 * не касается: панель существует и без открытого проекта, показывая пустое дерево.
 */
export function createFilesPlugin(options: FilesPluginOptions): Plugin {
  const { host, panelPoint, editorPoint } = options;

  return definePlugin({
    id: FILES_PLUGIN_ID,
    activate(ctx) {
      for (const command of filesCommands(host)) {
        ctx.subscriptions.push(ctx.commands.register(command));
      }

      // Службы, без которых операции деградируют, а не падают: без запросов к человеку
      // недоступны создание и переименование, без буфера — копирование. Обе объявлены
      // в `@/sdk`, поэтому берутся из реестра, а не приходят портом.
      const operations = filesOperationCommands({
        host,
        prompt: ctx.services.get(PromptServiceToken) ?? null,
        clipboard: ctx.services.get(ResourceClipboardServiceToken) ?? null,
        notifications: ctx.services.get(NotificationsServiceToken) ?? null,
        // Системный буфер — единственное, что нельзя взять ни из реестра, ни из порта:
        // он у браузера. Отсутствие движка означает лишь недоступный пункт «Копировать путь».
        writeSystemClipboard:
          typeof navigator === 'undefined' || navigator.clipboard === undefined
            ? undefined
            : (text: string) => navigator.clipboard.writeText(text),
      });
      for (const command of operations) {
        ctx.subscriptions.push(ctx.commands.register(command));
      }

      // Служба диагностик объявлена в `@/sdk`, поэтому берётся из реестра сервисов,
      // а не приходит портом. `undefined` — штатная деградация: панель проблем покажет
      // пустоту, пометок в дереве не будет. Роняться на этом нельзя — это правило
      // `get` против `require` в реестре сервисов.
      const diagnostics = ctx.services.get(DiagnosticsServiceToken) ?? null;

      // Реестр команд для быстрых исправлений. Спрашивается ЛЕНИВО, на каждый вопрос:
      // между отрисовкой строки и нажатием плагин, владеющий командой, могли выключить,
      // и панель обязана это увидеть, а не помнить ответ, данный при активации.
      const commands: CommandAccess = {
        has: (commandId) => ctx.commands.get(commandId) !== undefined,
        run: (commandId, args) => {
          void ctx.commands.execute(commandId, args).catch((error: unknown) => {
            console.error(`[files] исправление «${commandId}» отказало`, error);
          });
        },
      };

      ctx.subscriptions.push(
        ctx.extensions.contribute(panelPoint, filesTreePanel(host), { id: FILES_TREE_PANEL_ID }),
        ctx.extensions.contribute(panelPoint, filesProblemsPanel(host, diagnostics, commands), {
          id: FILES_PROBLEMS_PANEL_ID,
        }),
        ctx.extensions.contribute(editorPoint, filesTextEditor(host), { id: FILES_TEXT_EDITOR_ID })
      );

      for (const item of [...filesMenuItems(), ...filesContextMenuItems()]) {
        ctx.subscriptions.push(ctx.extensions.contribute(MenuPoint, item.value, { id: item.id }));
      }

      // Пометка вносится только там, где есть чему её питать: вклад, который всегда
      // молчит, отличается от отсутствующего лишним обходом на каждую строку дерева.
      if (diagnostics !== null) {
        ctx.subscriptions.push(
          ctx.extensions.contribute(
            ResourceDecorationPoint,
            filesDiagnosticsDecoration(diagnostics),
            { id: FILES_DIAGNOSTICS_DECORATION_ID }
          )
        );
      }
    },
  });
}
