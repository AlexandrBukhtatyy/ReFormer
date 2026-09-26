/**
 * `@reformer/rjsf-kit-theme` — тема RJSF из любого кита ReFormer.
 *
 * Виджеты RJSF рисуются полями кита (мостом через адаптер поля), поле — в рамке поля кита,
 * объект — в его контейнере, отправка — его кнопкой. Кит описывается данными своего каталога,
 * поэтому тема не зависит ни от билдера, ни от конкретного кита: её берут и превью билдера,
 * и форма в приложении.
 *
 * @packageDocumentation
 */

export { createKitTheme, type KitTheme } from './theme';
export {
  DEFAULT_WIDGET_CANDIDATES,
  kitWidget,
  type KitWidgetCandidate,
  type KitWidgetOptions,
} from './widgets';
export {
  createFieldTemplate,
  createObjectTemplate,
  createSubmitButton,
  PlainFieldFrame,
} from './templates';
export type {
  KitFieldFrameProps,
  KitThemeInput,
  KitThemeProblem,
  KitThemeRecord,
  KitThemeTemplates,
} from './types';
