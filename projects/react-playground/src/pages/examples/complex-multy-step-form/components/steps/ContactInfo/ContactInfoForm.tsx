/**
 * ContactInfoForm (Step 3)
 *
 * Демонстрирует:
 * - Переиспользование AddressForm для двух разных адресов
 * - Операции с группами: getValue(), setValue()
 * - Условное отображение вложенных форм
 */

import type { FormProxy } from '@reformer/core';
import { useFormControl } from '@reformer/core';
import { FormField } from '@reformer/ui-kit';
import { AddressForm } from '../../nested-forms/Address/AddressForm';
import type { CreditApplicationForm } from '../../../types/credit-application';
import { ResidenceAddressSection } from '../../ui/ResidenceAddressSection';

interface ContactInfoFormProps {
  control: FormProxy<CreditApplicationForm>;
}

export function ContactInfoForm({ control }: ContactInfoFormProps) {
  const { value: sameAsRegistration } = useFormControl(control.sameAsRegistration);

  return (
    <div className="space-y-6" data-testid="step-contact-info">
      <h2 className="text-xl font-bold" data-testid="step-heading">
        Контактная информация
      </h2>
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Контакты</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={control.phoneMain} testId="phoneMain" />
          <FormField control={control.phoneAdditional} testId="phoneAdditional" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={control.email} testId="email" />
          <FormField control={control.emailAdditional} testId="emailAdditional" />
        </div>
      </div>
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Адрес регистрации</h3>
        <AddressForm control={control.registrationAddress} testIdPrefix="registrationAddress" />
      </div>
      <FormField control={control.sameAsRegistration} testId="sameAsRegistration" />
      {!sameAsRegistration && (
        <ResidenceAddressSection>
          <AddressForm control={control.residenceAddress} testIdPrefix="residenceAddress" />
        </ResidenceAddressSection>
      )}
    </div>
  );
}
