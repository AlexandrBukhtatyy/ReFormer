import { required, minLength, validate } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types/credit-application.types';

export const step6ConfirmationsValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Required Agreements
  // ==========================================
  required(path.agreePersonalData, {
    message: 'You must agree to personal data processing'
  });

  validate(path.agreePersonalData, (value) => {
    if (value !== true) {
      return {
        code: 'mustAgree',
        message: 'You must agree to personal data processing'
      };
    }
    return null;
  });

  required(path.agreeCreditHistory, {
    message: 'You must agree to credit history check'
  });

  validate(path.agreeCreditHistory, (value) => {
    if (value !== true) {
      return {
        code: 'mustAgree',
        message: 'You must agree to credit history check'
      };
    }
    return null;
  });

  required(path.agreeTerms, {
    message: 'You must accept the terms and conditions'
  });

  validate(path.agreeTerms, (value) => {
    if (value !== true) {
      return {
        code: 'mustAgree',
        message: 'You must accept the terms and conditions'
      };
    }
    return null;
  });

  required(path.confirmAccuracy, {
    message: 'You must confirm information accuracy'
  });

  validate(path.confirmAccuracy, (value) => {
    if (value !== true) {
      return {
        code: 'mustConfirm',
        message: 'You must confirm information accuracy'
      };
    }
    return null;
  });

  // ==========================================
  // Electronic Signature
  // ==========================================
  required(path.electronicSignature, {
    message: 'Electronic signature is required'
  });

  minLength(path.electronicSignature, 3, {
    message: 'Signature must be at least 3 characters'
  });

  // Signature must match full name
  validate(path.electronicSignature, (value, ctx) => {
    const signature = (value as string)?.toLowerCase().trim();
    const fullName = (ctx.form.fullName.value.value as string)?.toLowerCase().trim();

    if (!signature || !fullName) return null;

    // Simple check: signature should contain at least last name
    const lastName = (ctx.form.personalData.lastName.value.value as string)?.toLowerCase().trim();

    if (lastName && !signature.includes(lastName)) {
      return {
        code: 'signatureMismatch',
        message: 'Signature should include your last name'
      };
    }

    return null;
  });

  // ==========================================
  // Marketing Agreement (optional - no validation needed)
  // ==========================================
  // agreeMarketing is optional, no validation required
};
