/**
 * Диспетчер сочетаний клавиш — глобальный слой, и только он.
 *
 * ## Команда и ввод — разные вещи
 *
 * Это вывод из разбора v1, а не стиль изложения. Обработчик клавиш там занимает 192 строки,
 * и **командами является меньше трети**. Остальное — ввод, принадлежащий сфокусированному
 * редактору: стрелки с четырьмя комбинациями модификаторов, F6, аккорд из двух нажатий,
 * Escape с тремя разными смыслами в зависимости от места. Сложить это в один реестр значит
 * получить ту же цепочку условий, просто размазанную по десятку файлов.
 *
 * Разведение здесь механическое, а не по договорённости:
 *
 * - Host ставит **один** обработчик, в фазе **всплытия**. Редактор, обработавший событие,
 *   зовёт `stopPropagation()` — и событие до этого модуля просто не доходит. Никакого реестра
 *   приоритетов, никакого «кто раньше подписался»: выигрывает тот, кто ближе к фокусу,
 *   потому что так устроено всплытие.
 * - Этот слой сопоставляет событие с зарегистрированными сочетаниями и выполняет команду,
 *   только если `enabled(ctx)` истинно.
 * - **Фокус в поле ввода пропускает сочетание**, кроме помеченных {@link allowInEditable}.
 *   Это тот самый охранный случай, из-за которого v1 не разбирается на части: реестр команд
 *   без него условия не убирает, а прячет по десятку `enabled`.
 *
 * ## Куда ставится обработчик
 *
 * На `document`, а не на корневой `<div>` оболочки. Причина проверяемая: пока фокус не
 * поставлен никуда, `event.target` — это `body`, а корень оболочки его **потомок**, и событие
 * до него не доходит вовсе. «Один обработчик на корне» из контракта — про единственность
 * и про фазу, а не про конкретный узел; узел настраивается через {@link KeybindingsOptions.target}.
 *
 * ## Почему `mod` разрешается здесь
 *
 * `normalizeKeybinding` намеренно оставляет `mod` как есть: нормализация — про написание,
 * а не про платформу. Диспетчер — единственное место, которое знает, на чём выполняется
 * приложение, поэтому платформенное разрешение живёт тут ({@link resolvePlatformKeybinding}).
 *
 * ## Что вынесено в чистые функции
 *
 * {@link eventToKeybinding} и {@link shouldDispatch} — весь разбор и всё решение. Окружение
 * тестов — `node`, DOM там нет, поэтому обе принимают снимки полей, а не события браузера.
 * В обвязке остаётся только подписка на `keydown` и вызов реестра.
 *
 * @module host/ui/keybindings
 */

import { useEffect } from 'react';
import { normalizeKeybinding, type CommandRegistry } from '../primitives/command';
import { toDisposable, type Disposable } from '../primitives/disposable';
import type { WhenContext } from '../primitives/when-context';

/**
 * Модификатор, в который разворачивается `mod` на этой платформе.
 *
 * `meta` — Cmd на macOS, `ctrl` на остальных. Значение вычисляется один раз при установке
 * обработчика: платформа в течение сессии не меняется, а вычислять её на каждое нажатие
 * означало бы читать `navigator` десятки раз в секунду при обычном наборе текста.
 */
export type PlatformModifier = 'ctrl' | 'meta';

/**
 * Определяет платформенный модификатор.
 *
 * Строка принимается параметром, а не читается изнутри безусловно: обе ветки — часть
 * контракта, и проверять их надо обе, а `node` про macOS ничего не знает.
 */
export function detectPlatformModifier(platform?: string): PlatformModifier {
  // `Partial<Navigator>`, потому что в `node` объект `navigator` существует, а `platform`
  // в нём может отсутствовать: типы DOM обещают строку, рантайм — нет.
  const nav: Partial<Navigator> | null = typeof navigator === 'undefined' ? null : navigator;
  const source = platform ?? nav?.platform ?? nav?.userAgent ?? '';
  return /mac|iphone|ipad|ipod/i.test(source) ? 'meta' : 'ctrl';
}

/**
 * Разворачивает `mod` в платформенный модификатор, сохраняя канонический порядок.
 *
 * Работает по каноническому виду, поэтому обходится без повторного разбора: `mod` в порядке
 * модификаторов стоит первым (см. `MODIFIER_ORDER` в `primitives/command`), а за ним идут
 * `ctrl`, `meta`, `alt`, `shift`. Вставка сводится к проверке начала строки.
 *
 * Совпадение с уже указанным модификатором не является ошибкой: `mod+ctrl+k` на Windows —
 * это `ctrl+k`, потому что `mod` там и есть `ctrl`. Повторно нормализовать результат нельзя —
 * `normalizeKeybinding` отвергает повторённый модификатор.
 *
 * @throws {CommandError} `invalid-keybinding`, если исходное сочетание не разбирается.
 */
export function resolvePlatformKeybinding(keybinding: string, modifier: PlatformModifier): string {
  const canonical = normalizeKeybinding(keybinding);
  if (!canonical.startsWith('mod+')) return canonical;

  const rest = canonical.slice('mod+'.length);
  if (modifier === 'ctrl') return rest.startsWith('ctrl+') ? rest : `ctrl+${rest}`;

  // `meta` в каноническом порядке идёт после `ctrl`, поэтому уже указанный `ctrl` пропускается
  // вперёд, а не наоборот: иначе получилось бы `meta+ctrl+k`, чего диспетчер не построит.
  if (rest.startsWith('ctrl+')) {
    const tail = rest.slice('ctrl+'.length);
    return tail.startsWith('meta+') ? rest : `ctrl+meta+${tail}`;
  }
  return rest.startsWith('meta+') ? rest : `meta+${rest}`;
}

/** Как модификатор называется в подписи. Порядок совпадает с каноническим. */
const MODIFIER_LABELS = [
  ['ctrl', 'Ctrl'],
  ['meta', 'Cmd'],
  ['alt', 'Alt'],
  ['shift', 'Shift'],
] as const;

/** Клавиши, у которых есть общепринятый знак или сокращение. */
const KEY_LABELS: Readonly<Record<string, string>> = {
  escape: 'Esc',
  arrowleft: '←',
  arrowright: '→',
  arrowup: '↑',
  arrowdown: '↓',
  space: 'Space',
  enter: 'Enter',
  backspace: 'Backspace',
  delete: 'Delete',
  tab: 'Tab',
};

function formatKey(key: string): string {
  const known = KEY_LABELS[key];
  if (known !== undefined) return known;
  return key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Подпись сочетания для интерфейса: `mod+shift+p` → `Ctrl+Shift+P`.
 *
 * Не переводится и через словарь не идёт: `Ctrl` и `Shift` — это надписи на клавишах,
 * а не текст интерфейса, и переводить их значило бы называть клавишу не тем, что на ней
 * написано. Локализуется тут разве что порядок, а он у сочетаний один.
 *
 * Неразбираемое сочетание возвращается как есть: подпись — не то место, где стоит падать.
 */
export function formatKeybinding(keybinding: string, modifier: PlatformModifier): string {
  let rest: string;
  try {
    rest = resolvePlatformKeybinding(keybinding, modifier);
  } catch {
    return keybinding;
  }

  const parts: string[] = [];
  for (const [name, label] of MODIFIER_LABELS) {
    if (!rest.startsWith(`${name}+`)) continue;
    parts.push(label);
    rest = rest.slice(name.length + 1);
  }
  parts.push(formatKey(rest));
  return parts.join('+');
}

/**
 * Поля события клавиатуры, по которым строится сочетание.
 *
 * Не `KeyboardEvent`: правило проверяется в `node`, где `KeyboardEvent` нет, а собрать
 * пять полей тест может и без браузера.
 */
export interface KeyEventLike {
  /** `KeyboardEvent.key` как есть, с регистром: `'P'`, `'ArrowLeft'`, `' '`. */
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  /**
   * `KeyboardEvent.code` — ФИЗИЧЕСКАЯ клавиша: `'KeyC'`, `'Digit1'`, `'ArrowLeft'`.
   *
   * Нужен ровно для одного, зато обязательного случая: сочетаний с модификатором в нелатинской
   * раскладке. В русской раскладке Ctrl+C приходит с `key === 'с'` (кириллическая), и сочетание
   * `mod+c` по `key` не совпадает НИ С ЧЕМ — копирование просто перестаёт работать, молча.
   * v1 знала об этом и разбирала копирование по `e.code` (`panels/FilesPanel.tsx`), но только
   * его одно; здесь правило общее и живёт в одном месте.
   *
   * Необязателен: старые события и тестовые двойники его не несут, и тогда разбор идёт по `key`.
   */
  readonly code?: string;
  /**
   * Идёт ли набор через IME. Во время композиции нажатия принадлежат вводу целиком —
   * даже те, что помечены {@link allowInEditable}: Enter там подтверждает выбор иероглифа,
   * а не сохраняет файл.
   */
  readonly isComposing?: boolean;
}

/**
 * Клавиша по физическому положению — для сочетаний с модификатором.
 *
 * Разбирается только `KeyX` и `DigitN`: у них положение однозначно соответствует латинской
 * букве или цифре, и именно они попадают в сочетания. Всё остальное (`Slash`, `BracketLeft`,
 * `Comma`) зависит от раскладки уже физически — на разных клавиатурах эти клавиши стоят
 * в разных местах, и подставлять их по коду значило бы промахиваться иначе, но так же часто.
 */
function keyFromCode(code: string | undefined): string | null {
  if (code === undefined) return null;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  return null;
}

/**
 * Клавиши, которые сами по себе сочетанием не являются.
 *
 * Нажатие Shift рождает `keydown` с `key === 'Shift'` и `shiftKey === true`. Без этого списка
 * оно превратилось бы в сочетание `shift+shift`, и каждое нажатие модификатора запускало бы
 * перебор команд.
 */
const MODIFIER_KEYS: ReadonlySet<string> = new Set([
  'control',
  'shift',
  'alt',
  'altgraph',
  'meta',
  'os',
  'super',
  'hyper',
  'fn',
  'fnlock',
  'capslock',
  'numlock',
  'scrolllock',
  'symbol',
  'symbollock',
  'dead',
  'process',
  'unidentified',
]);

/**
 * Клавиши, которые принадлежат сфокусированному управляющему элементу.
 *
 * Пробел на кнопке обязан нажимать кнопку, а не уходить в команду холста; Enter на кнопке —
 * тем же образом. Это второе охранное условие v1 («не на кнопке»), и вместе с `editable` оно
 * закрывает оба случая, из-за которых там нельзя было разделить ввод и команды.
 *
 * С модификаторами сочетание сюда не попадает: `ctrl+enter` кнопка не обрабатывает,
 * и отдавать его команде правильно.
 */
const CONTROL_KEYS: ReadonlySet<string> = new Set(['space', 'enter']);

/**
 * Переводит событие в каноническое сочетание или отвечает `null`, если сочетания нет.
 *
 * Ключевое свойство: результат проходит через **ту же** `normalizeKeybinding`, что применялась
 * при регистрации команды. Иначе написание разъедется, и расхождение проявится не отказом,
 * а молча не сработавшей клавишей — самой дорогой из возможных поломок.
 *
 * `null` возвращается для нажатия самого модификатора, для набора через IME и для всего,
 * что нормализация разобрать не смогла: перебирать команды в этих случаях не по чему.
 */
export function eventToKeybinding(event: KeyEventLike): string | null {
  if (event.isComposing === true) return null;

  const raw = event.key;
  if (typeof raw !== 'string' || raw === '') return null;

  const lower = raw.toLowerCase();
  if (MODIFIER_KEYS.has(lower)) return null;

  // Пробел приходит как `' '`; в написании сочетаний это `space` — иначе `mod+ +` было бы
  // единственным способом его записать.
  const typed = raw === ' ' ? 'space' : lower;

  // Раскладка подменяется физической клавишей ТОЛЬКО при модификаторе: без него нажатие
  // принадлежит набору текста, и приводить «ы» к «s» значило бы печатать не то, что нажали.
  const modified = event.ctrlKey || event.metaKey || event.altKey;
  const key = modified ? (keyFromCode(event.code) ?? typed) : typed;

  const parts: string[] = [];
  if (event.ctrlKey) parts.push('ctrl');
  if (event.metaKey) parts.push('meta');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');
  parts.push(key);

  try {
    return normalizeKeybinding(parts.join('+'));
  } catch {
    // Нормализация отвергла клавишу — значит сочетания с ней не зарегистрировано в принципе:
    // регистрация проходит через ту же функцию и упала бы раньше.
    return null;
  }
}

/**
 * Команда в объёме, который нужен диспетчеру. Больше он ни до чего не дотягивается.
 *
 * Отдельный тип, а не `CommandContribution`: правило проверяется на трёх полях, и тест,
 * которому пришлось бы собирать `titleKey` и `run`, проверял бы заодно и их.
 */
export interface DispatchableCommand {
  readonly keybinding?: string;
  readonly enabled?: (ctx: WhenContext) => boolean;
  readonly allowInEditable?: boolean;
}

export interface ShouldDispatchOptions {
  /** Во что разворачивать `mod`. По умолчанию `ctrl` — чтобы результат не зависел от машины. */
  readonly modifier?: PlatformModifier;
  /** Куда сообщать об упавшем предикате. Молча его глотать нельзя: это чужая поломка. */
  readonly onError?: (error: unknown) => void;
}

/**
 * Должно ли это нажатие выполнить эту команду. Всё решение целиком, в одной чистой функции.
 *
 * Порядок проверок несущий и читается сверху вниз как правило:
 *
 * 1. у команды есть сочетание и оно совпадает с нажатым (с разрешением `mod`);
 * 2. фокус не в поле ввода — либо команда помечена `allowInEditable`;
 * 3. фокус не на управляющем элементе — либо нажато не «голое» пробел/Enter;
 * 4. `enabled(ctx)` истинно.
 *
 * Упавший предикат считается запретом: охранное условие, которое не смогло ответить,
 * тем более не должно пропускать действие. Это та же политика, что в реестре команд.
 */
export function shouldDispatch(
  binding: string,
  ctx: WhenContext,
  command: DispatchableCommand,
  options: ShouldDispatchOptions = {}
): boolean {
  if (command.keybinding === undefined) return false;

  let expected: string;
  try {
    expected = resolvePlatformKeybinding(command.keybinding, options.modifier ?? 'ctrl');
  } catch {
    // До реестра такая команда не дошла бы — он проверяет сочетание на регистрации.
    // Здесь это защита от команды, собранной в обход реестра.
    return false;
  }
  if (expected !== binding) return false;

  if (ctx.focus === 'editable' && command.allowInEditable !== true) return false;
  if (ctx.focus === 'control' && CONTROL_KEYS.has(binding)) return false;

  if (command.enabled === undefined) return true;
  try {
    return command.enabled(ctx) === true;
  } catch (error) {
    options.onError?.(error);
    return false;
  }
}

/** Где именно упало при обработке нажатия. */
export interface KeybindingErrorInfo {
  readonly commandId: string;
  readonly phase: 'enabled' | 'execute';
}

export interface KeybindingsOptions {
  readonly commands: CommandRegistry;
  /** Снимок состояния. Читается **один раз на нажатие**: предикатам нужен один и тот же. */
  readonly getContext: () => WhenContext;
  /** Во что разворачивать `mod`. По умолчанию определяется по платформе. */
  readonly modifier?: PlatformModifier;
  readonly onError?: (error: unknown, info: KeybindingErrorInfo) => void;
}

function defaultOnError(error: unknown, info: KeybindingErrorInfo): void {
  console.error(`[keybindings] «${info.commandId}»: ошибка в ${info.phase}`, error);
}

/**
 * Событие в объёме, который нужен обработке. `KeyboardEvent` подходит под эту форму.
 *
 * `preventDefault` обязателен: без него `mod+s` откроет диалог сохранения браузера поверх
 * нашего сохранения, а `mod+shift+p` в части сборок откроет приватное окно.
 */
export interface DispatchableEvent extends KeyEventLike {
  preventDefault(): void;
}

/**
 * Обрабатывает нажатие. Возвращает идентификатор выполненной команды или `null`.
 *
 * Перебор идёт по всему реестру, а не по заранее собранному указателю сочетание → команда.
 * Причина в контракте реестра: он не уведомляет об изменениях, а команды приходят и уходят
 * вместе с плагинами и открытыми редакторами, поэтому указатель пришлось бы либо перестраивать
 * на каждое нажатие (то же самое), либо держать устаревшим. Команд десятки, и перебор случается
 * только для события, которое вообще похоже на сочетание.
 *
 * Первая подошедшая команда выигрывает; остальные не рассматриваются. Порядок — регистрации.
 */
export function dispatchKeydown(
  event: DispatchableEvent,
  options: KeybindingsOptions
): string | null {
  const binding = eventToKeybinding(event);
  if (binding === null) return null;

  const onError = options.onError ?? defaultOnError;
  const ctx = options.getContext();
  const modifier = options.modifier ?? detectPlatformModifier();

  for (const command of options.commands.getAll()) {
    const ok = shouldDispatch(binding, ctx, command, {
      modifier,
      onError: (error) => {
        onError(error, { commandId: command.id, phase: 'enabled' });
      },
    });
    if (!ok) continue;

    event.preventDefault();
    // Выполняется через реестр, а не вызовом `run`: реестр — единственная дверь, через
    // которую команда запускается, и он же обязан быть общим с палитрой и с ассистентом.
    // Плата — повторная проверка `enabled` внутри `execute`; предикат по контракту чист
    // и дёшев, поэтому цена известна и мала.
    void options.commands.execute(command.id, undefined, ctx).catch((error: unknown) => {
      onError(error, { commandId: command.id, phase: 'execute' });
    });
    return command.id;
  }

  return null;
}

/** Узел, на который вешается обработчик. `Document` и `HTMLElement` подходят под эту форму. */
export interface KeydownTarget {
  addEventListener(type: 'keydown', listener: (event: KeyboardEvent) => void): void;
  removeEventListener(type: 'keydown', listener: (event: KeyboardEvent) => void): void;
}

/**
 * Ставит единственный обработчик в фазе всплытия. `dispose()` снимает его.
 *
 * Фаза именно всплытия, и это несущее: в фазе погружения глобальный слой получал бы событие
 * **раньше** редактора, и `stopPropagation()` у редактора уже ничего бы не спасал — команда
 * успела бы отработать. Всплытие делает правило «кто ближе к фокусу, тот и решает»
 * механикой браузера, а не договорённостью.
 */
export function installKeybindings(target: KeydownTarget, options: KeybindingsOptions): Disposable {
  const handler = (event: KeyboardEvent): void => {
    dispatchKeydown(event, options);
  };
  target.addEventListener('keydown', handler);
  return toDisposable(() => {
    target.removeEventListener('keydown', handler);
  });
}

/**
 * Держит обработчик установленным, пока смонтирован компонент.
 *
 * `options` обязан быть стабильным между перерисовками (`useMemo` у вызывающего): иначе
 * обработчик переустанавливается на каждый кадр, а вместе с ним теряется и порядок
 * подписок относительно редакторов.
 */
export function useKeybindings(options: KeybindingsOptions, target?: KeydownTarget | null): void {
  useEffect(() => {
    const node = target ?? (typeof document === 'undefined' ? null : document);
    if (node === null) return;
    const subscription = installKeybindings(node, options);
    return () => {
      subscription.dispose();
    };
  }, [options, target]);
}
