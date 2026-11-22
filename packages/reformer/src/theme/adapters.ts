/**
 * Адаптеры уровня темы: откуда берётся системная тема и куда применяется действующая.
 *
 * DOM и `matchMedia` уровень трогает только через них, поэтому тема работает и на сервере, и в
 * тестах: там адаптера нет (`null`) или он подменён ({@link fixedSystemTheme}).
 *
 * @module theme/adapters
 */

/**
 * Светлая или тёмная тема.
 *
 * @group Theme
 */
export type ThemeKind = 'light' | 'dark';

/**
 * Выбор пользователя: тема или «как в системе».
 *
 * @group Theme
 */
export type ThemePreference = ThemeKind | 'system';

/**
 * Источник системной темы.
 *
 * @group Theme
 */
export interface SystemThemeSource {
  /** Тема системы сейчас. */
  current(): ThemeKind;
  /** Смена темы системы. Возвращает отписку. */
  subscribe(onChange: () => void): () => void;
}

/**
 * Куда применяется действующая тема: корень документа, контейнер превью.
 *
 * @group Theme
 */
export interface ThemeTarget {
  apply(theme: ThemeKind): void;
}

/**
 * Значение — допустимый выбор темы.
 *
 * @param value - Что угодно: значение из хранилища, поле модели.
 * @returns `true` для `'light'`, `'dark'` и `'system'`.
 *
 * @example
 * ```typescript
 * isThemePreference('dark'); // true
 * isThemePreference('blue'); // false
 * ```
 *
 * @group Theme
 */
export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * Системная тема из медиазапроса `prefers-color-scheme`.
 *
 * @returns Источник или `null`, если спросить некого (сервер, воркер, среда без `matchMedia`) —
 *   тогда уровень считает систему светлой.
 *
 * @example
 * ```typescript
 * const theme = createTheme({ system: mediaQuerySystemTheme() }); // так и по умолчанию
 * ```
 *
 * @group Theme
 */
export function mediaQuerySystemTheme(): SystemThemeSource | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  return {
    current: () => (query.matches ? 'dark' : 'light'),
    subscribe(onChange) {
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
  };
}

/**
 * Системная тема, которую задаёт код: для тестов, SSR и превью.
 *
 * @param initial - Тема системы на старте. По умолчанию `'light'`.
 * @returns Источник с методом `set` — «переключить систему».
 *
 * @example
 * ```typescript
 * const system = fixedSystemTheme('light');
 * const theme = createTheme({ system, target: null });
 * system.set('dark');
 * theme.resolved.value; // 'dark' — предпочтение «как в системе»
 * ```
 *
 * @group Theme
 */
export function fixedSystemTheme(
  initial: ThemeKind = 'light'
): SystemThemeSource & { set(theme: ThemeKind): void } {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    current: () => current,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    set(theme) {
      if (theme === current) return;
      current = theme;
      for (const listener of [...listeners]) listener();
    },
  };
}

/**
 * Настройки {@link documentTheme}.
 *
 * @group Theme
 */
export interface DocumentThemeOptions {
  /** Элемент, на который ставится маркер темы. По умолчанию `document.documentElement`. */
  root?: HTMLElement;
  /**
   * Маркер тёмной темы. `'class'` — класс `dark` (светлая — без класса); `'data-theme'` —
   * атрибут `data-theme="dark|light"`. Оба читает `@custom-variant dark` у `@reformer/ui-kit`.
   * По умолчанию `'class'`.
   */
  attribute?: 'class' | 'data-theme';
  /** Ставить `color-scheme` (полосы прокрутки, системные контролы). По умолчанию `true`. */
  colorScheme?: boolean;
}

/**
 * Применять тему к корню документа тем же маркером, что читают стили `@reformer/ui-kit`.
 *
 * @param options - См. {@link DocumentThemeOptions}.
 * @returns Цель темы или `null` без `document` (сервер).
 *
 * @example
 * ```typescript
 * // Docusaurus и сайты на data-theme:
 * createTheme({ target: documentTheme({ attribute: 'data-theme' }) });
 * ```
 *
 * @group Theme
 */
export function documentTheme(options: DocumentThemeOptions = {}): ThemeTarget | null {
  if (typeof document === 'undefined') return null;
  const root = options.root ?? document.documentElement;
  const attribute = options.attribute ?? 'class';
  const colorScheme = options.colorScheme ?? true;
  return {
    apply(theme) {
      if (attribute === 'class') root.classList.toggle('dark', theme === 'dark');
      else root.setAttribute('data-theme', theme);
      if (colorScheme) root.style.colorScheme = theme;
    },
  };
}
