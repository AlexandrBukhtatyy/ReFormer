import { memo } from 'react';
import type { GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import type { PassportData } from '@/types/credit-application.types';

interface PassportDataFormProps {
  control: GroupNodeWithControls<PassportData>;
}

const PassportDataFormComponent = ({ control }: PassportDataFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.series} testId="passport-series" />
        <FormField control={control.number} testId="passport-number" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.issueDate} testId="passport-issueDate" />
        <FormField control={control.departmentCode} testId="passport-departmentCode" />
      </div>

      <FormField control={control.issuedBy} testId="passport-issuedBy" />
    </div>
  );
};

export const PassportDataForm = memo(PassportDataFormComponent);
