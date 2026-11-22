/**
 * Сочетания клавиш как текст: модификатор платформы и подпись для человека.
 *
 * Здесь то, что плагин показывает: подпись сочетания обязана совпадать с тем, что человек
 * нажимает, поэтому форматирует её тот же код, что разбирает. Диспетчер нажатий и его
 * установка в документ живут в оболочке билдера.
 *
 * @module @reformer/builder-plugin-api/ui/keyboard/keybindings
 */

import { normalizeKeybinding } from '../../primitives/command.js';

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
 * Разделитель ступеней в подписи аккорда.
 *
 * Обычный пробел, а не запятая и не дефис: `Ctrl+K Ctrl+S` — так это пишут и VS Code,
 * и WebStorm, и привычка человека читать такую подпись уже сформирована не нами.
 */
const CHORD_SEPARATOR = ' ';

/**
 * Подпись аккорда: `['mod+k', 'mod+s']` → `Ctrl+K Ctrl+S`.
 *
 * Ступени разделены, а не слиты: это два НАЖАТИЯ, и подпись `Ctrl+K+Ctrl+S` описывала бы
 * несуществующее сочетание из четырёх одновременно зажатых клавиш.
 */
export function formatChord(chord: readonly string[], modifier: PlatformModifier): string {
  return chord.map((step) => formatKeybinding(step, modifier)).join(CHORD_SEPARATOR);
}
