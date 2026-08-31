/**
 * Плагин генерации кода: точка расширения целей, двенадцать встроенных целей, панель и команда.
 *
 * **Почему это плагин, а не часть Host.** Всё содержимое каталога — предметное знание: что такое
 * схема формы, из каких файлов состоит её модуль, откуда берутся имена компонентов. В платформе
 * оно означало бы, что тринадцатый файл модуля вносится правкой ядра. Граница проверяется
 * линтером: `src/plugins/**` не видит `@/host/*` — только `@/sdk` и `@/lib`.
 *
 * **Почему цели вносятся здесь, а не лежат массивом.** Ровно ради этого точка расширения
 * и заводилась: список файлов модуля обязан быть расширяемым и снимаемым. Встроенные цели
 * вносятся в `activate` и уходят вместе с плагином, поэтому «выключить кодоген» — это
 * действительно выключить его, а не оставить полсписка.
 *
 * @module plugins/codegen/plugin
 */

import { createElement, type ReactElement } from 'react';
import { FileCode2 } from 'lucide-react';
import {
  argsOfResource,
  definePlugin,
  MenuPoint,
  NotificationsServiceToken,
  PanelPoint,
  RESOURCE_CONTEXT_MENU,
  whenResource,
  type MenuContribution,
  type ResourceId,
  type CommandContribution,
  type PanelContribution,
  type Plugin,
  type SlotId,
  type WhenContext,
} from '@/sdk';
import {
  codegenContextCommands,
  codegenContextMenuItems,
  type GenerateIntoDeps,
} from './context-menu';
import { CodegenTargetPoint, type CodegenTarget, type ExtensionPointRef } from './contract';
import { createFixture, type FixtureOutcome } from './fixture-command';
import type { CodegenHost, MessageSink } from './host';
import { CODEGEN_MESSAGES } from './messages';
import { runCodegen } from './run';
import { createCodegenSessions, type CodegenSessions } from './state';
import { BUILTIN_TARGETS } from './targets';
import { ExportPanel } from './ui/ExportPanel';

/** Идентификатор плагина: пространство имён во всех реестрах и в словаре. */
export const CODEGEN_PLUGIN_ID = 'codegen';

/** Панель экспорта. */
export const CODEGEN_PANEL_ID = 'codegen.panel';

/** Команда «экспортировать форму». */
export const GENERATE_COMMAND_ID = 'codegen.generate';

/** Идентификатор команды создания фикстуры предпросмотра. */
export const CREATE_FIXTURE_COMMAND_ID = 'codegen.create-fixture';

/**
 * Слот по умолчанию — правый док.
 *
 * Экспорт документный, как инспектор, и в отличие от превью ему не нужна натуральная ширина
 * формы: это список файлов и одна кнопка. Слот переопределяется настройкой плагина —
 * раскладка это дело композиции.
 */
export const DEFAULT_CODEGEN_SLOT: SlotId = 'panel.right';

/**
 * Виды ресурса, при которых панель видима.
 *
 * `form.schema` — идентификатор провайдера модели схемы. `application/json` — то, что оболочка
 * кладёт туда, пока композиция не подключила модель документа; вторая строка уйдёт вместе
 * с этим «пока».
 */
const PANEL_RESOURCE_KINDS: ReadonlySet<string> = new Set(['form.schema', 'application/json']);

/** Значок панели. Обёртка ради размера: контракт объявляет значок компонентом без пропсов. */
const CodegenIcon = (): ReactElement => createElement(FileCode2, { className: 'size-4' });

/** Видима ли панель при таком контексте. Чистая и дешёвая — её зовут на каждый кадр. */
export function panelVisible(ctx: WhenContext): boolean {
  return ctx.activeResourceKind !== null && PANEL_RESOURCE_KINDS.has(ctx.activeResourceKind);
}

/** Вклад панели. Отдельно от плагина, чтобы тест звал его без реестров. */
export function codegenPanel(
  host: CodegenHost,
  sessions: CodegenSessions,
  targets: () => readonly CodegenTarget[],
  slot: SlotId
): PanelContribution {
  return {
    id: CODEGEN_PANEL_ID,
    slot,
    titleKey: 'panel.title',
    icon: CodegenIcon,
    when: panelVisible,
    order: 20,
    Body: () => createElement(ExportPanel, { host, sessions, targets }),
  };
}

/**
 * Команды плагина: сгенерировать модуль формы и создать фикстуру предпросмотра.
 *
 * Обе — про запись файлов по схеме активного документа, и обе живут здесь по одной причине:
 * писать в проект вправе только кодоген (у превью в порту записи нет вовсе). Фикстура при этом
 * не цель генерации, а команда — её адрес лежит ВНЕ каталога модуля, а `CodegenTarget.path`
 * относителен ему и `..` отвергает.
 *
 * Имя формы команда не спрашивает — берёт то, что лежит в состоянии панели (а если панель
 * не открывали, то имя файла схемы). Команда с аргументом «как назвать» дублировала бы поле
 * ввода и разошлась бы с ним.
 */
/**
 * Адрес документа из аргументов команды.
 *
 * Проверяется, а не приводится типом: аргументы приходят от кого угодно — из меню, из палитры,
 * от ассистента, — и `as { documentId: string }` здесь означал бы доверие к чужой строке.
 */
export function documentIdOf(args: unknown): ResourceId | null {
  if (typeof args !== 'object' || args === null) return null;
  const value = (args as { documentId?: unknown }).documentId;
  return typeof value === 'string' ? value : null;
}

/**
 * Пункт контекстного меню дерева: «Сгенерировать код формы» — на ОТКРЫТОМ файле схемы.
 *
 * Остаётся рядом с подменю «Сгенерировать» (`./context-menu`) и не дублирует его: это два
 * разных вопроса, и видны они в разных местах. Здесь щёлкнули по САМОМУ ФАЙЛУ схемы, и
 * ответом будет модуль рядом с ним, в подпапке по имени формы, — то же, что делает панель
 * экспорта. Там щёлкнули по КАТАЛОГУ, и ответом будут файлы в нём самом.
 *
 * Виден только на файле, который ОТКРЫТ как схема формы (`host.documentOf` отвечает моделью,
 * а не текстом). Проверка честная: генерировать из неоткрытого файла нечего — модель схемы
 * появляется вместе с документом, — и пункт, обещающий это, обещал бы несбыточное.
 */
export function codegenDocumentMenuItems(
  host: CodegenHost
): readonly { readonly id: string; readonly value: MenuContribution }[] {
  return [
    {
      id: 'codegen.context.generate',
      value: {
        kind: 'item',
        menu: RESOURCE_CONTEXT_MENU,
        command: GENERATE_COMMAND_ID,
        group: '4_generate',
        when: whenResource(
          (target) => target.ref !== null && host.documentOf(target.ref.id) !== null
        ),
        argsOf: argsOfResource((target) => ({ documentId: target.ref?.id })),
      },
    },
  ];
}

export function codegenCommands(
  host: CodegenHost,
  sessions: CodegenSessions,
  targets: () => readonly CodegenTarget[]
): readonly CommandContribution[] {
  return [
    {
      id: GENERATE_COMMAND_ID,
      titleKey: 'command.generate',
      // Применимость по контексту вкладки ИЛИ по переданному адресу: пункт меню дерева
      // называет схему сам, и требовать от человека сначала открыть её вкладкой значило бы
      // просить лишний щелчок ради того, что уже названо.
      enabled: panelVisible,
      run(args) {
        const documentId = documentIdOf(args) ?? sessions.active();
        if (documentId === null) return;
        const store = sessions.storeFor(documentId);
        void runCodegen({
          host,
          targets: targets(),
          documentId,
          store,
          formName: store.get().formName,
        });
      },
    },
    {
      id: CREATE_FIXTURE_COMMAND_ID,
      titleKey: 'command.create-fixture',
      enabled: panelVisible,
      run(args) {
        const documentId = documentIdOf(args) ?? sessions.active();
        if (documentId === null) return;
        void createFixture(host, documentId).then((outcome) => {
          // Исход показывается словами всегда, включая «ничего не сделал»: человек нажал
          // кнопку и обязан узнать, что произошло, — молчание тут читается как поломка.
          notifyFixture(host, outcome);
        });
      },
    },
  ];
}

/** Показывает исход создания фикстуры. Открывает файл, только когда он действительно записан. */
function notifyFixture(host: CodegenHost, outcome: FixtureOutcome): void {
  if (outcome.kind === 'written') {
    host.openResource?.(outcome.id);
    return;
  }
  // Остальные исходы объясняет панель: у команды нет своего места для сообщения, а заводить
  // его ради трёх строк значило бы вторую систему уведомлений рядом с существующей.
  console.info('[codegen] фикстура не создана:', outcome.kind);
}

export interface CodegenPluginOptions {
  readonly host: CodegenHost;
  /**
   * Точка расширения целей.
   *
   * Параметром, а не импортом из `./contract` прямо в `activate`: вклад обязан уходить в ТОТ
   * объект, который дала композиция, — иначе, когда точка переедет в `@/sdk`, чужие цели
   * окажутся в одной точке, а наши в другой. Умолчание — наша же копия, чтобы плагин работал
   * и до переезда.
   */
  readonly targetPoint?: ExtensionPointRef<CodegenTarget>;
  /** Слот панели; по умолчанию {@link DEFAULT_CODEGEN_SLOT}. */
  readonly slot?: SlotId;
  /** Приёмник словаря. Без него строки показываются маркерами промаха. */
  readonly i18n?: MessageSink;
}

/**
 * Собирает плагин.
 *
 * `activate` только регистрирует: реестр состояний создаётся пустым, состояние документа
 * рождается при первом показе панели.
 */
export function createCodegenPlugin(options: CodegenPluginOptions): Plugin {
  const { host } = options;
  const point = options.targetPoint ?? CodegenTargetPoint;
  const slot = options.slot ?? DEFAULT_CODEGEN_SLOT;
  const sessions = createCodegenSessions();

  return definePlugin({
    id: CODEGEN_PLUGIN_ID,
    activate(ctx) {
      for (const [locale, messages] of Object.entries(CODEGEN_MESSAGES)) {
        options.i18n?.contribute(locale, messages);
      }

      // Список читается ЛЕНИВО, через реестр: цели вносят и снимают, в том числе чужие
      // плагины, и захваченный массив показывал бы состав на момент активации.
      const targets = (): readonly CodegenTarget[] =>
        ctx.extensions.get(point).map((contribution) => contribution.value);

      for (const target of BUILTIN_TARGETS) {
        ctx.subscriptions.push(
          ctx.extensions.contribute(point, target, { id: target.id, order: target.order })
        );
      }

      for (const command of codegenCommands(host, sessions, targets)) {
        ctx.subscriptions.push(ctx.commands.register(command));
      }

      // Генерация в названный каталог: своя команда и своё подменю. Уведомления берутся
      // из сервисов, а не из порта, — исход поездки показывает оболочка, и порт кодогена
      // о ней знать не обязан.
      const intoDeps: GenerateIntoDeps = { host, targets };
      const notifications = ctx.services.get(NotificationsServiceToken) ?? null;
      for (const command of codegenContextCommands(intoDeps, notifications)) {
        ctx.subscriptions.push(ctx.commands.register(command));
      }

      for (const item of [...codegenDocumentMenuItems(host), ...codegenContextMenuItems(targets)]) {
        ctx.subscriptions.push(ctx.extensions.contribute(MenuPoint, item.value, { id: item.id }));
      }

      const panel = codegenPanel(host, sessions, targets, slot);
      ctx.subscriptions.push(ctx.extensions.contribute(PanelPoint, panel, { id: panel.id }));
    },
    deactivate() {
      // Состояния не выражаются подпиской: они переживают перерисовку и переключение вкладки.
      sessions.dispose();
    },
  });
}
