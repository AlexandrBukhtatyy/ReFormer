/**
 * Реестры страниц кросс-фреймворк проверки на `@reformer/kit-taiga`: компоненты кита под именами
 * его каталога (`component-catalog.json`) — так же их связывает реестр, который печатает генератор
 * форм. Хосты на React и Vue регистрируют под теми же именами компоненты `@reformer/ui-kit` и
 * `@reformer/kit-vuetify`: документ формы у трёх стеков один.
 *
 * Обёртки поля у кита нет (`kit.infra.fieldWrapper: null`): контрол — самодостаточное поле. Сверх
 * кита — компоненты приложения (./app): капча и вычисляемое значение. Реестр формы — отдельной
 * константой: компоненты одной формы не попадают на страницу другой.
 */
import { defineRegistry, type RegistryBuilder } from '@reformer/renderer-json/neutral';
import {
  Box,
  Card,
  Checkbox,
  DatePicker,
  FieldArray,
  FormWizard,
  Input,
  InputMask,
  InputNumber,
  InputPassword,
  RadioGroup,
  Section,
  Select,
  Step,
  Switch,
  Textarea,
} from '@reformer/kit-taiga';
import { CaptchaWidget } from './app/captcha-widget';
import { ReadonlyValue } from './app/readonly-value';

const KIT = {
  Box,
  Card,
  Checkbox,
  DatePicker,
  FieldArray,
  FormWizard,
  Input,
  InputMask,
  InputNumber,
  InputPassword,
  RadioGroup,
  Section,
  Select,
  Step,
  Switch,
  Textarea,
};

function registerKit(reg: RegistryBuilder): void {
  for (const [name, component] of Object.entries(KIT)) reg.component(name, component);
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
