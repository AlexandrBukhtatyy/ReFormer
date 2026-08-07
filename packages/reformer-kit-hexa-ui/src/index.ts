/**
 * ReFormer-кит поверх дизайн-системы Kaspersky HexaUI.
 *
 * Пакет самодостаточен: несёт собственную зависимость на `@kaspersky/hexa-ui`, адаптеры полей к
 * seam ReFormer, обёртку поля поверх их `Field`, провайдер темы и каталог компонентов
 * (`@reformer/kit-hexa-ui/catalog`). Билдер про HexaUI ничего не знает — только перечисляет кит в
 * своём реестре и грузит этот namespace через `import()`.
 *
 * ВАЖНО про совместимость: `@kaspersky/hexa-ui` объявляет `react: "16.x || 17.x || 18.x"`, а билдер
 * работает на React 19. Фактически рендер проверен и работает, но внутри HexaUI живут antd@4 и
 * styled-components@5, которые старше удаления `findDOMNode` в React 19 — отдельные компоненты
 * могут падать. Каждый компонент изолирован билдером, поэтому падение даёт плашку, а не крах превью.
 *
 * @module reformer/kit-hexa-ui
 */

export { HEXA_UI_NAMESPACE } from './namespace';
export { FormField } from './form-field';
export { KitProvider, Box, Section } from './provider';
export {
  InputField,
  TextareaField,
  InputPasswordField,
  InputNumberField,
  CheckboxField,
  SelectField,
} from './fields';
