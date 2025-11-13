/**
 * Validation schema для CoBorrower
 *
 * Валидация элементов массива coBorrowers.
 * Применяется к каждому элементу через ArrayNode.applyValidationSchema()
 *
 * ВАЖНО: CoBorrower содержит вложенную группу personalData!
 */

import {
  createFieldPath,
  required,
  minLength,
  maxLength,
  pattern,
  email,
  min,
  validateTree,
} from 'reformer/validators';
import type { CoBorrower } from './CoBorrowerForm';

/**
 * Валидация элемента созаемщика
 */
export const coBorrowerValidation = (path: ReturnType<typeof createFieldPath<CoBorrower>>) => {
  // ============================================================================
  // Валидация вложенной группы personalData
  // ============================================================================

  // Фамилия обязательна
  required(path.personalData.lastName, { message: 'Фамилия обязательна' });
  minLength(path.personalData.lastName, 2, {
    message: 'Фамилия должна содержать минимум 2 символа',
  });
  maxLength(path.personalData.lastName, 50, {
    message: 'Фамилия не может превышать 50 символов',
  });
  pattern(path.personalData.lastName, /^[А-ЯЁа-яё\s-]+$/, {
    message: 'Фамилия должна содержать только русские буквы',
  });

  // Имя обязательно
  required(path.personalData.firstName, { message: 'Имя обязательно' });
  minLength(path.personalData.firstName, 2, {
    message: 'Имя должно содержать минимум 2 символа',
  });
  maxLength(path.personalData.firstName, 50, {
    message: 'Имя не может превышать 50 символов',
  });
  pattern(path.personalData.firstName, /^[А-ЯЁа-яё\s-]+$/, {
    message: 'Имя должно содержать только русские буквы',
  });

  // Отчество обязательно
  required(path.personalData.middleName, { message: 'Отчество обязательно' });
  minLength(path.personalData.middleName, 2, {
    message: 'Отчество должно содержать минимум 2 символа',
  });
  maxLength(path.personalData.middleName, 50, {
    message: 'Отчество не может превышать 50 символов',
  });
  pattern(path.personalData.middleName, /^[А-ЯЁа-яё\s-]+$/, {
    message: 'Отчество должно содержать только русские буквы',
  });

  // Дата рождения обязательна
  required(path.personalData.birthDate, { message: 'Дата рождения обязательна' });

  // Кросс-полевая валидация: созаемщику должно быть 18-80 лет
  validateTree(
    (ctx) => {
      const coBorrower = ctx.formValue();
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
    },
    { targetField: 'personalData.birthDate' }
  );

  // ============================================================================
  // Валидация остальных полей
  // ============================================================================

  // Телефон обязателен
  required(path.phone, { message: 'Телефон созаемщика обязателен' });

  // Email обязателен и должен быть валидным
  required(path.email, { message: 'Email созаемщика обязателен' });
  email(path.email, { message: 'Введите корректный email' });

  // Отношение к заемщику обязательно
  required(path.relationship, { message: 'Укажите отношение к заемщику' });

  // Ежемесячный доход должен быть положительным
  required(path.monthlyIncome, { message: 'Укажите ежемесячный доход созаемщика' });
  min(path.monthlyIncome, 10000, {
    message: 'Минимальный доход созаемщика: 10 000 ₽',
  });
};
