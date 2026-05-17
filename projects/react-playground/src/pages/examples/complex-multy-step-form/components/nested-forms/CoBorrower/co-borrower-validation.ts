/**
 * Validation schema для CoBorrower.
 *
 * Применяется к каждому элементу массива coBorrowers через ArrayNode.applyValidationSchema().
 * Содержит вложенную группу personalData.
 */

import type { Validator } from '@reformer/core';
import {
  createFieldPath,
  validate,
  required,
  minLength,
  maxLength,
  pattern,
  email,
  min,
} from '@reformer/core/validators';
import type { CoBorrower } from './CoBorrowerForm';

const coBorrowerAge18to80: Validator<CoBorrower, unknown> = (_value, _control, root) => {
  const coBorrower = root.getValue();
  const birthDate = new Date(coBorrower.personalData.birthDate);
  const today = new Date();

  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  const dayDiff = today.getDate() - birthDate.getDate();

  const finalAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;

  if (finalAge < 18) {
    return {
      code: 'coBorrowerTooYoung',
      message: 'Созаемщику должно быть не менее 18 лет',
    };
  }
  if (finalAge > 80) {
    return {
      code: 'coBorrowerTooOld',
      message: 'Созаемщику должно быть не более 80 лет',
    };
  }
  return null;
};

/**
 * Валидация элемента созаемщика
 */
export const coBorrowerValidation = (path: ReturnType<typeof createFieldPath<CoBorrower>>) => {
  validate(path.personalData.lastName, required({ message: 'Фамилия обязательна' }));
  validate(
    path.personalData.lastName,
    minLength(2, { message: 'Фамилия должна содержать минимум 2 символа' })
  );
  validate(
    path.personalData.lastName,
    maxLength(50, { message: 'Фамилия не может превышать 50 символов' })
  );
  validate(
    path.personalData.lastName,
    pattern(/^[А-ЯЁа-яё\s-]+$/, {
      message: 'Фамилия должна содержать только русские буквы',
    })
  );

  validate(path.personalData.firstName, required({ message: 'Имя обязательно' }));
  validate(
    path.personalData.firstName,
    minLength(2, { message: 'Имя должно содержать минимум 2 символа' })
  );
  validate(
    path.personalData.firstName,
    maxLength(50, { message: 'Имя не может превышать 50 символов' })
  );
  validate(
    path.personalData.firstName,
    pattern(/^[А-ЯЁа-яё\s-]+$/, {
      message: 'Имя должно содержать только русские буквы',
    })
  );

  validate(path.personalData.middleName, required({ message: 'Отчество обязательно' }));
  validate(
    path.personalData.middleName,
    minLength(2, { message: 'Отчество должно содержать минимум 2 символа' })
  );
  validate(
    path.personalData.middleName,
    maxLength(50, { message: 'Отчество не может превышать 50 символов' })
  );
  validate(
    path.personalData.middleName,
    pattern(/^[А-ЯЁа-яё\s-]+$/, {
      message: 'Отчество должно содержать только русские буквы',
    })
  );

  validate(path.personalData.birthDate, required({ message: 'Дата рождения обязательна' }));

  validate(path.personalData.birthDate, coBorrowerAge18to80);

  validate(path.phone, required({ message: 'Телефон созаемщика обязателен' }));

  validate(path.email, required({ message: 'Email созаемщика обязателен' }));
  validate(path.email, email({ message: 'Введите корректный email' }));

  validate(path.relationship, required({ message: 'Укажите отношение к заемщику' }));

  validate(path.monthlyIncome, required({ message: 'Укажите ежемесячный доход созаемщика' }));
  validate(path.monthlyIncome, min(10000, { message: 'Минимальный доход созаемщика: 10 000 ₽' }));
};
