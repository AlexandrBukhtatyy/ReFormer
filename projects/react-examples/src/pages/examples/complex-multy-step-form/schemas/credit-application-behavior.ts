/**
 * Behavior Schema для кредитной заявки
 *
 * Содержит декларативное описание реактивного поведения формы:
 * - copyFrom: Копирование значений между полями
 * - enableWhen: Условное включение/выключение полей
 * - computeFrom: Автоматическое вычисление значений
 * - watchField: Подписка на изменения с динамической загрузкой
 * - revalidateWhen: Перевалидация зависимых полей
 * - apply: Композиция behavior схем для переиспользования
 *
 * Всего реализовано 34+ behaviors:
 * - 1 apply (для Address - применяется к 2 полям)
 * - 2 copyFrom
 * - 15 enableWhen (массивы контролируются через UI)
 * - 8 computeFrom
 * - 6 watchField (включая 3 для очистки ArrayNode)
 * - 2 revalidateWhen
 */

import {
  copyFrom,
  enableWhen,
  computeFrom,
  watchField,
  revalidateWhen,
  apply,
  type BehaviorSchemaFn,
} from 'reformer/behaviors';
import type { CreditApplicationForm } from '../types/credit-application';

// Импортируем модульные behavior схемы
import { addressBehavior } from '../components/nested-forms/Address/address-behavior';

// Compute функции из utils
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

// API функции из api (уровень домена)
// ПРИМЕЧАНИЕ: fetchRegions, fetchCities теперь используются в addressBehavior
import { fetchCarModels } from '../api';
import type { FieldPath } from 'reformer';

/**
 * Главная схема поведения формы заявки на кредит
 *
 * Применяется автоматически при создании формы через GroupNode конструктор
 */
export const creditApplicationBehavior: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ===================================================================
  // 0. Композиция behavior схем (apply)
  // ===================================================================

  //  Применяем addressBehavior к двум полям адреса
  // Это заменяет дублирование логики загрузки регионов/городов
  apply([path.registrationAddress, path.residenceAddress], addressBehavior);

  // ===================================================================
  // 1. copyFrom() - Копирование значений между полями (2)
  // ===================================================================

  // Копирование адреса регистрации → адрес проживания
  copyFrom(path.residenceAddress, path.registrationAddress, {
    when: (form) => form.sameAsRegistration === true,
    fields: 'all',
  });

  // Копирование основного email → дополнительный email
  copyFrom(path.emailAdditional, path.email, {
    when: (form) => form.sameEmail === true,
  });

  // ===================================================================
  // 2. enableWhen() - Условное включение полей (15)
  // ===================================================================

  // ------------------------------------------------------------------------
  // 2.1. Поля ипотеки (включаются только при loanType === 'mortgage')
  // ------------------------------------------------------------------------
  enableWhen(path.propertyValue, (form) => form.loanType === 'mortgage', {
    resetOnDisable: true,
  });
  enableWhen(path.initialPayment, (form) => form.loanType === 'mortgage', {
    resetOnDisable: true,
  });

  // ------------------------------------------------------------------------
  // 2.2. Поля автокредита (включаются только при loanType === 'car')
  // ------------------------------------------------------------------------
  enableWhen(path.carBrand, (form) => form.loanType === 'car', {
    resetOnDisable: true,
  });
  enableWhen(path.carModel, (form) => form.loanType === 'car', {
    resetOnDisable: true,
  });
  enableWhen(path.carYear, (form) => form.loanType === 'car', {
    resetOnDisable: true,
  });
  enableWhen(path.carPrice, (form) => form.loanType === 'car', {
    resetOnDisable: true,
  });

  // ------------------------------------------------------------------------
  // 2.3. Поля для трудоустроенных (employmentStatus === 'employed')
  // ------------------------------------------------------------------------
  enableWhen(path.companyName, (form) => form.employmentStatus === 'employed', {
    resetOnDisable: true,
  });
  enableWhen(path.companyInn, (form) => form.employmentStatus === 'employed', {
    resetOnDisable: true,
  });
  enableWhen(path.companyPhone, (form) => form.employmentStatus === 'employed', {
    resetOnDisable: true,
  });
  enableWhen(path.companyAddress, (form) => form.employmentStatus === 'employed', {
    resetOnDisable: true,
  });
  enableWhen(path.position, (form) => form.employmentStatus === 'employed', {
    resetOnDisable: true,
  });

  // ------------------------------------------------------------------------
  // 2.4. Поля для ИП (employmentStatus === 'selfEmployed')
  // ------------------------------------------------------------------------
  enableWhen(path.businessType, (form) => form.employmentStatus === 'selfEmployed', {
    resetOnDisable: true,
  });
  enableWhen(path.businessInn, (form) => form.employmentStatus === 'selfEmployed', {
    resetOnDisable: true,
  });
  enableWhen(path.businessActivity, (form) => form.employmentStatus === 'selfEmployed', {
    resetOnDisable: true,
  });

  // ------------------------------------------------------------------------
  // 2.5. Адрес проживания (включается при sameAsRegistration === false)
  // ------------------------------------------------------------------------
  enableWhen(path.residenceAddress, (form) => form.sameAsRegistration === false, {
    resetOnDisable: true,
  });

  // ------------------------------------------------------------------------
  // 2.6. Массивы форм (условное отображение)
  // ------------------------------------------------------------------------

  // ПРИМЕЧАНИЕ: ArrayNode не поддерживает enable()/disable()
  // Массивы (properties, existingLoans, coBorrowers) должны контролироваться
  // через условный рендеринг в React компоненте:
  // {form.hasProperty.value.value && <ArrayField control={form.properties} />}

  // ===================================================================
  // 3. computeFrom() - Вычисляемые поля (8)
  // ===================================================================

  // Процентная ставка (зависит от типа кредита, региона, наличия имущества)
  computeFrom(
    [path.loanType, path.registrationAddress, path.hasProperty, path.properties],
    path.interestRate,
    computeInterestRate
  );

  // Ежемесячный платеж (вычисляется по формуле аннуитетного платежа)
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    computeMonthlyPayment
  );

  // Первоначальный взнос (20% от стоимости недвижимости)
  computeFrom([path.propertyValue], path.initialPayment, computeInitialPayment);

  // Полное имя (конкатенация Фамилия Имя Отчество)
  computeFrom([path.personalData], path.fullName, computeFullName);

  // Возраст (вычисляется из даты рождения)
  computeFrom([path.personalData], path.age, computeAge);

  // Общий доход (основной + дополнительный)
  computeFrom([path.monthlyIncome, path.additionalIncome], path.totalIncome, computeTotalIncome);

  // Процент платежа от дохода
  computeFrom(
    [path.monthlyPayment, path.totalIncome],
    path.paymentToIncomeRatio,
    computePaymentRatio
  );

  // Общий доход созаемщиков (сумма доходов всех созаемщиков)
  computeFrom([path.coBorrowers], path.coBorrowersIncome, computeCoBorrowersIncome);

  // ===================================================================
  // 4. watchField() - Динамическая загрузка данных (1)
  // ===================================================================

  // ПРИМЕЧАНИЕ: Загрузка регионов/городов для адресов теперь в addressBehavior (композиция)

  // Загрузка моделей автомобилей при изменении марки
  watchField(
    path.carBrand,
    async (value, ctx) => {
      if (value) {
        try {
          const { data: models } = await fetchCarModels(value);
          ctx.form.carModel.updateComponentProps({ options: models });
          console.log('Loaded car models:', models);
        } catch (error) {
          console.log('Load car failure:', error);
          ctx.form.carModel.reset();
          ctx.form.carModel.updateComponentProps({ options: [] });
        }
      }
    },
    { immediate: false, debounce: 300 }
  );

  // ===================================================================
  // 5. revalidateWhen() - Перевалидация зависимых полей (2)
  // ===================================================================

  // Перевалидировать доход при изменении платежа
  revalidateWhen(path.monthlyIncome, [path.monthlyPayment]);

  // Перевалидировать первоначальный взнос при изменении стоимости недвижимости
  revalidateWhen(path.initialPayment, [path.propertyValue]);

  // ===================================================================
  // 6. Очистка ArrayNode при снятии чекбоксов (3)
  // ===================================================================

  // Очистить массив имущества при снятии чекбокса hasProperty
  watchField(path.hasProperty, (hasProperty, ctx) => {
    if (!hasProperty) {
      ctx.form.properties?.clear();
    }
  });

  // Очистить массив кредитов при снятии чекбокса hasExistingLoans
  watchField(path.hasExistingLoans, (hasLoans, ctx) => {
    if (!hasLoans) {
      ctx.form.existingLoans?.clear();
    }
  });

  // Очистить массив созаемщиков при снятии чекбокса hasCoBorrower
  watchField(path.hasCoBorrower, (hasCoBorrower, ctx) => {
    if (!hasCoBorrower) {
      ctx.form.coBorrowers?.clear();
    }
  });
};
