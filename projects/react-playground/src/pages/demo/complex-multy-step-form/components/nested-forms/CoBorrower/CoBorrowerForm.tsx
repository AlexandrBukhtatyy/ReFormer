import { memo } from 'react';
import type { FormProxy } from '@reformer/core';
import { FormField } from '@reformer/ui-kit';
import type { CoBorrower } from './types';

export type { CoBorrower } from './types';

interface CoBorrowerFormProps {
  // GroupProxy для элемента массива coBorrowers
  control: FormProxy<CoBorrower>;
}

const CoBorrowerFormComponent = ({ control }: CoBorrowerFormProps) => {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <FormField control={control.personalData.lastName} testId="coBorrower-lastName" />
        <FormField control={control.personalData.firstName} testId="coBorrower-firstName" />
        <FormField control={control.personalData.middleName} testId="coBorrower-middleName" />
      </div>

      <FormField control={control.personalData.birthDate} testId="coBorrower-birthDate" />

      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.phone} testId="coBorrower-phone" />
        <FormField control={control.email} testId="coBorrower-email" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.relationship} testId="coBorrower-relationship" />
        <FormField control={control.monthlyIncome} testId="coBorrower-monthlyIncome" />
      </div>
    </div>
  );
};

// Мемоизируем компонент, чтобы предотвратить ререндер при изменении других полей
export const CoBorrowerForm = memo(CoBorrowerFormComponent);
