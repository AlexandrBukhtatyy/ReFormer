import type { BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';
import type { CreditApplicationForm } from '../../types/credit-application.types';

// Import all step behaviors
import { step1LoanBehaviors } from './steps/step-1-loan-info.behaviors';
import { step2PersonalBehaviors } from './steps/step-2-personal-info.behaviors';
import { step3ContactBehaviors } from './steps/step-3-contact-info.behaviors';
import { step4EmploymentBehaviors } from './steps/step-4-employment.behaviors';
import { step5AdditionalBehaviors } from './steps/step-5-additional-info.behaviors';

export const creditApplicationBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Apply all step behaviors
  step1LoanBehaviors(path);
  step2PersonalBehaviors(path);
  step3ContactBehaviors(path);
  step4EmploymentBehaviors(path);
  step5AdditionalBehaviors(path);
};
