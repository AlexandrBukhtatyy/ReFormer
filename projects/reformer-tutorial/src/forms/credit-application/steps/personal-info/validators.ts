import { validate, required, minLength, pattern } from '@reformer/core/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
import type { CreditApplicationForm } from '../../type';

/**
 * Валидация для Шага 2: Личная информация
 */
export const personalValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Личные данные: Имена
  validate(path.personalData.lastName, required({ message: 'Фамилия обязательна' }));
  validate(path.personalData.lastName, minLength(2, { message: 'Минимум 2 символа' }));
  validate(
    path.personalData.lastName,
    pattern(/^[А-ЯЁа-яё\s-]+$/, { message: 'Используйте только кириллицу' })
  );

  validate(path.personalData.firstName, required({ message: 'Имя обязательно' }));
  validate(path.personalData.firstName, minLength(2, { message: 'Минимум 2 символа' }));
  validate(
    path.personalData.firstName,
    pattern(/^[А-ЯЁа-яё\s-]+$/, { message: 'Используйте только кириллицу' })
  );

  validate(
    path.personalData.middleName,
    pattern(/^[А-ЯЁа-яё\s-]+$/, { message: 'Используйте только кириллицу' })
  );

  // Дата рождения
  validate(path.personalData.birthDate, required({ message: 'Дата рождения обязательна' }));

  validate(path.personalData.birthDate, (birthDate) => {
    if (!birthDate) return null;

    const date = new Date(birthDate as string);
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

    const date = new Date(birthDate as string);
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
  validate(path.passportData.series, required({ message: 'Серия паспорта обязательна' }));
  validate(
    path.passportData.series,
    pattern(/^\d{4}$/, { message: 'Серия должна быть ровно 4 цифры' })
  );

  validate(path.passportData.number, required({ message: 'Номер паспорта обязателен' }));
  validate(
    path.passportData.number,
    pattern(/^\d{6}$/, { message: 'Номер должен быть ровно 6 цифр' })
  );

  validate(path.passportData.issueDate, required({ message: 'Дата выдачи обязательна' }));

  validate(path.passportData.issueDate, (issueDate) => {
    if (!issueDate) return null;

    const date = new Date(issueDate as string);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date > today) {
      return { code: 'futureDateIssue', message: 'Дата выдачи не может быть в будущем' };
    }
    return null;
  });

  validate(path.passportData.issueDate, (issueDate, _control, root) => {
    if (!issueDate) return null;

    const birthDate = root.personalData.birthDate.value.value;
    if (!birthDate) return null;

    const issue = new Date(issueDate as string);
    const birth = new Date(birthDate);

    if (issue <= birth) {
      return {
        code: 'issueDateBeforeBirth',
        message: 'Дата выдачи должна быть после даты рождения',
      };
    }
    return null;
  });

  validate(path.passportData.issuedBy, required({ message: 'Орган выдачи обязателен' }));
  validate(path.passportData.issuedBy, minLength(10, { message: 'Минимум 10 символов' }));

  // ИНН и СНИЛС
  validate(path.inn, required({ message: 'ИНН обязателен' }));
  validate(path.inn, pattern(/^\d{10}$|^\d{12}$/, { message: 'ИНН должен быть 10 или 12 цифр' }));

  validate(path.snils, required({ message: 'СНИЛС обязателен' }));
  validate(path.snils, pattern(/^\d{11}$/, { message: 'СНИЛС должен быть ровно 11 цифр' }));
};
