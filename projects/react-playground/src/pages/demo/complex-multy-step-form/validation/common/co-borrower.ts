import { defineValidationSchema, validate, type Rule } from '@reformer/core/validation';
import { maxAge, min, minAge, required } from '@reformer/core/validators';
import type { CoBorrower } from '../../components/nested-forms/CoBorrower/types';
import { EMAIL_REQUIRED_RULES, ruName } from './rules';

const BIRTH_DATE_RULES: Rule<string>[] = [
  required({ message: 'Дата рождения обязательна' }),
  minAge(18, { message: 'Созаемщику должно быть не менее 18 лет' }),
  maxAge(80, { message: 'Созаемщику должно быть не более 80 лет' }),
];

const PHONE_RULES: Rule<string>[] = [required({ message: 'Телефон обязателен' })];

const RELATIONSHIP_RULES: Rule<string>[] = [required({ message: 'Укажите отношение к заемщику' })];

const MONTHLY_INCOME_RULES: Rule<number>[] = [
  required({ message: 'Укажите доход созаемщика' }),
  min(10000, { message: 'Минимум 10 000 ₽' }),
];

export const coBorrowerRules = defineValidationSchema<CoBorrower>(({ model }) => {
  validate(model.$.personalData.lastName, ruName('Фамилия'));
  validate(model.$.personalData.firstName, ruName('Имя'));
  validate(model.$.personalData.middleName, ruName('Отчество'));
  validate(model.$.personalData.birthDate, BIRTH_DATE_RULES);
  validate(model.$.phone, PHONE_RULES);
  validate(model.$.email, EMAIL_REQUIRED_RULES);
  validate(model.$.relationship, RELATIONSHIP_RULES);
  validate(model.$.monthlyIncome, MONTHLY_INCOME_RULES);
});
