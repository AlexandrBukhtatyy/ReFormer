import type { GroupNodeWithControls } from '@reformer/core';
import { useFormControlValue } from '@reformer/core';
import type { CreditApplicationForm } from '../../type';
import { FormField } from '@/components/ui/FormField';
import { AddressForm } from '../../sub-forms/address/AddressForm';

interface ContactInfoFormProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

export function ContactInfoForm({ control }: ContactInfoFormProps) {
  const sameAsRegistration = useFormControlValue(control.sameAsRegistration);

  const copyAddress = () => {
    const regAddress = control.registrationAddress.getValue();
    control.residenceAddress.setValue(regAddress);
  };

  const clearAddress = () => {
    control.residenceAddress.reset();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Контактная информация</h2>

      {/* Телефоны */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Телефоны</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={control.phoneMain} />
          <FormField control={control.phoneAdditional} />
        </div>
      </div>

      {/* Email */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Email</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={control.email} />
          <FormField control={control.emailAdditional} />
        </div>
      </div>

      {/* Адрес регистрации */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Адрес регистрации</h3>
        <AddressForm control={control.registrationAddress} />
      </div>

      {/* Чекбокс "совпадает" */}
      <FormField control={control.sameAsRegistration} />

      {/* Адрес проживания (условный) */}
      {!sameAsRegistration && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Адрес проживания</h3>
            <button
              type="button"
              onClick={copyAddress}
              className="text-sm text-blue-600 hover:underline"
            >
              Скопировать из регистрации
            </button>
          </div>

          <AddressForm control={control.residenceAddress} />

          <button
            type="button"
            onClick={clearAddress}
            className="text-sm text-gray-600 hover:underline"
          >
            Очистить
          </button>
        </div>
      )}
    </div>
  );
}
