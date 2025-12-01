import { required, minLength, pattern, validate } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { PersonalData } from './type';

export const personalDataValidation: ValidationSchemaFn<PersonalData> = (
  path: FieldPath<PersonalData>
) => {
  // Имена
  required(path.lastName, { message: 'Фамилия обязательна' });
  minLength(path.lastName, 2, { message: 'Минимум 2 символа' });
  pattern(path.lastName, /^[А-ЯЁа-яё\s-]+$/, {
    message: 'Используйте только кириллицу',
  });

  required(path.firstName, { message: 'Имя обязательно' });
  minLength(path.firstName, 2, { message: 'Минимум 2 символа' });
  pattern(path.firstName, /^[А-ЯЁа-яё\s-]+$/, {
    message: 'Используйте только кириллицу',
  });

  pattern(path.middleName, /^[А-ЯЁа-яё\s-]+$/, {
    message: 'Используйте только кириллицу',
  });

  // Дата рождения
  required(path.birthDate, { message: 'Дата рождения обязательна' });

  // Проверка: дата рождения не в будущем
  validate(path.birthDate, (birthDate) => {
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

  // Проверка: возраст от 18 до 70 лет
  validate(path.birthDate, (birthDate) => {
    if (!birthDate) return null;

    const date = new Date(birthDate);
    const today = new Date();

    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
      age--;
    }

    if (age < 18) {
      return {
        code: 'underAge',
        message: 'Заявитель должен быть не моложе 18 лет',
      };
    }

    if (age > 70) {
      return {
        code: 'overAge',
        message: 'Заявитель должен быть не старше 70 лет',
      };
    }

    return null;
  });
};
