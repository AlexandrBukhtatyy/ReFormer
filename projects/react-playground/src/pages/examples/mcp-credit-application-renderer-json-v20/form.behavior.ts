// form.behavior.ts — model behavior: computed fields, conditional enable/reset,
// copy-from, cascade resets, async dependent options. Reused across all targets.

import {
  compute,
  copyFrom,
  defineFormBehavior,
  enableWhen,
  onChange,
} from '@reformer/core/behaviors';
import type { CreditApplicationForm, LoanType } from './types';
import { loadCarModels, loadCities } from './data-sources';

const BASE_RATE: Record<LoanType, number> = {
  consumer: 15,
  mortgage: 9,
  car: 11,
  business: 14,
  refinancing: 12,
};

function computeAge(birthDate: string): number {
  if (!birthDate) return 0;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age < 0 ? 0 : age;
}

/** Annuity payment: P * (i(1+i)^n) / ((1+i)^n − 1). */
function annuity(principal: number, months: number, annualPct: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const i = annualPct / 100 / 12;
  if (i === 0) return Math.round(principal / months);
  const pow = Math.pow(1 + i, months);
  return Math.round((principal * (i * pow)) / (pow - 1));
}

export const creditBehavior = defineFormBehavior<CreditApplicationForm>(({ model, form }) => {
  // ---- Computed fields (C.1–C.8) --------------------------------------

  // C.1 interestRate — by loan type, region, collateral.
  compute(model.$.interestRate, () => {
    let rate = BASE_RATE[model.loanType] ?? 15;
    const region = model.registrationAddress?.region;
    if (region === 'moscow' || region === 'spb') rate -= 0.5;
    if (model.hasProperty && (model.properties?.length ?? 0) > 0) rate -= 1;
    return Math.max(Math.round(rate * 100) / 100, 1);
  });

  // C.2 monthlyPayment — annuity of amount / term / rate.
  compute(model.$.monthlyPayment, () =>
    annuity(model.loanAmount ?? 0, model.loanTerm ?? 0, model.interestRate ?? 0)
  );

  // C.3 initialPayment — 20% of property value (mortgage only).
  compute(model.$.initialPayment, () => Math.round((model.propertyValue ?? 0) * 0.2), {
    when: () => model.loanType === 'mortgage',
  });

  // C.4 fullName — concat surname + name + patronymic.
  compute(model.$.fullName, () => {
    const p = model.personalData;
    return [p?.lastName, p?.firstName, p?.middleName].filter(Boolean).join(' ').trim();
  });

  // C.5 age — from birth date.
  compute(model.$.age, () => computeAge(model.personalData?.birthDate ?? ''));

  // C.6 totalIncome — main + additional.
  compute(model.$.totalIncome, () => (model.monthlyIncome ?? 0) + (model.additionalIncome ?? 0));

  // C.7 paymentToIncomeRatio — monthlyPayment / totalIncome, %.
  compute(model.$.paymentToIncomeRatio, () => {
    const income = model.totalIncome ?? 0;
    if (income <= 0) return 0;
    return Math.round(((model.monthlyPayment ?? 0) / income) * 1000) / 10;
  });

  // C.8 coBorrowersIncome — sum of co-borrowers' incomes (reactive iteration).
  compute(model.$.coBorrowersIncome, () => {
    let sum = 0;
    model.coBorrowers.forEach((cb) => {
      sum += cb.monthlyIncome ?? 0;
    });
    return sum;
  });

  // ---- Conditional fields (enable + reset on disable) -----------------

  // Mortgage-only.
  enableWhen([model.$.propertyValue, model.$.initialPayment], () => model.loanType === 'mortgage', {
    resetOnDisable: true,
  });

  // Car-loan-only.
  enableWhen(
    [model.$.carBrand, model.$.carModel, model.$.carYear, model.$.carPrice],
    () => model.loanType === 'car',
    { resetOnDisable: true }
  );

  // Employed-only.
  enableWhen(
    [
      model.$.companyName,
      model.$.companyInn,
      model.$.companyPhone,
      model.$.companyAddress,
      model.$.position,
    ],
    () => model.employmentStatus === 'employed',
    { resetOnDisable: true }
  );

  // Self-employed-only.
  enableWhen(
    [model.$.businessType, model.$.businessInn, model.$.businessActivity],
    () => model.employmentStatus === 'selfEmployed',
    { resetOnDisable: true }
  );

  // Residence address group — enabled only when it differs from registration.
  enableWhen(model.$.residenceAddress, () => model.sameAsRegistration === false);

  // ---- Copy-from (conditional mirroring) ------------------------------

  // emailAdditional mirrors email while `sameEmail` is set.
  compute(model.$.emailAdditional, () => model.email, {
    when: () => model.sameEmail === true,
  });

  // residenceAddress mirrors registrationAddress while `sameAsRegistration`.
  const mirror = (src: keyof CreditApplicationForm['registrationAddress']) =>
    copyFrom(model.$.registrationAddress[src], model.$.residenceAddress[src], {
      when: () => model.sameAsRegistration === true,
    });
  mirror('region');
  mirror('city');
  mirror('street');
  mirror('house');
  mirror('apartment');
  mirror('postalCode');

  // ---- Cascade resets on controlling fields ---------------------------

  // Loan type switch clears type-specific fields.
  onChange(model.$.loanType, (type) => {
    if (type !== 'mortgage') model.propertyValue = null;
    if (type !== 'car') {
      model.carBrand = null;
      model.carModel = null;
      model.carYear = null;
      model.carPrice = null;
    }
  });

  // Array toggles clear their arrays when unchecked.
  onChange(model.$.hasProperty, (has) => {
    if (!has) model.properties.clear();
  });
  onChange(model.$.hasExistingLoans, (has) => {
    if (!has) model.existingLoans.clear();
  });
  onChange(model.$.hasCoBorrower, (has) => {
    if (!has) model.coBorrowers.clear();
  });

  // ---- Async dependent options ----------------------------------------

  // Car brand → reset model + load models (debounced, abortable).
  onChange(
    model.$.carBrand,
    async (brand, { signal }) => {
      model.carModel = null;
      if (model.loanType !== 'car' || !brand) return;
      try {
        const options = await loadCarModels(brand, signal);
        form.carModel.updateComponentProps({ options });
      } catch {
        /* aborted — superseded by a newer change */
      }
    },
    { debounce: 300 }
  );

  // Registration region → reset city + load cities.
  onChange(
    model.$.registrationAddress.region,
    async (region, { signal }) => {
      model.registrationAddress.city = '';
      if (!region) return;
      try {
        const options = await loadCities(region, signal);
        form.registrationAddress.city.updateComponentProps({ options });
      } catch {
        /* aborted */
      }
    },
    { debounce: 300 }
  );

  // Residence region → load cities (only when address differs).
  onChange(
    model.$.residenceAddress.region,
    async (region, { signal }) => {
      if (model.sameAsRegistration || !region) return;
      model.residenceAddress.city = '';
      try {
        const options = await loadCities(region, signal);
        form.residenceAddress.city.updateComponentProps({ options });
      } catch {
        /* aborted */
      }
    },
    { debounce: 300 }
  );
});
