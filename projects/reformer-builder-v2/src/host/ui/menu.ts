/**
 * Меню приложения: модель вкладов и построение дерева. Всё, что здесь является правилом,
 * а не отрисовкой.
 *
 * ## Меню — проекция реестра команд, а не второй набор действий
 *
 * У пункта нет `run`: он ссылается на команду по идентификатору. Это главное решение модуля,
 * и оно не про экономию. Позволь пункту носить своё тело — и появится действие, которого нет
 * ни в палитре, ни у ассистента, ни под сочетанием клавиш; дальше оно разойдётся с одноимённой
 * командой, и разойдётся молча. Отсюда же ответ на «доступен ли пункт»: его даёт
 * `CommandRegistry.isEnabled`, то есть тот же предикат, что гасит команду везде.
 *
 * Следствие, названное явно: **пункт, за которым нет зарегистрированной команды, не рисуется**.
 * Не серым, а никак — потому что серый пункт обещает, что когда-нибудь станет доступен, а этот
 * не станет: команды нет вовсе. Та же политика, что у быстрых исправлений (`usableFixes`).
 *
 * ## Разделители выводятся из групп, а не вносятся
 *
 * Вклада «разделитель» не существует. Пункт объявляет `group`, группы идут по алфавиту
 * (отсюда соглашение `1_new`, `2_open`), и между соседними НЕПУСТЫМИ группами появляется линия.
 * Внести висящий разделитель в чужое меню невозможно, а группа, все пункты которой скрылись
 * по `when`, не оставляет после себя следа — чего вручную расставленные разделители не умеют.
 *
 * ## Вложенность — не отдельная возможность
 *
 * Подменю адресуется тем же путём, что корень (`file/recent`), поэтому «расширять не только
 * верхний уровень» — это не функция, а следствие адресации: плагин вносит пункт в `file/recent`
 * ровно так же, как в `file`. Циклы (подменю, которое содержит себя) обрываются на повторе пути,
 * а глубина ограничена {@link MAX_MENU_DEPTH} — меню глубже уже не меню.
 *
 * ## Что здесь и чего здесь нет
 *
 * Есть: отбор по `when`, группы, порядок, разрешение заголовков, рекурсия подменю, зоны корней.
 * Нет: React, DOM, i18n-сервиса, платформы. Окружение тестов — `node`, и правило «пустая группа
 * не даёт разделителя» обязано проверяться без браузера. Сочетание возвращается каноническим
 * (`mod+s`), а не форматированным: как оно выглядит, знает только то место, где известна
 * платформа.
 *
 * @module host/ui/menu
 */

import type { ComponentType } from 'react';
import type { Disposable } from '../primitives/disposable';
import type { CommandContribution } from '../primitives/command';
import { defineExtensionPoint } from '../primitives/extension-point';
import type { WhenContext } from '../primitives/when-context';
import type { TranslateKey } from './palette';

/**
 * Корневые меню, объявленные Host.
 *
 * Набор фиксирован по тому же доводу, что и набор слотов оболочки: состав шапки — часть
 * идентичности приложения, а не следствие того, какие плагины включены. Добавление корня —
 * правка Host, и пусть будет заметной.
 *
 * Плагин при этом не заперт: он вправе внести СВОЁ корневое меню ({@link MenuRootContribution}),
 * но встанет оно в зону между `file` и `help` — см. {@link sortMenuRoots}.
 *
 * ## Почему только «Файл» и «Справка»
 *
 * «Правка» и «Вид» были и убраны. Обе состояли из действий, у которых уже есть более короткий
 * путь: правка узлов — из сочетаний клавиш и контекстного меню на самом узле, а панели, тема
 * и палитра — из рейла и `mod+shift+p`. Меню, дублирующее то, что рядом на экране, стоит
 * не «ничего», а лишний уровень в шапке и лишнее место, где состав приложения надо повторить.
 * Сами действия никуда не делись: команды на месте, сочетания работают, палитра их находит.
 */
export type MenuRootId = 'file' | 'help';

/** Корневые меню Host. Порядок показа задаёт {@link sortMenuRoots}, а не этот список. */
export const MENU_ROOT_IDS: readonly MenuRootId[] = Object.freeze(['file', 'help'] as const);

/**
 * Контекстные меню, объявленные Host, — корни, у которых нет места в шапке.
 *
 * Они перечислены здесь по той же причине, что и корни шапки: набор поверхностей приложения
 * не должен зависеть от того, какие плагины включены. Но показывает их не {@link buildMenuBar},
 * а сама поверхность — дерево ресурсов строит своё меню через {@link buildMenu} в момент
 * щелчка, потому что до щелчка у контекстного меню нет цели, а без цели половина его пунктов
 * не имеет смысла.
 *
 * - `resource/context` — щелчок правой кнопкой по строке дерева ресурсов (или мимо строк).
 * - `editor/title` — ряд действий справа в строке вкладок: то, что относится к ОТКРЫТОМУ
 *   документу, а не к приложению. Пункт со значком становится кнопкой, пункт без значка
 *   уходит под «…» — так же, как это устроено в редакторах, откуда пришла привычка.
 */
export type ContextMenuId = 'resource/context' | 'editor/title';

/** Контекстные корни Host. Известны {@link unknownMenuPaths}, поэтому вклад в них — не промах. */
export const CONTEXT_MENU_IDS: readonly ContextMenuId[] = Object.freeze([
  'resource/context',
  'editor/title',
] as const);

/** Ключи заголовков корневых меню в словаре Host. */
export const MENU_ROOT_TITLE_KEYS: Readonly<Record<MenuRootId, string>> = Object.freeze({
  file: 'shell.menu.file',
  help: 'shell.menu.help',
});

/**
 * Адрес места в дереве меню: корень (`file`) или подменю (`file/recent`).
 *
 * Строка, а не объединение: пути подменю заводят плагины, и перечислить их Host не может.
 * Промах по несуществующему пути не рисуется — найти его умеет {@link unknownMenuPaths}.
 */
export type MenuPath = string;

/** Максимальная глубина: корень, подменю, подменю подменю. Дальше — уже не меню. */
export const MAX_MENU_DEPTH = 3;

/** Общее у всего, что вносится ВНУТРЬ меню. */
interface MenuPlacement {
  /** Куда: корневое меню или подменю. */
  readonly menu: MenuPath;
  /**
   * Группа внутри меню. Группы сортируются по имени, поэтому соглашение — числовой префикс:
   * `1_new`, `2_open`. Отсутствие означает безымянную группу, и она идёт первой.
   */
  readonly group?: string;
  /** Порядок внутри группы; меньше — раньше. Без значения берётся `order` вклада. */
  readonly order?: number;
  /**
   * Показывать ли сейчас. Отсутствие означает «всегда».
   *
   * `when` скрывает, а недоступность гасит: первое — про принадлежность контексту (пункты
   * редактора схемы не нужны на markdown), второе — про «сейчас нечего отменять». Скрывать
   * второе значило бы, что меню меняет высоту под курсором.
   */
  readonly when?: (ctx: WhenContext, target: MenuTarget) => boolean;
  /**
   * Сигнал «мой ответ изменился»: подписка, по которой поверхность пересчитывает меню.
   *
   * Нужен вкладу, чьи `when` и `toggled` зависят от состояния, о котором поверхность
   * не знает вовсе. Пример, ради которого поле и появилось: кнопка markdown меняет значок
   * вместе с режимом показа, а режим живёт в плагине — меню перерисовывать не с чего,
   * и кнопка оставалась прежней, хотя документ уже показан иначе.
   *
   * Это ровно то же решение, что у вклада декорации ресурса (`./decorations`), и по той же
   * причине: контекст применимости отвечает на вопрос «что происходит в приложении», а не
   * «что происходит внутри плагина», и класть туда чужое состояние значило бы вносить
   * предметное знание в платформу.
   */
  readonly onDidChange?: (cb: () => void) => Disposable;
}

/**
 * То, ПО ЧЕМУ вызвали меню: строка дерева, узел канваса, вкладка. Для шапки — `undefined`.
 *
 * Непрозрачна для этого модуля намеренно. Меню — платформенная проекция реестра команд,
 * и знать, что бывает строкой дерева, оно не вправе: сегодня контекстное меню открывают
 * над ресурсом, завтра над узлом схемы, и перечислить это здесь значило бы менять модель
 * меню на каждый новый вид поверхности. Типизированную форму цели объявляет тот, кто меню
 * вызывает (для дерева — `./resource-menu`), и он же сужает `unknown` для своих вкладов.
 *
 * Отсюда и то, почему цель приходит ОТДЕЛЬНО от {@link WhenContext}: тот отвечает на вопрос
 * «что происходит в приложении» и одинаков для палитры, клавиш и меню, а цель существует
 * только в момент щелчка и только у контекстного вызова.
 */
export type MenuTarget = unknown;

/** Пункт меню: ссылка на команду и ничего больше. */
export interface MenuItemContribution extends MenuPlacement {
  readonly kind: 'item';
  /** Идентификатор команды. Нет такой команды — пункта не будет. */
  readonly command: string;
  /** Аргументы команды. Уходят в `execute` как есть. */
  readonly args?: unknown;
  /**
   * Аргументы, вычисляемые по цели щелчка. Заданы — {@link MenuItemContribution.args}
   * не используется вовсе.
   *
   * Отдельным полем, а не «`args` может быть функцией»: аргументы команды — произвольное
   * значение, и различать «функция как аргумент» от «функция, считающая аргумент» по типу
   * означало бы запретить первое молча.
   */
  readonly argsOf?: (target: MenuTarget) => unknown;
  /**
   * Ключ заголовка, если он должен отличаться от заголовка команды. Разрешается словарём
   * того, кто внёс ПУНКТ, — в отличие от заголовка команды, который принадлежит её владельцу.
   *
   * По умолчанию отсутствует, и берётся заголовок команды: одно действие — одно имя
   * в палитре, в меню и у ассистента.
   */
  readonly titleKey?: string;
  /**
   * Состояние переключателя: галочка или точка радио. Отсутствие означает обычный пункт.
   *
   * Предикат, а не значение: состояние вычисляется на том же контексте, что и видимость,
   * и держать его копию рядом означало бы иметь два ответа на один вопрос.
   */
  readonly toggled?: (ctx: WhenContext, target: MenuTarget) => boolean;
  /**
   * Значок — для поверхностей, где пункт рисуется КНОПКОЙ, а не строкой списка
   * (`editor/title`). В списке он не показывается: ряд подписей со значками у одних
   * пунктов и без значков у других читается хуже, чем ряд одних подписей.
   *
   * Отсутствие значка на кнопочной поверхности — не ошибка: такой пункт уходит под «…»,
   * где у него есть место для подписи.
   */
  readonly icon?: ComponentType;
}

/**
 * Подменю: заголовок в одном месте, содержимое — по собственному адресу.
 *
 * `submenu` — это путь, по которому в него вносят пункты. Заводит его тот, кто вносит
 * заголовок, но наполнять может кто угодно: адрес и есть точка расширения.
 */
export interface MenuSubmenuContribution extends MenuPlacement {
  readonly kind: 'submenu';
  /** Адрес содержимого, например `file/recent`. */
  readonly submenu: MenuPath;
  /** Ключ заголовка в словаре внёсшего. */
  readonly titleKey: string;
}

/**
 * Группа пунктов, состав которой известен только в рантайме: открытые панели, недавние
 * проекты, шаблоны форм.
 *
 * Функция, а не список, потому что перечислить это заранее нельзя; зовётся при каждом
 * пересчёте меню и обязана быть чистой и дешёвой — та же дисциплина, что у `when` панели.
 */
export interface MenuDynamicContribution extends MenuPlacement {
  readonly kind: 'dynamic';
  readonly items: (ctx: WhenContext, target: MenuTarget) => readonly MenuDynamicItem[];
}

/** Пункт динамической группы. Готовая строка вместо ключа — имена файлов не переводятся. */
export interface MenuDynamicItem {
  /** Уникален в пределах группы: служит React-ключом. */
  readonly id: string;
  readonly command: string;
  readonly args?: unknown;
  /** Готовый заголовок. Указан вместе с `titleKey` — выигрывает он. */
  readonly title?: string;
  /** Ключ заголовка в словаре внёсшего группу. */
  readonly titleKey?: string;
  /** Галочка. Значение, а не предикат: контекст группе уже дали. */
  readonly toggled?: boolean;
}

/**
 * Собственное корневое меню плагина.
 *
 * Встать перед «Файлом» или после «Справки» оно не может — см. {@link sortMenuRoots}: порядок
 * корней держится зонами, а не сквозным числом, потому что числа со временем нарушают все.
 */
export interface MenuRootContribution {
  readonly kind: 'root';
  /** Путь корня, по которому в него вносят пункты. Совпадение с корнем Host — отказ. */
  readonly id: MenuPath;
  readonly titleKey: string;
  /** Порядок среди корней ПЛАГИНОВ. Без значения берётся `order` вклада. */
  readonly order?: number;
}

/** Всё, что можно внести в точку расширения меню. */
export type MenuContribution =
  | MenuItemContribution
  | MenuSubmenuContribution
  | MenuDynamicContribution
  | MenuRootContribution;

/**
 * Точка расширения меню.
 *
 * Заполняется вкладами плагинов. Проекции платформенных реестров (список панелей, справка,
 * недавние проекты) вкладами НЕ являются — они приходят в {@link MenuBuildOptions.entries}
 * от самой оболочки через {@link hostMenuEntry}: у корневого реестра метода `contribute`
 * нет вовсе, и «вклад, внесённый Host» невыразим по построению.
 */
export const MenuPoint = defineExtensionPoint<MenuContribution>('menu');

/**
 * Запись, из которой строится меню: вклад плагина либо встроенная запись оболочки.
 *
 * `Contribution<MenuContribution>` подходит под этот тип структурно, поэтому реестр отдаёт
 * свои вклады как есть, а оболочка добавляет собственные через {@link hostMenuEntry} —
 * с `pluginId: undefined`, что означает «заголовок разрешается словарём Host».
 */
export interface MenuEntry {
  readonly id: string;
  readonly pluginId?: string;
  readonly order: number;
  readonly value: MenuContribution;
}

/**
 * Подписка на сигналы вкладов: одна на весь набор.
 *
 * Возвращает снятие всех подписок разом. Упавший вклад не мешает остальным: отказ подписки
 * — его поломка, а не повод оставить поверхность без обновлений вовсе.
 */
export function observeMenuEntries(entries: readonly MenuEntry[], cb: () => void): Disposable {
  const subscriptions: Disposable[] = [];
  for (const entry of entries) {
    const observe = entry.value.kind === 'root' ? undefined : entry.value.onDidChange;
    if (observe === undefined) continue;
    try {
      subscriptions.push(observe(cb));
    } catch (error) {
      console.error(`[shell] вклад меню «${entry.id}»: подписка отказала`, error);
    }
  }
  return {
    dispose: () => {
      for (const subscription of subscriptions) subscription.dispose();
      subscriptions.length = 0;
    },
  };
}

/** Встроенная запись оболочки: то же, что вклад, но без владельца. */
export function hostMenuEntry(id: string, value: MenuContribution, order = 0): MenuEntry {
  return Object.freeze({ id, order, value });
}

/** Что построению нужно от реестра команд. Сужение ради тестов: подделывать весь реестр незачем. */
export interface MenuCommandLookup {
  get(id: string): CommandContribution | undefined;
  isEnabled(id: string, ctx?: WhenContext): boolean;
}

/** Почему запись не попала в меню. Код, а не фраза: по нему видно, чинить вклад или команду. */
export type MenuIssueKind =
  | 'unknown-command'
  | 'unknown-menu'
  | 'predicate-failed'
  | 'duplicate-root'
  | 'reserved-root'
  | 'cycle'
  | 'too-deep';

/** Что именно не так и у кого. `entryId` — адрес вклада, по нему находится виновник. */
export interface MenuIssue {
  readonly kind: MenuIssueKind;
  readonly entryId: string;
  readonly pluginId?: string;
  /** Путь, команда или подменю — то, на что запись ссылалась. */
  readonly target?: string;
  readonly error?: unknown;
}

export interface MenuBuildOptions {
  readonly entries: readonly MenuEntry[];
  readonly ctx: WhenContext;
  /**
   * По чему вызвали меню. Для шапки отсутствует, для контекстного меню — то, по чему щёлкнули.
   *
   * Уходит в предикаты и в {@link MenuItemContribution.argsOf} как есть; сама модель меню
   * его не интерпретирует (см. {@link MenuTarget}).
   */
  readonly target?: MenuTarget;
  readonly commands: MenuCommandLookup;
  readonly translate: TranslateKey;
  /** Запуск команды. Всегда через реестр — общая дверь с палитрой, клавишами и ассистентом. */
  readonly execute: (commandId: string, args?: unknown) => void;
  /**
   * Куда сообщать о записи, которая не попала в меню.
   *
   * Молчание здесь хуже шума: пункт, промахнувшийся мимо пути, просто не появляется, и без
   * сообщения виновника ищут чтением всех плагинов сразу. Раздел «прочее» для промахов был бы
   * ещё хуже — он превращает опечатку в видимую пользователю строку.
   */
  readonly onIssue?: (issue: MenuIssue) => void;
}

/** Разделитель между группами. Собственного вклада не имеет — выводится из групп. */
export interface MenuSeparatorNode {
  readonly kind: 'separator';
  readonly id: string;
}

/** Пункт, готовый к показу: заголовок — строка, применимость — уже посчитана. */
export interface MenuActionNode {
  readonly kind: 'item';
  readonly id: string;
  readonly title: string;
  readonly enabled: boolean;
  /** Значок пункта, если он объявлен. Рисует его та поверхность, которой значки нужны. */
  readonly icon?: ComponentType;
  /** Галочка/радио. `undefined` — обычный пункт. */
  readonly checked?: boolean;
  /** Каноническое сочетание команды (`mod+s`); форматирует его тот, кто знает платформу. */
  readonly keybinding?: string;
  readonly run: () => void;
}

/** Подменю с уже построенным содержимым. Пустых не бывает — они не доходят до этого типа. */
export interface MenuSubmenuNode {
  readonly kind: 'submenu';
  readonly id: string;
  readonly title: string;
  readonly items: readonly MenuNode[];
}

export type MenuNode = MenuSeparatorNode | MenuActionNode | MenuSubmenuNode;

/**
 * Корневое меню шапки.
 *
 * `enabled: false` — это «сейчас пусто», и корень остаётся на месте серым. Прятать его нельзя:
 * «Правка» пуста на markdown-вкладке, и исчезни она — «Вид» уехал бы влево ровно в тот момент,
 * когда человек к нему тянется.
 */
export interface MenuBarNode {
  readonly id: MenuPath;
  readonly title: string;
  readonly enabled: boolean;
  readonly items: readonly MenuNode[];
}

/** Действующий порядок записи: собственный `order` важнее порядка регистрации. */
function entryOrder(entry: MenuEntry): number {
  return entry.value.order ?? entry.order;
}

/** Группа записи. Отсутствие — безымянная группа, она идёт первой. */
function entryGroup(entry: MenuEntry): string {
  return entry.value.kind === 'root' ? '' : (entry.value.group ?? '');
}

/**
 * Видна ли запись сейчас.
 *
 * Упавший предикат считается запретом — та же политика, что у панелей и команд: показать
 * пункт, чей `when` не отработал, значит открыть действие в состоянии, для которого оно
 * не писалось.
 */
function isVisible(
  entry: MenuEntry,
  ctx: WhenContext,
  target: MenuTarget,
  onIssue?: (i: MenuIssue) => void
): boolean {
  if (entry.value.kind === 'root') return true;
  const when = entry.value.when;
  if (when === undefined) return true;
  try {
    return when(ctx, target) === true;
  } catch (error) {
    onIssue?.({ kind: 'predicate-failed', entryId: entry.id, pluginId: entry.pluginId, error });
    return false;
  }
}

/** Заголовок пункта: свой ключ разрешается словарём внёсшего, иначе берётся заголовок команды. */
function itemTitle(
  entry: MenuEntry,
  command: CommandContribution,
  titleKey: string | undefined,
  translate: TranslateKey
): string {
  if (titleKey === undefined) return translate(command.titleKey, command);
  return translate(titleKey, entry);
}

/** Состояние переключателя. Упавший предикат — «не отмечен»: галочка не стоит падения меню. */
function readToggled(
  entry: MenuEntry,
  toggled: ((ctx: WhenContext, target: MenuTarget) => boolean) | undefined,
  ctx: WhenContext,
  target: MenuTarget,
  onIssue?: (i: MenuIssue) => void
): boolean | undefined {
  if (toggled === undefined) return undefined;
  try {
    return toggled(ctx, target) === true;
  } catch (error) {
    onIssue?.({ kind: 'predicate-failed', entryId: entry.id, pluginId: entry.pluginId, error });
    return false;
  }
}

/**
 * Пункт из ссылки на команду — общий путь для статических пунктов и динамических групп.
 *
 * `null` означает «команды нет»: пункт не рисуется вовсе, а причина уходит в
 * {@link MenuBuildOptions.onIssue}.
 */
function actionNode(
  options: MenuBuildOptions,
  entry: MenuEntry,
  nodeId: string,
  spec: {
    readonly command: string;
    readonly args?: unknown;
    readonly title?: string;
    readonly titleKey?: string;
    readonly checked?: boolean;
    readonly icon?: ComponentType;
  }
): MenuActionNode | null {
  const command = options.commands.get(spec.command);
  if (command === undefined) {
    options.onIssue?.({
      kind: 'unknown-command',
      entryId: entry.id,
      pluginId: entry.pluginId,
      target: spec.command,
    });
    return null;
  }
  return {
    kind: 'item',
    id: nodeId,
    title: spec.title ?? itemTitle(entry, command, spec.titleKey, options.translate),
    enabled: options.commands.isEnabled(command.id, options.ctx),
    checked: spec.checked,
    icon: spec.icon,
    // Сочетание показывается ТОЛЬКО у пункта без аргументов, потому что клавиши вызывают
    // команду без них. Найдено запуском: подменю «Панели» — это одна команда с адресом
    // панели, и каждая строка обещала «Ctrl+B», хотя это сочетание переключает боковую
    // панель, а не ту, что в строке. Подпись, которая врёт, хуже отсутствующей.
    keybinding: spec.args === undefined ? command.keybinding : undefined,
    run: () => {
      options.execute(command.id, spec.args);
    },
  };
}

/** Пункты одной динамической группы. Упавший поставщик даёт пустую группу, а не пустое меню. */
function dynamicNodes(
  options: MenuBuildOptions,
  entry: MenuEntry,
  contribution: MenuDynamicContribution
): readonly MenuNode[] {
  let items: readonly MenuDynamicItem[];
  try {
    items = contribution.items(options.ctx, options.target);
  } catch (error) {
    options.onIssue?.({
      kind: 'predicate-failed',
      entryId: entry.id,
      pluginId: entry.pluginId,
      error,
    });
    return [];
  }

  const nodes: MenuNode[] = [];
  for (const item of items) {
    const node = actionNode(options, entry, `${entry.id}:${item.id}`, {
      command: item.command,
      args: item.args,
      title: item.title,
      titleKey: item.titleKey,
      checked: item.toggled,
    });
    if (node !== null) nodes.push(node);
  }
  return nodes;
}

/**
 * Узел подменю. `null` — не рисовать: цикл, перебор глубины или пустое содержимое.
 *
 * Пустое подменю скрывается целиком, в отличие от пустого корня. Разница не в
 * непоследовательности: корень держит МЕСТО в шапке, и его исчезновение двигает соседей,
 * а подменю внутри списка не двигает ничего, зато открывается в никуда.
 */
function submenuNode(
  options: MenuBuildOptions,
  entry: MenuEntry,
  contribution: MenuSubmenuContribution,
  trail: readonly MenuPath[]
): MenuSubmenuNode | null {
  const target = contribution.submenu;

  if (trail.includes(target)) {
    options.onIssue?.({ kind: 'cycle', entryId: entry.id, pluginId: entry.pluginId, target });
    return null;
  }
  if (trail.length >= MAX_MENU_DEPTH) {
    options.onIssue?.({ kind: 'too-deep', entryId: entry.id, pluginId: entry.pluginId, target });
    return null;
  }

  const items = buildItems(options, target, [...trail, target]);
  if (items.length === 0) return null;

  return {
    kind: 'submenu',
    id: entry.id,
    title: options.translate(contribution.titleKey, entry),
    items,
  };
}

/**
 * Содержимое одного меню: группы, разделители между непустыми, рекурсия в подменю.
 *
 * `trail` — путь, по которому сюда пришли. Он и есть защита от цикла: подменю, встретившее
 * себя, не строится, а сообщает. Иначе проверить нельзя — граф собирается из вкладов
 * независимых плагинов, и ни один из них не видит целого.
 */
function buildItems(
  options: MenuBuildOptions,
  path: MenuPath,
  trail: readonly MenuPath[]
): readonly MenuNode[] {
  const groups = new Map<string, MenuNode[]>();

  const placed = options.entries
    .map((entry, index) => ({ entry, index }))
    .filter(
      ({ entry }) =>
        entry.value.kind !== 'root' &&
        entry.value.menu === path &&
        isVisible(entry, options.ctx, options.target, options.onIssue)
    )
    .sort(
      (a, b) =>
        entryGroup(a.entry).localeCompare(entryGroup(b.entry)) ||
        entryOrder(a.entry) - entryOrder(b.entry) ||
        a.index - b.index
    );

  for (const { entry } of placed) {
    const value = entry.value;
    const group = entryGroup(entry);
    const bucket = groups.get(group) ?? [];

    if (value.kind === 'item') {
      const node = actionNode(options, entry, entry.id, {
        command: value.command,
        // Аргументы по цели важнее объявленных: они и есть ответ на «к чему применить»,
        // а `args` рядом с ними означал бы два разных ответа на один вопрос.
        args: value.argsOf === undefined ? value.args : value.argsOf(options.target),
        titleKey: value.titleKey,
        icon: value.icon,
        checked: readToggled(entry, value.toggled, options.ctx, options.target, options.onIssue),
      });
      if (node !== null) bucket.push(node);
    } else if (value.kind === 'submenu') {
      const node = submenuNode(options, entry, value, trail);
      if (node !== null) bucket.push(node);
    } else if (value.kind === 'dynamic') {
      bucket.push(...dynamicNodes(options, entry, value));
    }

    if (bucket.length > 0) groups.set(group, bucket);
  }

  const nodes: MenuNode[] = [];
  for (const [group, bucket] of groups) {
    if (nodes.length > 0) nodes.push({ kind: 'separator', id: `${path}:${group}:separator` });
    nodes.push(...bucket);
  }
  return nodes;
}

/** Корни плагинов: отбор, отсев занятых и повторных имён, порядок между собой. */
function pluginRoots(options: MenuBuildOptions): readonly MenuEntry[] {
  const seen = new Set<MenuPath>(MENU_ROOT_IDS);
  const roots: { entry: MenuEntry; index: number }[] = [];

  options.entries.forEach((entry, index) => {
    if (entry.value.kind !== 'root') return;
    const id = entry.value.id;
    if (seen.has(id)) {
      options.onIssue?.({
        kind: (MENU_ROOT_IDS as readonly string[]).includes(id)
          ? 'reserved-root'
          : 'duplicate-root',
        entryId: entry.id,
        pluginId: entry.pluginId,
        target: id,
      });
      return;
    }
    seen.add(id);
    roots.push({ entry, index });
  });

  return roots
    .sort((a, b) => entryOrder(a.entry) - entryOrder(b.entry) || a.index - b.index)
    .map(({ entry }) => entry);
}

/**
 * Порядок корней: `file`, затем корни плагинов, затем `help`.
 *
 * Зонами, а не сквозным числом. Число пришлось бы объяснять («бери order от 300 до 899»),
 * и первый же плагин, оставивший `order` незаполненным, встал бы перед «Файлом» — не по злому
 * умыслу, а потому что ноль это то, что получается само.
 */
export function sortMenuRoots(
  builtin: readonly MenuRootId[],
  plugins: readonly MenuPath[]
): readonly MenuPath[] {
  const head = builtin.filter((id) => id !== 'help');
  const tail = builtin.filter((id) => id === 'help');
  return [...head, ...plugins, ...tail];
}

/**
 * Строит содержимое ОДНОГО меню по его адресу — то, чем пользуется контекстное меню.
 *
 * Та же модель вкладов, тот же отбор, те же группы и разделители, что у шапки: контекстное
 * меню — не второй механизм, а другой корень. Отсюда прямое следствие: плагин, добавляющий
 * пункт в меню дерева, пишет ровно такой же вклад, как для «Файла», и его действие остаётся
 * той же командой — доступной из палитры, с клавиши и ассистенту.
 *
 * Пустой результат означает «показывать нечего»: вызывающий сам решает, рисовать ли пустое
 * меню или не открывать его вовсе.
 */
export function buildMenu(options: MenuBuildOptions, path: MenuPath): readonly MenuNode[] {
  return buildItems(options, path, [path]);
}

/**
 * Строит шапку меню целиком.
 *
 * Пересчитывается на каждое изменение контекста применимости — как и отбор панелей, и по той
 * же причине: «виден ли пункт» и «доступен ли он» меняются от переключения вкладки, а не от
 * перерегистрации вкладов. Отсюда требование к предикатам: чистые и дешёвые.
 */
export function buildMenuBar(options: MenuBuildOptions): readonly MenuBarNode[] {
  const plugins = pluginRoots(options);
  const titles = new Map<MenuPath, string>();
  for (const id of MENU_ROOT_IDS) titles.set(id, options.translate(MENU_ROOT_TITLE_KEYS[id]));
  for (const entry of plugins) {
    const root = entry.value as MenuRootContribution;
    titles.set(root.id, options.translate(root.titleKey, entry));
  }

  const order = sortMenuRoots(
    MENU_ROOT_IDS,
    plugins.map((entry) => (entry.value as MenuRootContribution).id)
  );

  return order.map((id) => {
    const items = buildItems(options, id, [id]);
    return { id, title: titles.get(id) ?? id, enabled: items.length > 0, items };
  });
}

/**
 * Пути, на которые ссылаются вклады, но которых нет ни среди корней, ни среди подменю.
 *
 * Отдельной функцией, а не проверкой внутри построения: промах по пути нельзя обнаружить,
 * строя одно меню, — надо знать все объявленные адреса сразу. Зовётся диагностикой и тестом;
 * само построение такую запись молча пропускает, потому что рисовать её негде.
 */
export function unknownMenuPaths(entries: readonly MenuEntry[]): readonly MenuIssue[] {
  // Контекстные корни известны наравне с корнями шапки: пункт в меню дерева — такой же
  // законный адрес, как пункт в «Файле», хотя в шапке его никто не увидит.
  const known = new Set<MenuPath>([...MENU_ROOT_IDS, ...CONTEXT_MENU_IDS]);
  for (const entry of entries) {
    const value = entry.value;
    if (value.kind === 'root') known.add(value.id);
    if (value.kind === 'submenu') known.add(value.submenu);
  }

  const issues: MenuIssue[] = [];
  for (const entry of entries) {
    const value = entry.value;
    if (value.kind === 'root') continue;
    if (known.has(value.menu)) continue;
    issues.push({
      kind: 'unknown-menu',
      entryId: entry.id,
      pluginId: entry.pluginId,
      target: value.menu,
    });
  }
  return issues;
}
