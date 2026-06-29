/**
 * M1: реактивное поведение кредитной заявки.
 *
 * Гибрид по природе операций (см. план fieldconfig-witty-trinket.md):
 * - value-операции (computeFrom/copyFrom/watchField) пишут СИГНАЛЫ модели;
 * - state/UI-операции (updateComponentProps, enable/disable, array.clear) идут через НОДЫ формы.
 *
 * Вызывать после `createForm` (нужен реестр сигнал→нода для `enableWhen` скалярных полей) и
 * очищать возвращённым cleanup на размонтировании.
 */

import { effect, type Signal, type ReadonlySignal } from '@preact/signals-core';
import {
  copyFrom,
  watchField,
  enableWhen,
  transformValue,
  type FormModel,
  type FormProxy,
  type ModelSignals,
  type BehaviorCleanup,
} from '@reformer/core';
import type { CreditApplicationForm } from '../types/credit-application';
import type { PersonalData } from '../components/nested-forms/PersonalData/types';
import type { CoBorrower } from '../components/nested-forms/CoBorrower/types';
import type { Address } from '../components/nested-forms/Address/types';
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
import { fetchCarModels, fetchCities } from '../api';

/** Узел поля с UI/состоянием (то, что нужно из формы для node-операций). */
interface NodeOps {
  enable(): void;
  disable(): void;
  reset(): void;
  setValue(value: unknown): void;
  updateComponentProps(props: Record<string, unknown>): void;
  clear(): void;
}
const ops = (node: unknown): NodeOps => node as NodeOps;

/**
 * Настроить поведение формы на модели + нодах.
 * @returns cleanup, отписывающий все эффекты.
 */
export function setupCreditApplicationBehavior(
  model: FormModel<CreditApplicationForm>,
  form: FormProxy<CreditApplicationForm>
): BehaviorCleanup {
  const cleanups: BehaviorCleanup[] = [];

  /** Вычисляемое поле: target = read() при изменении прочитанных сигналов (с опциональным условием). */
  const compute = <R>(
    read: () => R,
    target: Signal<R>,
    options?: { when?: () => boolean }
  ): void => {
    cleanups.push(
      effect(() => {
        if (options?.when && !options.when()) return;
        const next = read();
        if (target.peek() !== next) target.value = next;
      })
    );
  };

  // ===================================================================
  // 1. computeFrom — вычисляемые поля (значения → модель)
  // ===================================================================

  // Процентная ставка (тип кредита, регион регистрации, наличие/кол-во имущества)
  compute(
    () =>
      computeInterestRate({
        loanType: model.loanType,
        registrationAddress: { region: model.registrationAddress.region },
        hasProperty: model.hasProperty,
        // .map подписывает на изменение длины массива (нужен только count)
        properties: model.properties.map(() => null),
      }),
    model.$.interestRate
  );

  // Ежемесячный платёж (аннуитет)
  compute(
    () =>
      computeMonthlyPayment({
        loanAmount: model.loanAmount,
        loanTerm: model.loanTerm,
        interestRate: model.interestRate,
      }),
    model.$.monthlyPayment
  );

  // Первоначальный взнос (20% стоимости) — только для ипотеки; иначе сбрасывает enableWhen
  compute(
    () => computeInitialPayment({ propertyValue: model.propertyValue }),
    model.$.initialPayment,
    {
      when: () => model.loanType === 'mortgage',
    }
  );

  // Полное имя / возраст из personalData
  compute(
    () =>
      computeFullName({
        personalData: {
          lastName: model.personalData.lastName,
          firstName: model.personalData.firstName,
          middleName: model.personalData.middleName,
        } as PersonalData,
      }),
    model.$.fullName
  );
  compute(
    () => computeAge({ personalData: { birthDate: model.personalData.birthDate } as PersonalData }),
    model.$.age
  );

  // Доход созаёмщиков (сумма по элементам массива)
  compute(
    () =>
      computeCoBorrowersIncome({
        coBorrowers: model.coBorrowers.map((cb) => ({
          monthlyIncome: cb.monthlyIncome,
        })) as CoBorrower[],
      }),
    model.$.coBorrowersIncome
  );

  // Общий доход (основной + дополнительный + созаёмщики)
  compute(
    () =>
      computeTotalIncome({
        monthlyIncome: model.monthlyIncome,
        additionalIncome: model.additionalIncome,
        coBorrowersIncome: model.coBorrowersIncome,
      }),
    model.$.totalIncome
  );

  // Процент платежа от дохода
  compute(
    () =>
      computePaymentRatio({
        monthlyPayment: model.monthlyPayment,
        totalIncome: model.totalIncome,
      }),
    model.$.paymentToIncomeRatio
  );

  // ===================================================================
  // 2. copyFrom — копирование значений
  // ===================================================================

  // Основной email → дополнительный, когда установлен флаг «Дублировать email»
  cleanups.push(
    copyFrom(model.$.email, model.$.emailAdditional, { when: () => model.sameEmail === true })
  );

  // Адрес регистрации → адрес проживания (весь объект), когда «совпадает»
  cleanups.push(
    effect(() => {
      const same = model.sameAsRegistration; // подписка
      const snapshot: Address = {
        region: model.registrationAddress.region,
        city: model.registrationAddress.city,
        street: model.registrationAddress.street,
        house: model.registrationAddress.house,
        apartment: model.registrationAddress.apartment,
        postalCode: model.registrationAddress.postalCode,
      };
      if (same !== true) return;
      // Выходим из контекста effect перед записью группы (защита от Cycle detected)
      queueMicrotask(() => {
        model.residenceAddress = snapshot;
      });
    })
  );

  // ===================================================================
  // 3. enableWhen — условные поля (скаляры через реестр сигнал→нода)
  // ===================================================================

  const enableScalar = (sig: ReadonlySignal<unknown>, cond: () => boolean): void => {
    cleanups.push(enableWhen(sig, cond, { resetOnDisable: true }));
  };

  // Ипотека
  enableScalar(model.$.propertyValue, () => model.loanType === 'mortgage');
  enableScalar(model.$.initialPayment, () => model.loanType === 'mortgage');
  // Автокредит
  enableScalar(model.$.carBrand, () => model.loanType === 'car');
  enableScalar(model.$.carModel, () => model.loanType === 'car');
  enableScalar(model.$.carYear, () => model.loanType === 'car');
  enableScalar(model.$.carPrice, () => model.loanType === 'car');
  // Трудоустроенные
  enableScalar(model.$.companyName, () => model.employmentStatus === 'employed');
  enableScalar(model.$.companyInn, () => model.employmentStatus === 'employed');
  enableScalar(model.$.companyPhone, () => model.employmentStatus === 'employed');
  enableScalar(model.$.companyAddress, () => model.employmentStatus === 'employed');
  enableScalar(model.$.position, () => model.employmentStatus === 'employed');
  // ИП
  enableScalar(model.$.businessType, () => model.employmentStatus === 'selfEmployed');
  enableScalar(model.$.businessInn, () => model.employmentStatus === 'selfEmployed');
  enableScalar(model.$.businessActivity, () => model.employmentStatus === 'selfEmployed');

  // Адрес проживания — группа: enable/disable через ноду формы
  cleanups.push(
    effect(() => {
      const enabled = model.sameAsRegistration === false; // подписка
      queueMicrotask(() => {
        if (enabled) ops(form.residenceAddress).enable();
        else ops(form.residenceAddress).disable();
      });
    })
  );

  // ===================================================================
  // 4. watchField — динамическая загрузка / лимиты / очистка массивов
  // ===================================================================

  // Загрузка моделей авто при смене марки (+ сброс выбранной модели)
  cleanups.push(
    watchField(
      model.$.carBrand,
      async (brand) => {
        ops(form.carModel).reset();
        if (!brand) {
          ops(form.carModel).updateComponentProps({ options: [] });
          return;
        }
        try {
          const { data: models } = await fetchCarModels(brand);
          ops(form.carModel).updateComponentProps({ options: models });
        } catch {
          ops(form.carModel).updateComponentProps({ options: [] });
        }
      },
      { immediate: false }
    )
  );

  // Максимальная сумма кредита от дохода (≤ 10 годовых, не более 10 млн)
  cleanups.push(
    watchField(
      model.$.totalIncome,
      (totalIncome) => {
        if (totalIncome && totalIncome > 0) {
          const max = Math.min(totalIncome * 12 * 10, 10000000);
          queueMicrotask(() => ops(form.loanAmount).updateComponentProps({ max }));
        }
      },
      { immediate: false }
    )
  );

  // Максимальный срок с учётом возраста (погашение до 70 лет)
  cleanups.push(
    watchField(
      model.$.age,
      (age) => {
        if (age && age >= 18) {
          const maxTermMonths = Math.min(Math.max(70 - age, 1) * 12, 240);
          queueMicrotask(() => ops(form.loanTerm).updateComponentProps({ max: maxTermMonths }));
        }
      },
      { immediate: false }
    )
  );

  // Очистка массивов при снятии чекбоксов
  cleanups.push(
    watchField(
      model.$.hasProperty,
      (v) => {
        if (!v) ops(form.properties).clear();
      },
      { immediate: false }
    )
  );
  cleanups.push(
    watchField(
      model.$.hasExistingLoans,
      (v) => {
        if (!v) ops(form.existingLoans).clear();
      },
      { immediate: false }
    )
  );
  cleanups.push(
    watchField(
      model.$.hasCoBorrower,
      (v) => {
        if (!v) ops(form.coBorrowers).clear();
      },
      { immediate: false }
    )
  );

  // ===================================================================
  // 5. Поведение адресов (загрузка городов по региону + автоформат индекса)
  // ===================================================================

  const setupAddress = (signals: ModelSignals<Address>, addressForm: FormProxy<Address>): void => {
    // Подгрузка справочника городов по региону. Город НЕ очищаем на смене региона:
    // (а) это затёрло бы значение при загрузке данных (region выставляется раньше city);
    // (б) поле «Город» — обычный Input (не Select), список городов носит вспомогательный характер.
    cleanups.push(
      watchField(
        signals.region,
        async (region) => {
          if (!region) {
            ops(addressForm.city).updateComponentProps({ options: [] });
            return;
          }
          try {
            const { data: cities } = await fetchCities(region);
            ops(addressForm.city).updateComponentProps({ options: cities });
          } catch {
            ops(addressForm.city).updateComponentProps({ options: [] });
          }
        },
        { immediate: false }
      )
    );
    // Автоформат почтового индекса (только цифры, ≤ 6)
    cleanups.push(
      transformValue(signals.postalCode, (pc) => (pc ?? '').replace(/\D/g, '').slice(0, 6))
    );
  };

  setupAddress(model.$.registrationAddress, form.registrationAddress);
  setupAddress(model.$.residenceAddress, form.residenceAddress);

  return () => {
    cleanups.forEach((c) => c());
  };
}
