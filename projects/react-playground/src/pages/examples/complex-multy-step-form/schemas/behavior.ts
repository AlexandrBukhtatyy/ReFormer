/**
 * M1: реактивное поведение кредитной заявки — декларативная схема (`@reformer/core/behaviors`).
 *
 * Свободные операторы (compute/copyFrom/enableWhen/onChange/apply) сами регистрируются в схеме;
 * массива cleanup'ов и ручного управления жизненным циклом нет. Подключается через
 * `createForm({ behavior })` — форма владеет lifecycle.
 *
 * Гибрид по природе: value-операции (compute/copyFrom) пишут сигналы модели (`model.$`),
 * state/UI-операции (enableWhen, reset/clear/updateComponentProps) — ноды формы (`form.*`).
 */

import {
  defineFormBehavior,
  compute,
  copyFrom,
  enableWhen,
  onChange,
  apply,
} from '@reformer/core/behaviors';
import type { CreditApplicationForm } from '../types/credit-application';
import type { PersonalData } from '../components/nested-forms/PersonalData/types';
import type { CoBorrower } from '../components/nested-forms/CoBorrower/types';
import { addressBehavior } from '../components/nested-forms/Address/address-behavior';
import { loadOptionsOn, clearWhenOff } from './operators';
import {
  computeInterestRate,
  computeMonthlyPayment,
  computeInitialPayment,
  computeFullName,
  computeAge,
  computeTotalIncome,
  computePaymentRatio,
  computeCoBorrowersIncome,
} from '../utils';
import { fetchCarModels } from '../api';

export const creditApplicationBehavior = defineFormBehavior<CreditApplicationForm>(
  ({ model, form }) => {
    // ===================================================================
    // 1. compute — вычисляемые поля (auto-tracking)
    // ===================================================================
    compute(model.$.interestRate, () =>
      computeInterestRate({
        loanType: model.loanType,
        registrationAddress: { region: model.registrationAddress.region },
        hasProperty: model.hasProperty,
        // .map подписывает на изменение длины массива (нужен только count)
        properties: model.properties.map(() => null),
      })
    );
    compute(model.$.monthlyPayment, () => computeMonthlyPayment(model));
    // Первоначальный взнос (20% стоимости) — только для ипотеки
    compute(
      model.$.initialPayment,
      () => computeInitialPayment({ propertyValue: model.propertyValue }),
      {
        when: () => model.loanType === 'mortgage',
      }
    );
    compute(model.$.fullName, () =>
      computeFullName({
        personalData: model.personalData as PersonalData,
      })
    );
    compute(model.$.age, () =>
      computeAge({ personalData: { birthDate: model.personalData.birthDate } as PersonalData })
    );
    compute(model.$.coBorrowersIncome, () =>
      computeCoBorrowersIncome({
        coBorrowers: model.coBorrowers.map((cb) => ({
          monthlyIncome: cb.monthlyIncome,
        })) as CoBorrower[],
      })
    );
    compute(model.$.totalIncome, () =>
      computeTotalIncome({
        monthlyIncome: model.monthlyIncome,
        additionalIncome: model.additionalIncome,
        coBorrowersIncome: model.coBorrowersIncome,
      })
    );
    compute(model.$.paymentToIncomeRatio, () =>
      computePaymentRatio({
        monthlyPayment: model.monthlyPayment,
        totalIncome: model.totalIncome,
      })
    );

    // ===================================================================
    // 2. copyFrom — копирование значений (скаляр + группа)
    // ===================================================================
    copyFrom(model.$.email, model.$.emailAdditional, { when: () => model.sameEmail === true });
    copyFrom(model.$.registrationAddress, model.$.residenceAddress, {
      when: () => model.sameAsRegistration === true,
    });

    // ===================================================================
    // 3. enableWhen — условные поля (массив целей; группа residence)
    // ===================================================================
    enableWhen(
      [model.$.propertyValue, model.$.initialPayment],
      () => model.loanType === 'mortgage',
      {
        resetOnDisable: true,
      }
    );
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
    // Адрес проживания — группа: enable/disable без сброса (значение копируется из адреса регистрации)
    enableWhen(model.$.residenceAddress, () => model.sameAsRegistration === false);

    // ===================================================================
    // 4. Реакции — загрузка справочников / лимиты / очистка массивов
    // ===================================================================
    loadOptionsOn(model.$.carBrand, form.carModel, fetchCarModels, { resetTarget: true });

    // Максимальная сумма кредита от дохода (≤ 10 годовых, не более 10 млн)
    onChange(model.$.totalIncome, (totalIncome) => {
      if (totalIncome && totalIncome > 0) {
        form.loanAmount.updateComponentProps({ max: Math.min(totalIncome * 12 * 10, 10_000_000) });
      }
    });
    // Максимальный срок с учётом возраста (погашение до 70 лет)
    onChange(model.$.age, (age) => {
      if (age && age >= 18) {
        form.loanTerm.updateComponentProps({ max: Math.min(Math.max(70 - age, 1) * 12, 240) });
      }
    });

    clearWhenOff(model.$.hasProperty, form.properties);
    clearWhenOff(model.$.hasExistingLoans, form.existingLoans);
    clearWhenOff(model.$.hasCoBorrower, form.coBorrowers);

    // ===================================================================
    // 5. Под-схема адреса — на оба адреса
    // ===================================================================
    apply([model.$.registrationAddress, model.$.residenceAddress], addressBehavior);
  }
);
