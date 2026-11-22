// @reformer-form-build 3bc019b2b91070f5 собран из form.intent.json; правка руками отсоединит файл от сборки
/**
 * Поведение формы «Заявка на кредит» — связи над моделью и правила узлов схемы.
 * Скрытие узла НЕ убирает поле из модели: чтобы оно перестало валидироваться,
 * рядом нужен enableWhen.
 */
import {
  defineFormBehavior,
  compute,
  copyFrom,
  disableWhen,
  enableWhen,
  hideWhen,
  onChange,
  onComponentEvent,
  resetWhen,
} from '@reformer/core/behaviors';
import { submitApplication } from './api';
import type { CreditApplication } from './model';

export const formBehavior = defineFormBehavior<CreditApplication>(({ model, schema }) => {
  enableWhen(model.$.propertyValue, () => model.loanType === 'mortgage', { resetOnDisable: true });
  resetWhen(model.$.initialPayment, () => !(model.loanType === 'mortgage'), { resetValue: null });
  enableWhen(model.$.carBrand, () => model.loanType === 'car', { resetOnDisable: true });
  enableWhen(model.$.carModel, () => model.loanType === 'car', { resetOnDisable: true });
  enableWhen(model.$.carYear, () => model.loanType === 'car', { resetOnDisable: true });
  enableWhen(model.$.carPrice, () => model.loanType === 'car', { resetOnDisable: true });
  compute(
    model.$.initialPayment,
    () => (model.propertyValue == null ? null : Math.round(model.propertyValue * 0.2)),
    { when: () => model.loanType === 'mortgage' }
  );
  onChange(model.$.carBrand, () => {
    model.carModel = null;
  });
  onChange(model.$.registrationAddress.region, () => {
    model.registrationAddress.city = '';
  });
  enableWhen(model.$.companyName, () => model.employmentStatus === 'employed', {
    resetOnDisable: true,
  });
  enableWhen(model.$.companyInn, () => model.employmentStatus === 'employed', {
    resetOnDisable: true,
  });
  enableWhen(model.$.companyPhone, () => model.employmentStatus === 'employed', {
    resetOnDisable: true,
  });
  enableWhen(model.$.companyAddress, () => model.employmentStatus === 'employed', {
    resetOnDisable: true,
  });
  enableWhen(model.$.position, () => model.employmentStatus === 'employed', {
    resetOnDisable: true,
  });
  enableWhen(model.$.businessType, () => model.employmentStatus === 'selfEmployed', {
    resetOnDisable: true,
  });
  enableWhen(model.$.businessInn, () => model.employmentStatus === 'selfEmployed', {
    resetOnDisable: true,
  });
  enableWhen(model.$.businessActivity, () => model.employmentStatus === 'selfEmployed', {
    resetOnDisable: true,
  });
  disableWhen(model.$.residenceAddress, () => model.sameAsRegistration === true);
  copyFrom(model.$.registrationAddress.region, model.$.residenceAddress.region, {
    when: () => model.sameAsRegistration === true,
  });
  copyFrom(model.$.registrationAddress.city, model.$.residenceAddress.city, {
    when: () => model.sameAsRegistration === true,
  });
  copyFrom(model.$.registrationAddress.street, model.$.residenceAddress.street, {
    when: () => model.sameAsRegistration === true,
  });
  copyFrom(model.$.registrationAddress.house, model.$.residenceAddress.house, {
    when: () => model.sameAsRegistration === true,
  });
  copyFrom(model.$.registrationAddress.apartment, model.$.residenceAddress.apartment, {
    when: () => model.sameAsRegistration === true,
  });
  copyFrom(model.$.registrationAddress.postalCode, model.$.residenceAddress.postalCode, {
    when: () => model.sameAsRegistration === true,
  });
  copyFrom(model.$.email, model.$.emailAdditional, { when: () => model.sameEmail === true });
  onChange(model.$.hasProperty, (value) => {
    if (!value) model.properties.clear();
  });
  onChange(model.$.hasExistingLoans, (value) => {
    if (!value) model.existingLoans.clear();
  });
  onChange(model.$.hasCoBorrower, (value) => {
    if (!value) model.coBorrowers.clear();
  });
  compute(
    model.$.interestRate,
    () =>
      ((
        ({ consumer: 15, mortgage: 9, car: 12, business: 14, refinancing: 11 }) as Record<
          string,
          number
        >
      )[model.loanType ?? 'consumer'] ?? 15) -
      (model.hasProperty && model.properties.length > 0 ? 1 : 0)
  );
  compute(model.$.monthlyPayment, () =>
    (() => {
      const p = model.loanAmount ?? 0;
      const n = model.loanTerm ?? 0;
      const i = (model.interestRate ?? 0) / 100 / 12;
      if (!p || !n) return null;
      if (!i) return Math.round(p / n);
      const k = Math.pow(1 + i, n);
      return Math.round((p * (i * k)) / (k - 1));
    })()
  );
  compute(model.$.fullName, () =>
    [model.personalData.lastName, model.personalData.firstName, model.personalData.middleName]
      .filter(Boolean)
      .join(' ')
  );
  compute(model.$.age, () =>
    (() => {
      const s = model.personalData.birthDate as unknown as string;
      if (!s) return null;
      const b = new Date(s);
      if (isNaN(b.getTime())) return null;
      const t = new Date();
      let a = t.getFullYear() - b.getFullYear();
      const m = t.getMonth() - b.getMonth();
      if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
      return a;
    })()
  );
  compute(model.$.totalIncome, () => (model.monthlyIncome ?? 0) + (model.additionalIncome ?? 0));
  compute(model.$.paymentToIncomeRatio, () =>
    (model.totalIncome ?? 0) > 0 && model.monthlyPayment != null
      ? Math.round((model.monthlyPayment / (model.totalIncome as number)) * 100 * 10) / 10
      : null
  );
  compute(model.$.coBorrowersIncome, () =>
    model.coBorrowers.map((row) => row.monthlyIncome).reduce((sum, v) => sum + (v || 0), 0)
  );

  // Видимость узлов схемы — по `selector`.
  hideWhen(schema.node('mortgage-section'), () => model.loanType !== 'mortgage');
  hideWhen(schema.node('car-section'), () => model.loanType !== 'car');
  hideWhen(schema.node('employed-section'), () => model.employmentStatus !== 'employed');
  hideWhen(schema.node('self-section'), () => model.employmentStatus !== 'selfEmployed');
  hideWhen(schema.node('res-section'), () => model.sameAsRegistration === true);
  hideWhen(schema.node('properties-box'), () => !model.hasProperty);
  hideWhen(schema.node('loans-box'), () => !model.hasExistingLoans);
  hideWhen(schema.node('cob-box'), () => !model.hasCoBorrower);

  // События компонентов, эффекты рендера и хуки узлов схемы — по `selector`.
  onComponentEvent(schema.node('wizard'), 'onSubmit', async () => {
    await submitApplication(model.get());
  });
});
