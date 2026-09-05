/**
 * Плагин «редактор схемы формы»: провайдер модели, редактор, палитра, инспектор и команды.
 *
 * **Почему это плагин, а не часть Host.** Всё содержимое этого каталога — предметное знание:
 * что такое `$component`, чем шаг отличается от вкладки, какие свойства бывают у поля, куда
 * встаёт узел из палитры. В платформе оно означало бы, что второй формат вносится правкой
 * ядра. Граница проверяется линтером: `src/plugins/**` не видит `@/shell/*` — только `@/sdk`
 * и `@/lib`.
 *
 * ## Провайдер модели вносится на РЕСУРС, редактор — на его содержимое
 *
 * Оба спрашивают одно и то же ({@link isFormSchemaResource}), но отвечают на разные вопросы.
 * Провайдер — «чья это модель»: он один на документ, и потому его вклад не привязан к тому,
 * каким редактором документ открыли. Редактор — «чем рисовать»: их может быть несколько,
 * и структурный обязан выигрывать у текстового приоритетом, а не порядком регистрации.
 *
 * ## Панели регистрируются один раз, `when` управляет видимостью
 *
 * Не «регистрируются вместе с редактором». Вклад вносится при активации плагина и живёт до
 * его выключения, а `when` каждый кадр отвечает только на вопрос «показывать ли сейчас».
 * Иначе рейл мигал бы при каждом переключении вкладки — дефект v1, где видимость панели была
 * зашита в раскладку.
 *
 * @module plugins/editor-schema/plugin
 */

import { createElement, type ReactElement } from 'react';
import { Blocks, SlidersHorizontal } from 'lucide-react';
import type { NodeIdFactory } from '@/lib/form-model/node-id';
import {
  definePlugin,
  DiagnosticsServiceToken,
  EditorPoint,
  MenuPoint,
  PanelPoint,
  SelectionServiceToken,
  SettingsServiceToken,
  type DocumentModelProvider,
  type EditorContribution,
  type PanelContribution,
  type Plugin,
  type ResourceId,
  type WhenContext,
} from '@/sdk';
import {
  canvasViewCommands,
  canvasViewMenuItems,
  type CanvasActionDeps,
} from './canvas/canvas-actions';
import { createCanvasPrefs, type CanvasPrefs } from './session/canvas-prefs';
import { createQuickAddStore, type QuickAddStore } from './session/quick-add-store';
import { schemaEditorCommands, type CommandAccess } from './editing/commands';
import { schemaViewCommands } from './editing/view-actions';
import type { SchemaViewStore } from './session/view-mode';
import { createSchemaViewStore } from './session/view-mode';
import { createDragSession, type DragSession } from './session/drag-session';
import { SCHEMA_EDITOR_MESSAGES } from './messages';
import {
  createSchemaModelProvider,
  isFormSchemaResource,
  SCHEMA_MODEL_PROVIDER_ID,
} from './model/provider';
import { createSessionRegistry, type SessionRegistry } from './session/sessions';
import { InspectorPanel } from './ui/InspectorPanel';
import { PalettePanel } from './ui/PalettePanel';
import { SchemaEditor } from './ui/SchemaEditor';
import {
  createCollapseRegistry,
  readCollapsedState,
  type CollapseRegistry,
} from './session/view-state';
import type { ExtensionPointRef, MessageSink, SchemaDiagnostics, SchemaEditorHost } from './host';

// Реэкспорт, а не объявление: идентификатор живёт в contract.ts, чтобы композиция могла
// взять его, не втягивая плагин в стартовый граф.
import { SCHEMA_EDITOR_PLUGIN_ID } from './contract';
export { SCHEMA_EDITOR_PLUGIN_ID };

/** Структурный редактор схемы. */
export const SCHEMA_EDITOR_ID = 'editor-schema.canvas';

export const PALETTE_PANEL_ID = 'editor-schema.palette';
export const INSPECTOR_PANEL_ID = 'editor-schema.inspector';

/**
 * Приоритет структурного редактора.
 *
 * Заведомо выше единицы текстового редактора (`plugins/files`): тот берётся за всё, что
 * читается текстом, и обязан проигрывать любому, кто знает про содержимое больше. Круглая
 * сотня оставляет место тому, кто знает ещё больше, — например редактору конкретного кита.
 */
export const SCHEMA_EDITOR_PRIORITY = 100;

/**
 * Значки панелей в рейле.
 *
 * Обёртка ради размера: контракт панели объявляет значок компонентом БЕЗ пропсов, а значок
 * lucide по умолчанию 24 пикселя — в кнопке рейла это перелив.
 */
const PaletteIcon = (): ReactElement => createElement(Blocks, { className: 'size-4' });
const InspectorIcon = (): ReactElement => createElement(SlidersHorizontal, { className: 'size-4' });

/**
 * Видима ли панель редактора при таком контексте. Чистая и дешёвая — её зовут на каждый кадр.
 *
 * Сравнение одно, и этого достаточно: `activeResourceKind` — это `providerId` МОДЕЛЬНОГО
 * документа, а модельным его делает разбор ровно этого провайдера. Рядом стоял второй ответ,
 * `application/json`, — он существовал, пока композиция не собирала модельных документов
 * и вид ресурса у схемы формы был неотличим от вида `package.json`. Теперь собирает,
 * и вторая половина не просто не нужна: она показывала бы палитру на чужом JSON, у которого
 * ни модели, ни сеанса нет.
 */
export function panelsVisible(ctx: WhenContext): boolean {
  return ctx.activeResourceKind === SCHEMA_MODEL_PROVIDER_ID;
}

/** Всё, что редактор и его панели держат помимо ручки документа. */
export interface SchemaEditorStores {
  /** Общий сеанс перетаскивания: палитра кладёт груз, канвас его читает. */
  readonly drag: DragSession;
  /** Снимки свёрнутых веток по документам — состояние вида редактора. */
  readonly viewStates: CollapseRegistry;
  /**
   * Предпочтения канваса: дерево или схема и видны ли обёртки.
   *
   * Общие для всех документов, поэтому живут рядом с сеансом перетаскивания, а не в снимке
   * вида: снимок принадлежит документу, а способ смотреть — человеку.
   */
  readonly prefs: CanvasPrefs;
  /** Быстрое добавление: команда открывает диалог через этот стор, тело редактора его рисует. */
  readonly quickAdd: QuickAddStore;
}

/**
 * Вклад редактора. Отдельно от плагина, чтобы тест звал его без реестров.
 *
 * `viewState` отдаёт снимок, записанный канвасом ПО ХОДУ ДЕЛА: оболочка зовёт `capture`
 * в уборке эффекта раскладки, когда тело редактора уже могло быть снято с дерева. Подробности —
 * в `./view-state`; тонкость та же, что у порта Monaco, и по той же причине.
 */
export function schemaEditorContribution(
  host: SchemaEditorHost,
  registry: SessionRegistry,
  commands: CommandAccess,
  diagnostics: SchemaDiagnostics | null = null,
  stores: SchemaEditorStores = defaultStores(),
  views: SchemaViewStore | null = null
): EditorContribution {
  const { drag, viewStates, prefs, quickAdd } = stores;
  return {
    id: SCHEMA_EDITOR_ID,
    // Имя для выбора «открыть с помощью». Ключ разрешается словарём ПЛАГИНА: заголовок
    // редактора принадлежит тому, кто его внёс, — иначе `editor.label` двух редакторов
    // означал бы одну строку на двоих.
    titleKey: 'editor.label',
    canOpen(ref, probe) {
      // Решение по СОДЕРЖИМОМУ, а не по расширению: `.json` бывает и схемой формы,
      // и конфигом пакета, и мета-схемой.
      return isFormSchemaResource(ref, probe) ? SCHEMA_EDITOR_PRIORITY : false;
    },
    Body: ({ documentId }: { documentId: ResourceId }) =>
      createElement(SchemaEditor, {
        host,
        registry,
        documentId,
        commands,
        diagnostics,
        drag,
        viewStates,
        prefs,
        quickAdd,
        views,
      }),
    viewState: {
      capture: (id) => viewStates.peek(id),
      restore: (id, state) => {
        // Непонятное значение равносильно отсутствию снимка: дерево откроется развёрнутым,
        // а не упадёт на чужой структуре.
        const restored = readCollapsedState(state);
        if (restored !== null) viewStates.record(id, new Set(restored));
      },
    },
  };
}

/** Свои хранилища — для теста, зовущего вклад в одиночку. */
function defaultStores(): SchemaEditorStores {
  return {
    drag: createDragSession(),
    viewStates: createCollapseRegistry(),
    prefs: createCanvasPrefs(),
    quickAdd: createQuickAddStore(),
  };
}

/** Панели редактора: палитра слева, инспектор справа. */
export function schemaEditorPanels(
  host: SchemaEditorHost,
  registry: SessionRegistry,
  drag: DragSession = createDragSession()
): readonly PanelContribution[] {
  return [
    {
      id: PALETTE_PANEL_ID,
      slot: 'panel.left',
      titleKey: 'palette.title',
      icon: PaletteIcon,
      when: panelsVisible,
      order: 20,
      Body: () => createElement(PalettePanel, { host, registry, drag }),
    },
    {
      id: INSPECTOR_PANEL_ID,
      slot: 'panel.right',
      titleKey: 'inspector.title',
      icon: InspectorIcon,
      when: panelsVisible,
      order: 10,
      Body: () => createElement(InspectorPanel, { host, registry }),
    },
  ];
}

export interface SchemaEditorPluginOptions {
  readonly host: SchemaEditorHost;
  /**
   * Точка расширения провайдеров модели (`document.model`).
   *
   * Подставляется композицией: `@/sdk` её пока не отдаёт, а импортировать `@/shell` плагину
   * нельзя — тот же приём, что у точек панели и редактора в `plugins/files`.
   */
  /**
   * Точка провайдеров модели.
   *
   * Остаётся параметром, а не берётся импортом из `@/sdk` прямо здесь, по той же причине,
   * что и у остальных точек плагина: вклад уходит в ТОТ объект, который дала композиция,
   * и подставить в тестах другой реестр — единственный способ проверить внесение, не поднимая
   * приложение. Тип при этом настоящий, поэтому разойтись с платформой он больше не может.
   */
  readonly modelPoint: ExtensionPointRef<DocumentModelProvider<unknown>>;
  /** Приёмник словаря. Без него строки показываются маркерами промаха — см. `./messages`. */
  readonly i18n?: MessageSink;
  /** Генератор идентификаторов узлов. В тестах — детерминированный. */
  readonly newId?: NodeIdFactory;
}

/**
 * Собирает плагин.
 *
 * `activate` только регистрирует: реестр сеансов создаётся пустым, сеанс рождается при
 * открытии документа. Словарь регистрируется здесь же, если приёмник дан, — он не является
 * подпиской (вклад в словарь не снимается вместе с плагином), поэтому в `subscriptions`
 * не кладётся.
 */
export function createSchemaEditorPlugin(options: SchemaEditorPluginOptions): Plugin {
  const { host, modelPoint, newId } = options;
  const provider = createSchemaModelProvider({ newId });
  // Реестру сеансов провайдер больше не нужен: разбор и печать делает платформа, взяв
  // этот же вклад из точки `document.model`. Сеанс остался только видом на её ручку.
  const registry = createSessionRegistry({ host });

  return definePlugin({
    id: SCHEMA_EDITOR_PLUGIN_ID,
    activate(ctx) {
      for (const [locale, messages] of Object.entries(SCHEMA_EDITOR_MESSAGES)) {
        options.i18n?.contribute(locale, messages);
      }

      // Служба диагностик объявлена в `@/sdk`, поэтому берётся из реестра сервисов,
      // а не приходит портом. `undefined` — штатная деградация: меток на узлах не будет,
      // канвас останется прежним. Роняться на этом нельзя (правило `get` против `require`).
      const diagnostics = ctx.services.get(DiagnosticsServiceToken) ?? null;

      // Общий канал выделения: щелчок по превью переезжает на канвас, а выбранный на канвасе
      // узел уходит наружу. `get`, а не `require`: плагину доступен только он, и отсутствие
      // службы — штатная деградация (так собирается и тест плагина, где реестра сервисов нет).
      const selection = ctx.services.get(SelectionServiceToken);
      if (selection !== undefined) ctx.subscriptions.push(registry.connectSelection(selection));

      // Реестр команд спрашивается ЛЕНИВО, на каждый вопрос: между отрисовкой кнопки
      // исправления и нажатием плагин, владеющий командой, могли выключить — и `has`
      // обязан это увидеть, а не помнить ответ, данный при активации.
      const commands: CommandAccess = {
        has: (commandId) => ctx.commands.get(commandId) !== undefined,
        run: (commandId, args) => {
          void ctx.commands.execute(commandId, args).catch((error: unknown) => {
            console.error(`[editor-schema] команда «${commandId}» отказала`, error);
          });
        },
      };

      // Настройки берутся из реестра служб: способ показа принадлежит человеку, и хранит
      // его платформа. Без службы всё работает, но не переживает перезагрузку.
      const settings = ctx.services.get(SettingsServiceToken) ?? null;

      // ОДИН сеанс перетаскивания на палитру и канвас: они не видят друг друга, и второй
      // сеанс означал бы, что канвас никогда не узнает про груз с палитры. Реестр снимков
      // вида — тоже один: его спрашивает вклад редактора, а пишет в него канвас. Здесь же,
      // а не рядом с плагином, потому что предпочтениям канваса нужны настройки, а они
      // приходят только с контекстом активации.
      const stores: SchemaEditorStores = {
        drag: createDragSession(),
        viewStates: createCollapseRegistry(),
        prefs: createCanvasPrefs({ settings }),
        quickAdd: createQuickAddStore(),
      };
      ctx.subscriptions.push({
        dispose: () => {
          stores.prefs.dispose();
          stores.quickAdd.dispose();
        },
      });

      for (const command of schemaEditorCommands(registry, host, stores.quickAdd)) {
        ctx.subscriptions.push(ctx.commands.register(command));
      }

      // Чем показан документ — конструктором или исходником.
      const views = createSchemaViewStore({
        settings,
        hasTextEditor: () => host.TextEditor !== undefined,
      });
      ctx.subscriptions.push({
        dispose: () => {
          views.dispose();
        },
      });

      /**
       * Схема ли документ.
       *
       * Спрашивается у СЕАНСОВ, а не по имени файла: схемой является не всякий `.json`,
       * и решает это разбор, который уже сделал провайдер модели. Открытая вкладка без
       * сеанса — текстовый документ, и кнопке над ним делать нечего.
       */
      const isSchema = (id: ResourceId): boolean => registry.get(id) !== null;

      for (const command of schemaViewCommands({ host, views, isSchema })) {
        ctx.subscriptions.push(ctx.commands.register(command));
      }

      // Как показан документ — дерево, схема, живая форма или исходник: один переключатель
      // в полосе вкладок. Держать его двумя наборами кнопок значило бы дать два ответа
      // на один вопрос.
      const canvasActions: CanvasActionDeps = {
        prefs: stores.prefs,
        views,
        isSchema,
        // Сеанс появляется ПОСЛЕ отрисовки ряда кнопок (его открывает эффект тела редактора),
        // и ряд обязан узнать об этом — иначе кнопки видов остаются выключенными у только
        // что открытой формы.
        sessions: registry,
        editorId: SCHEMA_EDITOR_ID,
        hasTextEditor: () => host.TextEditor !== undefined,
        // Спрашивается у порта на каждый вызов: поверхности вносятся вкладами, и плагин
        // превью можно выключить, пока вкладка открыта.
        hasLive: () => host.live?.available() === true,
        activeDocument: () => host.activeDocument?.() ?? null,
      };
      for (const command of canvasViewCommands(canvasActions)) {
        ctx.subscriptions.push(ctx.commands.register(command));
      }
      for (const item of canvasViewMenuItems(canvasActions)) {
        ctx.subscriptions.push(ctx.extensions.contribute(MenuPoint, item.value, { id: item.id }));
      }

      ctx.subscriptions.push(
        ctx.extensions.contribute(modelPoint, provider, { id: SCHEMA_MODEL_PROVIDER_ID }),
        ctx.extensions.contribute(
          EditorPoint,
          schemaEditorContribution(host, registry, commands, diagnostics, stores, views),
          { id: SCHEMA_EDITOR_ID }
        )
      );

      for (const panel of schemaEditorPanels(host, registry, stores.drag)) {
        ctx.subscriptions.push(ctx.extensions.contribute(PanelPoint, panel, { id: panel.id }));
      }
    },
    deactivate() {
      // Сеансы не выражаются подпиской: они переживают перерисовку и закрытие вкладки,
      // и снять их может только тот, кто их держит.
      registry.dispose();
    },
  });
}
