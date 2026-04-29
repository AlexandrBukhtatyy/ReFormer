/**
 * Registry для credit-application-form (iter-9, renderer-json).
 *
 * Path C — все стандартные ui-kit компоненты (Input/Select/etc.) +
 * `FormArraySection` напрямую из `@reformer/ui-kit/form-array` без
 * app-specific обёртки. `FormWizard` напрямую из `@reformer/ui-kit/form-wizard`.
 *
 * `FIELD_WRAPPER` обязателен — иначе renderer-json не оборачивает field-nodes
 * в FormField (нет label, нет error display).
 *
 * Sources — все опции/labels/etc. вынесены сюда (`reg.source(...)`).
 * В JSON ссылка строкой: `{ options: 'LOAN_TYPES' }`. Реальные массивы
 * экспортируются для использования в `schema.ts` (componentProps на
 * `createForm`-уровне — это runtime source-of-truth для рендера).
 */

import {
  Box,
  Button,
  Checkbox,
  FormField,
  Input,
  InputMask,
  RadioGroup,
  Section,
  Select,
  Textarea,
  FormArraySection,
  FormWizard,
} from '@reformer/ui-kit';
import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';

// ── Опции (экспортируются для использования в schema.ts) ──────────────────

export const LOAN_TYPES = [
  { value: 'consumer', label: 'Потребительский кредит' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'car', label: 'Автокредит' },
  { value: 'business', label: 'Кредит для бизнеса' },
  { value: 'refinancing', label: 'Рефинансирование' },
];

export const EMPLOYMENT_STATUSES = [
  { value: 'employed', label: 'Работаю по найму' },
  { value: 'selfEmployed', label: 'Индивидуальный предприниматель' },
  { value: 'unemployed', label: 'Не работаю' },
  { value: 'retired', label: 'Пенсионер' },
  { value: 'student', label: 'Студент' },
];

export const MARITAL_STATUSES = [
  { value: 'single', label: 'Холост/не замужем' },
  { value: 'married', label: 'Женат/Замужем' },
  { value: 'divorced', label: 'Разведен(а)' },
  { value: 'widowed', label: 'Вдовец/Вдова' },
];

export const EDUCATIONS = [
  { value: 'secondary', label: 'Среднее' },
  { value: 'specialized', label: 'Среднее специальное' },
  { value: 'higher', label: 'Высшее' },
  { value: 'postgraduate', label: 'Послевузовское' },
];

export const GENDERS = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];

export const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Квартира' },
  { value: 'house', label: 'Дом' },
  { value: 'land', label: 'Земельный участок' },
  { value: 'commercial', label: 'Коммерческая недвижимость' },
  { value: 'car', label: 'Автомобиль' },
  { value: 'other', label: 'Другое' },
];

export const EXISTING_LOAN_TYPES = [
  { value: 'consumer', label: 'Потребительский кредит' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'car', label: 'Автокредит' },
  { value: 'creditCard', label: 'Кредитная карта' },
  { value: 'other', label: 'Другое' },
];

export const CO_BORROWER_RELATIONSHIPS = [
  { value: 'spouse', label: 'Супруг(а)' },
  { value: 'parent', label: 'Родитель' },
  { value: 'child', label: 'Ребенок' },
  { value: 'sibling', label: 'Брат/Сестра' },
  { value: 'relative', label: 'Другой родственник' },
  { value: 'other', label: 'Другое' },
];

// ── Builder ────────────────────────────────────────────────────────────────

export function createCreditApplicationRegistry(): ComponentRegistry {
  return defineRegistry((reg) => {
    // ui-kit fields
    reg.field('Input', Input);
    reg.field('InputMask', InputMask);
    reg.field('Textarea', Textarea);
    reg.field('Select', Select);
    reg.field('Checkbox', Checkbox);
    reg.field('RadioGroup', RadioGroup);

    // ui-kit containers / layout
    reg.container('Box', Box);
    reg.container('Section', Section);
    reg.container('Button', Button);
    reg.container('FormField', FormField);

    // FIELD_WRAPPER — system-required, без него field-nodes рендерятся как
    // bare input без label/error display.
    reg.container(FIELD_WRAPPER, FormField);

    // Path C — ui-kit FormArraySection (без app-specific обёртки).
    // Поддерживает `itemComponent: { $template }` через converter.
    reg.container('FormArraySection', FormArraySection);

    // ui-kit FormWizard — A1 (Path G). Внутри FormWizard сам управляет
    // переключением шагов через cdk headless context.
    reg.container('FormWizard', FormWizard);

    // Sources (D3) — string-references из JSON
    reg.source('LOAN_TYPES', LOAN_TYPES);
    reg.source('EMPLOYMENT_STATUSES', EMPLOYMENT_STATUSES);
    reg.source('MARITAL_STATUSES', MARITAL_STATUSES);
    reg.source('EDUCATIONS', EDUCATIONS);
    reg.source('GENDERS', GENDERS);
    reg.source('PROPERTY_TYPES', PROPERTY_TYPES);
    reg.source('EXISTING_LOAN_TYPES', EXISTING_LOAN_TYPES);
    reg.source('CO_BORROWER_RELATIONSHIPS', CO_BORROWER_RELATIONSHIPS);
    reg.source('CURRENT_YEAR_PLUS_ONE', new Date().getFullYear() + 1);
  });
}
