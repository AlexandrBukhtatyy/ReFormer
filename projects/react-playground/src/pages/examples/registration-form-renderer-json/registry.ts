/**
 * Реестр формы регистрации: только то, что JSON выразить не может — компоненты полей,
 * обёртка поля и обработчики кнопок.
 *
 * Вёрстка (заголовки, сетки колонок, блок подсказок) в реестр НЕ попадает: она описана
 * `$html(...)`-узлами прямо в схеме.
 */

import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';
import {
  InputField,
  InputPasswordField,
  InputMaskField,
  CheckboxField,
  FormField,
  Button,
} from '@reformer/ui-kit';

/**
 * Обработчики кнопок. Отдельный объект нужен из-за порядка построения: реестр требуется
 * для `convertJsonToM1Tree` → форма создаётся уже ПОСЛЕ него, а submit нуждается в форме.
 * Реестр замыкает сам объект (`() => actions.submit()`), поэтому поля дозаполняются позже —
 * без этого пришлось бы строить реестр дважды.
 */
export interface FormActions {
  submit: () => void;
  reset: () => void;
}

export function createRegistrationRegistry(actions: FormActions): ComponentRegistry {
  return defineRegistry((reg) => {
    // Поля: имя в схеме → компонент ui-kit.
    reg.component('Input', InputField);
    reg.component('InputPassword', InputPasswordField);
    reg.component('InputMask', InputMaskField);
    reg.component('Checkbox', CheckboxField);
    reg.component('Button', Button);

    // Системная обёртка поля: label + ошибки вокруг каждого листа.
    reg.component(FIELD_WRAPPER, FormField);

    // Обработчики — через `$fn(...)`; late-binding описан у FormActions.
    reg.fn('submit', () => actions.submit());
    reg.fn('reset', () => actions.reset());
  });
}
