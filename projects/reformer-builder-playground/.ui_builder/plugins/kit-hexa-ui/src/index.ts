/**
 * ReFormer-кит поверх дизайн-системы Kaspersky HexaUI.
 *
 * Пакет самодостаточен: несёт собственную зависимость на `@kaspersky/hexa-ui`, поля с адаптерами к
 * seam ReFormer (статика `reformerAdapter`), обёртку и рамку поля поверх их `Field`, провайдер темы
 * и каталог компонентов (`@reformer/kit-hexa-ui/catalog`). Билдер про HexaUI ничего не знает: кит
 * приходит в него внешним плагином этого же пакета (`manifest.json`, `src/builder-plugin.ts`) —
 * вкладом в точку `reformer.kit.source`.
 *
 * ## Вход экспортирует всё, что каталог называет компонентом
 *
 * Кодоген билдера печатает импорт по каталогу: `import { Button, Card, … } from
 * '@reformer/kit-hexa-ui'` — символ записи (`exportName` либо имя записи) из входа пакета. Записи,
 * которой здесь нет, превью билдера не замечает (оно берёт компоненты из namespace), а
 * сгенерированный модуль с ней не компилируется: `TS2305 … has no exported member`. Поэтому состав
 * входа обязан совпадать с каталогом и с namespace — это закрепляет `src/builder-plugin.test.ts`.
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

// Контейнеры и презентационные компоненты — сами компоненты HexaUI, без обёрток: те же символы,
// что отдаёт namespace. Каноническое имя ReFormer с ними связывает каталог (`exportName` записи):
// `Separator` → `Divider`, `Spinner` → `Loader`, `Progress` → `ProgressBar`.
export {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Label,
  Link,
  Loader,
  Panel,
  ProgressBar,
  Skeleton,
  Space,
  Tag,
} from '@kaspersky/hexa-ui';
