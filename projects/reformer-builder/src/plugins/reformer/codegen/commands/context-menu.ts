/**
 * Генерация в каталог из контекстного меню дерева: подменю «Сгенерировать» и команда за ним.
 *
 * ## Зачем второй вход, если экспорт уже есть
 *
 * Панель экспорта идёт ОТ ДОКУМЕНТА: она печатает то, что открыто во вкладке, и кладёт модуль
 * рядом со схемой, в подпапку по имени формы. Это верно, когда форму сочиняют. Но чаще нужно
 * другое — «вот у меня каталог формы, перепечатай в нём вот этот файл», и от документа этот
 * вопрос не выражается вовсе: каталог называет человек щелчком, а схема лежит внутри него.
 *
 * Отсюда три отличия от {@link runCodegen}, и все три вынуждены целью, а не вкусом:
 *
 * - **схема ищется в каталоге**, а не берётся у активной вкладки — открывать файл, чтобы
 *   сгенерировать по нему, значило бы требовать лишний шаг ради того, что уже названо;
 * - **файлы ложатся В САМ каталог** ({@link deliverInto}), а не в подпапку под ним — иначе
 *   щелчок по `credit-application/` дал бы `credit-application/credit-application/`;
 * - **цель можно выбрать одну** — это и есть подменю v1, где «Типы», «Модель», «Валидация»
 *   были отдельными пунктами.
 *
 * ## Одна цель печатается в контексте ВСЕГО модуля
 *
 * Печатается всегда весь модуль, а доставляется отобранное. Так «Типы» дают ровно тот же
 * `types.ts`, что и «Весь модуль», а `README.md` и `registry.ts` перечисляют настоящий состав,
 * а не себя одного: и тот и другой читают `ctx.files`, то есть ответ на вопрос «из чего
 * состоит модуль» — а он не зависит от того, сколько файлов человек попросил записать.
 *
 * ## Чего здесь нет
 *
 * Своего состояния. Панель держит сессию на документ, а у каталога документа нет; исход
 * поездки говорится уведомлением и на этом заканчивается. Заводить вторую сессию — «на
 * каталог» — значило бы иметь два ответа на вопрос «что было в прошлый прогон».
 *
 * @module plugins/reformer/codegen/commands/context-menu
 */

import {
  formNameOfSchemaPath,
  MODULE_FILES,
  SCHEMA_FILE_NAMES,
} from '@/plugins/reformer/core/codegen';
import { isFormSchema } from '@/plugins/reformer/core/form-model';
import type { JsonFormSchema } from '@reformer/renderer-json';
import {
  argsOfResource,
  asResourceTarget,
  RESOURCE_CONTEXT_MENU,
  whenResource,
  type CommandContribution,
  type MenuContribution,
  type MenuDynamicItem,
  type NotificationsService,
  type ResourceId,
  type ResourceRef,
} from '@reformer/builder-plugin-api';
import type { CodegenTarget } from '../contract';
import { deliverInto, SourceReadOnlyError, type DeliveryResult } from '../pipeline/deliver';
import { generateModule, type ModuleFile } from '../pipeline/generate';
import type { CodegenDocument, CodegenHost } from '../host';
import { schemaOf } from '../pipeline/run';
import { formSourceOf, loadFormSource, StepPartsError, type FormSource } from '../pipeline/source';
import { pluginMessageKey } from '@reformer/builder-plugin-api';
import { CODEGEN_PLUGIN_ID } from '../contract';

/** Команда «сгенерировать в этот каталог». */
export const GENERATE_INTO_COMMAND_ID = 'codegen.generateInto';

/**
 * Адрес подменю «Сгенерировать».
 *
 * Путь, а не структура: он и есть точка расширения. Чужой плагин, у которого появилась своя
 * цель, вносит пункт сюда тем же вкладом, каким вносил бы его в «Файл», — и оказывается
 * в одном списке с нашими, не притрагиваясь к этому модулю.
 */
export const CODEGEN_CONTEXT_SUBMENU = 'resource/context/codegen';

/**
 * Имена, под которыми в каталоге формы лежит её схема, — в порядке предпочтения.
 *
 * Список, а не «любой .json»: перебрать все json-файлы каталога значит прочитать их все,
 * и цена такого поиска зависела бы от того, что ещё лежит рядом. Канон раскладки называет
 * файл схемы однозначно ({@link SCHEMA_FILE_NAMES}: `form.schema.json`, затем прежнее
 * `renderer.schema.json`), два остальных шаблона — то, чем схему называют, когда форм
 * в каталоге несколько.
 */
const SCHEMA_SUFFIXES: readonly string[] = ['.schema.json', '.form.json'];

/** Похоже ли имя на файл схемы формы. Порядок ответа задаёт {@link schemaCandidates}. */
function looksLikeSchema(name: string): boolean {
  return (
    SCHEMA_FILE_NAMES.includes(name) || SCHEMA_SUFFIXES.some((suffix) => name.endsWith(suffix))
  );
}

/** Ранг имени: канон — 0, прежнее имя — 1, прочие — после них. */
function schemaRank(name: string): number {
  const rank = SCHEMA_FILE_NAMES.indexOf(name);
  return rank === -1 ? SCHEMA_FILE_NAMES.length : rank;
}

/**
 * Кандидаты в схему, канон первым.
 *
 * Порядок важнее полноты: в каталоге может лежать и `form.schema.json`, и прежний
 * `renderer.schema.json` (форма, перегенерированная по новой раскладке, старый файл не
 * удаляет), и черновик `old.schema.json` — и «первый попавшийся» тогда зависел бы от того,
 * в каком порядке источник отдал листинг. Канон первым, затем прежнее имя, затем по алфавиту.
 */
export function schemaCandidates(entries: readonly ResourceRef[]): readonly ResourceRef[] {
  const files = entries.filter((entry) => entry.kind === 'file' && looksLikeSchema(entry.name));
  return [...files].sort((a, b) => {
    const byRank = schemaRank(a.name) - schemaRank(b.name);
    return byRank !== 0 ? byRank : a.name.localeCompare(b.name);
  });
}

/** Схема, найденная в каталоге: адрес нужен для имени формы и для отчёта. */
export interface FoundSchema {
  readonly ref: ResourceRef;
  readonly schema: JsonFormSchema;
  /** Открытый документ, из которого взята схема; нет — прочитана с диска. */
  readonly document?: CodegenDocument;
}

/**
 * Найти схему формы в каталоге.
 *
 * Открытый документ ПРЕДПОЧТИТЕЛЬНЕЕ файла на диске: у него текст, который человек видит
 * прямо сейчас, а у файла — тот, что успели сохранить. Сгенерировать по сохранённой копии
 * форму, которой в редакторе уже нет, — молчаливо неверный результат, и он выглядел бы как
 * работающий.
 */
export async function findSchemaIn(
  host: CodegenHost,
  dir: ResourceId
): Promise<FoundSchema | null> {
  if (host.list === undefined) return null;
  const entries = await host.list(dir).catch(() => null);
  if (entries === null) return null;

  for (const ref of schemaCandidates(entries)) {
    const document = host.documentOf(ref.id);
    if (document !== null) {
      const fromDocument = schemaOf(document);
      if (fromDocument !== null) return { ref, schema: fromDocument, document };
      continue;
    }
    const text = await host.readText(ref.id).catch(() => null);
    if (text === null) continue;
    try {
      const parsed: unknown = JSON.parse(text);
      if (isFormSchema(parsed)) return { ref, schema: parsed };
    } catch {
      // Неразбираемый json — не наш файл, а не авария: в каталоге формы может лежать что
      // угодно, и следующий кандидат ещё не проверен.
    }
  }
  return null;
}

/** Аргументы команды. Проверяются, а не приводятся: их шлют меню, палитра и ассистент. */
export interface GenerateIntoArgs {
  /** Каталог, в который печатать. Без него команде нечего адресовать. */
  readonly dir?: ResourceId;
  /**
   * Одна цель вместо всего модуля. Отсутствие означает весь модуль — то же, что делает
   * панель экспорта.
   */
  readonly targetId?: string;
  /** Имя формы; отсутствие — берётся из имени файла схемы. */
  readonly formName?: string;
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
  };
}

/** Исход поездки — данные, а не текст: сообщение собирает {@link notifyOutcome}. */
export type GenerateIntoOutcome =
  | { readonly kind: 'no-directory' }
  | { readonly kind: 'no-listing' }
  | { readonly kind: 'no-schema' }
  | { readonly kind: 'no-kit' }
  | { readonly kind: 'not-applicable'; readonly targetId: string }
  | { readonly kind: 'read-only' }
  | { readonly kind: 'failed'; readonly message: string }
  | { readonly kind: 'delivered'; readonly delivery: DeliveryResult; readonly formName: string };

export interface GenerateIntoDeps {
  readonly host: CodegenHost;
  /** Цели читаются лениво: их вносят и снимают, в том числе чужие плагины. */
  readonly targets: () => readonly CodegenTarget[];
}

/**
 * Напечатать модуль по схеме из каталога и записать в него отобранное.
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

  const found = await findSchemaIn(host, dir);
  if (found === null) return { kind: 'no-schema' };

  const kit = host.kit();
  // Без кита неизвестно, откуда импортировать компоненты, — тот же отказ, что и у панели,
  // и по той же причине: напечатать `@reformer/ui-kit` наугад хуже, чем не печатать.
  if (kit === null) return { kind: 'no-kit' };

  const formName = (args.formName ?? '').trim() || formNameOfSchemaPath(found.ref.path);

  let source: FormSource;
  try {
    source =
      found.document === undefined
        ? await loadFormSource(host, found.ref.id, found.schema)
        : await formSourceOf(host, found.document, found.schema);
  } catch (error) {
    if (!(error instanceof StepPartsError)) throw error;
    return { kind: 'failed', message: error.message };
  }

  const module = await generateModule(
    deps.targets(),
    {
      schema: source.schema,
      origins: source.origins,
      formName,
      kit: { kit, catalog: host.catalog() },
      rules: host.rulesOf?.(found.ref.id) ?? undefined,
    },
    host.format
  );

  const files: readonly ModuleFile[] =
    args.targetId === undefined
      ? module.files
      : module.files.filter((file) => file.targetId === args.targetId);
  // Пустой отбор при названной цели — не «нечего делать», а «эта цель к этой форме
  // не применилась» (шим визарда у формы без визарда). Молчание здесь читалось бы как отказ.
  if (files.length === 0 && args.targetId !== undefined) {
    return { kind: 'not-applicable', targetId: args.targetId };
  }

  try {
    // Весь модуль — для поиска сирот: при записи одной цели файлов шагов среди доставляемых
    // нет, и без полного состава каждая папка шага выглядела бы брошенной.
    const delivery = await deliverInto(host, dir, files, { module: module.files });
    return { kind: 'delivered', delivery, formName };
  } catch (error) {
    if (error instanceof SourceReadOnlyError) return { kind: 'read-only' };
    return { kind: 'failed', message: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Сказать, что получилось.
 *
 * Уведомлением, а не тишиной, во всех исходах, включая «ничего не записал»: человек нажал
 * пункт меню и обязан узнать результат — молчание после щелчка читается как поломка. Ключи
 * разрешает словарь Host (так устроены уведомления), поэтому они с приставкой `codegen.`.
 */
export function notifyOutcome(
  notifications: NotificationsService | null,
  outcome: GenerateIntoOutcome,
  /**
   * Порт — ради действия «Открыть form.schema.json» у уведомления о прежних именах.
   * Без него (или без `openResource`) уведомление остаётся, кнопки нет.
   */
  host?: Pick<CodegenHost, 'resolve' | 'openResource'>
): void {
  if (notifications === null) return;
  if (outcome.kind === 'delivered') notifyLayout(notifications, outcome.delivery, host);
  switch (outcome.kind) {
    case 'no-directory':
      notifications.warning(pluginMessageKey(CODEGEN_PLUGIN_ID, 'notify.no-directory'));
      return;
    case 'no-listing':
      notifications.error(pluginMessageKey(CODEGEN_PLUGIN_ID, 'notify.no-listing'));
      return;
    case 'no-schema':
      notifications.warning(pluginMessageKey(CODEGEN_PLUGIN_ID, 'notify.no-schema'));
      return;
    case 'no-kit':
      notifications.error(pluginMessageKey(CODEGEN_PLUGIN_ID, 'notify.no-kit'));
      return;
    case 'not-applicable':
      notifications.info(pluginMessageKey(CODEGEN_PLUGIN_ID, 'notify.not-applicable'));
      return;
    case 'read-only':
      notifications.error(pluginMessageKey(CODEGEN_PLUGIN_ID, 'notify.read-only'));
      return;
    case 'failed':
      notifications.error(pluginMessageKey(CODEGEN_PLUGIN_ID, 'notify.failed'), {
        params: { message: outcome.message },
      });
      return;
    case 'delivered': {
      const { written, skipped, failed } = outcome.delivery;
      // Пропуск — главное, что обязано доехать: авторский файл не тронут, и человек, ждавший
      // перезаписи, иначе узнал бы об этом только открыв файл.
      if (failed.length > 0) {
        notifications.error(pluginMessageKey(CODEGEN_PLUGIN_ID, 'notify.partial'), {
          params: { written: written.length, failed: failed.length },
        });
        return;
      }
      if (written.length === 0) {
        notifications.info(pluginMessageKey(CODEGEN_PLUGIN_ID, 'notify.nothing-written'), {
          params: { skipped: skipped.length },
        });
        return;
      }
      notifications.success(pluginMessageKey(CODEGEN_PLUGIN_ID, 'notify.written'), {
        params: { written: written.length, skipped: skipped.length },
      });
      return;
    }
  }
}

/**
 * Сказать про раскладку: прежние имена рядом с новыми и брошенные папки шагов.
 *
 * Отдельными уведомлениями, а не хвостом основного: «записано 12 файлов» — исход, а эти два —
 * просьба к человеку что-то сделать руками (удалить старый файл, разобраться с папкой),
 * и склеенные в одну строку они терялись бы за числами.
 */
export function notifyLayout(
  notifications: NotificationsService,
  delivery: DeliveryResult,
  host?: Pick<CodegenHost, 'resolve' | 'openResource'>
): void {
  if (delivery.legacy.length > 0) {
    const carried = delivery.legacy.filter((entry) => entry.carried).length;
    const schema = delivery.legacy.find((entry) => entry.replacedBy === MODULE_FILES.schema);
    const open = host?.openResource;
    // Схема — особый случай: редактор держит открытым СТАРЫЙ файл, и дальнейшие правки ушли бы
    // в него, а генерация уже читает новый. Отсюда действие, а не только текст.
    const action =
      schema === undefined || open === undefined || host === undefined
        ? undefined
        : {
            titleKey: pluginMessageKey(CODEGEN_PLUGIN_ID, 'notify.legacy.open-schema'),
            run: () => {
              open(host.resolve(delivery.dir, ...schema.replacedBy.split('/')));
            },
          };
    notifications.warning(pluginMessageKey(CODEGEN_PLUGIN_ID, 'notify.legacy'), {
      params: {
        count: delivery.legacy.length,
        carried,
        files: delivery.legacy.map((entry) => `${entry.path} → ${entry.replacedBy}`).join(', '),
      },
      ...(action === undefined ? {} : { action }),
    });
  }
  if (delivery.orphans.length > 0) {
    notifications.warning(pluginMessageKey(CODEGEN_PLUGIN_ID, 'notify.orphans'), {
      params: { count: delivery.orphans.length, dirs: delivery.orphans.join(', ') },
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

/**
 * Печатать можно только В КАТАЛОГ — и на файле пункт гаснет, а не исчезает.
 *
 * Пустое место панели считается каталогом: цель дерева подставляет туда корень показа, и
 * «сгенерировать в корень проекта» — законное, хотя и редкое, желание.
 */
const overDirectory = whenResource(
  (target) => target.ref === null || target.ref.kind === 'directory'
);

/** Имя каталога как имя формы: щёлкнули по `credit-application/` — форма так и называется. */
function formNameOfTarget(ref: ResourceRef | null): string | undefined {
  return ref !== null && ref.kind === 'directory' ? ref.name : undefined;
}

/**
 * Пункты подменю «Сгенерировать»: «Весь модуль» и по пункту на цель.
 *
 * Цели вносятся ДИНАМИЧЕСКОЙ группой, а не списком вкладов, потому что их состав известен
 * только в рантайме: точка расширения открыта, и перечислить пункты заранее — значит показать
 * состав на момент активации плагина.
 */
export function codegenContextMenuItems(
  targets: () => readonly CodegenTarget[]
): readonly { readonly id: string; readonly value: MenuContribution }[] {
  return [
    {
      id: 'codegen.context.submenu',
      value: {
        kind: 'submenu',
        menu: RESOURCE_CONTEXT_MENU,
        submenu: CODEGEN_CONTEXT_SUBMENU,
        titleKey: 'menu.generate',
        // Своя группа: генерация — не правка записи и не создание пустого файла, и линия
        // между ними появится сама.
        group: '4_generate',
        enabledWhen: overDirectory,
      },
    },
    {
      id: 'codegen.context.all',
      value: {
        kind: 'item',
        menu: CODEGEN_CONTEXT_SUBMENU,
        command: GENERATE_INTO_COMMAND_ID,
        group: '1_all',
        titleKey: 'menu.generate.all',
        argsOf: argsOfResource((target) => ({
          dir: target.dir,
          formName: formNameOfTarget(target.ref),
        })),
      },
    },
    {
      id: 'codegen.context.targets',
      value: {
        kind: 'dynamic',
        menu: CODEGEN_CONTEXT_SUBMENU,
        group: '2_targets',
        items: (_ctx, menuTarget): readonly MenuDynamicItem[] => {
          const resource = asResourceTarget(menuTarget);
          if (resource === null) return [];
          const formName = formNameOfTarget(resource.ref);
          return targets().map((target) => ({
            id: target.id,
            command: GENERATE_INTO_COMMAND_ID,
            args: { dir: resource.dir, targetId: target.id, formName },
            // Ключ — у наших целей, готовая строка — у чужих: подписать чужую цель нам нечем,
            // а имя файла осмысленно всегда (см. `CodegenTarget.titleKey`).
            titleKey: target.titleKey,
            title: target.titleKey === undefined ? target.path : undefined,
          }));
        },
      },
    },
  ];
}
