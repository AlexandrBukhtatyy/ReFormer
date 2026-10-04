// registry.ts — реестр: имена компонентов ($component(...)) и source-значений ($dataSource(...)),
// на которые ссылается renderer.schema.json. Визард — библиотечный `FormWizard` под именем `Wizard`
// (так он назван в документе): шаги он берёт из узлов-детей (`Step`), форму и валидацию — из сборки.
// Запись `FIELD_WRAPPER` — обёртка поля: сборка кладёт её в бандл, рендерер берёт оттуда.

import {
  Box,
  CheckboxWithLabel,
  FormArray,
  FormField,
  FormWizard,
  Input,
  InputMask,
  InputNumber,
  RadioGroupOptions,
  Section,
  SelectAsync,
  Textarea,
} from '@reformer/ui-kit';
import { Step } from '@reformer/cdk/form-wizard';
import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';
import {
  CO_BORROWER_ITEM_LABEL,
  CURRENT_YEAR_PLUS_ONE,
  EDUCATION_LEVELS,
  EMPLOYMENT_STATUSES,
  GENDERS,
  LOAN_ITEM_LABEL,
  LOAN_TYPES,
  MARITAL_STATUSES,
  PROPERTY_ITEM_LABEL,
  PROPERTY_TYPES,
  REGIONS,
} from './data-sources';

export function createRegistry(): ComponentRegistry {
  return defineRegistry((reg) => {
    // Визард и его шаги: библиотечные компоненты под именами из документа, без прикладной обёртки.
    reg.component('Wizard', FormWizard);
    reg.component('Step', Step);

    // Layout containers.
    reg.component('Box', Box);
    reg.component('Section', Section);
    reg.component('FormArray', FormArray);

    // Leaf field components.
    reg.component('Input', Input);
    reg.component('InputNumber', InputNumber);
    reg.component('Select', SelectAsync);
    reg.component('Textarea', Textarea);
    reg.component('Checkbox', CheckboxWithLabel);
    reg.component('RadioGroup', RadioGroupOptions);
    reg.component('InputMask', InputMask);

    // Field wrapper (label / error / hint).
    reg.component(FIELD_WRAPPER, FormField);

    // Static option dictionaries.
    reg.dataSource('LOAN_TYPES', LOAN_TYPES);
    reg.dataSource('GENDERS', GENDERS);
    reg.dataSource('EMPLOYMENT_STATUSES', EMPLOYMENT_STATUSES);
    reg.dataSource('MARITAL_STATUSES', MARITAL_STATUSES);
    reg.dataSource('EDUCATION_LEVELS', EDUCATION_LEVELS);
    reg.dataSource('PROPERTY_TYPES', PROPERTY_TYPES);
    reg.dataSource('REGIONS', REGIONS);
    reg.dataSource('CURRENT_YEAR_PLUS_ONE', CURRENT_YEAR_PLUS_ONE);

    // Array item-label functions.
    reg.dataSource('PROPERTY_ITEM_LABEL', PROPERTY_ITEM_LABEL);
    reg.dataSource('LOAN_ITEM_LABEL', LOAN_ITEM_LABEL);
    reg.dataSource('CO_BORROWER_ITEM_LABEL', CO_BORROWER_ITEM_LABEL);
  });
}
