import { validate, required, minLength, pattern } from '@reformer/core/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
import type { PersonalData } from './type';

export const personalDataValidation: ValidationSchemaFn<PersonalData> = (
  path: FieldPath<PersonalData>
) => {
  // Имена
  validate(path.lastName, required({ message: 'Фамилия обязательна' }));
  validate(path.lastName, minLength(2, { message: 'Минимум 2 символа' }));
  validate(path.lastName, pattern(/^[А-ЯЁа-яё\s-]+$/, { message: 'Используйте только кириллицу' }));

  validate(path.firstName, required({ message: 'Имя обязательно' }));
  validate(path.firstName, minLength(2, { message: 'Минимум 2 символа' }));
  validate(
    path.firstName,
    pattern(/^[А-ЯЁа-яё\s-]+$/, { message: 'Используйте только кириллицу' })
  );

  validate(
    path.middleName,
    pattern(/^[А-ЯЁа-яё\s-]+$/, { message: 'Используйте только кириллицу' })
  );

  // Дата рождения
  validate(path.birthDate, required({ message: 'Дата рождения обязательна' }));

  // Проверка: дата рождения не в будущем
  validate(path.birthDate, (birthDate) => {
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

  // Проверка: возраст от 18 до 70 лет
  validate(path.birthDate, (birthDate) => {
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
};
