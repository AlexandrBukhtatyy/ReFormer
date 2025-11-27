import type { FieldPath, ValidationSchemaFn } from 'reformer';
import {
  validate,
  validateTree,
  required,
  minLength,
  maxLength,
  pattern,
} from 'reformer/validators';
import type { CreditApplicationForm } from '../../../types/credit-application';

/**
 * Схема валидации для Шага 2: Персональные данные
 */
export const personalDataValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Валидация личных данных
  required(path.personalData.lastName, { message: 'Фамилия обязательна' });
  minLength(path.personalData.lastName, 2, { message: 'Минимум 2 символа' });
  maxLength(path.personalData.lastName, 50, { message: 'Максимум 50 символов' });
  pattern(path.personalData.lastName, /^[А-ЯЁа-яё\s-]+$/, {
    message: 'Только русские буквы, пробелы и дефис',
  });

  required(path.personalData.firstName, { message: 'Имя обязательно' });
  minLength(path.personalData.firstName, 2, { message: 'Минимум 2 символа' });
  maxLength(path.personalData.firstName, 50, { message: 'Максимум 50 символов' });
  pattern(path.personalData.firstName, /^[А-ЯЁа-яё\s-]+$/, {
    message: 'Только русские буквы, пробелы и дефис',
  });

  required(path.personalData.middleName, { message: 'Отчество обязательно' });
  minLength(path.personalData.middleName, 2, { message: 'Минимум 2 символа' });
  maxLength(path.personalData.middleName, 50, { message: 'Максимум 50 символов' });
  pattern(path.personalData.middleName, /^[А-ЯЁа-яё\s-]+$/, {
    message: 'Только русские буквы, пробелы и дефис',
  });

  required(path.personalData.birthDate, { message: 'Дата рождения обязательна' });

  // Валидация возраста
  validate(path.personalData.birthDate, (value) => {
    const birthDate = new Date(value);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();

    if (age < 18) {
      return {
        code: 'tooYoung',
        message: 'Заемщику должно быть не менее 18 лет',
      };
    }

    if (age > 70) {
      return {
        code: 'tooOld',
        message: 'Максимальный возраст заемщика: 70 лет',
      };
    }

    return null;
  });

  required(path.personalData.gender, { message: 'Выберите пол' });

  required(path.personalData.birthPlace, { message: 'Место рождения обязательно' });
  minLength(path.personalData.birthPlace, 5, { message: 'Минимум 5 символов' });
  maxLength(path.personalData.birthPlace, 100, { message: 'Максимум 100 символов' });

  // Валидация паспортных данных
  required(path.passportData.series, { message: 'Серия паспорта обязательна' });
  pattern(path.passportData.series, /^\d{2}\s\d{2}$/, {
    message: 'Формат: 00 00',
  });

  required(path.passportData.number, { message: 'Номер паспорта обязателен' });
  pattern(path.passportData.number, /^\d{6}$/, {
    message: 'Номер должен содержать 6 цифр',
  });

  required(path.passportData.issueDate, { message: 'Дата выдачи обязательна' });

  // Валидация даты выдачи паспорта
  validate(path.passportData.issueDate, (value) => {
    const issueDate = new Date(value);
    const today = new Date();

    if (issueDate > today) {
      return {
        code: 'issueDateInFuture',
        message: 'Дата выдачи не может быть в будущем',
      };
    }

    return null;
  });

  required(path.passportData.issuedBy, { message: 'Кем выдан обязательно' });
  minLength(path.passportData.issuedBy, 10, { message: 'Минимум 10 символов' });
  maxLength(path.passportData.issuedBy, 200, { message: 'Максимум 200 символов' });

  required(path.passportData.departmentCode, { message: 'Код подразделения обязателен' });
  pattern(path.passportData.departmentCode, /^\d{3}-\d{3}$/, {
    message: 'Формат: 000-000',
  });

  // Кросс-полевая валидация: дата выдачи паспорта должна быть после достижения 14 лет
  validateTree<CreditApplicationForm>(
    (ctx) => {
      const form = ctx.form.getValue();
      if (!form.personalData.birthDate || !form.passportData.issueDate) {
        return null;
      }

      const birthDate = new Date(form.personalData.birthDate);
      const issueDate = new Date(form.passportData.issueDate);

      // Минимальный возраст получения паспорта - 14 лет
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
    { targetField: 'passportData.issueDate' }
  );

  // Валидация ИНН
  required(path.inn, { message: 'ИНН обязателен' });
  pattern(path.inn, /^\d{12}$/, {
    message: 'ИНН должен содержать 12 цифр',
  });

  // Валидация СНИЛС
  required(path.snils, { message: 'СНИЛС обязателен' });
  pattern(path.snils, /^\d{3}-\d{3}-\d{3}\s\d{2}$/, {
    message: 'Формат СНИЛС: 000-000-000 00',
  });
};
