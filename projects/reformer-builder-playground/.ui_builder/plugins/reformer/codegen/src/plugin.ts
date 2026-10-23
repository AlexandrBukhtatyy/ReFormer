/**
 * Плагин генерации кода: панель «Экспорт формы», запись модуля, цели из проекта и команды.
 *
 * Общий для любого формата формы. Что такое форма документа, из каких файлов состоит её модуль и
 * где он лежит, знает стек: он вносит себя в точку `CodegenStackPoint`, а файлы модуля — целями в
 * `CodegenTargetPoint` (у ReFormer — `./stack`). Хозяин стеки и цели только спрашивает — на каждый
 * вопрос, а не при активации: порядок активации плагинов не важен.
 *
 * **Почему цели читаются из точки.** Ровно ради этого точка расширения и заводилась: список
 * файлов модуля обязан быть расширяемым и снимаемым. Цели стека уходят вместе со стеком, цели из
 * проекта (`.ui_builder/codegen/*.eta`) вносит хозяин — наравне со всеми, чтобы замена встроенной
 * цели встала на ЕЁ место.
 *
 * @module plugins/reformer/codegen/plugin
 */

import { createElement, type ReactElement } from 'react';
import { FileCode2 } from 'lucide-react';
import {
  argsOfResource,
  CodegenStackPoint,
  CodegenTargetPoint,
  definePlugin,
  MenuPoint,
  ModuleGeneratorCapability,
  NotificationsServiceToken,
  PanelPoint,
  pluginMessageKey,
  RESOURCE_CONTEXT_MENU,
  whenResource,
  type CodegenProblem,
  type CodegenTarget,
  type CommandContribution,
  type Disposable,
  type MenuContribution,
  type NotificationsService,
  type PanelContribution,
  type Plugin,
  type ResourceId,
  type SlotId,
} from '@reformer/builder-plugin-api';
import { codegenContextCommands, type GenerateIntoDeps } from './commands/generate-into';
import { ejectTemplate, type EjectOutcome } from './commands/eject';
import type { CodegenHost } from './host';
import { codegenWorkspace, type CodegenGaps } from './workspace';
import { generateFor } from './pipeline/generate-for';
import { CODEGEN_MESSAGES } from './messages';
import { runCodegen } from './pipeline/run';
import { discoverUserTargets } from './pipeline/user-targets';
import { createCodegenSessions, type CodegenSessions } from './pipeline/state';
import { overrideProblems, stackDocumentVisible, stackFor, type Stacks } from './stacks';
import { ExportPanel } from './ui/ExportPanel';
import { activateCodegenStack } from './stack/plugin';

// Реэкспорт, а не объявление: идентификатор живёт в contract.ts, чтобы композиция могла
// взять его, не втягивая плагин в стартовый граф.
import { CODEGEN_PLUGIN_ID } from './contract';
export { CODEGEN_PLUGIN_ID };

/** Панель экспорта. */
export const CODEGEN_PANEL_ID = 'codegen.panel';

/** Команда «экспортировать форму». */
export const GENERATE_COMMAND_ID = 'codegen.generate';

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

/** Значок панели. Обёртка ради размера: контракт объявляет значок компонентом без пропсов. */
const CodegenIcon = (): ReactElement => createElement(FileCode2, { className: 'size-4' });

/** Вклад панели. Отдельно от плагина, чтобы тест звал его без реестров. */
export function codegenPanel(
  host: CodegenHost,
  sessions: CodegenSessions,
  stacks: Stacks,
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
    // Видна, пока активен документ, который печатает какой-нибудь стек.
    when: stackDocumentVisible(stacks),
    order: 20,
    Body: () => createElement(ExportPanel, { host, sessions, stacks, targets, onEject, problems }),
  };
}

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
 * Остаётся рядом с подменю «Сгенерировать» и не дублирует его: это два разных вопроса, и видны
 * они в разных местах. Здесь щёлкнули по САМОМУ ФАЙЛУ схемы, и ответом будет модуль на месте,
 * которое назовёт стек, — то же, что делает панель экспорта. Там щёлкнули по КАТАЛОГУ, и ответом
 * будут файлы в нём самом.
 *
 * Виден только на файле, который ОТКРЫТ документом, печатаемым каким-нибудь стеком. Проверка
 * честная: генерировать из неоткрытого файла нечего — модель схемы появляется вместе с
 * документом, — и пункт, обещающий это, обещал бы несбыточное.
 */
export function codegenDocumentMenuItems(
  host: CodegenHost,
  stacks: Stacks
): readonly { readonly id: string; readonly value: MenuContribution }[] {
  return [
    {
      id: 'codegen.context.generate',
      value: {
        kind: 'item',
        menu: RESOURCE_CONTEXT_MENU,
        command: GENERATE_COMMAND_ID,
        group: '4_generate',
        when: whenResource((target) => {
          const document = target.ref === null ? null : host.documentOf(target.ref.id);
          return document !== null && stackFor(stacks, document) !== null;
        }),
        argsOf: argsOfResource((target) => ({ documentId: target.ref?.id })),
      },
    },
  ];
}

/**
 * Команда плагина: сгенерировать модуль формы.
 *
 * Имя формы команда не спрашивает — берёт то, что лежит в состоянии панели (а если панель
 * не открывали, то его называет стек из имени файла схемы). Команда с аргументом «как назвать»
 * дублировала бы поле ввода и разошлась бы с ним.
 */
export function codegenCommands(
  host: CodegenHost,
  sessions: CodegenSessions,
  stacks: Stacks,
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
      enabled: stackDocumentVisible(stacks),
      run(args) {
        const documentId = documentIdOf(args) ?? sessions.active();
        if (documentId === null) return;
        const store = sessions.storeFor(documentId);
        void runCodegen({
          host,
          stacks,
          targets: targets(),
          documentId,
          store,
          formName: store.get().formName,
          problems: problems(),
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
          notifications?.info(pluginMessageKey(CODEGEN_PLUGIN_ID, 'notify.targets-refreshed'), {
            params: { count },
          });
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
      notifications.success(pluginMessageKey(CODEGEN_PLUGIN_ID, 'notify.eject-written'), {
        params: { name: outcome.name },
      });
      return;
    case 'no-project':
      notifications.warning(pluginMessageKey(CODEGEN_PLUGIN_ID, 'notify.eject-no-project'));
      return;
    case 'not-a-template':
      notifications.info(pluginMessageKey(CODEGEN_PLUGIN_ID, 'notify.eject-not-a-template'));
      return;
    case 'read-only':
      notifications.error(pluginMessageKey(CODEGEN_PLUGIN_ID, 'notify.eject-read-only'));
      return;
    case 'failed':
      notifications.error(pluginMessageKey(CODEGEN_PLUGIN_ID, 'notify.eject-failed'), {
        params: { message: outcome.message },
      });
      return;
  }
}

export interface CodegenPluginOptions {
  /**
   * Рабочая область ЦЕЛИКОМ — только для теста, зовущего плагин без реестра служб.
   *
   * В приложении её собирает сам плагин из возможностей контекста (`./workspace`), и порта
   * у него больше нет. Оставленный параметр перебивает сборку, потому что стенд подделывает
   * не службы, а их ответы: половина двойников здесь считает вызовы и подсовывает файлы,
   * чего через настоящий реестр не выразить.
   */
  readonly host?: CodegenHost;
  /**
   * То, чему в возможностях места пока нет: форматирование (нужна конфигурация prettier из
   * проекта). Подставляет его композиция — см. `./workspace`.
   */
  readonly gaps?: CodegenGaps;
  /** Слот панели; по умолчанию {@link DEFAULT_CODEGEN_SLOT}. */
  readonly slot?: SlotId;
  /**
   * Активировать ли стек ReFormer вместе с хозяином — до раскола на два плагина (шаг 2b).
   * `false` — только хозяин: так его тесты видят ровно хозяйские вклады.
   */
  readonly stack?: boolean;
}

/**
 * Собирает плагин.
 *
 * `activate` только регистрирует: реестр состояний создаётся пустым, состояние документа
 * рождается при первом показе панели.
 */
export function createCodegenPlugin(options: CodegenPluginOptions = {}): Plugin {
  const slot = options.slot ?? DEFAULT_CODEGEN_SLOT;
  const sessions = createCodegenSessions();

  return definePlugin({
    id: CODEGEN_PLUGIN_ID,
    activate(ctx) {
      // Рабочая область собирается ЗДЕСЬ, а не приходит параметром: службы живут в контексте
      // активации, и раньше него их нет. Композиция подставляет только названные дыры.
      const host = options.host ?? codegenWorkspace(ctx, options.gaps);
      for (const [locale, messages] of Object.entries(CODEGEN_MESSAGES)) {
        ctx.i18n.contribute(locale, messages);
      }

      // Стеки и цели — ЛЕНИВО, через реестр: их вносят и снимают, в том числе чужие плагины,
      // и захваченный массив показывал бы состав на момент активации.
      const stacks: Stacks = () =>
        ctx.extensions
          .get(CodegenStackPoint)
          .map((contribution) => ({ stack: contribution.value, pluginId: contribution.pluginId }));
      const targets = (): readonly CodegenTarget[] =>
        ctx.extensions.get(CodegenTargetPoint).map((contribution) => contribution.value);

      // Цели из проекта вносятся ВКЛАДАМИ наравне со всеми — только так они попадают
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
        const contributed = ctx.extensions.get(CodegenTargetPoint);
        for (const target of found.targets) {
          const inherited = contributed.find((c) => c.id === target.overrides)?.order;
          userDisposables.push(
            ctx.extensions.contribute(CodegenTargetPoint, target, {
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

      // Отказы разбора и предупреждения о заменах — одним списком: панель показывает их
      // вместе с отказами печати. Замены считаются по ПОЛНОМУ списку вкладов, лениво —
      // цели вносят и снимают, в том числе чужие плагины.
      const allProblems = (): readonly CodegenProblem[] => [
        ...userProblems,
        ...overrideProblems(targets(), stacks),
      ];

      // Стек ReFormer — пока в этом же плагине (шаг 2b раскола): его вклады идут тем же
      // контекстом, что и хозяйские. Раньше целей из проекта: замена встроенной наследует её
      // порядок.
      if (options.stack !== false) activateCodegenStack(ctx);

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

      // Генерация по заказу — наружу возможностью: её берёт ассистент, чтобы запись модуля стала
      // частью его хода. Прогон тот же, что у панели, и состояние документа то же — открытая
      // панель экспорта покажет и этот прогон.
      ctx.subscriptions.push(
        ctx.services.register(ModuleGeneratorCapability, {
          generate: (documentId, request) =>
            generateFor(
              {
                host,
                stacks,
                targets: targets(),
                store: sessions.storeFor(documentId),
                problems: allProblems(),
                translate: (key, params) => ctx.i18n.t(key, params),
              },
              documentId,
              request
            ),
        })
      );

      for (const command of codegenCommands(host, sessions, stacks, targets, allProblems)) {
        ctx.subscriptions.push(ctx.commands.register(command));
      }

      // Генерация в названный каталог: своя команда, подразделы меню вносят стеки. Уведомления
      // берутся из сервисов, а не из порта, — исход поездки показывает оболочка, и порт кодогена
      // о ней знать не обязан.
      const intoDeps: GenerateIntoDeps = { host, stacks, targets };
      const notifications = ctx.services.get(NotificationsServiceToken) ?? null;

      for (const command of userTargetCommands(host, targets, reloadUserTargets, notifications)) {
        ctx.subscriptions.push(ctx.commands.register(command));
      }
      for (const command of codegenContextCommands(intoDeps, notifications)) {
        ctx.subscriptions.push(ctx.commands.register(command));
      }

      for (const item of codegenDocumentMenuItems(host, stacks)) {
        ctx.subscriptions.push(ctx.extensions.contribute(MenuPoint, item.value, { id: item.id }));
      }

      const panel = codegenPanel(
        host,
        sessions,
        stacks,
        targets,
        slot,
        (targetId) => {
          // Через реестр команд, а не прямым вызовом: кнопка панели обязана делать то же
          // самое, что палитра и клавиатурное сочетание, — иначе путей к действию два.
          ctx.commands.get(EJECT_TEMPLATE_COMMAND_ID)?.run({ targetId });
        },
        allProblems
      );
      ctx.subscriptions.push(ctx.extensions.contribute(PanelPoint, panel, { id: panel.id }));
    },
    deactivate() {
      // Состояния не выражаются подпиской: они переживают перерисовку и переключение вкладки.
      sessions.dispose();
    },
  });
}
