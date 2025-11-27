import { required, minLength, maxLength, pattern, validate } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '../../../types/credit-application.types';

export const step2PersonalValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Personal Data Validation
  // ==========================================
  required(path.personalData.lastName, { message: 'Last name is required' });
  minLength(path.personalData.lastName, 2, { message: 'Last name must be at least 2 characters' });
  maxLength(path.personalData.lastName, 50, { message: 'Last name cannot exceed 50 characters' });

  required(path.personalData.firstName, { message: 'First name is required' });
  minLength(path.personalData.firstName, 2, {
    message: 'First name must be at least 2 characters',
  });
  maxLength(path.personalData.firstName, 50, { message: 'First name cannot exceed 50 characters' });

  required(path.personalData.birthDate, { message: 'Birth date is required' });

  // Age validation: must be 18-70 years old
  validate(path.personalData.birthDate, (value) => {
    const birthDate = value as string;
    if (!birthDate) return null;

    const today = new Date();
    const birth = new Date(birthDate);

    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    if (age < 18) {
      return { code: 'tooYoung', message: 'Applicant must be at least 18 years old' };
    }
    if (age > 70) {
      return { code: 'tooOld', message: 'Applicant must be no older than 70 years' };
    }
    return null;
  });

  required(path.personalData.birthPlace, { message: 'Birth place is required' });
  required(path.personalData.gender, { message: 'Gender is required' });

  // ==========================================
  // Passport Data Validation
  // ==========================================
  required(path.passportData.series, { message: 'Passport series is required' });
  pattern(path.passportData.series, /^\d{4}$/, { message: 'Passport series must be 4 digits' });

  required(path.passportData.number, { message: 'Passport number is required' });
  pattern(path.passportData.number, /^\d{6}$/, { message: 'Passport number must be 6 digits' });

  required(path.passportData.issueDate, { message: 'Issue date is required' });

  // Passport issue date validation
  validate(path.passportData.issueDate, (value, ctx) => {
    const issueDate = value as string;
    const birthDate = ctx.form.personalData.birthDate.value.value as string;

    if (!issueDate) return null;

    const issue = new Date(issueDate);
    const today = new Date();

    if (issue > today) {
      return { code: 'futureDate', message: 'Issue date cannot be in the future' };
    }

    if (birthDate) {
      const birth = new Date(birthDate);
      const minIssueDate = new Date(birth);
      minIssueDate.setFullYear(minIssueDate.getFullYear() + 14);

      if (issue < minIssueDate) {
        return { code: 'issuedTooEarly', message: 'Passport cannot be issued before age 14' };
      }
    }

    return null;
  });

  required(path.passportData.issuedBy, { message: 'Issued by is required' });
  required(path.passportData.departmentCode, { message: 'Department code is required' });
  pattern(path.passportData.departmentCode, /^\d{3}-\d{3}$/, {
    message: 'Department code must be in format XXX-XXX',
  });

  // ==========================================
  // INN and SNILS Validation
  // ==========================================
  required(path.inn, { message: 'INN is required' });
  pattern(path.inn, /^\d{12}$/, { message: 'INN must be 12 digits' });

  // INN checksum validation
  validate(path.inn, (value) => {
    const inn = value as string;
    if (!inn || inn.length !== 12) return null;

    // Simplified checksum validation for personal INN (12 digits)
    const weights1 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    const weights2 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];

    const calcChecksum = (weights: number[], length: number) => {
      let sum = 0;
      for (let i = 0; i < length; i++) {
        sum += parseInt(inn[i]) * weights[i];
      }
      return (sum % 11) % 10;
    };

    const checksum1 = calcChecksum(weights1, 10);
    const checksum2 = calcChecksum(weights2, 11);

    if (checksum1 !== parseInt(inn[10]) || checksum2 !== parseInt(inn[11])) {
      return { code: 'invalidInn', message: 'Invalid INN checksum' };
    }

    return null;
  });

  required(path.snils, { message: 'SNILS is required' });
  pattern(path.snils, /^\d{3}-\d{3}-\d{3} \d{2}$/, {
    message: 'SNILS must be in format XXX-XXX-XXX XX',
  });
};
