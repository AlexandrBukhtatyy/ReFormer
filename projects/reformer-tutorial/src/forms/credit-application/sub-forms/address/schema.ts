import type { FormSchema } from '@reformer/core';
import { Input } from '@/components/ui/input';
import type { Address } from './type';

export const addressSchema: FormSchema<Address> = {
  region: {
    value: '',
    component: Input,
    componentProps: { label: 'Регион', placeholder: 'Введите регион' },
  },
  city: {
    value: '',
    component: Input,
    componentProps: { label: 'Город', placeholder: 'Введите город' },
  },
  street: {
    value: '',
    component: Input,
    componentProps: { label: 'Улица', placeholder: 'Введите улицу' },
  },
  house: {
    value: '',
    component: Input,
    componentProps: { label: 'Дом', placeholder: 'Номер дома' },
  },
  apartment: {
    value: '',
    component: Input,
    componentProps: { label: 'Квартира', placeholder: 'Номер квартиры' },
  },
  postalCode: {
    value: '',
    component: Input,
    componentProps: { label: 'Почтовый индекс', placeholder: '000000' },
  },
};
