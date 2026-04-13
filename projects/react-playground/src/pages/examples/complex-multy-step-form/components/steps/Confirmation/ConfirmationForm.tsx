import { useFormControlValue, type FormProxy } from '@reformer/core';
import { FormField } from '@reformer/ui-kit';
import type { CreditApplicationForm } from '../../../types/credit-application';
import {
  ConfirmationInfoBlock,
  HighPaymentWarningBase,
  LoanSummarySectionBase,
  ApplicantSummarySectionBase,
  SubmitWarning,
  NextStepsInfo,
  ElectronicSignatureHint,
} from '../../ui/ConfirmationComponents';

interface ConfirmationFormProps {
  control: FormProxy<CreditApplicationForm>;
}

export function ConfirmationForm({ control }: ConfirmationFormProps) {
  // Use hooks to get reactive values for display
  const interestRate = useFormControlValue(control.interestRate) as number;
  const monthlyPayment = useFormControlValue(control.monthlyPayment) as number;
  const fullName = useFormControlValue(control.fullName) as string;
  const age = useFormControlValue(control.age) as number | null;
  const totalIncome = useFormControlValue(control.totalIncome) as number;
  const paymentToIncomeRatio = useFormControlValue(control.paymentToIncomeRatio) as number;
  const coBorrowersIncome = useFormControlValue(control.coBorrowersIncome) as number;

  return (
    <div className="space-y-6" data-testid="step-confirmation">
      <h2 className="text-xl font-bold" data-testid="step-heading">
        Подтверждение и согласия
      </h2>
      <div className="space-y-4">
        <ConfirmationInfoBlock />
        <HighPaymentWarningBase monthlyPayment={monthlyPayment} />
      </div>

      <LoanSummarySectionBase interestRate={interestRate} monthlyPayment={monthlyPayment} />

      <ApplicantSummarySectionBase
        fullName={fullName}
        age={age}
        totalIncome={totalIncome}
        paymentToIncomeRatio={paymentToIncomeRatio}
        coBorrowersIncome={coBorrowersIncome}
      />

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Обязательные согласия</h3>
        <div className="space-y-3">
          <FormField control={control.agreePersonalData} testId="agreePersonalData" />
          <FormField control={control.agreeCreditHistory} testId="agreeCreditHistory" />
          <FormField control={control.agreeTerms} testId="agreeTerms" />
          <FormField control={control.confirmAccuracy} testId="confirmAccuracy" />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold mt-6">Опциональные согласия</h3>
        <FormField control={control.agreeMarketing} testId="agreeMarketing" />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold mt-6">Электронная подпись</h3>
        <FormField control={control.electronicSignature} testId="electronicSignature" />
        <ElectronicSignatureHint />
      </div>

      <SubmitWarning />
      <NextStepsInfo />
    </div>
  );
}
