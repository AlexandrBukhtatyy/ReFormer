/**
 * Поведение формы «Заявка на кредит» — единственное: и модель, и узлы схемы.
 *
 * - связи над моделью: вычисляемые поля, условная доступность, копирование, каскадные сбросы,
 *   асинхронные справочники и динамические лимиты;
 * - правила узлов схемы (`schema.node(selector)`): условная видимость секций, блокировка
 *   readonly-полей и режима просмотра, отправка по `onSubmit` визарда. Их исполняет рендерер.
 *
 * Поведение — фабрика от настроек страницы (режим, колбэки отправки); уходит полем `behavior`
 * в сборку `createForm({ model, schema, behavior, validation })`.
 *
 * Слой поведения НЕ владеет валидацией: единственный мост к раннеру — явный вызов
 * `validateModel` из `onChange` (живая проверка email с задержкой).
 */

import {
  compute,
  computeFrom,
  copyFrom,
  defineFormBehavior,
  enableWhen,
  hideWhen,
  onChange,
  onComponentEvent,
  onInit,
  resetWhen,
} from '@reformer/core/behaviors';
import { validateModel } from '@reformer/core/validation';

import { submitCreditApplication, type SubmitApplicationResult } from './api';
import { fetchCarModels, fetchCitiesByRegion } from './data-sources';
import {
  BASE_INTEREST_RATE,
  BORROWER_MAX_AGE,
  INITIAL_PAYMENT_SHARE,
  MAX_INCOME_YEARS,
  PREFERRED_REGIONS,
  type CreditApplicationForm,
  type FormMode,
} from './types';
import { emailLiveSchema } from './validation';

/** Настройки страницы, которые замыкает поведение. */
export type CreditBehaviorOptions = {
  /** Режим формы: в `view` все поля блокируются целиком. */
  mode: FormMode;
  onSubmitStart: () => void;
  onSubmitSuccess: (result: SubmitApplicationResult) => void;
  onSubmitError: (message: string) => void;
};

/** Поля, которые считаются поведением и не редактируются вручную. */
const READONLY_FIELDS = [
  'interestRate',
  'monthlyPayment',
  'initialPayment',
  'fullName',
  'age',
  'totalIncome',
  'paymentToIncomeRatio',
  'coBorrowersIncome',
] as const;

/** Аннуитетный платёж: P * (i * (1+i)^n) / ((1+i)^n − 1). */
export function annuityMonthly(amount: number, months: number, ratePercent: number): number {
  if (amount <= 0 || months <= 0) return 0;
  const i = ratePercent / 100 / 12;
  if (i <= 0) return Math.round(amount / months);
  const pow = Math.pow(1 + i, months);
  return Math.round((amount * (i * pow)) / (pow - 1));
}

/** Полных лет на текущую дату по строке `YYYY-MM-DD`. */
export function yearsSince(isoDate: string): number | null {
  if (!isoDate) return null;
  const birth = new Date(isoDate);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) years -= 1;
  return years;
}

const ABORTED = 'AbortError';

/**
 * Фабрика поведения. Замыкает настройки страницы, поэтому создаётся в `index.tsx` и передаётся в
 * `createForm({ behavior })`; смена режима пересобирает бандл целиком (`key` у формы).
 */
export const makeCreditApplicationBehavior = (options: CreditBehaviorOptions) =>
  defineFormBehavior<CreditApplicationForm>(({ model, form, schema }) => {
    // ------------------------------------------------------------------------------------
    // Вычисляемые поля
    // ------------------------------------------------------------------------------------

    // Ставка: база по типу кредита, скидка за «сильный» регион и за наличие имущества.
    // `.map(() => null).length` трекает только КОЛИЧЕСТВО строк массива, не их поля.
    compute(model.$.interestRate, () => {
      const base = BASE_INTEREST_RATE[model.loanType] ?? 18;
      const regionAdjust = PREFERRED_REGIONS.includes(model.registrationAddress.region)
        ? -0.5
        : 0.5;
      const propertyCount = model.properties.map(() => null).length;
      const propertyAdjust = model.hasProperty && propertyCount > 0 ? -1 : 0;
      return Math.max(5, Number((base + regionAdjust + propertyAdjust).toFixed(2)));
    });

    // Первоначальный взнос — 20 % стоимости, только для ипотеки.
    compute(
      model.$.initialPayment,
      () => Math.round((model.propertyValue ?? 0) * INITIAL_PAYMENT_SHARE),
      { when: () => model.loanType === 'mortgage' }
    );
    resetWhen(model.$.initialPayment, () => model.loanType !== 'mortgage', { resetValue: null });

    // Ежемесячный платёж — зависимости перечислены явно (спека C.2).
    computeFrom(
      [model.$.loanAmount, model.$.loanTerm, model.$.interestRate],
      model.$.monthlyPayment,
      (amount, term, rate) =>
        annuityMonthly(Number(amount ?? 0), Number(term ?? 0), Number(rate ?? 0))
    );

    compute(model.$.fullName, () =>
      [model.personalData.lastName, model.personalData.firstName, model.personalData.middleName]
        .filter(Boolean)
        .join(' ')
    );

    compute(model.$.age, () => yearsSince(model.personalData.birthDate));

    compute(model.$.totalIncome, () => (model.monthlyIncome ?? 0) + (model.additionalIncome ?? 0));

    compute(model.$.paymentToIncomeRatio, () => {
      const income = model.totalIncome ?? 0;
      if (income <= 0) return null;
      return Number((((model.monthlyPayment ?? 0) / income) * 100).toFixed(1));
    });

    // Агрегат по массиву — через value-proxy `model.coBorrowers.map(...)`:
    // читается и сигнал массива (структура), и поля каждого элемента.
    compute(model.$.coBorrowersIncome, () =>
      model.coBorrowers.map((cb) => cb.monthlyIncome ?? 0).reduce((sum, v) => sum + v, 0)
    );

    // ------------------------------------------------------------------------------------
    // Условная доступность (значение сбрасывается при выключении)
    // ------------------------------------------------------------------------------------

    enableWhen(model.$.propertyValue, () => model.loanType === 'mortgage', {
      resetOnDisable: true,
    });

    enableWhen(
      [model.$.carBrand, model.$.carModel, model.$.carYear, model.$.carPrice],
      () => model.loanType === 'car',
      { resetOnDisable: true }
    );

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

    enableWhen(
      [model.$.businessType, model.$.businessInn, model.$.businessActivity],
      () => model.employmentStatus === 'selfEmployed',
      { resetOnDisable: true }
    );

    // Групповой таргет: адрес проживания выключается целиком, значение сохраняется —
    // оно приходит копированием из адреса регистрации.
    enableWhen(model.$.residenceAddress, () => model.sameAsRegistration === false);

    // ------------------------------------------------------------------------------------
    // Копирование значений
    // ------------------------------------------------------------------------------------

    copyFrom(model.$.registrationAddress, model.$.residenceAddress, {
      when: () => model.sameAsRegistration === true,
    });

    copyFrom(model.$.email, model.$.emailAdditional, {
      when: () => model.sameEmail === true,
    });

    // ------------------------------------------------------------------------------------
    // Каскадные сбросы + асинхронные справочники
    // ------------------------------------------------------------------------------------

    onChange(
      model.$.carBrand,
      async (brand, { signal }) => {
        model.carModel = null;
        if (!brand) {
          form.carModel.updateComponentProps({ options: [] });
          return;
        }
        try {
          const options = await fetchCarModels(brand, { signal });
          form.carModel.updateComponentProps({ options });
        } catch (error) {
          if ((error as Error).name === ABORTED) return;
          form.carModel.updateComponentProps({ options: [] });
        }
      },
      { debounce: 300 }
    );

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
        } catch (error) {
          if ((error as Error).name === ABORTED) return;
          form.registrationAddress.city.updateComponentProps({ options: [] });
        }
      },
      { debounce: 300 }
    );

    onChange(
      model.$.residenceAddress.region,
      async (region, { signal }) => {
        if (model.sameAsRegistration) return;
        model.residenceAddress.city = '';
        if (!region) {
          form.residenceAddress.city.updateComponentProps({ options: [] });
          return;
        }
        try {
          const options = await fetchCitiesByRegion(region, { signal });
          form.residenceAddress.city.updateComponentProps({ options });
        } catch (error) {
          if ((error as Error).name === ABORTED) return;
          form.residenceAddress.city.updateComponentProps({ options: [] });
        }
      },
      { debounce: 300 }
    );

    // ------------------------------------------------------------------------------------
    // Очистка массивов при снятии флагов (колбэк идёт вне effect-контекста — мутация безопасна)
    // ------------------------------------------------------------------------------------

    onChange(model.$.hasProperty, (on) => {
      if (!on) model.properties.clear();
    });

    onChange(model.$.hasExistingLoans, (on) => {
      if (!on) model.existingLoans.clear();
    });

    onChange(model.$.hasCoBorrower, (on) => {
      if (!on) model.coBorrowers.clear();
    });

    // ------------------------------------------------------------------------------------
    // Динамические лимиты полей
    // ------------------------------------------------------------------------------------

    onChange(
      model.$.totalIncome,
      (income) => {
        const limit = Math.min(10_000_000, Math.max(50_000, (income ?? 0) * 12 * MAX_INCOME_YEARS));
        form.loanAmount.updateComponentProps({ max: limit });
      },
      { immediate: true }
    );

    onChange(
      model.$.age,
      (age) => {
        const maxMonths =
          age == null ? 240 : Math.max(6, Math.min(240, (BORROWER_MAX_AGE - age) * 12));
        form.loanTerm.updateComponentProps({ max: maxMonths });
      },
      { immediate: true }
    );

    // ------------------------------------------------------------------------------------
    // Живая проверка формата email с задержкой 500 мс
    // ------------------------------------------------------------------------------------

    onChange(
      model.$.email,
      () => {
        void validateModel(model, emailLiveSchema);
      },
      { debounce: 500 }
    );

    // ------------------------------------------------------------------------------------
    // Правила узлов схемы: условная видимость. Условие читает модель — оно реактивно и
    // пересчитывается при изменении прочитанных значений.
    // ------------------------------------------------------------------------------------

    hideWhen(schema.node('mortgage-section'), () => model.loanType !== 'mortgage');
    hideWhen(schema.node('car-section'), () => model.loanType !== 'car');
    hideWhen(schema.node('employed-section'), () => model.employmentStatus !== 'employed');
    hideWhen(schema.node('self-employed-section'), () => model.employmentStatus !== 'selfEmployed');
    hideWhen(schema.node('residence-section'), () => model.sameAsRegistration === true);
    hideWhen(schema.node('properties-array'), () => model.hasProperty !== true);
    hideWhen(schema.node('loans-array'), () => model.hasExistingLoans !== true);
    hideWhen(schema.node('loans-hint'), () => model.hasExistingLoans !== true);
    hideWhen(schema.node('coborrowers-array'), () => model.hasCoBorrower !== true);
    hideWhen(schema.node('coBorrowersIncome'), () => model.hasCoBorrower !== true);
    hideWhen(schema.node('additionalIncomeSource'), () => (model.additionalIncome ?? 0) <= 0);

    // ------------------------------------------------------------------------------------
    // Блокировки. Глобального `settings.readonly` нет; единственный рычаг — состояние
    // ноды (`disable()`): `componentProps.disabled` затирается seam-ом и не работает.
    // `onInit` синхронный и срабатывает до первого рендера; стоит после связей над моделью —
    // в том же порядке, в каком правила узлов шли раньше.
    // ------------------------------------------------------------------------------------

    onInit(schema.node('wizard'), () => {
      if (options.mode === 'view') {
        form.disable();
        return;
      }
      for (const field of READONLY_FIELDS) {
        form[field].disable();
      }
    });

    // ------------------------------------------------------------------------------------
    // Отправка. Визард зовёт `onSubmit` только после успешной проверки всей формы и передаёт
    // значения; при провале проверки он сам помечает поля `touched`, обработчик не вызывается.
    // ------------------------------------------------------------------------------------

    onComponentEvent(schema.node('wizard'), 'onSubmit', async (values: CreditApplicationForm) => {
      if (options.mode === 'view') return;
      options.onSubmitStart();
      try {
        options.onSubmitSuccess(await submitCreditApplication(values));
      } catch (error) {
        options.onSubmitError(
          error instanceof Error ? error.message : 'Не удалось отправить заявку.'
        );
      }
    });
  });
