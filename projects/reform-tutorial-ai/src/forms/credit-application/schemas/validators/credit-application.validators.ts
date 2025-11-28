import { apply } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '../../types/credit-application.types';

import { step1LoanValidation } from './steps/step-1-loan-info.validators';
import { step2PersonalValidation } from './steps/step-2-personal-info.validators';
import { step3ContactValidation } from './steps/step-3-contact-info.validators';
import { step4EmploymentValidation } from './steps/step-4-employment.validators';
import { step5AdditionalValidation } from './steps/step-5-additional-info.validators';
import { step6ConfirmationsValidation } from './steps/step-6-confirmations.validators';

/**
 * Main validation schema for Credit Application Form
 *
 * Composes all step-specific validators using apply()
 */
export const creditApplicationValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Apply all step validators
  apply(path, step1LoanValidation);
  apply(path, step2PersonalValidation);
  apply(path, step3ContactValidation);
  apply(path, step4EmploymentValidation);
  apply(path, step5AdditionalValidation);
  apply(path, step6ConfirmationsValidation);
};
