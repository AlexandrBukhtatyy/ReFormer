/**
 * ReFormer-кит поверх дизайн-системы Kaspersky HexaUI.
 *
 * Пакет самодостаточен: несёт собственную зависимость на `@kaspersky/hexa-ui`, поля с адаптерами к
 * seam ReFormer (статика `reformerAdapter`), обёртку и рамку поля поверх их `Field`, визард по
 * протоколу каталога `3.0`, провайдер темы и каталог компонентов (`@reformer/kit-hexa-ui/catalog`).
 * Билдер про HexaUI ничего не знает: кит приходит в него внешним плагином этого же пакета
 * (`manifest.json`, `src/builder-plugin.ts`) — вкладом в точку `reformer.kit.source`.
 *
 * ## Вход экспортирует всё, что каталог называет компонентом
 *
 * Кодоген билдера печатает импорт по каталогу: `import { Button, Card, … } from
 * '@reformer/kit-hexa-ui'` — символ записи (`exportName` либо имя записи) из входа пакета. Записи,
 * которой здесь нет, превью билдера не замечает (оно берёт компоненты из namespace), а
 * сгенерированный модуль с ней не компилируется: `TS2305 … has no exported member`. Поэтому состав
 * входа обязан покрывать каталог — это закрепляет `src/builder-plugin.test.ts`.
 *
 * Вход — это: поля (`./fields`), компоненты HexaUI как есть (`./components`, явным списком),
 * плоские имена статик (`./compound`), тяжёлое (`./heavy` — только здесь, не в namespace), визард,
 * обёртка и рамка поля, провайдер.
 *
 * ВАЖНО про совместимость: `@kaspersky/hexa-ui` объявляет `react: "16.x || 17.x || 18.x"`, а билдер
 * работает на React 19. Внутри HexaUI живут antd@4 и styled-components@5; браузерный прогон кита
 * (`*.browser.test.tsx`) монтирует все поля и визард под React 19 — падений нет, есть только
 * предупреждения в консоли. Единственная найденная разница — `defaultProps` функций, которые
 * React 19 не применяет (`Uploader.size`): обёртки кита задают такие пропсы явно.
 *
 * @module reformer/kit-hexa-ui
 */

// Готовый CSS дизайн-системы — для приложения, которое берёт кит пакетом. В билдере его приносит
// манифест плагина (`src/builder-plugin.css`), и сюда плагин не заходит: код плагина CSS не
// импортирует, иначе оболочка не смогла бы его изолировать. Сам по себе CSS глобален (ресет antd
// на `html`/`body`/теги): приложение ограничивает его провайдером кита Vite-плагином
// `hexaUiStyles()` из `@reformer/kit-hexa-ui/vite`.
import '@kaspersky/hexa-ui/design-system/global-style/styles.css';

export { HEXA_UI_NAMESPACE } from './namespace';
export { FormField } from './form-field';
export { FieldFrame, type FieldFrameProps } from './field-frame';
export { KitProvider, Box, Section } from './provider';
export { FormWizard, type FormWizardProps, type WizardStepNode } from './wizard';
export * from './fields';
export * from './components';
export * from './compound';
export * from './heavy';
