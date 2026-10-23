/**
 * Генерация в каталог — команда за подразделами подменю «Сгенерировать» в дереве.
 *
 * Подразделы вносят стеки (у ReFormer — «ReFormer»: «Весь модуль» и по пункту на цель): их
 * подписи — ключи словаря стека. Команда за пунктами — здесь, у хозяина: найти форму в каталоге,
 * напечатать и записать — общий путь для любого стека, а аргумент `stack` называет, чей.
 *
 * ## Зачем второй вход, если экспорт уже есть
 *
 * Панель экспорта идёт ОТ ДОКУМЕНТА: она печатает то, что открыто во вкладке, и кладёт модуль
 * туда, куда указывает место документа. Это верно, когда форму сочиняют. Но чаще нужно другое —
 * «вот у меня каталог формы, перепечатай в нём вот этот файл», и от документа этот вопрос не
 * выражается вовсе: каталог называет человек щелчком, а схема лежит внутри него.
 *
 * Отсюда три отличия от {@link runCodegen}, и все три вынуждены целью, а не вкусом:
 *
 * - **форма ищется в каталоге** (`CodegenStack.find`), а не берётся у активной вкладки —
 *   открывать файл, чтобы сгенерировать по нему, значило бы требовать лишний шаг ради того, что
 *   уже названо;
 * - **файлы ложатся туда, куда укажет стек** — в сам каталог, а не в подпапку под ним, иначе
 *   щелчок по `credit-application/` дал бы `credit-application/credit-application/`;
 * - **цель можно выбрать одну** — это и есть подменю v1, где «Типы», «Модель», «Валидация»
 *   были отдельными пунктами.
 *
 * ## Одна цель печатается в контексте ВСЕГО модуля
 *
 * Печатается всегда весь модуль, а доставляется отобранное. Так «Типы» дают ровно тот же
 * `types/<форма>.ts`, что и «Весь модуль», а `README.md` перечисляет настоящий состав, а не себя
 * одного: он читает `ctx.files`, то есть ответ на вопрос «из чего состоит модуль» — а он не
 * зависит от того, сколько файлов человек попросил записать.
 *
 * ## Чего здесь нет
 *
 * Своего состояния. Панель держит сессию на документ, а у каталога документа нет; исход
 * поездки говорится уведомлением и на этом заканчивается. Заводить вторую сессию — «на
 * каталог» — значило бы иметь два ответа на вопрос «что было в прошлый прогон».
 *
 * @module plugins/forms/codegen/commands/generate-into
 */

import {
  isCodegenRefusal,
  pluginMessageKey,
  type CodegenFile,
  type CodegenOpenResult,
  type CodegenRefusal,
  type CodegenTarget,
  type CommandContribution,
  type NotificationsService,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import { CODEGEN_PLUGIN_ID } from '../contract';
import type { CodegenHost } from '../host';
import {
  deliverInto,
  DeliveryRefusedError,
  SourceReadOnlyError,
  type DeliveryResult,
} from '../pipeline/deliver';
import { stackById, targetsFor, type StackEntry, type Stacks } from '../stacks';

/** Команда «сгенерировать в этот каталог». Имя — контракт с пунктами меню стеков. */
export const GENERATE_INTO_COMMAND_ID = 'codegen.generateInto';

/** Аргументы команды. Проверяются, а не приводятся: их шлют меню, палитра и ассистент. */
export interface GenerateIntoArgs {
  /** Каталог, в который печатать. Без него команде нечего адресовать. */
  readonly dir?: ResourceId;
  /**
   * Одна цель вместо всего модуля. Отсутствие означает весь модуль — то же, что делает
   * панель экспорта.
   */
  readonly targetId?: string;
  /** Имя формы; отсутствие — его называет стек (из имени файла схемы). */
  readonly formName?: string;
  /** Стек, чей подраздел меню позвал команду. Отсутствие — первый стек, нашедший форму. */
  readonly stack?: string;
}

function stringField(args: unknown, field: keyof GenerateIntoArgs): string | undefined {
  if (typeof args !== 'object' || args === null) return undefined;
  const value = (args as Record<string, unknown>)[field];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * Аргументы из произвольного значения.
 *
 * Проверяются по полю, а не приводятся целиком: команду зовут из меню, из палитры и от
 * ассистента, и `as GenerateIntoArgs` означал бы доверие к чужой строке в адресе ресурса.
 */
export function generateIntoArgs(args: unknown): GenerateIntoArgs {
  return {
    dir: stringField(args, 'dir') as ResourceId | undefined,
    targetId: stringField(args, 'targetId'),
    formName: stringField(args, 'formName'),
    stack: stringField(args, 'stack'),
  };
}

/** Исход поездки — данные, а не текст: сообщение собирает {@link notifyOutcome}. */
export type GenerateIntoOutcome =
  | { readonly kind: 'no-directory' }
  | { readonly kind: 'no-listing' }
  | { readonly kind: 'no-schema' }
  | { readonly kind: 'not-applicable'; readonly targetId: string }
  | { readonly kind: 'read-only' }
  /** Отказ стека: форма не собирается, кита нет, модуль на диске напечатан другим китом. */
  | { readonly kind: 'refused'; readonly stack: StackEntry; readonly refusal: CodegenRefusal }
  | { readonly kind: 'failed'; readonly message: string }
  | {
      readonly kind: 'delivered';
      readonly delivery: DeliveryResult;
      readonly formName: string;
      readonly stack: StackEntry;
    };

export interface GenerateIntoDeps {
  readonly host: CodegenHost;
  readonly stacks: Stacks;
  /** Цели читаются лениво: их вносят и снимают, в том числе чужие плагины. */
  readonly targets: () => readonly CodegenTarget[];
}

/** Форма в каталоге у названного стека либо у первого, кто её нашёл. */
async function findIn(
  deps: GenerateIntoDeps,
  dir: ResourceId,
  stackId: string | undefined
): Promise<{ readonly entry: StackEntry; readonly found: CodegenOpenResult } | null> {
  const named = stackId === undefined ? null : stackById(deps.stacks, stackId);
  const entries = named === null ? deps.stacks() : [named];
  for (const entry of entries) {
    const found = (await entry.stack.find?.(dir, deps.host)) ?? null;
    if (found !== null) return { entry, found };
  }
  return null;
}

/**
 * Напечатать модуль по форме из каталога и записать в него отобранное.
 *
 * Отдельно от команды по той же причине, по какой `run` отделён от панели: исход проверяется
 * тестом без реестров, а команда остаётся тремя строками — разобрать аргументы, позвать, сказать.
 */
export async function generateInto(
  deps: GenerateIntoDeps,
  args: GenerateIntoArgs
): Promise<GenerateIntoOutcome> {
  const { host } = deps;
  const dir = args.dir;
  if (dir === undefined) return { kind: 'no-directory' };
  if (host.list === undefined) return { kind: 'no-listing' };

  const located = await findIn(deps, dir, args.stack);
  if (located === null) return { kind: 'no-schema' };
  const { entry, found } = located;
  if (found === null) return { kind: 'no-schema' };
  if (isCodegenRefusal(found)) return { kind: 'refused', stack: entry, refusal: found };

  const formName = (args.formName ?? '').trim() || found.formName;
  const module = await found.print({
    targets: targetsFor(deps.targets(), entry.stack),
    formName,
    format: host.format,
  });

  const files: readonly CodegenFile[] =
    args.targetId === undefined
      ? module.files
      : module.files.filter((file) => file.targetId === args.targetId);
  // Пустой отбор при названной цели — не «нечего делать», а «эта цель к этой форме
  // не применилась» (поток шагов у формы без визарда). Молчание здесь читалось бы как отказ.
  if (files.length === 0 && args.targetId !== undefined) {
    return { kind: 'not-applicable', targetId: args.targetId };
  }

  try {
    // Проверка и заметки стека — по ВСЕМУ модулю: при записи одной цели файлов шагов среди
    // доставляемых нет, и без полного состава каждый файл шага выглядел бы брошенным.
    const delivery = await deliverInto(host, found.root, files, module);
    return { kind: 'delivered', delivery, formName, stack: entry };
  } catch (error) {
    if (error instanceof SourceReadOnlyError) return { kind: 'read-only' };
    if (error instanceof DeliveryRefusedError) {
      return { kind: 'refused', stack: entry, refusal: error.refusal };
    }
    return { kind: 'failed', message: error instanceof Error ? error.message : String(error) };
  }
}

/** Ключ словаря хозяина генерации. */
const own = (key: string): string => pluginMessageKey(CODEGEN_PLUGIN_ID, key);

/**
 * Отказ стека уведомлением.
 *
 * Без подробности — ключом словаря стека: уведомления разрешают ключ словарём его владельца.
 * С подробностью (какой файл шага не собрался) — текстом «не удалось: …», чтобы подробность не
 * потерялась: ключ стека её не передаёт.
 */
function notifyRefusal(
  notifications: NotificationsService,
  entry: StackEntry,
  refusal: CodegenRefusal
): void {
  const { key, params } = refusal.refusal;
  if (refusal.detail === undefined) {
    notifications.error(pluginMessageKey(entry.pluginId, key), {
      ...(params === undefined ? {} : { params }),
    });
    return;
  }
  notifications.error(own('notify.failed'), {
    params: { message: `${entry.stack.translate(key, params)} ${refusal.detail}` },
  });
}

/**
 * Сказать, что получилось.
 *
 * Уведомлением, а не тишиной, во всех исходах, включая «ничего не записал»: человек нажал
 * пункт меню и обязан узнать результат — молчание после щелчка читается как поломка.
 */
export function notifyOutcome(
  notifications: NotificationsService | null,
  outcome: GenerateIntoOutcome,
  /**
   * Порт — ради действия «Открыть новый файл» у уведомления о прежних именах.
   * Без него (или без `openResource`) уведомление остаётся, кнопки нет.
   */
  host?: Pick<CodegenHost, 'resolve' | 'openResource'>
): void {
  if (notifications === null) return;
  if (outcome.kind === 'delivered') {
    notifyLayout(notifications, outcome.delivery, outcome.stack, host);
  }
  switch (outcome.kind) {
    case 'no-directory':
      notifications.warning(own('notify.no-directory'));
      return;
    case 'no-listing':
      notifications.error(own('notify.no-listing'));
      return;
    case 'no-schema':
      notifications.warning(own('notify.no-schema'));
      return;
    case 'not-applicable':
      notifications.info(own('notify.not-applicable'));
      return;
    case 'read-only':
      notifications.error(own('notify.read-only'));
      return;
    case 'refused':
      notifyRefusal(notifications, outcome.stack, outcome.refusal);
      return;
    case 'failed':
      notifications.error(own('notify.failed'), { params: { message: outcome.message } });
      return;
    case 'delivered': {
      const { written, skipped, failed } = outcome.delivery;
      // Пропуск — главное, что обязано доехать: авторский файл не тронут, и человек, ждавший
      // перезаписи, иначе узнал бы об этом только открыв файл.
      if (failed.length > 0) {
        notifications.error(own('notify.partial'), {
          params: { written: written.length, failed: failed.length },
        });
        return;
      }
      if (written.length === 0) {
        notifications.info(own('notify.nothing-written'), { params: { skipped: skipped.length } });
        return;
      }
      notifications.success(own('notify.written'), {
        params: { written: written.length, skipped: skipped.length },
      });
      return;
    }
  }
}

/**
 * Сказать про модуль на диске: файлы под прежними именами рядом с новыми и заметки стека
 * (у ReFormer — брошенные файлы шагов и файлы прежней плоской раскладки).
 *
 * Отдельными уведомлениями, а не хвостом основного: «записано 12 файлов» — исход, а эти —
 * просьба к человеку что-то сделать руками (удалить старый файл, разобраться с папкой, перенести
 * правки), и склеенные в одну строку они терялись бы за числами.
 */
export function notifyLayout(
  notifications: NotificationsService,
  delivery: DeliveryResult,
  entry: StackEntry,
  host?: Pick<CodegenHost, 'resolve' | 'openResource'>
): void {
  if (delivery.legacy.length > 0) {
    const carried = delivery.legacy.filter((file) => file.carried).length;
    const first = delivery.legacy[0];
    const open = host?.openResource;
    // Редактор держит открытым СТАРЫЙ файл (у документа формы это особенно больно: дальнейшие
    // правки ушли бы в него, а генерация уже читает новый). Отсюда действие, а не только текст.
    const action =
      open === undefined || host === undefined
        ? undefined
        : {
            titleKey: own('notify.legacy.open'),
            run: () => {
              open(host.resolve(delivery.dir, ...first.replacedBy.split('/')));
            },
          };
    notifications.warning(own('notify.legacy'), {
      params: {
        count: delivery.legacy.length,
        carried,
        files: delivery.legacy.map((file) => `${file.path} → ${file.replacedBy}`).join(', '),
      },
      ...(action === undefined ? {} : { action }),
    });
  }
  for (const note of delivery.notes) {
    notifications.warning(pluginMessageKey(entry.pluginId, note.notify.key), {
      ...(note.notify.params === undefined ? {} : { params: note.notify.params }),
    });
  }
}

/**
 * Команда генерации в каталог.
 *
 * `enabled` не объявлен: «применима ли» здесь — вопрос про ЦЕЛЬ щелчка, а контекст
 * применимости о ней не знает (см. `host/ui/menu`, `enabledWhen`). Гасит пункт вклад меню,
 * а вызов без каталога — из палитры или от ассистента — команда объясняет уведомлением,
 * потому что там это законная попытка, а не промах интерфейса.
 */
export function codegenContextCommands(
  deps: GenerateIntoDeps,
  notifications: NotificationsService | null
): readonly CommandContribution[] {
  return [
    {
      id: GENERATE_INTO_COMMAND_ID,
      titleKey: 'command.generateInto',
      async run(args) {
        const outcome = await generateInto(deps, generateIntoArgs(args));
        notifyOutcome(notifications, outcome, deps.host);
        // Один записанный файл открывается — так вёл себя каждый пункт «Сгенерировать» в v1,
        // и это верно ровно для одного: открыть двенадцать вкладок «Всем модулем» значило бы
        // спрятать за ними ту, из которой человек пришёл.
        if (outcome.kind === 'delivered' && outcome.delivery.written.length === 1) {
          const path = outcome.delivery.written[0];
          deps.host.openResource?.(deps.host.resolve(outcome.delivery.dir, ...path.split('/')));
        }
        return outcome.kind === 'delivered';
      },
    },
  ];
}
