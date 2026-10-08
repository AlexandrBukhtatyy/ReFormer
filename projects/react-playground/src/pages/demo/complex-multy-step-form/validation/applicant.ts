import type { ValidationError } from '@reformer/core';
import { defineValidationSchema, validate, type Rule } from '@reformer/core/validation';
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
  required({ message: 'Дата рождения обязательна' }),
  minAge(18, { message: 'Заемщику должно быть не менее 18 лет' }),
  maxAge(70, { message: 'Максимальный возраст заемщика: 70 лет' }),
];

const GENDER_RULES: Rule<PersonalData['gender']>[] = [required({ message: 'Выберите пол' })];

const BIRTH_PLACE_RULES: Rule<string>[] = [
  required({ message: 'Место рождения обязательно' }),
  minLength(5, { message: 'Минимум 5 символов' }),
  maxLength(100, { message: 'Максимум 100 символов' }),
];

const PASSPORT_SERIES_RULES: Rule<string>[] = [
  required({ message: 'Серия паспорта обязательна' }),
  pattern(/^\d{2}\s\d{2}$/, { message: 'Формат: 00 00' }),
];

const PASSPORT_NUMBER_RULES: Rule<string>[] = [
  required({ message: 'Номер паспорта обязателен' }),
  pattern(/^\d{6}$/, { message: 'Номер должен содержать 6 цифр' }),
];

const PASSPORT_ISSUE_DATE_RULES: Rule<string>[] = [
  required({ message: 'Дата выдачи обязательна' }),
  pastDate({ message: 'Дата выдачи не может быть в будущем' }),
];

const PASSPORT_ISSUED_BY_RULES: Rule<string>[] = [
  required({ message: 'Кем выдан обязательно' }),
  minLength(10, { message: 'Минимум 10 символов' }),
  maxLength(200, { message: 'Максимум 200 символов' }),
];

const PASSPORT_DEPARTMENT_CODE_RULES: Rule<string>[] = [
  required({ message: 'Код подразделения обязателен' }),
  pattern(/^\d{3}-\d{3}$/, { message: 'Формат: 000-000' }),
];

const INN_RULES: Rule<string>[] = [
  required({ message: 'ИНН обязателен' }),
  pattern(/^\d{12}$/, { message: 'ИНН должен содержать 12 цифр' }),
];

const SNILS_RULES: Rule<string>[] = [
  required({ message: 'СНИЛС обязателен' }),
  pattern(/^\d{3}-\d{3}-\d{3}\s\d{2}$/, { message: 'Формат: 000-000-000 00' }),
];

const passportIssuedAfterAge14 = (application: CreditApplicationForm): ValidationError | null => {
  const { birthDate } = application.personalData;
  const { issueDate } = application.passportData;
  if (!birthDate || !issueDate) return null;
  const earliestIssueDate = new Date(birthDate);
  earliestIssueDate.setFullYear(earliestIssueDate.getFullYear() + 14);
  return new Date(issueDate) < earliestIssueDate
    ? {
        code: 'passportIssuedBeforeMinAge',
        message: 'Паспорт не может быть выдан ранее достижения 14 лет',
      }
    : null;
};

export const applicantRules = defineValidationSchema<CreditApplicationForm>(({ model, cross }) => {
  validate(model.$.personalData.lastName, ruName('Фамилия'));
  validate(model.$.personalData.firstName, ruName('Имя'));
  validate(model.$.personalData.middleName, ruName('Отчество'));
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
