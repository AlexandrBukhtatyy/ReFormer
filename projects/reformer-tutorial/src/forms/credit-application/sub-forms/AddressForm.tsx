import { memo } from 'react';
import type { GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/FormField';
import type { Address } from '../types/credit-application.types';

// 1. Определяем интерфейс пропсов
interface AddressFormProps {
  control: GroupNodeWithControls<Address>;
}

// 2. Создаём компонент
const AddressFormComponent = ({ control }: AddressFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.region} />
        <FormField control={control.city} />
      </div>

      <FormField control={control.street} />

      <div className="grid grid-cols-3 gap-4">
        <FormField control={control.house} />
        <FormField control={control.apartment} />
        <FormField control={control.postalCode} />
      </div>
    </div>
  );
};

// 3. Мемоизируем для предотвращения лишних ре-рендеров
export const AddressForm = memo(AddressFormComponent);
