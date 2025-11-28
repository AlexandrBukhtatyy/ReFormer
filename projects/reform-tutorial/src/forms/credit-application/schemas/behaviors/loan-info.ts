import { computeFrom, enableWhen, watchField } from 'reformer/behaviors';
import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm, Address } from '../../types/credit-application.types';

export const loanBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Вычисляемое поле: Процентная ставка
  // ==========================================
  computeFrom(
    [path.loanType, path.registrationAddress, path.hasProperty],
    path.interestRate,
    (values) => {
      const baseRates: Record<string, number> = {
        mortgage: 8.5,
        car: 12.0,
        consumer: 15.0,
        business: 18.0,
        refinancing: 14.0,
      };

      let rate = baseRates[values.loanType as string] || 15.0;

      // Скидка для крупных городов
      const address = values.registrationAddress as Address;
      const city = address?.city || '';
      if (['Москва', 'Санкт-Петербург'].includes(city)) {
        rate -= 0.5;
      }

      // Скидка за наличие имущества в залог
      if (values.hasProperty) {
        rate -= 1.0;
      }

      // Минимальная ставка 5%
      return Math.max(rate, 5.0);
    }
  );

  // ==========================================
  // Вычисляемое поле: Ежемесячный платёж
  // ==========================================
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    (values) => {
      const amount = values.loanAmount as number;
      const termMonths = values.loanTerm as number;
      const annualRate = values.interestRate as number;

      if (!amount || !termMonths || !annualRate) return 0;
      if (amount <= 0 || termMonths <= 0 || annualRate <= 0) return 0;

      const monthlyRate = annualRate / 100 / 12;
      const factor = Math.pow(1 + monthlyRate, termMonths);
      const payment = (amount * (monthlyRate * factor)) / (factor - 1);

      return Math.round(payment);
    }
  );

  // ==========================================
  // Условная видимость: Поля ипотеки
  // ==========================================
  enableWhen(path.propertyValue, (value) => value.loanType === 'mortgage');
  enableWhen(path.initialPayment, (value) => value.loanType === 'mortgage');

  // ==========================================
  // Условная видимость: Поля автокредита
  // ==========================================
  enableWhen(path.carBrand, (value) => value.loanType === 'car');
  enableWhen(path.carModel, (value) => value.loanType === 'car');
  enableWhen(path.carYear, (value) => value.loanType === 'car');
  enableWhen(path.carPrice, (value) => value.loanType === 'car');

  // ==========================================
  // Watch: Сброс полей
  // ==========================================
  watchField(path.loanType, (value, { form }) => {
    if (value !== 'mortgage') {
      form.propertyValue.setValue(null, { emitEvent: false });
      form.initialPayment.setValue(null, { emitEvent: false });
    }
    if (value !== 'car') {
      form.carBrand.setValue('', { emitEvent: false });
      form.carModel.setValue('', { emitEvent: false });
      form.carYear.setValue(null, { emitEvent: false });
      form.carPrice.setValue(null, { emitEvent: false });
    }
  });

  computeFrom(
    [path.propertyValue],
    path.initialPayment,
    ({ propertyValue }: { propertyValue: number }): number => {
      if (!propertyValue) {
        return 0;
      }

      return Math.round(propertyValue * 0.2);
    }
  );
};
