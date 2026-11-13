/**
 * uiSchemas of the six steps. Each field's entry comes from the shared `CREDIT_FIELDS` metadata
 * (control → widget, placeholder, mask, option labels); the step adds its layout, array options and
 * the computed fields' widget. Module-level constants.
 * https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/uiSchema
 */
import type { UiSchema } from '@rjsf/utils';
import {
  CREDIT_ARRAYS,
  CREDIT_STEPS,
  fieldMeta,
  type CreditArrayKey,
  type CreditFieldPath,
  type CreditStep,
} from '../../../shared/domain/credit';
import { EmploymentLayout, LoanLayout, PersonalLayout } from './layouts';

/**
 * Key of a `remoteSelect` list in `formContext.options`: a dictionary by its name (regions, property
 * types); a list that depends on another field's value (cities of a region, models of a brand) by the
 * field it belongs to.
 */
function optionsKey(path: CreditFieldPath): string | undefined {
  const { optionsFrom } = fieldMeta(path);
  return optionsFrom === 'cities' || optionsFrom === 'carModels' ? path : optionsFrom;
}

/** uiSchema of one field from its shared metadata. Text, email, number, date, checkbox: the schema type picks the widget. */
function fieldUi(path: CreditFieldPath): UiSchema {
  const { control, placeholder, mask, options } = fieldMeta(path);
  const ui: UiSchema = placeholder ? { 'ui:placeholder': placeholder } : {};
  switch (control) {
    case 'textarea':
      return { ...ui, 'ui:widget': 'textarea' };
    case 'masked':
      return { ...ui, 'ui:widget': 'masked', 'ui:options': { mask } };
    case 'radio':
    case 'select':
      if (!options)
        return {
          ...ui,
          'ui:widget': 'remoteSelect',
          'ui:options': { optionsFrom: optionsKey(path) },
        };
      return {
        ...ui,
        ...(control === 'radio' ? { 'ui:widget': 'radio' } : {}),
        'ui:enumNames': options.map((option) => option.label),
        // DOM values are the enum values (not indexes): the contract's `input-{path}-{value}`.
        'ui:optionValueFormat': 'realValue',
      };
    default:
      return ui;
  }
}

/** `ui` with `value` at a path template (`a.b`, `rows[].c` → `rows.items.c`). */
function setIn(ui: UiSchema, pattern: string, value: UiSchema): void {
  const keys = pattern.replace(/\[\]/g, '.items').split('.');
  let node = ui;
  for (const key of keys.slice(0, -1)) node = node[key] ??= {};
  node[keys[keys.length - 1]] = value;
}

/** A step's uiSchema: every field from metadata, computed values, array options, then `extra`. */
function stepUi(step: CreditStep, extra: UiSchema = {}): UiSchema {
  const ui: UiSchema = {};
  for (const path of step.fields) setIn(ui, path, fieldUi(path));
  for (const key of step.computed) ui[key] = { 'ui:widget': 'computed' };
  for (const key of step.keys) {
    if (!(key in CREDIT_ARRAYS)) continue;
    const { addLabel, rowTitle } = CREDIT_ARRAYS[key as CreditArrayKey];
    ui[key] = { ...ui[key], 'ui:options': { addLabel, rowTitle, orderable: false } };
  }
  return { ...ui, ...extra };
}

export const loanUi = stepUi(CREDIT_STEPS[0], { 'ui:ObjectFieldTemplate': LoanLayout });
export const personalUi = stepUi(CREDIT_STEPS[1], { 'ui:ObjectFieldTemplate': PersonalLayout });
export const contactsUi = stepUi(CREDIT_STEPS[2]);
export const employmentUi = stepUi(CREDIT_STEPS[3], {
  'ui:ObjectFieldTemplate': EmploymentLayout,
});
export const additionalUi = stepUi(CREDIT_STEPS[4], {
  // The arrays come from `then` schemas, which RJSF appends after the static properties.
  'ui:order': [
    'maritalStatus',
    'dependents',
    'education',
    'hasProperty',
    'properties',
    'hasExistingLoans',
    'existingLoans',
    'hasCoBorrower',
    'coBorrowers',
    'coBorrowersIncome',
  ],
});
export const confirmationUi = stepUi(CREDIT_STEPS[5]);
