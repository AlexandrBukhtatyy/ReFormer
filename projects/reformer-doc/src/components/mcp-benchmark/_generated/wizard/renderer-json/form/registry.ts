// @reformer-form-build 6faa8c64f3df454f собран сервером ReFormer из form.intent.json: форму меняют через сервер (form_build; в guided — form_start, затем form_edit), а не этот файл — правка руками отсоединит его от сборки, guided её отменит
/**
 * Реестр компонентов формы «Оформление заказа»: что рендерить под каждый
 * `$component(...)` из layout-схемы. Новый компонент в схеме → регистрация здесь.
 */
import { Step } from '@reformer/cdk/form-wizard';
import { FormField, CheckboxWithLabel, FieldArray, FormWizard, Input, InputMask, InputNumber, RadioGroupOptions, SelectAsync, SelectMulti, Slider, SwitchWithLabel, Textarea } from '@reformer/ui-kit';
import { DatePicker } from '@reformer/ui-kit/date-picker';
import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';

export function createRegistry(): ComponentRegistry {
  return defineRegistry((reg) => {
    // Системная обёртка листа: label + ошибки. Сборка кладёт её в бандл формы.
    reg.component(FIELD_WRAPPER, FormField);
    reg.component('Step', Step);
    reg.component('Checkbox', CheckboxWithLabel);
    reg.component('DatePicker', DatePicker);
    reg.component('FieldArray', FieldArray);
    reg.component('FormWizard', FormWizard);
    reg.component('Input', Input);
    reg.component('InputMask', InputMask);
    reg.component('InputNumber', InputNumber);
    reg.component('RadioGroup', RadioGroupOptions);
    reg.component('Select', SelectAsync);
    reg.component('SelectMulti', SelectMulti);
    reg.component('Slider', Slider);
    reg.component('Switch', SwitchWithLabel);
    reg.component('Textarea', Textarea);
  });
}
