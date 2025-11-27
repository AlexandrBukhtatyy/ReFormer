import { memo } from 'react';
import type { GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import type { CoBorrower } from '../types/credit-application.types';

interface CoBorrowerFormProps {
  control: GroupNodeWithControls<CoBorrower>;
}

const CoBorrowerFormComponent = ({ control }: CoBorrowerFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <FormField control={control.personalData.lastName} testId="coborrower-lastName" />
        <FormField control={control.personalData.firstName} testId="coborrower-firstName" />
        <FormField control={control.personalData.middleName} testId="coborrower-middleName" />
      </div>

      <FormField control={control.personalData.birthDate} testId="coborrower-birthDate" />

      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.phone} testId="coborrower-phone" />
        <FormField control={control.email} testId="coborrower-email" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.relationship} testId="coborrower-relationship" />
        <FormField control={control.monthlyIncome} testId="coborrower-monthlyIncome" />
      </div>
    </div>
  );
};

export const CoBorrowerForm = memo(CoBorrowerFormComponent);
