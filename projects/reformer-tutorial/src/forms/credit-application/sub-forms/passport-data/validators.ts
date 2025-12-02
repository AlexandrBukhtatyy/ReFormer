import { required, minLength, pattern, validate } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
import type { PassportData } from './type';

export const passportDataValidation: ValidationSchemaFn<PassportData> = (
  path: FieldPath<PassportData>
) => {
  required(path.series, { message: 'Серия паспорта обязательна' });
  pattern(path.series, /^\d{4}$/, {
    message: 'Серия должна быть ровно 4 цифры',
  });

  required(path.number, { message: 'Номер паспорта обязателен' });
  pattern(path.number, /^\d{6}$/, {
    message: 'Номер должен быть ровно 6 цифр',
  });

  required(path.issueDate, { message: 'Дата выдачи обязательна' });

  // Проверка: дата выдачи не в будущем
  validate(path.issueDate, (issueDate) => {
    if (!issueDate) return null;

    const date = new Date(issueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date > today) {
      return {
        code: 'futureDateIssue',
        message: 'Дата выдачи не может быть в будущем',
      };
    }

    return null;
  });

  required(path.issuedBy, { message: 'Орган выдачи обязателен' });
  minLength(path.issuedBy, 10, { message: 'Минимум 10 символов' });
};
