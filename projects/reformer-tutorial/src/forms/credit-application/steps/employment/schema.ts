import type { FormSchema } from 'reformer';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { EmploymentStep } from './type';

export const employmentSchema: FormSchema<EmploymentStep> = {
  employmentStatus: {
    value: 'employed',
    component: Select,
    componentProps: {
      label: 'Статус занятости',
      options: [
        { value: 'employed', label: 'Работаю по найму' },
        { value: 'selfEmployed', label: 'Самозанятый/ИП' },
        { value: 'unemployed', label: 'Не работаю' },
        { value: 'retired', label: 'Пенсионер' },
        { value: 'student', label: 'Студент' },
      ],
    },
  },

  companyName: { value: '', component: Input, componentProps: { label: 'Название компании' } },
  companyInn: { value: '', component: Input, componentProps: { label: 'ИНН компании' } },
  companyPhone: { value: '', component: Input, componentProps: { label: 'Телефон компании' } },
  companyAddress: { value: '', component: Input, componentProps: { label: 'Адрес компании' } },
  position: { value: '', component: Input, componentProps: { label: 'Должность' } },
  workExperienceTotal: {
    value: null,
    component: Input,
    componentProps: { label: 'Общий стаж (месяцев)', type: 'number' },
  },
  workExperienceCurrent: {
    value: null,
    component: Input,
    componentProps: { label: 'На текущем месте (месяцев)', type: 'number' },
  },
  monthlyIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Ежемесячный доход', type: 'number' },
  },
  additionalIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Дополнительный доход', type: 'number' },
  },
  additionalIncomeSource: {
    value: '',
    component: Input,
    componentProps: { label: 'Источник дополнительного дохода' },
  },
  businessType: { value: '', component: Input, componentProps: { label: 'Тип бизнеса' } },
  businessInn: { value: '', component: Input, componentProps: { label: 'ИНН ИП' } },
  businessActivity: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Вид деятельности', rows: 3 },
  },

  totalIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Общий доход', disabled: true },
  },
};
