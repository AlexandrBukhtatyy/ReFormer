import { memo } from 'react';
import type { FormSchema, GroupNodeWithControls } from '@reformer/core';
import { Input } from '@/components/ui/input';
import { InputMask } from '@/components/ui/input-mask';
import { FormField } from '@/components/ui/form-field';

/**
 * Адрес (вложенная форма)
 */
export interface Address {
  region: string;
  city: string;
  street: string;
  house: string;
  apartment?: string;
  postalCode: string;
}

/**
 * Переиспользуемая схема формы
 */
export const addressFormSchema: FormSchema<Address> = {
  region: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Регион',
      placeholder: 'Введите регион',
    },
  },

  city: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Город',
      placeholder: 'Введите город',
    },
  },

  street: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Улица',
      placeholder: 'Введите улицу',
    },
  },

  house: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Дом',
      placeholder: '№',
    },
  },

  apartment: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Квартира',
      placeholder: '№',
    },
  },

  postalCode: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Индекс',
      placeholder: '000000',
      mask: '999999',
    },
  },
};

interface AddressFormProps {
  // GroupProxy для вложенной формы address (используем any для обхода ограничений TypeScript)
  control: GroupNodeWithControls<Address>;
  /** Префикс для testId (например: 'registrationAddress' или 'residenceAddress') */
  testIdPrefix: string;
}

const AddressFormComponent = ({ control, testIdPrefix }: AddressFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.region} testId={`${testIdPrefix}-region`} />
        <FormField control={control.city} testId={`${testIdPrefix}-city`} />
      </div>

      <FormField control={control.street} testId={`${testIdPrefix}-street`} />

      <div className="grid grid-cols-3 gap-4">
        <FormField control={control.house} testId={`${testIdPrefix}-house`} />
        <FormField control={control.apartment} testId={`${testIdPrefix}-apartment`} />
        <FormField control={control.postalCode} testId={`${testIdPrefix}-postalCode`} />
      </div>
    </div>
  );
};

// Мемоизируем компонент, чтобы предотвратить ререндер при изменении других полей
export const AddressForm = memo(AddressFormComponent);
