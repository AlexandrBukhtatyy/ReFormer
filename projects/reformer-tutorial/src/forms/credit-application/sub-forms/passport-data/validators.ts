import { validate, required, minLength, pattern } from '@reformer/core/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
import type { PassportData } from './type';

export const passportDataValidation: ValidationSchemaFn<PassportData> = (
  path: FieldPath<PassportData>
) => {
  validate(path.series, required({ message: 'Серия паспорта обязательна' }));
  validate(path.series, pattern(/^\d{4}$/, { message: 'Серия должна быть ровно 4 цифры' }));

  validate(path.number, required({ message: 'Номер паспорта обязателен' }));
  validate(path.number, pattern(/^\d{6}$/, { message: 'Номер должен быть ровно 6 цифр' }));

  validate(path.issueDate, required({ message: 'Дата выдачи обязательна' }));

  // Проверка: дата выдачи не в будущем
  validate(path.issueDate, (issueDate) => {
    if (!issueDate) return null;

    const date = new Date(issueDate as string);
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

  validate(path.issuedBy, required({ message: 'Орган выдачи обязателен' }));
  validate(path.issuedBy, minLength(10, { message: 'Минимум 10 символов' }));
};
