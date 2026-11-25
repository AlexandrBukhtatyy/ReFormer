/**
 * @reformer/kit-vuetify — кит ReFormer на Vuetify 4: компоненты под именами каталога
 * (`component-catalog.json`, вход `./catalog`) для формы на `@reformer/renderer-json`, которую
 * рисует `@reformer/renderer-vue`.
 *
 * Контрол — самодостаточное поле: подпись и ошибку рисует компонент Vuetify, обёртка поля
 * (`FIELD_WRAPPER`) в реестре не нужна. Приложение подключает Vuetify китом один раз —
 * `createApp(App).use(createKitVuetify())`, стили — `vuetify/styles` и
 * `@reformer/kit-vuetify/styles.css`.
 */

export { Checkbox } from './checkbox';
export { DatePicker } from './date-picker';
export { FieldArray } from './field-array';
export { FormWizard, Step } from './form-wizard';
export { Input } from './input';
export { InputMask } from './input-mask';
export { InputNumber } from './input-number';
export { InputPassword } from './input-password';
export { Box, Card, Section } from './layout';
export { RadioGroup } from './radio-group';
export { Select } from './select';
export { Switch } from './switch';
export { Textarea } from './textarea';
export { createKitVuetify, type KitVuetifyOptions } from './vuetify';
export { applyMask } from './mask';
export type { Option } from './field';
