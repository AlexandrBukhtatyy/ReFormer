import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { InputMask } from '@/components/ui/input-mask';
import { Textarea } from '@/components/ui/textarea';
import { memo } from 'react';
import type { FormSchema, GroupNodeWithControls } from 'reformer';

/**
 * Паспортные данные (вложенная форма)
 */
export interface PassportData {
  series: string;
  number: string;
  issueDate: string;
  issuedBy: string;
  departmentCode: string;
}

export const passportDataSchema: FormSchema<PassportData> = {
  series: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Серия паспорта',
      placeholder: '00 00',
      mask: '99 99',
    },
  },

  number: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Номер паспорта',
      placeholder: '000000',
      mask: '999999',
    },
  },

  issueDate: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Дата выдачи',
      type: 'date',
    },
  },

  issuedBy: {
    value: '',
    component: Textarea,
    componentProps: {
      label: 'Кем выдан',
      placeholder: 'Введите наименование органа',
      rows: 3,
    },
  },

  departmentCode: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Код подразделения',
      placeholder: '000-000',
      mask: '999-999',
    },
  },
};

interface PassportDataFormProps {
  // GroupProxy для вложенной формы passportData (используем any для обхода ограничений TypeScript)
  control: GroupNodeWithControls<PassportData>;
}

const PassportDataFormComponent = ({ control }: PassportDataFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.series} testId="passportData-series" />
        <FormField control={control.number} testId="passportData-number" />
      </div>
      <FormField control={control.issueDate} testId="passportData-issueDate" />
      <FormField control={control.issuedBy} testId="passportData-issuedBy" />
      <FormField control={control.departmentCode} testId="passportData-departmentCode" />
    </div>
  );
};

// Мемоизируем компонент, чтобы предотвратить ререндер при изменении других полей
export const PassportDataForm = memo(PassportDataFormComponent);
