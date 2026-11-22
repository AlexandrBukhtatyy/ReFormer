/**
 * Записи реестра renderer-json, общие для форм бенчмарка: контролы на нейтральных примитивах,
 * страница, `<form>` с отправкой через сборку и обёртка поля `FIELD_WRAPPER` (рамка + атрибуты
 * контракта). Диалект контролов — статика `reformerAdapter` (../../reformer-kit/adapters.ts).
 *
 * Реестр формы — отдельным модулем (./registry.ts — регистрация, ./credit-registry.ts — кредит):
 * страницы собираются по отдельности, и компоненты одной формы не должны попадать в бандл другой.
 */
import { FIELD_WRAPPER, type RegistryBuilder } from '@reformer/renderer-json';
import { Checkbox, MaskedInput, Select, TextInput, Textarea } from '../../../shared/ui/controls';
import { Actions, Page, SubmitButton } from '../../../shared/ui/layout';
import { FieldWrapper } from '../../reformer-kit/Field';
import { FormShell, ResetAction } from './form-shell';

export function registerBase(reg: RegistryBuilder): void {
  reg.component('TextInput', TextInput);
  reg.component('MaskedInput', MaskedInput);
  reg.component('Checkbox', Checkbox);
  reg.component('Select', Select);
  reg.component('Textarea', Textarea);
  reg.component('Page', Page);
  reg.component('Form', FormShell);
  reg.component('Actions', Actions);
  reg.component('SubmitButton', SubmitButton);
  reg.component('ResetButton', ResetAction);
  reg.component(FIELD_WRAPPER, FieldWrapper);
}
