import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { FormSchema } from 'reformer';
import type { Property } from './type';

export const propertySchema: FormSchema<Property> = {
  type: {
    value: 'apartment',
    component: Select,
    componentProps: {
      label: 'Тип имущества',
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
    componentProps: { label: 'Описание', placeholder: 'Опишите имущество', rows: 2 },
  },
  estimatedValue: {
    value: 0,
    component: Input,
    componentProps: { label: 'Оценочная стоимость', type: 'number', min: 0 },
  },
  hasEncumbrance: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Есть обременение (ипотека, залог)' },
  },
};
