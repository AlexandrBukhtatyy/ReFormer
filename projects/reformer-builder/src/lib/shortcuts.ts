/**
 * Платформенно-зависимые подписи горячих клавиш. Аккорды по всему билдеру пишутся в нейтральной
 * записи (`Mod+Shift+Z`, `Mod+Alt+1`, `Backspace`), а подписи собираются под ОС пользователя:
 * на macOS — символьные модификаторы в порядке Apple (⌃⌥⇧⌘, без разделителя), на Windows/Linux —
 * словесные через `+` (Ctrl+Shift+Z).
 *
 * `Mod` — «главный» модификатор: ⌘ на macOS и Ctrl на остальных, ровно так же, как его читает
 * обработчик `onKey` в EditorLayout (`e.metaKey || e.ctrlKey`). Отдельный `Ctrl` в записи — это
 * именно Control (⌃ на macOS); на Windows/Linux он схлопывается с `Mod` в один «Ctrl».
 *
 * Рендер аккорда в `<Kbd>` — компонент `Shortcut` (`./Shortcut`), здесь только чистые функции.
 *
 * @module reformer-builder/lib/shortcuts
 */

export type Platform = 'mac' | 'other';

/** Минимум от `navigator`, который нужен для определения платформы (`userAgentData` нет в lib.dom). */
type NavigatorLike = {
  userAgentData?: { platform?: string };
  platform?: string;
  userAgent?: string;
};

/**
 * Платформа по navigator: `userAgentData.platform` (актуальный API) → `platform` (deprecated, но
 * везде есть) → `userAgent`. iPadOS отдаёт `MacIntel` и попадает в `mac` — это верно, на внешней
 * клавиатуре там ⌘.
 */
export function detectPlatform(
  nav: NavigatorLike | undefined = typeof navigator === 'undefined'
    ? undefined
    : (navigator as NavigatorLike)
): Platform {
  const hint = nav?.userAgentData?.platform || nav?.platform || nav?.userAgent || '';
  return /mac|iphone|ipad|ipod/i.test(hint) ? 'mac' : 'other';
}

/** Платформа текущей среды. Считается один раз: в рантайме ОС не меняется. */
export const PLATFORM: Platform = detectPlatform();

/** Метка на платформу: одна строка — общая для обеих, пара — `[macOS, Windows/Linux]`. */
type Label = string | readonly [mac: string, other: string];

type Modifier = 'Mod' | 'Ctrl' | 'Alt' | 'Shift';

/** Синонимы модификаторов в записи аккорда (регистр не важен). */
const MODIFIER_ALIASES: Record<string, Modifier> = {
  mod: 'Mod',
  cmd: 'Mod',
  command: 'Mod',
  meta: 'Mod',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  alt: 'Alt',
  opt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
};

const MODIFIER_LABELS: Record<Modifier, Label> = {
  Mod: ['⌘', 'Ctrl'],
  Ctrl: ['⌃', 'Ctrl'],
  Alt: ['⌥', 'Alt'],
  Shift: ['⇧', 'Shift'],
};

/**
 * Порядок модификаторов в подписи. macOS — канон Apple (Control, Option, Shift, Command),
 * Windows/Linux — привычный Ctrl, Alt, Shift (`Mod` идёт первым, т.к. он и есть Ctrl).
 */
const MODIFIER_ORDER: Record<Platform, readonly Modifier[]> = {
  mac: ['Ctrl', 'Alt', 'Shift', 'Mod'],
  other: ['Mod', 'Ctrl', 'Alt', 'Shift'],
};

/** Именованные клавиши. Всё, чего здесь нет, идёт как есть (F6, Tab), одиночные символы — в верхний регистр. */
const KEY_LABELS: Record<string, Label> = {
  enter: ['↵', 'Enter'],
  return: ['↵', 'Enter'],
  backspace: ['⌫', 'Backspace'],
  delete: 'Delete',
  escape: 'Esc',
  esc: 'Esc',
  space: 'Space',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  /** Собирательное «любая стрелка» — для описаний вида «переместить узел ⌘↑↓←→». */
  arrows: '↑↓←→',
};

function pick(label: Label, platform: Platform): string {
  return typeof label === 'string' ? label : label[platform === 'mac' ? 0 : 1];
}

/**
 * Разложить аккорд на подписи клавиш под платформу — по одной на `<Kbd>`.
 *
 * @example
 * shortcutKeys('Mod+Shift+Z', 'mac');   // ['⇧', '⌘', 'Z']
 * shortcutKeys('Mod+Shift+Z', 'other'); // ['Ctrl', 'Shift', 'Z']
 */
export function shortcutKeys(spec: string, platform: Platform = PLATFORM): string[] {
  const tokens = spec
    .split('+')
    .map((t) => t.trim())
    .filter(Boolean);

  const mods = new Set<Modifier>();
  const keys: string[] = [];
  for (const token of tokens) {
    const mod = MODIFIER_ALIASES[token.toLowerCase()];
    if (mod) mods.add(mod);
    else keys.push(token);
  }

  const out: string[] = [];
  for (const mod of MODIFIER_ORDER[platform]) {
    if (!mods.has(mod)) continue;
    const label = pick(MODIFIER_LABELS[mod], platform);
    // На Windows/Linux `Mod` и `Ctrl` дают одну и ту же подпись — дубль не показываем.
    if (!out.includes(label)) out.push(label);
  }
  for (const key of keys) {
    const label = KEY_LABELS[key.toLowerCase()];
    out.push(label ? pick(label, platform) : key.length === 1 ? key.toUpperCase() : key);
  }
  return out;
}

/**
 * Аккорд одной строкой — для `title`, `aria-label` и текста в предложении. На macOS клавиши идут
 * слитно (⇧⌘Z), на Windows/Linux — через `+` (Ctrl+Shift+Z).
 */
export function formatShortcut(spec: string, platform: Platform = PLATFORM): string {
  return shortcutKeys(spec, platform).join(platform === 'mac' ? '' : '+');
}
