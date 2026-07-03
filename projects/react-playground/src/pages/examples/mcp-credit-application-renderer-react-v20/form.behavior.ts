// form.behavior.ts — defineFormBehavior: compute (8) / enableWhen (conditional) / copyFrom (2) / onChange (async + array reset).
// Behavior operates on model.$.field signals; passed to createForm({ model, schema, behavior }).

import { defineFormBehavior } from '@reformer/core/behaviors';
import { compute, computeFrom, copyFrom, enableWhen, onChange } from '@reformer/core/behaviors';
import type { CreditApplicationForm } from './types';
import { fetchCarModelsByBrand, fetchCitiesByRegion } from './data-sources';

// ── Pure financial helpers ───────────────────────────────────────────────────
const BASE_RATE: Record<CreditApplicationForm['loanType'], number> = {
  consumer: 18.5,
  mortgage: 9.5,
  car: 12.5,
  business: 15,
  refinance: 11,
};

function computeInterestRate(
  loanType: CreditApplicationForm['loanType'],
  region: string,
  hasProperty: boolean,
  propertiesCount: number
): number {
  let rate = BASE_RATE[loanType] ?? 15;
  if (region === 'moscow' || region === 'spb') rate -= 0.5; // крупный регион
  if (hasProperty && propertiesCount > 0) rate -= 0.7; // залоговое обеспечение
  return Math.round(rate * 100) / 100;
}

function annuityMonthly(amount: number, termMonths: number, annualRatePct: number): number {
  if (!amount || !termMonths) return 0;
  const i = annualRatePct / 100 / 12;
  if (i <= 0) return Math.round(amount / termMonths);
  const pow = Math.pow(1 + i, termMonths);
  return Math.round((amount * (i * pow)) / (pow - 1));
}

function calcAge(birthDate: string): number | null {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) age -= 1;
  return age;
}

export const creditApplicationBehavior = defineFormBehavior<CreditApplicationForm>(
  ({ model, form }) => {
    // ── Conditional availability (enableWhen; skipped from validation while disabled) ──
    // mortgage
    enableWhen([model.$.propertyValue], () => model.loanType === 'mortgage', {
      resetOnDisable: true,
    });
    // car
    enableWhen(
      [model.$.carBrand, model.$.carModel, model.$.carYear, model.$.carPrice],
      () => model.loanType === 'car',
      { resetOnDisable: true }
    );
    // employed
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
    // self-employed
    enableWhen(
      [model.$.businessType, model.$.businessInn, model.$.businessActivity],
      () => model.employmentStatus === 'selfEmployed',
      { resetOnDisable: true }
    );
    // residence address — enabled only when it differs; NO resetOnDisable so copied value survives
    enableWhen(model.$.residenceAddress, () => model.sameAsRegistration === false);

    // ── Copy behaviors ───────────────────────────────────────────────────────
    copyFrom(model.$.registrationAddress, model.$.residenceAddress, {
      when: () => model.sameAsRegistration === true,
    });
    copyFrom(model.$.email, model.$.emailAdditional, {
      when: () => model.sameEmail === true,
      transform: (v) => (typeof v === 'string' ? v.trim() : v),
    });

    // ── Computed fields (C.1–C.8) ────────────────────────────────────────────
    // C.1 interestRate — loanType, region, hasProperty, properties
    compute(model.$.interestRate, () =>
      computeInterestRate(
        model.loanType,
        model.registrationAddress.region,
        model.hasProperty,
        model.properties.map(() => null).length
      )
    );
    // C.2 monthlyPayment — annuity(loanAmount, loanTerm, interestRate)
    computeFrom(
      [model.$.loanAmount, model.$.loanTerm, model.$.interestRate],
      model.$.monthlyPayment,
      (amount, term, rate) => annuityMonthly(amount ?? 0, term ?? 0, rate ?? 0)
    );
    // C.3 initialPayment — 20% of propertyValue (mortgage only)
    compute(model.$.initialPayment, () => Math.round((model.propertyValue ?? 0) * 0.2), {
      when: () => model.loanType === 'mortgage',
    });
    // C.4 fullName — concat ФИО
    compute(model.$.fullName, () =>
      [model.personalData.lastName, model.personalData.firstName, model.personalData.middleName]
        .filter(Boolean)
        .join(' ')
    );
    // C.5 age — from birthDate
    compute(model.$.age, () => calcAge(model.personalData.birthDate));
    // C.6 totalIncome — monthlyIncome + additionalIncome
    compute(model.$.totalIncome, () => (model.monthlyIncome ?? 0) + (model.additionalIncome ?? 0));
    // C.7 paymentToIncomeRatio — (monthlyPayment / totalIncome) * 100
    compute(model.$.paymentToIncomeRatio, () => {
      const income = model.totalIncome ?? 0;
      const payment = model.monthlyPayment ?? 0;
      if (income <= 0) return null;
      return Math.round((payment / income) * 100 * 100) / 100;
    });
    // C.8 coBorrowersIncome — sum over coBorrowers[].monthlyIncome
    compute(model.$.coBorrowersIncome, () =>
      model.coBorrowers.map((cb) => cb.monthlyIncome ?? 0).reduce((s, v) => s + v, 0)
    );

    // ── Async options loading (onChange + updateComponentProps) ───────────────
    onChange(
      model.$.registrationAddress.region,
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

    onChange(
      model.$.residenceAddress.region,
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

    // carBrand → carModel options (spec: async load, debounce 300ms; reset model on brand change)
    onChange(
      model.$.carBrand,
      async (brand, { signal }) => {
        model.carModel = null;
        if (!brand) {
          form.carModel.updateComponentProps({ options: [] });
          return;
        }
        try {
          const options = await fetchCarModelsByBrand(brand, { signal });
          form.carModel.updateComponentProps({ options });
        } catch (e) {
          if ((e as Error).name === 'AbortError') return;
          form.carModel.updateComponentProps({ options: [] });
        }
      },
      { debounce: 300 }
    );

    // ── Array toggles: clear the array when its checkbox is turned off ─────────
    const clearArray = (arr: { length: number; removeAt: (i: number) => void }) => {
      for (let i = arr.length - 1; i >= 0; i -= 1) arr.removeAt(i);
    };
    onChange(model.$.hasProperty, (has) => {
      if (!has) clearArray(model.properties);
    });
    onChange(model.$.hasExistingLoans, (has) => {
      if (!has) clearArray(model.existingLoans);
    });
    onChange(model.$.hasCoBorrower, (has) => {
      if (!has) clearArray(model.coBorrowers);
    });
  }
);
