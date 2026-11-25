/**
 * Реестры страниц кросс-фреймворк проверки на `@reformer/ui-kit`: компоненты кита под именами его
 * каталога (`component-catalog.json`) — так же их связывает реестр, который печатает генератор
 * форм. Хосты на Vue и Angular регистрируют под теми же именами компоненты `@reformer/kit-vuetify`
 * и `@reformer/kit-taiga`: документ формы у трёх стеков один.
 *
 * Имя каталога и экспорт кита иногда различаются (`Checkbox` → `CheckboxWithLabel`, `Select` →
 * `SelectAsync`) — так их называет каталог. Поле собирает `FormField` ui-kit (`kit.infra.fieldWrapper`
 * каталога, запись `FIELD_WRAPPER`): он даёт `field-`, `label-` и `error-{путь}` DOM-контракта, а
 * `input-{путь}` ставит на контрол рендерер. Шаг визарда — `Step` из `@reformer/cdk`.
 *
 * Сверх кита — компоненты приложения (./app): капча и вычисляемое значение. Реестр формы —
 * отдельной константой: компоненты одной формы не попадают на страницу другой.
 */
import { Step } from '@reformer/cdk/form-wizard';
import { defineRegistry, FIELD_WRAPPER, type RegistryBuilder } from '@reformer/renderer-json';
import {
  Box,
  Card,
  CheckboxWithLabel,
  FieldArray,
  FormField,
  FormWizard,
  Input,
  InputMask,
  InputNumber,
  InputPassword,
  RadioGroupOptions,
  Section,
  SelectAsync,
  SwitchWithLabel,
  Textarea,
} from '@reformer/ui-kit';
import { DatePicker } from '@reformer/ui-kit/date-picker';
import { CaptchaWidget } from './app/captcha-widget';
import { ReadonlyValue } from './app/readonly-value';

function registerKit(reg: RegistryBuilder): void {
  reg.component(FIELD_WRAPPER, FormField);
  reg.component('Input', Input);
  reg.component('InputPassword', InputPassword);
  reg.component('InputMask', InputMask);
  reg.component('InputNumber', InputNumber);
  reg.component('Textarea', Textarea);
  reg.component('DatePicker', DatePicker);
  reg.component('Checkbox', CheckboxWithLabel);
  reg.component('Switch', SwitchWithLabel);
  reg.component('RadioGroup', RadioGroupOptions);
  reg.component('Select', SelectAsync);
  reg.component('Box', Box);
  reg.component('Card', Card);
  reg.component('Section', Section);
  reg.component('FieldArray', FieldArray);
  reg.component('FormWizard', FormWizard);
  reg.component('Step', Step);
}

/** Реестр формы регистрации: кит и капча. */
export const registrationRegistry = defineRegistry((reg) => {
  registerKit(reg);
  reg.component('CaptchaWidget', CaptchaWidget);
});

/** Реестр кредитной заявки: кит и вычисляемые значения. */
export const creditRegistry = defineRegistry((reg) => {
  registerKit(reg);
  reg.component('ReadonlyValue', ReadonlyValue);
});
