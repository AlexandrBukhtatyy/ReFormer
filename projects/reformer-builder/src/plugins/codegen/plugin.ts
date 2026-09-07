/**
 * Плагин генерации кода: точка расширения целей, двенадцать встроенных целей, панель и команда.
 *
 * **Почему это плагин, а не часть Host.** Всё содержимое каталога — предметное знание: что такое
 * схема формы, из каких файлов состоит её модуль, откуда берутся имена компонентов. В платформе
 * оно означало бы, что тринадцатый файл модуля вносится правкой ядра. Граница проверяется
 * линтером: `src/plugins/**` не видит `@/shell/*` — только `@/sdk` и `@/lib`.
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
  type Disposable,
  type MenuContribution,
  type NotificationsService,
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
} from './commands/context-menu';
import { CodegenTargetPoint, type CodegenTarget, type ExtensionPointRef } from './contract';
import { ejectTemplate, type EjectOutcome } from './commands/eject';
import { createFixture, type FixtureOutcome } from './commands/fixture-command';
import type { CodegenProblem } from './pipeline/generate';
import type { CodegenHost, MessageSink } from './host';
import { CODEGEN_MESSAGES } from './messages';
import { runCodegen } from './pipeline/run';
import { applyOverrides, discoverUserTargets } from './pipeline/user-targets';
import { createCodegenSessions, type CodegenSessions } from './pipeline/state';
import { BUILTIN_TARGETS } from './pipeline/targets';
import { ExportPanel } from './ui/ExportPanel';

// Реэкспорт, а не объявление: идентификатор живёт в contract.ts, чтобы композиция могла
// взять его, не втягивая плагин в стартовый граф.
import { CODEGEN_PLUGIN_ID } from './contract';
export { CODEGEN_PLUGIN_ID };

/** Панель экспорта. */
export const CODEGEN_PANEL_ID = 'codegen.panel';

/** Команда «экспортировать форму». */
export const GENERATE_COMMAND_ID = 'codegen.generate';

/** Идентификатор команды создания фикстуры предпросмотра. */
export const CREATE_FIXTURE_COMMAND_ID = 'codegen.create-fixture';

/**
 * Перечитать цели из `.ui_builder/codegen/`.
 *
 * Командой, а не слежением за файлами: File System Access слежения не даёт — тот же
 * названный пробел, что у шаблонов форм, и та же кнопка «перечитать» в ответ.
 */
export const REFRESH_TARGETS_COMMAND_ID = 'codegen.refresh-targets';

/** Выгрузить встроенный шаблон в проект — «скопируй и правь». */
export const EJECT_TEMPLATE_COMMAND_ID = 'codegen.eject-template';

/**
 * Порядок цели из проекта, если она ничего не переопределяет и порядка не назвала.
 *
 * После всех встроенных (у тех порядок кратен десяти и не доходит до тысячи): новый
 * файл модуля — это добавка к канону, а не вставка в его середину.
 */
const USER_TARGET_ORDER = 1000;

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
  slot: SlotId,
  /** Выгрузка шаблона цели. Без неё панель не показывает кнопку — и это законно. */
  onEject?: (targetId: string) => void,
  /** Отказы разбора целей из проекта — панель показывает их вместе с отказами печати. */
  problems?: () => readonly CodegenProblem[]
): PanelContribution {
  return {
    id: CODEGEN_PANEL_ID,
    slot,
    titleKey: 'panel.title',
    icon: CodegenIcon,
    when: panelVisible,
    order: 20,
    Body: () => createElement(ExportPanel, { host, sessions, targets, onEject, problems }),
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
  targets: () => readonly CodegenTarget[],
  /**
   * Отказы разбора пользовательских целей.
   *
   * Приезжают в отчёт вместе с отказами печати: человек смотрит в панель после нажатия
   * «Сгенерировать», и «мой шаблон не подхватился» обязан объясниться именно там,
   * а не в тосте, который уже исчез.
   */
  problems: () => readonly CodegenProblem[] = () => []
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
          problems: problems(),
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

/**
 * Команды вокруг целей из проекта: перечитать каталог и выгрузить встроенный шаблон.
 *
 * Отдельно от {@link codegenCommands}, потому что обе не про ДОКУМЕНТ: перечитывание
 * относится к проекту, выгрузка — к цели. Ни той, ни другой не нужна активная вкладка.
 */
export function userTargetCommands(
  host: CodegenHost,
  targets: () => readonly CodegenTarget[],
  reload: () => Promise<number>,
  notifications: NotificationsService | null
): readonly CommandContribution[] {
  return [
    {
      id: REFRESH_TARGETS_COMMAND_ID,
      titleKey: 'command.refresh-targets',
      run() {
        void reload().then((count) => {
          // Число называется всегда, включая ноль: «перечитал и не нашёл ничего» —
          // это ответ, а молчание читается как «кнопка не сработала».
          notifications?.info('codegen.notify.targets-refreshed', { params: { count } });
        });
      },
    },
    {
      id: EJECT_TEMPLATE_COMMAND_ID,
      titleKey: 'command.eject-template',
      run(args) {
        const targetId = targetIdOf(args);
        if (targetId === null) return;
        void ejectTemplate({ host, targets }, targetId).then(async (outcome) => {
          notifyEject(notifications, outcome);
          if (outcome.kind !== 'written') return;
          // Перечитываем сразу: иначе выгруженный файл существует, но целью ещё не стал,
          // и первая же генерация напечатала бы встроенный шаблон — как будто выгрузка
          // ничего не сделала.
          await reload();
          host.openResource?.(outcome.id);
        });
      },
    },
  ];
}

/** Идентификатор цели из аргументов команды. Проверяется, а не приводится типом. */
export function targetIdOf(args: unknown): string | null {
  if (typeof args !== 'object' || args === null) return null;
  const value = (args as { targetId?: unknown }).targetId;
  return typeof value === 'string' ? value : null;
}

/** Исход выгрузки словами. Показывается всегда, включая «ничего не сделал». */
function notifyEject(notifications: NotificationsService | null, outcome: EjectOutcome): void {
  if (notifications === null) return;
  switch (outcome.kind) {
    case 'written':
      notifications.success('codegen.notify.eject-written', { params: { name: outcome.name } });
      return;
    case 'no-project':
      notifications.warning('codegen.notify.eject-no-project');
      return;
    case 'not-a-template':
      notifications.info('codegen.notify.eject-not-a-template');
      return;
    case 'read-only':
      notifications.error('codegen.notify.eject-read-only');
      return;
    case 'failed':
      notifications.error('codegen.notify.eject-failed', { params: { message: outcome.message } });
      return;
  }
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
      //
      // Переопределённые снимаются ЗДЕСЬ, а не реестром: замена — предметное правило
      // кодогена, а реестр про неё не знает и знать не должен.
      const targets = (): readonly CodegenTarget[] =>
        applyOverrides(ctx.extensions.get(point).map((contribution) => contribution.value));

      // Цели из проекта вносятся ВКЛАДАМИ наравне с нашими — только так они попадают
      // в общий порядок: цель, заменившая встроенную, обязана встать на ЕЁ место, иначе
      // состав модуля переставлялся бы от одного факта переопределения.
      let userDisposables: Disposable[] = [];
      let userProblems: readonly CodegenProblem[] = [];

      const dropUserTargets = (): void => {
        for (const disposable of userDisposables) disposable.dispose();
        userDisposables = [];
      };

      const reloadUserTargets = async (): Promise<number> => {
        dropUserTargets();
        const found = await discoverUserTargets(host);
        userProblems = found.problems;
        for (const target of found.targets) {
          const inherited = BUILTIN_TARGETS.find((t) => t.id === target.overrides)?.order;
          userDisposables.push(
            ctx.extensions.contribute(point, target, {
              // Свой ключ в реестре: `id` принадлежит цели, а совпадение КЛЮЧЕЙ реестр
              // встречает броском — то есть отказом активации вместо отказа одного файла.
              id: `user:${target.id}`,
              order: target.order ?? inherited ?? USER_TARGET_ORDER,
            })
          );
        }
        return found.targets.length;
      };
      ctx.subscriptions.push({ dispose: dropUserTargets });
      void reloadUserTargets();
      // Проект в момент активации может быть ещё не открыт, и тогда первое чтение вернуло бы
      // пустой список навсегда — до тех пор, пока человек не догадается нажать «перечитать».
      // Смена кита — тот же признак «проект появился», по которому перечитывает себя панель
      // шаблонов форм; своего события «проект открыт» порт не отдаёт.
      ctx.subscriptions.push(
        host.onDidChangeKit(() => {
          void reloadUserTargets();
        })
      );

      for (const target of BUILTIN_TARGETS) {
        ctx.subscriptions.push(
          ctx.extensions.contribute(point, target, { id: target.id, order: target.order })
        );
      }

      for (const command of codegenCommands(host, sessions, targets, () => userProblems)) {
        ctx.subscriptions.push(ctx.commands.register(command));
      }

      // Генерация в названный каталог: своя команда и своё подменю. Уведомления берутся
      // из сервисов, а не из порта, — исход поездки показывает оболочка, и порт кодогена
      // о ней знать не обязан.
      const intoDeps: GenerateIntoDeps = { host, targets };
      const notifications = ctx.services.get(NotificationsServiceToken) ?? null;

      for (const command of userTargetCommands(host, targets, reloadUserTargets, notifications)) {
        ctx.subscriptions.push(ctx.commands.register(command));
      }
      for (const command of codegenContextCommands(intoDeps, notifications)) {
        ctx.subscriptions.push(ctx.commands.register(command));
      }

      for (const item of [...codegenDocumentMenuItems(host), ...codegenContextMenuItems(targets)]) {
        ctx.subscriptions.push(ctx.extensions.contribute(MenuPoint, item.value, { id: item.id }));
      }

      const panel = codegenPanel(
        host,
        sessions,
        targets,
        slot,
        (targetId) => {
          // Через реестр команд, а не прямым вызовом: кнопка панели обязана делать то же
          // самое, что палитра и клавиатурное сочетание, — иначе путей к действию два.
          ctx.commands.get(EJECT_TEMPLATE_COMMAND_ID)?.run({ targetId });
        },
        () => userProblems
      );
      ctx.subscriptions.push(ctx.extensions.contribute(PanelPoint, panel, { id: panel.id }));
    },
    deactivate() {
      // Состояния не выражаются подпиской: они переживают перерисовку и переключение вкладки.
      sessions.dispose();
    },
  });
}
