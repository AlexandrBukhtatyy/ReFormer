// form.behavior.ts — defineFormBehavior: computed fields, conditional enable/disable,
// copy-from, async options loading, array clearing.
import {
  defineFormBehavior,
  compute,
  copyFrom,
  enableWhen,
  onChange,
} from '@reformer/core/behaviors';
import { fetchCarModels, fetchCitiesByRegion } from './data-sources';
import type { CreditForm, LoanType } from './types';

const BASE_RATE: Record<LoanType, number> = {
  consumer: 15,
  mortgage: 9,
  car: 11,
  business: 17,
  refinance: 13,
};

function computeAge(birthDate: string): number {
  if (!birthDate) return 0;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const monthDiff = now.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d.getDate())) age -= 1;
  return age < 0 ? 0 : age;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export const creditBehavior = defineFormBehavior<CreditForm>(({ model, form }) => {
  const m = model.$;

  // ===== Computed fields (C.1–C.8) =====

  // C.3 initialPayment — 20% стоимости недвижимости (только для ипотеки)
  compute(m.initialPayment, () => Math.round((model.propertyValue ?? 0) * 0.2), {
    when: () => model.loanType === 'mortgage',
  });

  // C.1 interestRate — базовая ставка по типу + корректировки (регион, имущество)
  compute(m.interestRate, () => {
    let rate = BASE_RATE[model.loanType] ?? 15;
    const hasCollateral = model.hasProperty && model.properties.map(() => null).length > 0;
    if (hasCollateral) rate -= 0.5;
    const region = model.registrationAddress.region;
    if (region && region !== 'moscow') rate += 0.5;
    return round2(rate);
  });

  // C.2 monthlyPayment — аннуитетная формула
  compute(m.monthlyPayment, () => {
    const principal = model.loanAmount ?? 0;
    const term = model.loanTerm ?? 0;
    const i = (model.interestRate ?? 0) / 100 / 12;
    if (principal <= 0 || term <= 0) return 0;
    if (i <= 0) return Math.round(principal / term);
    const pow = Math.pow(1 + i, term);
    return Math.round((principal * i * pow) / (pow - 1));
  });

  // C.4 fullName — Фамилия Имя Отчество
  compute(m.fullName, () =>
    [model.personalData.lastName, model.personalData.firstName, model.personalData.middleName]
      .filter(Boolean)
      .join(' ')
  );

  // C.5 age — возраст из даты рождения
  compute(m.age, () => computeAge(model.personalData.birthDate));

  // C.6 totalIncome — основной + дополнительный доход
  compute(m.totalIncome, () => (model.monthlyIncome ?? 0) + (model.additionalIncome ?? 0));

  // C.7 paymentToIncomeRatio — платёж / доход, %
  compute(m.paymentToIncomeRatio, () => {
    const income = model.totalIncome ?? 0;
    if (income <= 0) return 0;
    return round2(((model.monthlyPayment ?? 0) / income) * 100);
  });

  // C.8 coBorrowersIncome — сумма доходов созаёмщиков (реактивно по массиву)
  compute(m.coBorrowersIncome, () =>
    model.coBorrowers.map((cb) => cb.monthlyIncome ?? 0).reduce((sum, v) => sum + v, 0)
  );

  // ===== Conditional visibility/availability (enableWhen) =====

  // ипотека
  enableWhen([m.propertyValue, m.initialPayment], () => model.loanType === 'mortgage', {
    resetOnDisable: true,
  });
  // автокредит
  enableWhen([m.carBrand, m.carModel, m.carYear, m.carPrice], () => model.loanType === 'car', {
    resetOnDisable: true,
  });
  // работа по найму
  enableWhen(
    [m.companyName, m.companyInn, m.companyPhone, m.companyAddress, m.position],
    () => model.employmentStatus === 'employed',
    { resetOnDisable: true }
  );
  // ИП / самозанятый
  enableWhen(
    [m.businessType, m.businessInn, m.businessActivity],
    () => model.employmentStatus === 'selfEmployed',
    {
      resetOnDisable: true,
    }
  );
  // адрес проживания (группа) — включается при отличии от регистрации
  enableWhen(m.residenceAddress, () => model.sameAsRegistration === false);

  // ===== Copy-from =====
  copyFrom(m.registrationAddress, m.residenceAddress, {
    when: () => model.sameAsRegistration === true,
  });
  copyFrom(m.email, m.emailAdditional, { when: () => model.sameEmail === true });

  // ===== Async options loading =====

  // carBrand → модели авто (+ сброс выбранной модели)
  onChange(
    m.carBrand,
    async (brand, { signal }) => {
      model.carModel = null;
      if (!brand) {
        form.carModel.updateComponentProps({ options: [] });
        return;
      }
      try {
        const options = await fetchCarModels(brand, { signal });
        form.carModel.updateComponentProps({ options });
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        form.carModel.updateComponentProps({ options: [] });
      }
    },
    { debounce: 300 }
  );

  // registrationAddress.region → города (+ сброс города)
  onChange(
    m.registrationAddress.region,
    async (region, { signal }) => {
      model.registrationAddress.city = '';
      if (!region) {
        form.registrationAddress.city.updateComponentProps({ options: [] });
        return;
      }
      try {
        const options = await fetchCitiesByRegion(region, { signal });
        form.registrationAddress.city.updateComponentProps({ options });
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        form.registrationAddress.city.updateComponentProps({ options: [] });
      }
    },
    { debounce: 300 }
  );

  // residenceAddress.region → города (+ сброс города)
  onChange(
    m.residenceAddress.region,
    async (region, { signal }) => {
      model.residenceAddress.city = '';
      if (!region) {
        form.residenceAddress.city.updateComponentProps({ options: [] });
        return;
      }
      try {
        const options = await fetchCitiesByRegion(region, { signal });
        form.residenceAddress.city.updateComponentProps({ options });
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        form.residenceAddress.city.updateComponentProps({ options: [] });
      }
    },
    { debounce: 300 }
  );

  // ===== Array management — очистка при снятии флага =====
  onChange(m.hasProperty, (has) => {
    if (!has) while (model.properties.length > 0) model.properties.removeAt(0);
  });
  onChange(m.hasExistingLoans, (has) => {
    if (!has) while (model.existingLoans.length > 0) model.existingLoans.removeAt(0);
  });
  onChange(m.hasCoBorrower, (has) => {
    if (!has) while (model.coBorrowers.length > 0) model.coBorrowers.removeAt(0);
  });
});
