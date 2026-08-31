import { FormField } from '@reformer/ui-kit';
import { memo } from 'react';
import type { FormProxy } from '@reformer/core';
import type { PassportData } from './types';

export type { PassportData } from './types';

interface PassportDataFormProps {
  // GroupProxy для вложенной формы passportData (используем any для обхода ограничений TypeScript)
  control: FormProxy<PassportData>;
}

const PassportDataFormComponent = ({ control }: PassportDataFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.series} testId="passportData-series" />
        <FormField control={control.number} testId="passportData-number" />
      </div>
      <FormField control={control.issuedBy} testId="passportData-issuedBy" />
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.issueDate} testId="passportData-issueDate" />
        <FormField control={control.departmentCode} testId="passportData-departmentCode" />
      </div>
    </div>
  );
};

// Мемоизируем компонент, чтобы предотвратить ререндер при изменении других полей
export const PassportDataForm = memo(PassportDataFormComponent);
