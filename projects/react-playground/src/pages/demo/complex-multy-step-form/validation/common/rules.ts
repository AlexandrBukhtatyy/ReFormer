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

/** Правила ФИО (русское имя): шаг «Данные» и созаёмщик. */
export const ruName = (label: string): Rule<string>[] => [
  required({ message: `${label} обязательно` }),
  minLength(2, { message: 'Минимум 2 символа' }),
  maxLength(50, { message: 'Максимум 50 символов' }),
  pattern(RU_NAME, { message: 'Только русские буквы, пробелы и дефис' }),
];

/** Формат телефона: дополнительный телефон и хвост обязательных наборов. */
export const PHONE_FORMAT_RULES: Rule<string>[] = [
  pattern(PHONE, { message: 'Формат: +7 (___) ___-__-__' }),
];

/** Формат email: дополнительный email и хвост {@link EMAIL_REQUIRED_RULES}. */
export const EMAIL_FORMAT_RULES: Rule<string>[] = [email({ message: 'Введите корректный email' })];

/** Обязательный email — заёмщик и созаёмщик. */
export const EMAIL_REQUIRED_RULES: Rule<string>[] = [
  required({ message: 'Email обязателен' }),
  ...EMAIL_FORMAT_RULES,
];

// Числовые наборы принимают и пустое значение: так их берут и поля `number | null`, и `number`.

/** Числовое поле не может быть отрицательным. */
export const NON_NEGATIVE_RULES: Rule<number | null>[] = [
  min(0, { message: 'Не может быть отрицательным' }),
];

/** Общий верхний предел сумм — 10 000 000 ₽. */
export const MAX_10M_RUB_RULES: Rule<number | null>[] = [
  max(10000000, { message: 'Максимум 10 000 000 ₽' }),
];
