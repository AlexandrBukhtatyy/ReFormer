/**
 * ContactInfoForm (Step 3)
 *
 * Демонстрирует:
 * - Переиспользование AddressForm для двух разных адресов
 * - Операции с группами: getValue(), setValue()
 * - Условное отображение вложенных форм
 */

import type { GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import { AddressForm } from '../../nested-forms/Address/AddressForm';
import type { CreditApplicationForm } from '../../../types/credit-application';
import { Button } from '@/components/ui/button';

interface ContactInfoFormProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

export function ContactInfoForm({ control }: ContactInfoFormProps) {
  const sameAsRegistration = control.sameAsRegistration.value.value;

  // Копировать адрес регистрации в адрес проживания
  const copyRegistrationAddress = () => {
    const regAddress = control.registrationAddress?.getValue();
    control.residenceAddress?.setValue(regAddress);
  };

  // Очистить адрес проживания
  const clearResidenceAddress = () => {
    control.residenceAddress?.reset();
  };

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
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Адрес проживания</h3>
            <Button size="sm" onClick={copyRegistrationAddress}>
              Скопировать из адреса регистрации
            </Button>
          </div>

          <AddressForm control={control.residenceAddress} testIdPrefix="residenceAddress" />

          <Button size="sm" onClick={clearResidenceAddress}>
            Очистить адрес проживания
          </Button>
        </div>
      )}
    </div>
  );
}
