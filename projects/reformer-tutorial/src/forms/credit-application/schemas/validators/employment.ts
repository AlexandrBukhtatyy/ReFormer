import { required, min, pattern, applyWhen } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '../../types/credit-application.types';

/**
 * Валидация для Шага 4: Занятость
 *
 * Валидирует:
 * - Статус занятости (требуется для всех)
 * - Поля дохода (требуются для всех)
 * - Поля занятости (условно требуются)
 * - Поля самозанятости (условно требуются)
 */
export const employmentValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Базовые поля занятости
  // ==========================================

  required(path.employmentStatus, { message: 'Статус занятости обязателен' });

  required(path.monthlyIncome, { message: 'Ежемесячный доход обязателен' });
  min(path.monthlyIncome, 10000, {
    message: 'Минимальный ежемесячный доход: 10 000',
  });

  min(path.additionalIncome, 0, {
    message: 'Дополнительный доход не может быть отрицательным',
  });

  // ==========================================
  // Условно: Поля работающих
  // ==========================================

  applyWhen(
    path.employmentStatus,
    (status) => status === 'employed',
    (p) => {
      required(p.companyName, { message: 'Название компании обязательно' });
      required(p.companyAddress, { message: 'Адрес компании обязателен' });
      required(p.position, { message: 'Должность обязательна' });

      required(p.workExperienceCurrent, { message: 'Стаж работы на текущем месте обязателен' });
      min(p.workExperienceCurrent, 3, {
        message: 'Минимум 3 месяца опыта на текущем месте требуется',
      });

      min(p.workExperienceTotal, 0, {
        message: 'Общий стаж не может быть отрицательным',
      });
    }
  );

  // ==========================================
  // Условно: Поля самозанятых
  // ==========================================

  applyWhen(
    path.employmentStatus,
    (status) => status === 'selfEmployed',
    (p) => {
      required(p.businessType, { message: 'Тип бизнеса обязателен' });
      required(p.businessInn, { message: 'ИНН бизнеса обязателен' });
    }
  );

  pattern(path.businessInn, /^\d{10}$|^\d{12}$/, {
    message: 'ИНН бизнеса должен быть 10 или 12 цифр',
  });
};
