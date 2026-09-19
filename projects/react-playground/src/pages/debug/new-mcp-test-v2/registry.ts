/**
 * Реестр: имя из оператора схемы → React-компонент / значение / функция.
 *
 * `*Field`-версии ui-kit уже value-based, поэтому `resolveFieldAdapter` не нужен.
 * Данные — только `reg.dataSource` + `$dataSource(NAME)`, функции — только
 * `reg.fn` + `$fn(name)`: виды раздельны, перекрёстная ссылка бросает.
 */
import { Step } from '@reformer/cdk/form-wizard';
import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';
import {
  Box,
  CheckboxWithLabel,
  FormField,
  Input,
  InputNumber,
  InputMask,
  RadioGroupOptions,
  Section,
  SelectAsync,
  Textarea,
  FormArray,
} from '@reformer/ui-kit';

import type { Dictionaries } from './api';
import { CAR_BRANDS, CURRENT_YEAR_PLUS_ONE, REGIONS } from './data-sources';
import { RendererFormWizard } from './renderer.wizard';
import {
  EDUCATION_LEVELS,
  EMPLOYMENT_STATUSES,
  GENDERS,
  LOAN_TYPES,
  MARITAL_STATUSES,
  PROPERTY_TYPES,
  type CoBorrowerItem,
  type ExistingLoanItem,
  type Option,
  type PropertyItem,
} from './types';

const EMPTY_OPTIONS: Option[] = [];

export function createRegistry(dictionaries: Dictionaries): ComponentRegistry {
  return defineRegistry((reg) => {
    /* --- системная обёртка поля: label + error + pending --- */
    reg.component(FIELD_WRAPPER, FormField);

    /* --- контролы --- */
    reg.component('Input', Input);
    reg.component('InputNumber', InputNumber);
    reg.component('InputMask', InputMask);
    reg.component('Textarea', Textarea);
    reg.component('Select', SelectAsync);
    reg.component('Checkbox', CheckboxWithLabel);
    reg.component('RadioGroup', RadioGroupOptions);

    /* --- контейнеры --- */
    reg.component('Box', Box);
    reg.component('Section', Section);
    reg.component('FormArray', FormArray);
    reg.component('Wizard', RendererFormWizard);
    reg.component('Step', Step);

    /* --- справочники (константные) --- */
    reg.dataSource('LOAN_TYPES', LOAN_TYPES);
    reg.dataSource('GENDERS', GENDERS);
    reg.dataSource('EMPLOYMENT_STATUSES', EMPLOYMENT_STATUSES);
    reg.dataSource('MARITAL_STATUSES', MARITAL_STATUSES);
    reg.dataSource('EDUCATION_LEVELS', EDUCATION_LEVELS);
    reg.dataSource('REGIONS', REGIONS);
    reg.dataSource('CAR_BRANDS', CAR_BRANDS);
    reg.dataSource('EMPTY_OPTIONS', EMPTY_OPTIONS);
    reg.dataSource('CURRENT_YEAR_PLUS_ONE', CURRENT_YEAR_PLUS_ONE);

    /* --- справочники, пришедшие с сервера (GET /api/v1/dictionaries) --- */
    reg.dataSource('BANKS', dictionaries.banks);
    reg.dataSource('LOAN_KINDS', dictionaries.loanKinds);
    reg.dataSource(
      'PROPERTY_TYPES',
      dictionaries.propertyTypes.length > 0 ? dictionaries.propertyTypes : PROPERTY_TYPES
    );

    /* --- функции для componentProps ($fn, не $dataSource) --- */
    reg.fn('propertyItemLabel', (item: PropertyItem | undefined, index: number) => {
      const type = PROPERTY_TYPES.find((o) => o.value === item?.type)?.label;
      return type ? `Имущество #${index + 1} — ${type}` : `Имущество #${index + 1}`;
    });
    reg.fn('loanItemLabel', (item: ExistingLoanItem | undefined, index: number) => {
      const bank = dictionaries.banks.find((o) => o.value === item?.bank)?.label;
      return bank ? `Кредит #${index + 1} — ${bank}` : `Кредит #${index + 1}`;
    });
    reg.fn('coBorrowerItemLabel', (item: CoBorrowerItem | undefined, index: number) => {
      const name = item?.personalData?.lastName;
      return name ? `Созаемщик #${index + 1} — ${name}` : `Созаемщик #${index + 1}`;
    });
  });
}
