/**
 * Компоненты для Шага 6 (Подтверждение)
 *
 * Презентационные компоненты для отображения информационных блоков, итогов и предупреждений.
 * Используются как в ConfirmationForm (с пропами), так и в RenderSchema (с useFormWizard).
 */

import type { ReactNode } from 'react';
import { useFormControlValue } from '@reformer/core';
import { useFormWizard } from '@reformer/cdk/form-wizard';
import type { CreditApplicationForm } from '../../types/credit-application';

// ============================================================================
// Информационный блок (синий)
// ============================================================================

export function ConfirmationInfoBlock(): ReactNode {
  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
      <p className="text-sm text-blue-800">
        Пожалуйста, внимательно ознакомьтесь с условиями и дайте необходимые согласия перед
        отправкой заявки.
      </p>
    </div>
  );
}

// ============================================================================
// Предупреждение о высоком платеже (красный)
// ============================================================================

interface HighPaymentWarningBaseProps {
  monthlyPayment: number;
}

/** Презентационный компонент - принимает данные как пропы */
export function HighPaymentWarningBase({ monthlyPayment }: HighPaymentWarningBaseProps): ReactNode {
  if (monthlyPayment <= 30000) {
    return null;
  }

  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-md">
      <p className="text-sm text-red-800">
        <b>Внимание!</b> Ежемесячный платеж превышает 30 000 Руб.
      </p>
    </div>
  );
}

/** Версия с useFormWizard для RenderSchema */
export function HighPaymentWarning(): ReactNode {
  const { form } = useFormWizard<CreditApplicationForm>();
  const monthlyPayment = useFormControlValue(form.monthlyPayment) as number;
  return <HighPaymentWarningBase monthlyPayment={monthlyPayment} />;
}

// ============================================================================
// Секция "Итого" с расчётами
// ============================================================================

interface LoanSummarySectionBaseProps {
  interestRate: number;
  monthlyPayment: number;
}

/** Презентационный компонент - принимает данные как пропы */
export function LoanSummarySectionBase({
  interestRate,
  monthlyPayment,
}: LoanSummarySectionBaseProps): ReactNode {
  return (
    <div className="space-y-4" data-testid="loan-summary-section">
      <h3 className="text-lg font-semibold">Итого</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div>
            <b>Процентная ставка:</b>{' '}
            <span data-testid="computed-interestRate">{interestRate}</span>%
          </div>
          <span className="text-xs text-gray-500">
            зависит от типа кредита, региона, наличия имущества
          </span>
        </div>
        <div>
          <div>
            <b>Ежемесячный платеж:</b>{' '}
            <span data-testid="computed-monthlyPayment">
              {monthlyPayment.toLocaleString('ru-RU')}
            </span>{' '}
            ₽
          </div>
          <span className="text-xs text-gray-500">вычисляется по формуле аннуитетного платежа</span>
        </div>
      </div>
    </div>
  );
}

/** Версия с useFormWizard для RenderSchema */
export function LoanSummarySection(): ReactNode {
  const { form } = useFormWizard<CreditApplicationForm>();
  const interestRate = useFormControlValue(form.interestRate) as number;
  const monthlyPayment = useFormControlValue(form.monthlyPayment) as number;
  return <LoanSummarySectionBase interestRate={interestRate} monthlyPayment={monthlyPayment} />;
}

// ============================================================================
// Секция вычисляемых полей заемщика
// ============================================================================

interface ApplicantSummarySectionBaseProps {
  fullName: string;
  age: number | null;
  totalIncome: number;
  paymentToIncomeRatio: number;
  coBorrowersIncome: number;
}

/** Презентационный компонент - принимает данные как пропы */
export function ApplicantSummarySectionBase({
  fullName,
  age,
  totalIncome,
  paymentToIncomeRatio,
  coBorrowersIncome,
}: ApplicantSummarySectionBaseProps): ReactNode {
  return (
    <div className="space-y-4" data-testid="applicant-summary-section">
      <h3 className="text-lg font-semibold">Данные заявителя</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div>
            <b>ФИО:</b>{' '}
            <span data-testid="computed-fullName">{fullName || '—'}</span>
          </div>
        </div>
        <div>
          <div>
            <b>Возраст:</b>{' '}
            <span data-testid="computed-age">{age ?? '—'}</span>
            {age !== null && ' лет'}
          </div>
        </div>
        <div>
          <div>
            <b>Общий доход:</b>{' '}
            <span data-testid="computed-totalIncome">
              {totalIncome.toLocaleString('ru-RU')}
            </span>{' '}
            ₽/мес
          </div>
          <span className="text-xs text-gray-500">основной + дополнительный</span>
        </div>
        <div>
          <div>
            <b>Платеж/Доход:</b>{' '}
            <span data-testid="computed-paymentToIncomeRatio">
              {paymentToIncomeRatio.toFixed(1)}
            </span>
            %
          </div>
          <span className="text-xs text-gray-500">рекомендуется менее 50%</span>
        </div>
        {coBorrowersIncome > 0 && (
          <div>
            <div>
              <b>Доход созаемщиков:</b>{' '}
              <span data-testid="computed-coBorrowersIncome">
                {coBorrowersIncome.toLocaleString('ru-RU')}
              </span>{' '}
              ₽/мес
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Версия с useFormWizard для RenderSchema */
export function ApplicantSummarySection(): ReactNode {
  const { form } = useFormWizard<CreditApplicationForm>();
  const fullName = useFormControlValue(form.fullName) as string;
  const age = useFormControlValue(form.age) as number | null;
  const totalIncome = useFormControlValue(form.totalIncome) as number;
  const paymentToIncomeRatio = useFormControlValue(form.paymentToIncomeRatio) as number;
  const coBorrowersIncome = useFormControlValue(form.coBorrowersIncome) as number;
  return (
    <ApplicantSummarySectionBase
      fullName={fullName}
      age={age}
      totalIncome={totalIncome}
      paymentToIncomeRatio={paymentToIncomeRatio}
      coBorrowersIncome={coBorrowersIncome}
    />
  );
}

// ============================================================================
// Предупреждение перед отправкой (желтый)
// ============================================================================

interface SubmitWarningProps {
  className?: string;
}

export function SubmitWarning({ className = 'mt-6' }: SubmitWarningProps): ReactNode {
  return (
    <div className={`p-4 bg-yellow-50 border border-yellow-200 rounded-md ${className}`}>
      <p className="text-sm text-yellow-800">
        <strong>Внимание!</strong> После нажатия кнопки &quot;Отправить заявку&quot; вы
        подтверждаете достоверность предоставленной информации и согласие c условиями кредитования.
      </p>
    </div>
  );
}

// ============================================================================
// Блок "Что будет дальше?" (зеленый)
// ============================================================================

export function NextStepsInfo(): ReactNode {
  return (
    <div className="p-4 bg-green-50 border border-green-200 rounded-md">
      <h4 className="font-semibold text-green-900 mb-2">Что будет дальше?</h4>
      <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
        <li>Ваша заявка будет рассмотрена в течение 24 часов</li>
        <li>Мы свяжемся c вами для подтверждения информации</li>
        <li>После одобрения вы получите индивидуальное предложение</li>
        <li>Вы сможете подписать договор онлайн или в офисе</li>
      </ul>
    </div>
  );
}

// ============================================================================
// Подпись под полем электронной подписи
// ============================================================================

export function ElectronicSignatureHint(): ReactNode {
  return (
    <p className="text-xs text-gray-500">Введите код из SMS, отправленный на ваш номер телефона</p>
  );
}
