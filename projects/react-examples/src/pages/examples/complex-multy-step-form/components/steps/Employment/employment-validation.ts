import type { FieldPath, ValidationSchemaFn } from 'reformer';
import {
  applyWhen,
  validateTree,
  required,
  min,
  max,
  minLength,
  maxLength,
  pattern,
} from 'reformer/validators';
import type { CreditApplicationForm } from '../../../types/credit-application';

/**
 * Схема валидации для Шага 4: Информация о занятости
 */
export const employmentValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.employmentStatus, { message: 'Укажите статус занятости' });

  // Условная валидация для работающих
  applyWhen(
    path.employmentStatus,
    (status) => status === 'employed',
    (path) => {
      required(path.companyName, { message: 'Укажите название компании' });
      minLength(path.companyName, 3, { message: 'Минимум 3 символа' });
      maxLength(path.companyName, 200, { message: 'Максимум 200 символов' });

      required(path.companyInn, { message: 'ИНН компании обязателен' });
      pattern(path.companyInn, /^\d{10}$/, {
        message: 'ИНН компании должен содержать 10 цифр',
      });

      required(path.companyPhone, { message: 'Телефон компании обязателен' });
      pattern(path.companyPhone, /^\+7\s\(\d{3}\)\s\d{3}-\d{2}-\d{2}$/, {
        message: 'Формат: +7 (___) ___-__-__',
      });

      required(path.companyAddress, { message: 'Адрес компании обязателен' });
      minLength(path.companyAddress, 10, { message: 'Минимум 10 символов' });
      maxLength(path.companyAddress, 300, { message: 'Максимум 300 символов' });

      required(path.position, { message: 'Укажите должность' });
      minLength(path.position, 3, { message: 'Минимум 3 символа' });
      maxLength(path.position, 100, { message: 'Максимум 100 символов' });

      required(path.workExperienceTotal, { message: 'Укажите общий стаж работы' });
      min(path.workExperienceTotal, 0, { message: 'Стаж не может быть отрицательным' });
      max(path.workExperienceTotal, 60, { message: 'Максимальный стаж: 60 лет' });

      required(path.workExperienceCurrent, { message: 'Укажите стаж на текущем месте' });
      min(path.workExperienceCurrent, 0, { message: 'Стаж не может быть отрицательным' });
      max(path.workExperienceCurrent, 60, { message: 'Максимальный стаж: 60 лет' });

      // Cross-field: стаж на текущем месте не больше общего стажа
      validateTree<CreditApplicationForm>(
        (ctx) => {
          const form = ctx.form.getValue();
          if (
            form.workExperienceCurrent &&
            form.workExperienceTotal &&
            form.workExperienceCurrent > form.workExperienceTotal
          ) {
            return {
              code: 'currentExperienceExceedsTotal',
              message: 'Стаж на текущем месте не может превышать общий стаж',
            };
          }
          return null;
        },
        { targetField: 'workExperienceCurrent' }
      );
    }
  );

  // Условная валидация для ИП
  applyWhen(
    path.employmentStatus,
    (status) => status === 'selfEmployed',
    (path) => {
      required(path.businessType, { message: 'Укажите тип бизнеса' });

      required(path.businessInn, { message: 'ИНН ИП обязателен' });
      pattern(path.businessInn, /^\d{12}$/, {
        message: 'ИНН ИП должен содержать 12 цифр',
      });

      required(path.businessActivity, { message: 'Укажите вид деятельности' });
      minLength(path.businessActivity, 10, { message: 'Минимум 10 символов' });
      maxLength(path.businessActivity, 300, { message: 'Максимум 300 символов' });
    }
  );

  // Валидация дохода (для всех статусов)
  required(path.monthlyIncome, { message: 'Укажите ежемесячный доход' });
  min(path.monthlyIncome, 10000, { message: 'Минимальный доход: 10 000 ₽' });
  max(path.monthlyIncome, 10000000, { message: 'Максимальный доход: 10 000 000 ₽' });

  // Валидация дополнительного дохода (опциональный)
  // Если указан, должен быть положительным и требует указания источника
  min(path.additionalIncome, 0, { message: 'Дополнительный доход не может быть отрицательным' });
  max(path.additionalIncome, 10000000, { message: 'Максимальный доход: 10 000 000 ₽' });

  // Если указан дополнительный доход, требуется указать источник
  validateTree<CreditApplicationForm>(
    (ctx) => {
      const form = ctx.form.getValue();
      if (form.additionalIncome && form.additionalIncome > 0 && !form.additionalIncomeSource) {
        return {
          code: 'additionalIncomeSourceRequired',
          message: 'Укажите источник дополнительного дохода',
        };
      }
      return null;
    },
    { targetField: 'additionalIncomeSource' }
  );

  // Валидация источника дополнительного дохода
  minLength(path.additionalIncomeSource, 5, { message: 'Минимум 5 символов' });
  maxLength(path.additionalIncomeSource, 200, { message: 'Максимум 200 символов' });
};
