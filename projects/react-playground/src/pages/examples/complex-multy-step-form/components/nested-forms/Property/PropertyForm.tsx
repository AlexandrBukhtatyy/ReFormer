import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { memo } from 'react';
import type { FormSchema, GroupNodeWithControls } from '@reformer/core';

export type PropertyType = 'apartment' | 'house' | 'car' | 'land' | 'none';

export interface Property {
  id?: string;
  type: PropertyType;
  description: string;
  estimatedValue: number;
  hasEncumbrance: boolean;
}

export const propertyFormSchema: FormSchema<Property> = {
  type: {
    value: 'apartment',
    component: Select,
    componentProps: {
      label: 'Тип имущества',
      placeholder: 'Выберите тип',
      options: [
        { value: 'apartment', label: 'Квартира' },
        { value: 'house', label: 'Дом' },
        { value: 'land', label: 'Земельный участок' },
        { value: 'commercial', label: 'Коммерческая недвижимость' },
        { value: 'car', label: 'Автомобиль' },
        { value: 'other', label: 'Другое' },
      ],
    },
  },
  description: {
    value: '',
    component: Textarea,
    componentProps: {
      label: 'Описание',
      placeholder: 'Опишите имущество',
      rows: 2,
    },
  },
  estimatedValue: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Оценочная стоимость',
      placeholder: '0',
      type: 'number',
      min: 0,
      step: 1000,
    },
  },
  hasEncumbrance: {
    value: false,
    component: Checkbox,
    componentProps: {
      label: 'Имеется обременение (залог)',
    },
  },
};

interface PropertyFormProps {
  // GroupProxy для элемента массива properties
  control: GroupNodeWithControls<Property>;
}

const PropertyFormComponent = ({ control }: PropertyFormProps) => {
  return (
    <div className="space-y-3">
      <FormField control={control.type} testId="property-type" />
      <FormField control={control.description} testId="property-description" />
      <FormField control={control.estimatedValue} testId="property-estimatedValue" />
      <FormField control={control.hasEncumbrance} testId="property-hasEncumbrance" />
    </div>
  );
};

// Мемоизируем компонент, чтобы предотвратить ререндер при изменении других полей
export const PropertyForm = memo(PropertyFormComponent);
