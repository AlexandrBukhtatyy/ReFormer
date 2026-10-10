/**
 * Подпуть `@reformer/core/react` — привязка ядра к React: хуки нод формы, связка поля с контролом,
 * контекст сборки и React-часть локализации.
 *
 * Единственный вход пакета с зависимостью от `react`. Корень `@reformer/core` и остальные сабпаты
 * от React свободны, поэтому `react` и `react-dom` — необязательные peer-зависимости: они нужны
 * только тому, кто импортирует этот вход.
 *
 * Контекст локализации обязан существовать в одном экземпляре на все пакеты `@reformer/*`:
 * пакеты получают его отсюда как внешнюю зависимость и не включают в свою сборку
 * (страж — `scripts/check-i18n-singleton.mjs`).
 *
 * @group Platforms
 * @module react
 * @mergeModuleWith <project>
 */

// Хуки нод формы, контекст сборки, связка поля с контролом.
export * from './platforms/react/index';

// Локализация: провайдер, хуки и контекст.
export { I18nProvider } from './platforms/react/i18n/provider';
export type {
  I18nProviderProps,
  I18nStaticProviderProps,
  I18nLoadingProviderProps,
} from './platforms/react/i18n/provider';
export { useI18n, useMessages, useIssueMessage } from './platforms/react/i18n/hooks';
export { I18N_CONTEXT_MARKER } from './platforms/react/i18n/context';
export type { I18nContextValue } from './platforms/react/i18n/context';
