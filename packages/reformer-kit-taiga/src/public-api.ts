/**
 * @reformer/kit-taiga — кит ReFormer на Taiga UI 5: standalone-компоненты под именами каталога
 * (`component-catalog.json`, вход `./catalog`) для формы на `@reformer/renderer-json`, которую
 * рисует `@reformer/renderer-angular`.
 *
 * Контрол — самодостаточное поле: подпись и ошибку рисует сам компонент, обёртка поля
 * (`FIELD_WRAPPER`) в реестре не нужна. Приложение ставит провайдеры кита один раз —
 * `provideKitTaiga()`, форма лежит внутри `<tui-root>`, стили —
 * `@taiga-ui/styles/taiga-ui-theme.css` и `@reformer/kit-taiga/styles.css`.
 */

export { Checkbox } from './lib/checkbox';
export { DatePicker } from './lib/date-picker';
export { FieldArray } from './lib/field-array';
export { FormWizard, Step } from './lib/form-wizard';
export { Input } from './lib/input';
export { InputMask } from './lib/input-mask';
export { InputNumber } from './lib/input-number';
export { InputPassword } from './lib/input-password';
export { Box, Card, Section } from './lib/layout';
export { RadioGroup } from './lib/radio-group';
export { Select } from './lib/select';
export { Switch } from './lib/switch';
export { Textarea } from './lib/textarea';
export { provideKitTaiga, type KitTaigaOptions } from './lib/taiga';
export { applyMask } from './lib/mask';
