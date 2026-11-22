/**
 * Наборы правил, общие для нескольких шагов и подформ.
 */

import type { Rule } from '@reformer/core/validation';
import {
  email,
  max,
  maxLength,
  min,
  minLength,
  pattern,
  required,
} from '@reformer/core/validators';

const RU_NAME = /^[А-ЯЁа-яё\s-]+$/;
const PHONE = /^\+7\s\(\d{3}\)\s\d{3}-\d{2}-\d{2}$/;

/**
 * Правила ФИО (русское имя): шаг «Данные» и созаёмщик. Обязательность получает код поля
 * (`lastName.required`): у «Фамилия обязательна» и «Имя обязательно» разный род.
 */
export const ruName = (field: 'lastName' | 'firstName' | 'middleName'): Rule<string>[] => [
  required({ code: `${field}.required` }),
  minLength(2, { code: 'ruName.minLength' }),
  maxLength(50, { code: 'ruName.maxLength' }),
  pattern(RU_NAME, { code: 'ruName.pattern' }),
];

/** Формат телефона: дополнительный телефон и хвост обязательных наборов. */
export const PHONE_FORMAT_RULES: Rule<string>[] = [pattern(PHONE, { code: 'phoneFormat.pattern' })];

/** Формат email: дополнительный email и хвост {@link EMAIL_REQUIRED_RULES}. */
export const EMAIL_FORMAT_RULES: Rule<string>[] = [email({ code: 'emailFormat.email' })];

/** Обязательный email — заёмщик и созаёмщик. */
export const EMAIL_REQUIRED_RULES: Rule<string>[] = [
  required({ code: 'emailRequired.required' }),
  ...EMAIL_FORMAT_RULES,
];

// Числовые наборы принимают и пустое значение: так их берут и поля `number | null`, и `number`.

/** Числовое поле не может быть отрицательным. */
export const NON_NEGATIVE_RULES: Rule<number | null>[] = [min(0, { code: 'nonNegative.min' })];

/** Общий верхний предел сумм — 10 000 000 ₽. */
export const MAX_10M_RUB_RULES: Rule<number | null>[] = [max(10000000, { code: 'max10mRub.max' })];
