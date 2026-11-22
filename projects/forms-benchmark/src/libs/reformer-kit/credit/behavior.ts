/**
 * Поведение кредитной заявки для обеих ReFormer-реализаций — порт `behavior/` эталонного демо
 * (`complex-multy-step-form`) на общий домен и общий API-клиент:
 *
 * - вычисляемые C.1–C.8 — `compute` (20-compute-vs-watch.md), формулы — `shared/domain/credit`;
 * - условные поля — `enableWhen(…, { resetOnDisable: true })`: выключенное поле не проверяется и
 *   возвращается к начальному значению (18-conditional-fields.md);
 * - копии — `copyFrom` с `when` (23-copy-from.md), при снятии флага цель — к начальному значению;
 * - сброс зависимых и подгрузка опций — `onChange` (32-async-options-loading.md); debounce и кэш —
 *   в общем клиенте (`creditApi`), своих нет;
 * - флаг массива: включение — одна пустая строка по шаблону `arrayOf`, выключение — `clear()`
 *   (10-arrays.md);
 *
 * Справочники (регионы, типы имущества) поведение не раздаёт: они сигналами в `componentProps`
 * схемы (./form.ts). Живая проверка шага после «Далее» — опция сборки `liveAfterStep`.
 *
 * Скрытие узлов разметки (`hideWhen`) — дело рендерера, оно в JSON-варианте; JSX читает те же
 * предикаты из `shared/domain/credit`.
 */
import type { FormArray } from '@reformer/core';
import {
  apply,
  compute,
  copyFrom,
  defineFormBehavior,
  enableWhen,
  onChange,
  type BehaviorScope,
  type ReadonlySignal,
} from '@reformer/core/behaviors';
import {
  computeAge,
  computeCoBorrowersIncome,
  computeFullName,
  computeInitialPayment,
  computeInterestRate,
  computeMonthlyPayment,
  computePaymentToIncomeRatio,
  computeTotalIncome,
  isCarLoan,
  isEmployed,
  isMortgage,
  isSelfEmployed,
  livesElsewhere,
  type CreditAddress,
  type CreditValues,
} from '../../../shared/domain/credit';
import { creditApi } from '../../../shared/api/credit-client';

/** Адрес: города по региону; смена региона пользователем очищает город. */
const addressBehavior = defineFormBehavior<CreditAddress>(({ model, form }) => {
  onChange(
    model.$.region,
    async (region, { signal: aborted }) => {
      const options = await creditApi.getCities(region);
      if (!aborted.aborted) form.city.updateComponentProps({ options });
    },
    { immediate: true }
  );
  // Регион, пришедший в пустое поле, — заполнение (копия адреса регистрации): город приходит с ним.
  let previous = model.region;
  onChange(model.$.region, (region) => {
    if (previous && region !== previous) model.city = '';
    previous = region;
  });
});

/** Флаг массива: включение — одна пустая строка (шаблон `arrayOf`), выключение — очистка. */
function rowsByFlag(flag: ReadonlySignal<boolean>, rows: FormArray<object>): void {
  onChange(flag, (on) => (on ? rows.push() : rows.clear()));
}

/** Тело поведения — функцией, чтобы JSON-вариант добавил к нему свои правила узлов. */
export function creditRules({ model, form }: BehaviorScope<CreditValues>) {
  // ── Вычисляемые C.1–C.8 ──
  compute(model.$.interestRate, () =>
    computeInterestRate(
      model.loanType,
      model.registrationAddress.region,
      model.hasProperty,
      model.properties.length
    )
  );
  compute(model.$.monthlyPayment, () =>
    computeMonthlyPayment(model.loanAmount, model.loanTerm, model.interestRate)
  );
  compute(model.$.initialPayment, () => computeInitialPayment(model.loanType, model.propertyValue));
  compute(model.$.fullName, () => computeFullName(model.personalData));
  compute(model.$.age, () => computeAge(model.personalData.birthDate));
  compute(model.$.totalIncome, () =>
    computeTotalIncome(model.monthlyIncome, model.additionalIncome)
  );
  compute(model.$.paymentToIncomeRatio, () =>
    computePaymentToIncomeRatio(model.monthlyPayment, model.totalIncome)
  );
  compute(model.$.coBorrowersIncome, () =>
    computeCoBorrowersIncome(model.coBorrowers.map((row) => ({ monthlyIncome: row.monthlyIncome })))
  );

  // ── Условные поля ──
  const reset = { resetOnDisable: true };
  enableWhen(model.$.propertyValue, () => isMortgage(model.loanType), reset);
  enableWhen(
    [model.$.carBrand, model.$.carModel, model.$.carYear, model.$.carPrice],
    () => isCarLoan(model.loanType),
    reset
  );
  enableWhen(
    [
      model.$.companyName,
      model.$.companyInn,
      model.$.companyPhone,
      model.$.companyAddress,
      model.$.position,
    ],
    () => isEmployed(model.employmentStatus),
    reset
  );
  enableWhen(
    [model.$.businessType, model.$.businessInn, model.$.businessActivity],
    () => isSelfEmployed(model.employmentStatus),
    reset
  );
  // Адрес проживания — копия адреса регистрации, пока флаг стоит: выключение без сброса.
  enableWhen(model.$.residenceAddress, () => livesElsewhere(model.sameAsRegistration));

  // ── Копии ──
  copyFrom(model.$.email, model.$.emailAdditional, { when: () => model.sameEmail });
  onChange(
    model.$.sameEmail,
    (same) => form.emailAdditional.updateComponentProps({ readOnly: same }),
    { immediate: true }
  );
  onChange(model.$.sameEmail, (same) => {
    if (!same) form.emailAdditional.reset();
  });
  copyFrom(model.$.registrationAddress, model.$.residenceAddress, {
    when: () => model.sameAsRegistration,
  });
  onChange(model.$.sameAsRegistration, (same) => {
    if (!same) form.residenceAddress.reset();
  });

  // ── Зависимые: модель по марке, города по региону ──
  onChange(model.$.carBrand, () => {
    model.carModel = '';
  });
  onChange(
    model.$.carBrand,
    async (brand, { signal: aborted }) => {
      const options = await creditApi.getCarModels(brand);
      if (options && !aborted.aborted) form.carModel.updateComponentProps({ options });
    },
    { immediate: true }
  );
  apply([model.$.registrationAddress, model.$.residenceAddress], addressBehavior);

  // ── Массивы по флагам ──
  rowsByFlag(model.$.hasProperty, form.properties as FormArray<object>);
  rowsByFlag(model.$.hasExistingLoans, form.existingLoans as FormArray<object>);
  rowsByFlag(model.$.hasCoBorrower, form.coBorrowers as FormArray<object>);
}

/** Поведение формы для JSX-варианта. */
export const creditBehavior = defineFormBehavior<CreditValues>(creditRules);
