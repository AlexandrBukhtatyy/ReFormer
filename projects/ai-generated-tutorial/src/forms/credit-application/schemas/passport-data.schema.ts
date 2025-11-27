import type { FormSchema } from 'reformer';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { PassportData } from '../types/credit-application.types';

export const passportDataSchema: FormSchema<PassportData> = {
  series: {
    value: '',
    component: Input,
    componentProps: { label: 'Passport Series', placeholder: '00 00' },
  },
  number: {
    value: '',
    component: Input,
    componentProps: { label: 'Passport Number', placeholder: '000000' },
  },
  issueDate: {
    value: '',
    component: Input,
    componentProps: { label: 'Issue Date', type: 'date' },
  },
  issuedBy: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Issued By', placeholder: 'Issuing authority', rows: 2 },
  },
  departmentCode: {
    value: '',
    component: Input,
    componentProps: { label: 'Department Code', placeholder: '000-000' },
  },
};
