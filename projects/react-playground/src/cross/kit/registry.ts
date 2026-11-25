/**
 * Реестры кита кросс-фреймворк проверки на `@reformer/ui-kit`. Имена — те, которыми компоненты
 * называет документ формы; за каждым — компонент библиотеки либо тонкий адаптер над ним
 * (./controls.tsx, ./layout.tsx). Такие же реестры с теми же именами — у китов на Vuetify и
 * Taiga UI: документ формы у трёх стеков один.
 *
 * Поле собирает `FormField` ui-kit (запись `FIELD_WRAPPER`): он даёт `field-`, `label-` и
 * `error-{путь}` DOM-контракта, а `input-{путь}` ставит на контрол рендерер.
 *
 * Реестр формы — отдельной константой: компоненты одной формы не попадают на страницу другой.
 */
import { defineRegistry, FIELD_WRAPPER, type RegistryBuilder } from '@reformer/renderer-json';
import { CheckboxWithLabel, FormField, InputNumber, RadioGroupOptions } from '@reformer/ui-kit';
import {
  CaptchaWidget,
  DateInput,
  MaskedInput,
  ReadonlyValue,
  Select,
  Textarea,
  TextInput,
} from './controls';
import { Actions, Form, Page, ResetButton, SubmitButton } from './layout';
import { ArraySection, Group, Section } from './sections';
import { Step, Wizard } from './wizard';

function registerBase(reg: RegistryBuilder): void {
  reg.component('TextInput', TextInput);
  reg.component('MaskedInput', MaskedInput);
  reg.component('Checkbox', CheckboxWithLabel);
  reg.component('Page', Page);
  reg.component('Form', Form);
  reg.component('Actions', Actions);
  reg.component('SubmitButton', SubmitButton);
  reg.component('ResetButton', ResetButton);
  reg.component(FIELD_WRAPPER, FormField);
}

/** Реестр формы регистрации: общие записи и капча. */
export const registrationRegistry = defineRegistry((reg) => {
  registerBase(reg);
  reg.component('CaptchaWidget', CaptchaWidget);
});

/**
 * Реестр кредитной заявки: общие записи, остальные контролы и контейнеры многошаговой формы.
 * Число (`InputNumber`) и группа радиокнопок (`RadioGroupOptions`) — компоненты ui-kit как есть:
 * их значение и так число либо `null` и строка.
 */
export const creditRegistry = defineRegistry((reg) => {
  registerBase(reg);
  reg.component('NumberInput', InputNumber);
  reg.component('DateInput', DateInput);
  reg.component('Textarea', Textarea);
  reg.component('Select', Select);
  reg.component('RadioGroup', RadioGroupOptions);
  reg.component('ReadonlyValue', ReadonlyValue);
  reg.component('Section', Section);
  reg.component('Group', Group);
  reg.component('ArraySection', ArraySection);
  reg.component('Wizard', Wizard);
  reg.component('Step', Step);
});
