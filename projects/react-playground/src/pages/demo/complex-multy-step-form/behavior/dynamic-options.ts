import { onChange, type BehaviorScope } from '@reformer/core/behaviors';
import { fetchCarModels } from '../api';
import type { CreditApplicationForm } from '../types/credit-application';
import { loadOptionsOn } from './operators';

/** Пропсы полей, которые зависят от значений: списки опций и пределы ввода. */
export function dynamicOptions({ model, form }: BehaviorScope<CreditApplicationForm>): void {
  loadOptionsOn(model.$.carBrand, form.carModel, fetchCarModels, { resetTarget: true });

  // Максимальная сумма кредита от дохода (≤ 10 годовых, не более 10 млн)
  onChange(model.$.totalIncome, (totalIncome) => {
    if (totalIncome > 0) {
      form.loanAmount.updateComponentProps({ max: Math.min(totalIncome * 12 * 10, 10_000_000) });
    }
  });
  // Максимальный срок с учётом возраста (погашение до 70 лет)
  onChange(model.$.age, (age) => {
    if (age !== null && age >= 18) {
      form.loanTerm.updateComponentProps({ max: Math.min(Math.max(70 - age, 1) * 12, 240) });
    }
  });
}
