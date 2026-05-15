import type { FieldPath, ValidationSchemaFn } from '@reformer/core';
import {
  validate,
  validateGroup,
  required,
  minLength,
  maxLength,
  pattern,
} from '@reformer/core/validators';
import type { CreditApplicationForm } from '../../../types/credit-application';

/**
 * Схема валидации для Шага 2: Персональные данные
 */
export const personalDataValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Личные данные
  validate(path.personalData.lastName, required({ message: 'Фамилия обязательна' }));
  validate(path.personalData.lastName, minLength(2, { message: 'Минимум 2 символа' }));
  validate(path.personalData.lastName, maxLength(50, { message: 'Максимум 50 символов' }));
  validate(
    path.personalData.lastName,
    pattern(/^[А-ЯЁа-яё\s-]+$/, { message: 'Только русские буквы, пробелы и дефис' })
  );

  validate(path.personalData.firstName, required({ message: 'Имя обязательно' }));
  validate(path.personalData.firstName, minLength(2, { message: 'Минимум 2 символа' }));
  validate(path.personalData.firstName, maxLength(50, { message: 'Максимум 50 символов' }));
  validate(
    path.personalData.firstName,
    pattern(/^[А-ЯЁа-яё\s-]+$/, { message: 'Только русские буквы, пробелы и дефис' })
  );

  validate(path.personalData.middleName, required({ message: 'Отчество обязательно' }));
  validate(path.personalData.middleName, minLength(2, { message: 'Минимум 2 символа' }));
  validate(path.personalData.middleName, maxLength(50, { message: 'Максимум 50 символов' }));
  validate(
    path.personalData.middleName,
    pattern(/^[А-ЯЁа-яё\s-]+$/, { message: 'Только русские буквы, пробелы и дефис' })
  );

  validate(path.personalData.birthDate, required({ message: 'Дата рождения обязательна' }));

  // Кастомная валидация возраста
  validate(path.personalData.birthDate, (value) => {
    const birthDate = new Date(value as string);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();

    if (age < 18) {
      return { code: 'tooYoung', message: 'Заемщику должно быть не менее 18 лет' };
    }
    if (age > 70) {
      return { code: 'tooOld', message: 'Максимальный возраст заемщика: 70 лет' };
    }
    return null;
  });

  validate(path.personalData.gender, required({ message: 'Выберите пол' }));

  validate(path.personalData.birthPlace, required({ message: 'Место рождения обязательно' }));
  validate(path.personalData.birthPlace, minLength(5, { message: 'Минимум 5 символов' }));
  validate(path.personalData.birthPlace, maxLength(100, { message: 'Максимум 100 символов' }));

  // Паспортные данные
  validate(path.passportData.series, required({ message: 'Серия паспорта обязательна' }));
  validate(path.passportData.series, pattern(/^\d{2}\s\d{2}$/, { message: 'Формат: 00 00' }));

  validate(path.passportData.number, required({ message: 'Номер паспорта обязателен' }));
  validate(
    path.passportData.number,
    pattern(/^\d{6}$/, { message: 'Номер должен содержать 6 цифр' })
  );

  validate(path.passportData.issueDate, required({ message: 'Дата выдачи обязательна' }));

  // Кастомная валидация даты выдачи паспорта
  validate(path.passportData.issueDate, (value) => {
    const issueDate = new Date(value as string);
    const today = new Date();
    if (issueDate > today) {
      return {
        code: 'issueDateInFuture',
        message: 'Дата выдачи не может быть в будущем',
      };
    }
    return null;
  });

  validate(path.passportData.issuedBy, required({ message: 'Кем выдан обязательно' }));
  validate(path.passportData.issuedBy, minLength(10, { message: 'Минимум 10 символов' }));
  validate(path.passportData.issuedBy, maxLength(200, { message: 'Максимум 200 символов' }));

  validate(path.passportData.departmentCode, required({ message: 'Код подразделения обязателен' }));
  validate(
    path.passportData.departmentCode,
    pattern(/^\d{3}-\d{3}$/, { message: 'Формат: 000-000' })
  );

  // Cross-field: паспорт выдан после 14 лет
  validateGroup(
    path,
    (scope) => {
      const form = scope.getValue();
      if (!form.personalData.birthDate || !form.passportData.issueDate) {
        return null;
      }

      const birthDate = new Date(form.personalData.birthDate);
      const issueDate = new Date(form.passportData.issueDate);

      const minIssueDate = new Date(birthDate);
      minIssueDate.setFullYear(birthDate.getFullYear() + 14);

      if (issueDate < minIssueDate) {
        return {
          code: 'passportIssuedBeforeMinAge',
          message: 'Паспорт не может быть выдан ранее достижения 14 лет',
        };
      }
      return null;
    },
    { targetField: path.passportData.issueDate }
  );

  // ИНН
  validate(path.inn, required({ message: 'ИНН обязателен' }));
  validate(path.inn, pattern(/^\d{12}$/, { message: 'ИНН должен содержать 12 цифр' }));

  // СНИЛС
  validate(path.snils, required({ message: 'СНИЛС обязателен' }));
  validate(
    path.snils,
    pattern(/^\d{3}-\d{3}-\d{3}\s\d{2}$/, { message: 'Формат СНИЛС: 000-000-000 00' })
  );
};
