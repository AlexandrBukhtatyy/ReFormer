/**
 * Плагин файлов: панель проекта, пометки находок в дереве, текстовый редактор и операции над
 * записями.
 *
 * **Почему это плагин, а не часть Host.** Дерево ресурсов платформенно, а вот РЕШЕНИЕ
 * «показывать его слева, называть его так-то, открывать проект вот этой командой» —
 * предметное. У корневого реестра вкладов нет `contribute` вовсе, поэтому панель, внесённая
 * самим Host, невыразима: вопрос «откуда здесь эта панель» обязан иметь ответ, и здесь
 * он — «её внёс `files`».
 *
 * **Что плагин делает сам, а что получает.** Сам: идентификатор, словарь, состав вкладов,
 * тексты команд и их применимость, тело редактора. Получает — службами SDK, из контекста
 * (`./host-from-context`): тело панели с деревом (компонент платформенный), вкладки и документы
 * рабочей области, перевод чужих находок. Портов от композиции у плагина нет.
 *
 * **Чего здесь нет.** Открытия проекта, недавних и сохранения — это встроенный плагин
 * «Проект»: открыть каталог и сохранить должен уметь любой состав, и без дерева файлов тоже.
 *
 * **Списка находок здесь тоже нет** — он вид «Проблемы» журнала (`base/journal`): «что сейчас
 * не так» рядом с «что произошло». Отказы операций над записями плагин пишет в тот же журнал
 * (`reformer.log`) с подробностями, а тост отсылает туда.
 *
 * ## Диагностика: пометка на файле — отсюда
 *
 * Не потому, что плагин её находит (находит валидатор), а потому, что он владеет ПОКАЗОМ
 * проекта: дерево ресурсов внёс он, и пометка на строке дерева — продолжение того же
 * решения.
 *
 * @module plugins/base/files/plugin
 */

import { FILES_PLUGIN_ID } from './contract';
import { createElement, type ReactElement } from 'react';
import { FolderTree } from 'lucide-react';
import {
  definePlugin,
  DiagnosticsServiceToken,
  LogServiceToken,
  NotificationsServiceToken,
  PromptServiceToken,
  ResourceClipboardServiceToken,
  EditorPoint,
  MenuPoint,
  PanelPoint,
  ResourceDecorationPoint,
  type DiagnosticsService,
  type EditorContribution,
  type PanelContribution,
  type Plugin,
  type PluginContext,
  type ResourceDecorationContribution,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import { diagnosticDecoration } from './diagnostics';
import {
  AssistantResourcePoint,
  AssistantToolPoint,
  WorkspaceFilesServiceToken,
  WorkspaceResourcesServiceToken,
  WorkspaceSourceCapability,
} from '@reformer/builder-plugin-api';
import { contributeAttachMenu } from './assistant/attach-menu';
import { listSourceTool } from './assistant/list-source';
import { createSourceIndex } from './assistant/source-index';
import { sourceResourceProvider } from './assistant/source-provider';
import {
  filesContextMenuItems,
  filesGenerateMenuItems,
  filesOperationCommands,
} from './operations';
import type { FilesHost } from './host';
import { filesHostFromContext } from './host-from-context';
import { FILES_MESSAGES } from './messages';
import { TextEditor } from './ui/TextEditor';

/** Идентификатор плагина: пространство имён во всех реестрах и в словаре. */
// Идентификатор живёт в `./contract` — листе, который берёт композиция: импорт значения
// отсюда втянул бы в стартовый граф весь плагин.
export { FILES_PLUGIN_ID } from './contract';

/** Панель с деревом ресурсов. */
export const FILES_TREE_PANEL_ID = 'files.tree';

/** Ресурсы `source:` для ассистента — файлы проекта прямо из источника. */
export const FILES_SOURCE_RESOURCES_ID = 'files.source';

/** Инструмент ассистента `list_source` — дерево каталога из источника. */
export const FILES_LIST_SOURCE_TOOL_ID = 'files.list-source';

/** Пометка на файле, у которого есть находки. */
export const FILES_DIAGNOSTICS_DECORATION_ID = 'files.diagnostics';

/** Текстовый редактор — тот, что берётся за файл, если не взялся никто другой. */
export const FILES_TEXT_EDITOR_ID = 'files.text';

/**
 * Команда в том виде, в каком её принимает реестр.
 *
 * Тип извлечён из `PluginContext`, а не импортирован: `@reformer/builder-plugin-api` его не экспортирует, а
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

/**
 * Панель проекта. Слот левый: навигация по проекту — то, что стоит слева во всех редакторах.
 *
 * `null` — оболочка дерева не даёт (возможности `reformer.workspace.tree` нет): панель без тела
 * была бы пустой вкладкой в рейле, и честнее её не вносить вовсе.
 */
export function filesTreePanel(host: FilesHost): PanelContribution | null {
  if (host.ResourceTreePanel === undefined) return null;
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
export function filesTextEditor(host: FilesHost): EditorContribution {
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

export interface FilesPluginOptions {
  /**
   * Порт плагина. Необязателен и ЗАПАСНОЙ: по умолчанию плагин собирает его сам из контекста
   * (`./host-from-context`), как обязан любой плагин из каталога. Параметр — только для тестов.
   */
  readonly host?: FilesHost;
}

/**
 * Собирает плагин.
 *
 * `activate` только регистрирует — как и требует контракт: ни чтения хранилища, ни обращения
 * к проекту здесь нет. Панель существует и без открытого проекта, показывая пустое дерево.
 */
export function createFilesPlugin(options: FilesPluginOptions = {}): Plugin {
  return definePlugin({
    id: FILES_PLUGIN_ID,
    activate(ctx) {
      // Словарь — первым делом: им переводятся заголовки панелей, команд и запросов.
      for (const [locale, messages] of Object.entries(FILES_MESSAGES)) {
        ctx.i18n.contribute(locale, messages);
      }

      const host = options.host ?? filesHostFromContext(ctx);

      // Правка записей проекта — ПРИВИЛЕГИРОВАННАЯ служба: плагин просит право
      // `workspace.resources` манифестом. Без него `get` отдаёт `undefined`, и это названная
      // деградация: панель остаётся просмотром, а команды, меняющие проект, недоступны.
      const resources = ctx.services.get(WorkspaceResourcesServiceToken) ?? null;

      // Службы, без которых операции деградируют, а не падают: без запросов к человеку
      // недоступны создание и переименование, без буфера — копирование. Обе объявлены
      // в `@reformer/builder-plugin-api`, поэтому берутся из реестра, а не приходят портом.
      const prompt = ctx.services.get(PromptServiceToken) ?? null;
      const operations = filesOperationCommands({
        host,
        resources,
        // Перечитывание уровня — у службы ЧТЕНИЯ: оно правит наш снимок, а не проект,
        // и права не требует.
        workspaceFiles: ctx.services.get(WorkspaceFilesServiceToken) ?? null,
        prompt,
        clipboard: ctx.services.get(ResourceClipboardServiceToken) ?? null,
        notifications: ctx.services.get(NotificationsServiceToken) ?? null,
        // Подробности отказа — в журнал: тост называет, что не вышло, журнал хранит почему.
        log: ctx.services.get(LogServiceToken) ?? null,
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

      // Служба диагностик объявлена в `@reformer/builder-plugin-api`, поэтому берётся из реестра
      // сервисов, а не приходит портом. `undefined` — штатная деградация: пометок в дереве не
      // будет. Роняться на этом нельзя — это правило `get` против `require` в реестре сервисов.
      const diagnostics = ctx.services.get(DiagnosticsServiceToken) ?? null;

      const treePanel = filesTreePanel(host);
      if (treePanel !== null) {
        ctx.subscriptions.push(
          ctx.extensions.contribute(PanelPoint, treePanel, { id: FILES_TREE_PANEL_ID })
        );
      }
      ctx.subscriptions.push(
        ctx.extensions.contribute(EditorPoint, filesTextEditor(host), { id: FILES_TEXT_EDITOR_ID })
      );

      for (const item of [...filesContextMenuItems(), ...filesGenerateMenuItems()]) {
        ctx.subscriptions.push(ctx.extensions.contribute(MenuPoint, item.value, { id: item.id }));
      }

      // Проект для ассистента — прямо из источника, мимо рабочей копии: ресурсы `source:`,
      // дерево каталога `list_source` и пункт меню «Прикрепить к ассистенту». Без службы
      // источника (приложение её не дало) ассистенту читать нечем, и вкладов нет вовсе.
      const source = ctx.services.get(WorkspaceSourceCapability);
      const workspaceFiles = ctx.services.get(WorkspaceFilesServiceToken);
      if (source !== undefined && workspaceFiles !== undefined) {
        const access = { source, files: workspaceFiles };
        const index = createSourceIndex({ access, changes: workspaceFiles });
        ctx.subscriptions.push(
          index,
          ctx.extensions.contribute(AssistantResourcePoint, sourceResourceProvider(access, index), {
            id: FILES_SOURCE_RESOURCES_ID,
          }),
          ctx.extensions.contribute(AssistantToolPoint, listSourceTool(access), {
            id: FILES_LIST_SOURCE_TOOL_ID,
          }),
          contributeAttachMenu(ctx)
        );
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
