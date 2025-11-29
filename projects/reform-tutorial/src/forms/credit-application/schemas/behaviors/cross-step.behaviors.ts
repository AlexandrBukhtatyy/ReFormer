import { computeFrom, disableWhen, revalidateWhen, watchField } from 'reformer/behaviors';
import type { BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';
import type { CreditApplicationForm } from '../../types/credit-application.types';

export const crossStepBehaviorsSchema: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Соотношение платежа к доходу
  // ==========================================
  computeFrom(
    [path.monthlyPayment, path.totalIncome, path.coBorrowersIncome],
    path.paymentToIncomeRatio,
    (values) => {
      const payment = values.monthlyPayment as number;
      const mainIncome = values.totalIncome as number;
      const coIncome = values.coBorrowersIncome as number;

      const totalHouseholdIncome = (mainIncome || 0) + (coIncome || 0);
      if (!totalHouseholdIncome || !payment) return 0;

      return Math.round((payment / totalHouseholdIncome) * 100);
    }
  );

  // Отключить paymentToIncomeRatio (только для чтения)
  disableWhen(path.paymentToIncomeRatio, () => true);

  // ==========================================
  // Ревалидация платежа при изменении дохода
  // ==========================================
  revalidateWhen(path.monthlyPayment, [path.totalIncome, path.coBorrowersIncome]);

  // ==========================================
  // Контроль доступа по возрасту
  // Поля кредита отключены если возраст < 18
  // ==========================================
  disableWhen(path.loanAmount, (form) => {
    const age = form.age as number | null;
    return age !== null && age < 18;
  });
  disableWhen(path.loanTerm, (form) => {
    const age = form.age as number | null;
    return age !== null && age < 18;
  });
  disableWhen(path.loanPurpose, (form) => {
    const age = form.age as number | null;
    return age !== null && age < 18;
  });

  // ==========================================
  // Аналитика
  // ==========================================
  watchField(path.loanAmount, (value) => {
    console.log('Loan amount changed:', value);
  });

  watchField(path.interestRate, (value) => {
    console.log('Interest rate computed:', value);
  });

  watchField(path.employmentStatus, (value) => {
    console.log('Employment status changed:', value);
  });
};
