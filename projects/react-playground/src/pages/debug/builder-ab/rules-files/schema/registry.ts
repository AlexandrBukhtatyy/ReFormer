// @reformer-generated 0eb241693c91
// schema/registry.ts — реестр компонентов и источников данных схемы. Регенерируется.

import {
  Box,
  CheckboxWithLabel,
  FieldArray,
  FileUploadDropzone,
  FormField,
  FormWizard,
  Input,
  InputMask,
  InputNumber,
  RadioGroupOptions,
  SelectAsync,
  Textarea,
} from '@reformer/ui-kit';
import { Combobox, ComboboxMulti } from '@reformer/ui-kit/combobox';
import { DatePicker } from '@reformer/ui-kit/date-picker';
import { Step } from '@reformer/cdk/form-wizard';
import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';
import {
  CITY_LIST,
  GENDERS,
  POSITIONS,
  SKILLS,
  REFERENCE_LABEL,
} from '../constants/reformer-multi-step-form';

export function createRegistry(): ComponentRegistry {
  return defineRegistry((reg) => {
    reg.component(FIELD_WRAPPER, FormField);
    // Визард — библиотечный: шаги берёт из узлов-детей, форму и поток — из сборки.
    reg.component('Wizard', FormWizard);
    reg.component('Step', Step);
    reg.component('Box', Box);
    reg.component('Input', Input);
    reg.component('DatePicker', DatePicker);
    reg.component('RadioGroup', RadioGroupOptions);
    reg.component('InputMask', InputMask);
    reg.component('Select', SelectAsync);
    reg.component('Combobox', Combobox);
    reg.component('ComboboxMulti', ComboboxMulti);
    reg.component('InputNumber', InputNumber);
    reg.component('Textarea', Textarea);
    reg.component('FileUploadDropzone', FileUploadDropzone);
    reg.component('Checkbox', CheckboxWithLabel);
    reg.component('FieldArray', FieldArray);

    reg.dataSource('CITY_LIST', CITY_LIST);
    reg.dataSource('GENDERS', GENDERS);
    reg.dataSource('POSITIONS', POSITIONS);
    reg.dataSource('SKILLS', SKILLS);
    reg.dataSource('REFERENCE_LABEL', REFERENCE_LABEL);
  });
}
