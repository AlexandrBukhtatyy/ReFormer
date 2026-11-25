/**
 * Реестры кита на Vuetify. Имена — те, которыми компоненты называет документ формы; за каждым —
 * тонкий адаптер над компонентом библиотеки (./controls.ts, ./layout.ts, ./sections.ts,
 * ./wizard.ts). Такие же реестры с теми же именами — у китов на `@reformer/ui-kit` и Taiga UI:
 * документ формы у трёх стеков один.
 *
 * Обёртки поля (`FIELD_WRAPPER`) у кита нет: подпись и ошибку рисует само поле Vuetify.
 *
 * Реестр — из входа `neutral` JSON-слоя: он не импортирует React. Реестр формы — отдельной
 * константой: компоненты одной формы не попадают на страницу другой.
 */
import { defineRegistry, type RegistryBuilder } from '@reformer/renderer-json/neutral';
import {
  CaptchaWidget,
  Checkbox,
  DateInput,
  MaskedInput,
  NumberInput,
  RadioGroup,
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
  reg.component('Checkbox', Checkbox);
  reg.component('Page', Page);
  reg.component('Form', Form);
  reg.component('Actions', Actions);
  reg.component('SubmitButton', SubmitButton);
  reg.component('ResetButton', ResetButton);
}

/** Реестр формы регистрации: общие записи и капча. */
export const registrationRegistry = defineRegistry((reg) => {
  registerBase(reg);
  reg.component('CaptchaWidget', CaptchaWidget);
});

/** Реестр кредитной заявки: общие записи, остальные контролы, секции, массивы и визард. */
export const creditRegistry = defineRegistry((reg) => {
  registerBase(reg);
  reg.component('NumberInput', NumberInput);
  reg.component('DateInput', DateInput);
  reg.component('Textarea', Textarea);
  reg.component('Select', Select);
  reg.component('RadioGroup', RadioGroup);
  reg.component('ReadonlyValue', ReadonlyValue);
  reg.component('Section', Section);
  reg.component('Group', Group);
  reg.component('ArraySection', ArraySection);
  reg.component('Wizard', Wizard);
  reg.component('Step', Step);
});
