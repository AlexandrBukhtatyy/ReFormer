import { compute, type BehaviorScope } from '@reformer/core/behaviors';
import { isMortgage } from '../model/predicates';
import type { CreditApplicationForm } from '../types/credit-application';
import {
  computeAge,
  computeCoBorrowersIncome,
  computeFullName,
  computeInitialPayment,
  computeInterestRate,
  computeMonthlyPayment,
  computePaymentRatio,
  computeTotalIncome,
} from '../utils';

/** Вычисляемые поля: `compute` следит за сигналами, которые прочитаны в расчёте. */
export function derived({ model }: BehaviorScope<CreditApplicationForm>): void {
  compute(model.$.interestRate, () =>
    computeInterestRate({
      loanType: model.loanType,
      region: model.registrationAddress.region,
      hasProperty: model.hasProperty,
      propertyCount: model.properties.length,
    })
  );
  compute(model.$.monthlyPayment, () => computeMonthlyPayment(model));
  // Первоначальный взнос (20 % стоимости) — только для ипотеки
  compute(model.$.initialPayment, () => computeInitialPayment(model), {
    when: () => isMortgage(model.loanType),
  });
  compute(model.$.fullName, () => computeFullName(model.personalData));
  compute(model.$.age, () => computeAge(model.personalData.birthDate));
  compute(model.$.coBorrowersIncome, () =>
    computeCoBorrowersIncome(model.coBorrowers.map((coBorrower) => coBorrower.monthlyIncome))
  );
  compute(model.$.totalIncome, () => computeTotalIncome(model));
  compute(model.$.paymentToIncomeRatio, () => computePaymentRatio(model));
}
