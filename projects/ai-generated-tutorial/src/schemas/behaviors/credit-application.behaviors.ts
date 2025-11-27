import type { BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types/credit-application.types';
import { step1LoanBehaviors } from './steps/step-1-loan-info.behaviors';

export const creditApplicationBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  step1LoanBehaviors(path);
};
