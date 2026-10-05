/**
 * ReFormer-кит поверх дизайн-системы Kaspersky HexaUI.
 *
 * Пакет самодостаточен: несёт собственную зависимость на `@kaspersky/hexa-ui`, поля с адаптерами к
 * seam ReFormer (статика `reformerAdapter`), обёртку и рамку поля поверх их `Field`, провайдер темы
 * и каталог компонентов (`@reformer/kit-hexa-ui/catalog`). Билдер про HexaUI ничего не знает: кит
 * приходит в него внешним плагином этого же пакета (`manifest.json`, `src/builder-plugin.ts`) —
 * вкладом в точку `reformer.kit.source`.
 *
 * ВАЖНО про совместимость: `@kaspersky/hexa-ui` объявляет `react: "16.x || 17.x || 18.x"`, а билдер
 * работает на React 19. Фактически рендер проверен и работает, но внутри HexaUI живут antd@4 и
 * styled-components@5, которые старше удаления `findDOMNode` в React 19 — отдельные компоненты
 * могут падать. Каждый компонент изолирован билдером, поэтому падение даёт плашку, а не крах превью.
 *
 * @module reformer/kit-hexa-ui
 */

// Готовый CSS дизайн-системы — для приложения, которое берёт кит пакетом. В билдере его приносит
// манифест плагина (`src/builder-plugin.css`), и сюда плагин не заходит: код плагина CSS не
// импортирует, иначе оболочка не смогла бы его изолировать.
import '@kaspersky/hexa-ui/design-system/global-style/styles.css';

export { HEXA_UI_NAMESPACE } from './namespace';
export { FormField } from './form-field';
export { FieldFrame, type FieldFrameProps } from './field-frame';
export { KitProvider, Box, Section } from './provider';
export {
  Input,
  Textarea,
  InputPassword,
  InputNumber,
  CheckboxWithLabel,
  Select,
  type CheckboxWithLabelProps,
  type FieldControlLayout,
  type FieldControlStatics,
} from './fields';
