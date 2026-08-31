/**
 * Поведение МОДЕЛИ: вычисляемые поля, копирование, условная доступность,
 * каскадные сбросы и асинхронная подгрузка справочников.
 *
 * Реактивность РЕНДЕРА (hideWhen / patchProps / onInit) живёт отдельно —
 * в `renderer.behavior.ts`.
 */
import {
  compute,
  computeFrom,
  copyFrom,
  defineFormBehavior,
  enableWhen,
  onChange,
} from '@reformer/core/behaviors';

import { loadCarModels, loadCities, maxLoanByIncome, maxTermByAge } from './data-sources';
import { BASE_RATES, PREFERENTIAL_REGIONS, type CreditApplicationForm } from './types';

type Form = CreditApplicationForm;

const ADDRESS_FIELDS = ['region', 'city', 'street', 'house', 'apartment', 'postalCode'] as const;

/** C.2 — аннуитетный платёж: P * (i * (1+i)^n) / ((1+i)^n - 1). */
export function annuityPayment(amount: number, months: number, annualRate: number): number | null {
  if (!amount || !months || !annualRate) return null;
  const i = annualRate / 100 / 12;
  const pow = Math.pow(1 + i, months);
  const value = (amount * (i * pow)) / (pow - 1);
  return Number.isFinite(value) ? Math.round(value) : null;
}

/** C.5 — полных лет на текущую дату. */
export function ageFromBirthDate(birthDate: string): number | null {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  const monthDiff = now.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < born.getDate())) years -= 1;
  return years;
}

/** C.1 — ставка от типа кредита, региона регистрации и наличия имущества. */
export function calcInterestRate(
  loanType: string,
  region: string,
  hasProperty: boolean,
  propertyCount: number
): number {
  let rate = BASE_RATES[loanType] ?? 16;
  if (PREFERENTIAL_REGIONS.includes(region)) rate -= 0.5;
  if (hasProperty && propertyCount > 0) rate -= Math.min(1.5, propertyCount * 0.5);
  return Math.round(rate * 100) / 100;
}

export const creditFormBehavior = defineFormBehavior<Form>(({ model, form }) => {
  /* ---------------- условные поля (спека: «Условные поля») ---------------- */

  enableWhen(model.$.propertyValue, () => model.loanType === 'mortgage', {
    resetOnDisable: true,
  });

  const carFields = [model.$.carBrand, model.$.carModel, model.$.carYear, model.$.carPrice];
  for (const sig of carFields) {
    enableWhen(sig, () => model.loanType === 'car', { resetOnDisable: true });
  }

  const employedFields = [
    model.$.companyName,
    model.$.companyInn,
    model.$.companyPhone,
    model.$.companyAddress,
    model.$.position,
  ];
  for (const sig of employedFields) {
    enableWhen(sig, () => model.employmentStatus === 'employed', { resetOnDisable: true });
  }

  const selfEmployedFields = [model.$.businessType, model.$.businessInn, model.$.businessActivity];
  for (const sig of selfEmployedFields) {
    enableWhen(sig, () => model.employmentStatus === 'selfEmployed', { resetOnDisable: true });
  }

  // Адрес проживания: доступен только когда он отличается от адреса регистрации.
  // `resetOnDisable` НЕ ставим — «сброс» здесь делает копирование ниже.
  for (const field of ADDRESS_FIELDS) {
    enableWhen(model.$.residenceAddress[field], () => model.sameAsRegistration === false);
  }

  /* ---------------- копирование ---------------- */

  for (const field of ADDRESS_FIELDS) {
    copyFrom(model.$.registrationAddress[field], model.$.residenceAddress[field], {
      when: () => model.sameAsRegistration === true,
    });
  }

  copyFrom(model.$.email, model.$.emailAdditional, { when: () => model.sameEmail === true });

  /* ---------------- вычисляемые поля ---------------- */

  // C.1 — ставка. Auto-tracking: читаем loanType, регион, флаг и ДЛИНУ массива.
  compute(model.$.interestRate, () =>
    calcInterestRate(
      model.loanType,
      model.registrationAddress.region,
      model.hasProperty,
      model.properties.map(() => null).length
    )
  );

  // C.2 — ежемесячный платёж (аннуитет).
  computeFrom(
    [model.$.loanAmount, model.$.loanTerm, model.$.interestRate],
    model.$.monthlyPayment,
    (amount, term, rate) =>
      annuityPayment(Number(amount ?? 0), Number(term ?? 0), Number(rate ?? 0))
  );

  // C.3 — первоначальный взнос = 20 % стоимости; вне ипотеки поле обнуляется.
  compute(model.$.initialPayment, () =>
    model.loanType === 'mortgage' ? Math.round((model.propertyValue ?? 0) * 0.2) : null
  );

  // C.4 — ФИО одной строкой.
  compute(model.$.fullName, () =>
    [model.personalData.lastName, model.personalData.firstName, model.personalData.middleName]
      .filter(Boolean)
      .join(' ')
  );

  // C.5 — возраст.
  compute(model.$.age, () => ageFromBirthDate(model.personalData.birthDate));

  // C.6 — общий доход.
  computeFrom(
    [model.$.monthlyIncome, model.$.additionalIncome],
    model.$.totalIncome,
    (main, extra) => Number(main ?? 0) + Number(extra ?? 0)
  );

  // C.7 — доля платежа в доходе.
  computeFrom(
    [model.$.monthlyPayment, model.$.totalIncome],
    model.$.paymentToIncomeRatio,
    (payment, income) => {
      const total = Number(income ?? 0);
      if (!total) return null;
      return Math.round(((Number(payment ?? 0) / total) * 100 + Number.EPSILON) * 10) / 10;
    }
  );

  // C.8 — сумма доходов созаемщиков: читаем value-proxy массива (реактивно и на
  // добавление/удаление строк, и на правку поля внутри строки).
  compute(model.$.coBorrowersIncome, () =>
    model.coBorrowers.map((cb) => cb.monthlyIncome ?? 0).reduce((sum, v) => sum + v, 0)
  );

  /* ---------------- каскадные сбросы + async-справочники ---------------- */

  // Первый прогон (`immediate: true`) нужен, чтобы справочник подгрузился и для
  // ПРЕДЗАПОЛНЕННОЙ заявки; зависимое поле при этом чистить нельзя — иначе
  // предзаполненное значение потеряется. Дальше срабатывает обычная логика
  // «сменил источник → очистил зависимое».
  let carBrandFirstRun = true;
  let regionFirstRun = true;
  let residenceRegionFirstRun = true;

  // Смена марки: чистим модель и подгружаем список моделей (debounce 300 мс).
  onChange(
    model.$.carBrand,
    async (brand, { signal }) => {
      const isInitial = carBrandFirstRun;
      carBrandFirstRun = false;
      if (!isInitial) model.carModel = null;
      if (!brand) {
        form.carModel.updateComponentProps({ options: [] });
        return;
      }
      form.carModel.updateComponentProps({ options: [], placeholder: 'Загрузка…' });
      try {
        const options = await loadCarModels(brand, signal);
        form.carModel.updateComponentProps({ options, placeholder: 'Выберите модель' });
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        form.carModel.updateComponentProps({ options: [], placeholder: 'Не удалось загрузить' });
      }
    },
    { debounce: 300, immediate: true }
  );

  // Смена региона регистрации: чистим город и подгружаем справочник городов.
  onChange(
    model.$.registrationAddress.region,
    async (region, { signal }) => {
      const isInitial = regionFirstRun;
      regionFirstRun = false;
      if (!isInitial) model.registrationAddress.city = '';
      if (!region) {
        form.registrationAddress.city.updateComponentProps({ options: [] });
        return;
      }
      form.registrationAddress.city.updateComponentProps({ options: [], placeholder: 'Загрузка…' });
      try {
        const options = await loadCities(region, signal);
        form.registrationAddress.city.updateComponentProps({
          options,
          placeholder: 'Выберите город',
        });
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        form.registrationAddress.city.updateComponentProps({
          options: [],
          placeholder: 'Не удалось загрузить',
        });
      }
    },
    { debounce: 300, immediate: true }
  );

  // То же для адреса проживания. Справочник грузим ВСЕГДА (в т.ч. когда регион
  // приехал копированием), а зависимый город чистим только когда пользователь
  // правит адрес проживания сам.
  onChange(
    model.$.residenceAddress.region,
    async (region, { signal }) => {
      const isInitial = residenceRegionFirstRun;
      residenceRegionFirstRun = false;
      if (!isInitial && !model.sameAsRegistration) model.residenceAddress.city = '';
      if (!region) {
        form.residenceAddress.city.updateComponentProps({ options: [] });
        return;
      }
      form.residenceAddress.city.updateComponentProps({ options: [], placeholder: 'Загрузка…' });
      try {
        const options = await loadCities(region, signal);
        form.residenceAddress.city.updateComponentProps({ options, placeholder: 'Выберите город' });
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        form.residenceAddress.city.updateComponentProps({
          options: [],
          placeholder: 'Не удалось загрузить',
        });
      }
    },
    { debounce: 300, immediate: true }
  );

  /* ---------------- управление массивами по флагам ---------------- */

  onChange(model.$.hasProperty, (on) => {
    if (!on) model.properties.clear();
  });
  onChange(model.$.hasExistingLoans, (on) => {
    if (!on) model.existingLoans.clear();
  });
  onChange(model.$.hasCoBorrower, (on) => {
    if (!on) model.coBorrowers.clear();
  });

  /* ---------------- динамические лимиты ---------------- */

  onChange(
    model.$.totalIncome,
    (income) => {
      form.loanAmount.updateComponentProps({ max: maxLoanByIncome(Number(income ?? 0)) });
    },
    { immediate: true }
  );

  onChange(
    model.$.age,
    (age) => {
      form.loanTerm.updateComponentProps({ max: maxTermByAge(Number(age ?? 0)) });
    },
    { immediate: true }
  );
});
