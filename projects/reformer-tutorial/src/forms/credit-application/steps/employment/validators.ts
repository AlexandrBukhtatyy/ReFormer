import { validate, required, min, pattern, applyWhen } from '@reformer/core/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
import type { CreditApplicationForm } from '../../type';

/**
 * Валидация для Шага 4: Занятость
 */
export const employmentValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Базовые поля занятости
  validate(path.employmentStatus, required({ message: 'Статус занятости обязателен' }));

  validate(path.monthlyIncome, required({ message: 'Ежемесячный доход обязателен' }));
  validate(path.monthlyIncome, min(10000, { message: 'Минимальный ежемесячный доход: 10 000' }));

  validate(
    path.additionalIncome,
    min(0, { message: 'Дополнительный доход не может быть отрицательным' })
  );

  // Условно: Поля работающих
  applyWhen(
    path.employmentStatus,
    (status) => status === 'employed',
    (p) => {
      validate(p.companyName, required({ message: 'Название компании обязательно' }));
      validate(p.companyAddress, required({ message: 'Адрес компании обязателен' }));
      validate(p.position, required({ message: 'Должность обязательна' }));

      validate(
        p.workExperienceCurrent,
        required({ message: 'Стаж работы на текущем месте обязателен' })
      );
      validate(
        p.workExperienceCurrent,
        min(3, { message: 'Минимум 3 месяца опыта на текущем месте требуется' })
      );

      validate(
        p.workExperienceTotal,
        min(0, { message: 'Общий стаж не может быть отрицательным' })
      );
    }
  );

  // Условно: Поля самозанятых
  applyWhen(
    path.employmentStatus,
    (status) => status === 'selfEmployed',
    (p) => {
      validate(p.businessType, required({ message: 'Тип бизнеса обязателен' }));
      validate(p.businessInn, required({ message: 'ИНН бизнеса обязателен' }));
    }
  );

  validate(
    path.businessInn,
    pattern(/^\d{10}$|^\d{12}$/, { message: 'ИНН бизнеса должен быть 10 или 12 цифр' })
  );
};
