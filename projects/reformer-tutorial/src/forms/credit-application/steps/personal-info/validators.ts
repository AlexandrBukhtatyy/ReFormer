import { required, minLength, pattern, validate } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
import type { CreditApplicationForm } from '../../type';

/**
 * Валидация для Шага 2: Личная информация
 */
export const personalValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Личные данные: Имена
  required(path.personalData.lastName, { message: 'Фамилия обязательна' });
  minLength(path.personalData.lastName, 2, { message: 'Минимум 2 символа' });
  pattern(path.personalData.lastName, /^[А-ЯЁа-яё\s-]+$/, {
    message: 'Используйте только кириллицу',
  });

  required(path.personalData.firstName, { message: 'Имя обязательно' });
  minLength(path.personalData.firstName, 2, { message: 'Минимум 2 символа' });
  pattern(path.personalData.firstName, /^[А-ЯЁа-яё\s-]+$/, {
    message: 'Используйте только кириллицу',
  });

  pattern(path.personalData.middleName, /^[А-ЯЁа-яё\s-]+$/, {
    message: 'Используйте только кириллицу',
  });

  // Дата рождения
  required(path.personalData.birthDate, { message: 'Дата рождения обязательна' });

  validate(path.personalData.birthDate, (birthDate) => {
    if (!birthDate) return null;

    const date = new Date(birthDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date > today) {
      return {
        code: 'futureDate',
        message: 'Дата рождения не может быть в будущем',
      };
    }

    return null;
  });

  validate(path.personalData.birthDate, (birthDate) => {
    if (!birthDate) return null;

    const date = new Date(birthDate);
    const today = new Date();

    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
      age--;
    }

    if (age < 18) {
      return { code: 'underAge', message: 'Заявитель должен быть не моложе 18 лет' };
    }

    if (age > 70) {
      return { code: 'overAge', message: 'Заявитель должен быть не старше 70 лет' };
    }

    return null;
  });

  // Данные паспорта
  required(path.passportData.series, { message: 'Серия паспорта обязательна' });
  pattern(path.passportData.series, /^\d{4}$/, {
    message: 'Серия должна быть ровно 4 цифры',
  });

  required(path.passportData.number, { message: 'Номер паспорта обязателен' });
  pattern(path.passportData.number, /^\d{6}$/, {
    message: 'Номер должен быть ровно 6 цифр',
  });

  required(path.passportData.issueDate, { message: 'Дата выдачи обязательна' });

  validate(path.passportData.issueDate, (issueDate) => {
    if (!issueDate) return null;

    const date = new Date(issueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date > today) {
      return { code: 'futureDateIssue', message: 'Дата выдачи не может быть в будущем' };
    }

    return null;
  });

  validate(path.passportData.issueDate, (issueDate, ctx) => {
    if (!issueDate) return null;

    const birthDate = ctx.form.personalData.birthDate.value.value;
    if (!birthDate) return null;

    const issue = new Date(issueDate);
    const birth = new Date(birthDate);

    if (issue <= birth) {
      return { code: 'issueDateBeforeBirth', message: 'Дата выдачи должна быть после даты рождения' };
    }

    return null;
  });

  required(path.passportData.issuedBy, { message: 'Орган выдачи обязателен' });
  minLength(path.passportData.issuedBy, 10, { message: 'Минимум 10 символов' });

  // ИНН и СНИЛС
  required(path.inn, { message: 'ИНН обязателен' });
  pattern(path.inn, /^\d{10}$|^\d{12}$/, { message: 'ИНН должен быть 10 или 12 цифр' });

  required(path.snils, { message: 'СНИЛС обязателен' });
  pattern(path.snils, /^\d{11}$/, { message: 'СНИЛС должен быть ровно 11 цифр' });
};
