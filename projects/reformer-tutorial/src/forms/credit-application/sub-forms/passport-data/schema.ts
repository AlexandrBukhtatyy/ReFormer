import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { FormSchema } from '@reformer/core';
import type { PassportData } from './type';

export const passportDataSchema: FormSchema<PassportData> = {
  series: {
    value: '',
    component: Input,
    componentProps: { label: 'Серия паспорта', placeholder: '00 00' },
  },
  number: {
    value: '',
    component: Input,
    componentProps: { label: 'Номер паспорта', placeholder: '000000' },
  },
  issueDate: {
    value: '',
    component: Input,
    componentProps: { label: 'Дата выдачи', type: 'date' },
  },
  issuedBy: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Кем выдан', placeholder: 'Орган, выдавший паспорт', rows: 2 },
  },
  departmentCode: {
    value: '',
    component: Input,
    componentProps: { label: 'Код подразделения', placeholder: '000-000' },
  },
};
