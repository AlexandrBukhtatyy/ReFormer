import { defineValidation, validate, type Rule } from '@reformer/core/validation';
import { maxAge, min, minAge, required } from '@reformer/core/validators';
import type { CoBorrower } from '../../components/nested-forms/CoBorrower/types';
import { EMAIL_REQUIRED_RULES, ruName } from './rules';

const BIRTH_DATE_RULES: Rule<string>[] = [
  required({ code: 'coBorrower.birthDate.required' }),
  minAge(18, { code: 'coBorrower.birthDate.minAge' }),
  maxAge(80, { code: 'coBorrower.birthDate.maxAge' }),
];

const PHONE_RULES: Rule<string>[] = [required({ code: 'coBorrower.phone.required' })];

const RELATIONSHIP_RULES: Rule<string>[] = [required({ code: 'coBorrower.relationship.required' })];

const MONTHLY_INCOME_RULES: Rule<number>[] = [
  required({ code: 'coBorrower.monthlyIncome.required' }),
  min(10000, { code: 'coBorrower.monthlyIncome.min' }),
];

export const coBorrowerRules = defineValidation<CoBorrower>(({ model }) => {
  validate(model.$.personalData.lastName, ruName('lastName'));
  validate(model.$.personalData.firstName, ruName('firstName'));
  validate(model.$.personalData.middleName, ruName('middleName'));
  validate(model.$.personalData.birthDate, BIRTH_DATE_RULES);
  validate(model.$.phone, PHONE_RULES);
  validate(model.$.email, EMAIL_REQUIRED_RULES);
  validate(model.$.relationship, RELATIONSHIP_RULES);
  validate(model.$.monthlyIncome, MONTHLY_INCOME_RULES);
});
