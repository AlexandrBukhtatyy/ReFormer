/**
 * Поведение кредитной заявки — единственное: и модель, и узлы схемы.
 *
 * Операторы сами регистрируются в схеме поведения; массива очисток и ручного управления жизненным
 * циклом нет. Подключается через `createForm({ behavior })` — форма владеет жизненным циклом.
 *
 * Три вида операций в одном файле:
 * - значения (`compute` / `copyFrom`) пишут сигналы модели (`model.$.…`);
 * - состояние полей (`enableWhen`, `reset`, `updateComponentProps`) — ноды формы (`form.…`);
 * - узлы схемы (`hideWhen` / `onComponentEvent` / `onMount`) — разметку (`schema.node(selector)`).
 *
 * Правила узлов исполняет рендерер. В варианте «React руками» рендерера нет, поэтому видимость
 * секций, загрузка и отправка там остаются в JSX, а разделы 6–9 этого файла ничего не делают.
 */

import {
  defineFormBehavior,
  compute,
  copyFrom,
  enableWhen,
  onChange,
  apply,
  hideWhen,
  onComponentEvent,
  onMount,
  onUnmount,
  renderEffect,
} from '@reformer/core/behaviors';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';
import type { CreditApplicationForm } from './types/credit-application';
import type { PersonalData } from './components/nested-forms/PersonalData/types';
import type { CoBorrower } from './components/nested-forms/CoBorrower/types';
import { addressBehavior } from './components/nested-forms/Address/address-behavior';
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
} from './utils';
import { fetchCarModels, submitCreditApplication } from './api';
import { applyCreditApplication, loadCreditApplication } from './hooks/useLoadCreditApplication';

export const creditApplicationBehavior = defineFormBehavior<CreditApplicationForm>(
  ({ model, form, schema }) => {
    // Условия — по одному разу на форму: ими пользуются и включение полей, и видимость секций.
    const isMortgage = () => model.loanType === 'mortgage';
    const isCar = () => model.loanType === 'car';
    const isBusinessLoan = () => model.loanType === 'business';
    const isEmployed = () => model.employmentStatus === 'employed';
    const isSelfEmployed = () => model.employmentStatus === 'selfEmployed';
    const isUnemployed = () => model.employmentStatus === 'unemployed';
    const livesElsewhere = () => model.sameAsRegistration === false;

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
    compute(model.$.initialPayment, () => computeInitialPayment(model), { when: isMortgage });
    compute(model.$.fullName, () => computeFullName(model));
    compute(model.$.age, () =>
      computeAge({ personalData: { birthDate: model.personalData.birthDate } as PersonalData })
    );
    compute(model.$.coBorrowersIncome, () =>
      computeCoBorrowersIncome({
        coBorrowers: model.coBorrowers.map((coBorrower) => ({
          monthlyIncome: coBorrower.monthlyIncome,
        })) as CoBorrower[],
      })
    );
    compute(model.$.totalIncome, () => computeTotalIncome(model));
    compute(model.$.paymentToIncomeRatio, () => computePaymentRatio(model));

    // ===================================================================
    // 2. copyFrom — копирование значений (скаляр + группа)
    // ===================================================================
    copyFrom(model.$.email, model.$.emailAdditional, { when: () => model.sameEmail === true });
    copyFrom(model.$.registrationAddress, model.$.residenceAddress, {
      when: () => model.sameAsRegistration === true,
    });

    // ===================================================================
    // 3. Условные секции: включение полей и видимость секции — рядом
    // ===================================================================
    enableWhen([model.$.propertyValue, model.$.initialPayment], isMortgage, {
      resetOnDisable: true,
    });
    hideWhen(schema.node('mortgage-section'), () => !isMortgage());

    enableWhen([model.$.carBrand, model.$.carModel, model.$.carYear, model.$.carPrice], isCar, {
      resetOnDisable: true,
    });
    hideWhen(schema.node('car-section'), () => !isCar());

    enableWhen(
      [
        model.$.companyName,
        model.$.companyInn,
        model.$.companyPhone,
        model.$.companyAddress,
        model.$.position,
      ],
      isEmployed,
      { resetOnDisable: true }
    );
    hideWhen(schema.node('employer-section'), () => !isEmployed());

    // Бизнес-поля стоят в схеме дважды: на шаге «Кредит» (бизнес-кредит) и на шаге «Работа»
    // (самозанятый). Поля одни и те же — включает их статус занятости.
    enableWhen(
      [model.$.businessType, model.$.businessInn, model.$.businessActivity],
      isSelfEmployed,
      { resetOnDisable: true }
    );
    hideWhen(schema.node('loan-business-section'), () => !isBusinessLoan());
    hideWhen(schema.node('business-section'), () => !isSelfEmployed());

    hideWhen(schema.node('income-section'), isUnemployed);
    hideWhen(schema.node('unemployed-warning'), () => !isUnemployed());

    // Адрес проживания — группа: без сброса, значение копируется из адреса регистрации.
    enableWhen(model.$.residenceAddress, livesElsewhere);
    hideWhen(schema.node('residence-address-section'), () => !livesElsewhere());

    hideWhen(schema.node('properties-array'), () => !model.hasProperty);
    hideWhen(schema.node('existing-loans-array'), () => !model.hasExistingLoans);
    hideWhen(schema.node('co-borrowers-array'), () => !model.hasCoBorrower);

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
    // 5. Поведение подформы адреса — на оба адреса
    // ===================================================================
    apply([model.$.registrationAddress, model.$.residenceAddress], addressBehavior);

    // ===================================================================
    // 6. Загрузка заявки: статус и текст ошибки показывает AsyncBoundary
    // ===================================================================
    const boundary = schema.node('data-boundary');
    const loadApplication = async () => {
      boundary.patchProps({ status: 'loading', error: null });
      try {
        applyCreditApplication(form, await loadCreditApplication('1'));
        boundary.patchProps({ status: 'ready' });
      } catch (error) {
        // Текст ошибки уходит в пропсы: пользователь должен видеть, что именно не загрузилось.
        boundary.patchProps({
          status: 'error',
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
          onRetry: () => void loadApplication(),
        });
      }
    };
    onMount(boundary, () => {
      void loadApplication();
    });

    // ===================================================================
    // 7. Отправка: визард зовёт обработчик только после успешной валидации
    // ===================================================================
    onComponentEvent(schema.node('wizard'), 'onSubmit', async (values: CreditApplicationForm) => {
      try {
        const response = await submitCreditApplication(values);
        if (response.status === 200 || response.status === 201) {
          alert(`Заявка успешно отправлена! ID: ${response.data.id}`);
        } else {
          alert('Ошибка отправки заявки: сервер вернул неожиданный ответ');
        }
      } catch {
        alert('Ошибка отправки заявки: сервер недоступен');
      }
    });

    // ===================================================================
    // 8. Навигация через ref визарда: эффект запускается после монтирования
    // ===================================================================
    const wizard = schema.node('wizard').getRef<FormWizardHandle<CreditApplicationForm>>();
    renderEffect(schema, () => {
      if (isMortgage()) wizard.current?.goToStep(1);
    });

    // ===================================================================
    // 9. Хуки жизненного цикла узла (демонстрация)
    // ===================================================================
    onMount(schema.node('wizard'), () => {
      console.log('[form.behavior] wizard mounted');
      return () => console.log('[form.behavior] wizard cleanup from onMount');
    });
    onUnmount(schema.node('wizard'), () => {
      console.log('[form.behavior] wizard unmounted');
    });
  }
);
