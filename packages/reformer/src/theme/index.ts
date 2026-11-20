/**
 * `@reformer/core/theme` — уровень темы над моделью приложения.
 *
 * - `createTheme({ preference?, system?, target?, storage? })` — выбор пользователя
 *   (`light | dark | system`), тема системы и действующая тема сигналами; команды `set`/`toggle`.
 * - Адаптеры: `mediaQuerySystemTheme` (`prefers-color-scheme`), `fixedSystemTheme` (тесты, SSR),
 *   `documentTheme` (класс `dark` или `data-theme` на корне — маркер, который читает ui-kit).
 * - Хранилище выбора: `webStorage()` и тип `StorageAdapter` для своих хранилищ.
 *
 * Привязка к полю модели (`preference: app.$.settings.theme`) — главный путь: форма настроек над
 * этим полем меняет тему, а уровень только читает. React-хуков не нужно:
 * `useSignalSnapshot(theme.resolved)` из `@reformer/core/react`.
 *
 * @group Theme
 * @module theme
 */

export { createTheme } from './create-theme';
export type { Theme, ThemeOptions } from './create-theme';
export {
  documentTheme,
  fixedSystemTheme,
  isThemePreference,
  mediaQuerySystemTheme,
} from './adapters';
export type {
  DocumentThemeOptions,
  SystemThemeSource,
  ThemeKind,
  ThemePreference,
  ThemeTarget,
} from './adapters';
export { webStorage } from '../levels/storage';
export type { StorageAdapter } from '../levels/storage';
