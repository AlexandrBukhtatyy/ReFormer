import type { ValidationIssue } from '@reformer/core';
import { defineValidation, validate, type Rule } from '@reformer/core/validation';
import {
  maxAge,
  maxLength,
  minAge,
  minLength,
  pastDate,
  pattern,
  required,
} from '@reformer/core/validators';
import type { PersonalData } from '../components/nested-forms/PersonalData/types';
import type { CreditApplicationForm } from '../types/credit-application';
import { ruName } from './common/rules';

const BIRTH_DATE_RULES: Rule<string>[] = [
  required({ code: 'birthDate.required' }),
  minAge(18, { code: 'birthDate.minAge' }),
  maxAge(70, { code: 'birthDate.maxAge' }),
];

const GENDER_RULES: Rule<PersonalData['gender']>[] = [required({ code: 'gender.required' })];

const BIRTH_PLACE_RULES: Rule<string>[] = [
  required({ code: 'birthPlace.required' }),
  minLength(5, { code: 'birthPlace.minLength' }),
  maxLength(100, { code: 'birthPlace.maxLength' }),
];

const PASSPORT_SERIES_RULES: Rule<string>[] = [
  required({ code: 'passportSeries.required' }),
  pattern(/^\d{2}\s\d{2}$/, { code: 'passportSeries.pattern' }),
];

const PASSPORT_NUMBER_RULES: Rule<string>[] = [
  required({ code: 'passportNumber.required' }),
  pattern(/^\d{6}$/, { code: 'passportNumber.pattern' }),
];

const PASSPORT_ISSUE_DATE_RULES: Rule<string>[] = [
  required({ code: 'passportIssueDate.required' }),
  pastDate({ code: 'passportIssueDate.pastDate' }),
];

const PASSPORT_ISSUED_BY_RULES: Rule<string>[] = [
  required({ code: 'passportIssuedBy.required' }),
  minLength(10, { code: 'passportIssuedBy.minLength' }),
  maxLength(200, { code: 'passportIssuedBy.maxLength' }),
];

const PASSPORT_DEPARTMENT_CODE_RULES: Rule<string>[] = [
  required({ code: 'passportDepartmentCode.required' }),
  pattern(/^\d{3}-\d{3}$/, { code: 'passportDepartmentCode.pattern' }),
];

const INN_RULES: Rule<string>[] = [
  required({ code: 'inn.required' }),
  pattern(/^\d{12}$/, { code: 'inn.pattern' }),
];

const SNILS_RULES: Rule<string>[] = [
  required({ code: 'snils.required' }),
  pattern(/^\d{3}-\d{3}-\d{3}\s\d{2}$/, { code: 'snils.pattern' }),
];

const passportIssuedAfterAge14 = (application: CreditApplicationForm): ValidationIssue | null => {
  const { birthDate } = application.personalData;
  const { issueDate } = application.passportData;
  if (!birthDate || !issueDate) return null;
  const earliestIssueDate = new Date(birthDate);
  earliestIssueDate.setFullYear(earliestIssueDate.getFullYear() + 14);
  return new Date(issueDate) < earliestIssueDate
    ? {
        code: 'passportIssuedBeforeMinAge',
      }
    : null;
};

export const applicantRules = defineValidation<CreditApplicationForm>(({ model, cross }) => {
  validate(model.$.personalData.lastName, ruName('lastName'));
  validate(model.$.personalData.firstName, ruName('firstName'));
  validate(model.$.personalData.middleName, ruName('middleName'));
  validate(model.$.personalData.birthDate, BIRTH_DATE_RULES);
  validate(model.$.personalData.gender, GENDER_RULES);
  validate(model.$.personalData.birthPlace, BIRTH_PLACE_RULES);
  validate(model.$.passportData.series, PASSPORT_SERIES_RULES);
  validate(model.$.passportData.number, PASSPORT_NUMBER_RULES);
  validate(model.$.passportData.issueDate, PASSPORT_ISSUE_DATE_RULES);
  cross(model.$.passportData.issueDate, passportIssuedAfterAge14);
  validate(model.$.passportData.issuedBy, PASSPORT_ISSUED_BY_RULES);
  validate(model.$.passportData.departmentCode, PASSPORT_DEPARTMENT_CODE_RULES);
  validate(model.$.inn, INN_RULES);
  validate(model.$.snils, SNILS_RULES);
});
