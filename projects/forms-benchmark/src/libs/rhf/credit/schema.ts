/**
 * Validation of the credit application (docs/specs/credit-application-form.md, BENCH-CONTRACT §8):
 * one zod schema for the whole wizard (RHF multi-step guide: one schema, `trigger` per step), each
 * field's rules in the spec's order (RHF shows the first issue per field), messages from the shared
 * catalogue, numbers and predicates from `shared/domain/credit`.
 *
 * - Always-visible fields carry their rules in the object shape.
 * - Conditional sections (mortgage, car, employer, business, residence address) keep only their
 *   type in the shape; their rules are separate object schemas that the root `.superRefine()` applies
 *   while the section is shown (`CREDIT_VISIBILITY` predicates). A hidden field is not validated.
 * - Cross-field rules sit in the same `.superRefine()` with `path` = the field the user enters.
 */
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { creditApi } from '../../../shared/api/credit-client';
import {
  CAR_BRAND_MAX_LENGTH,
  CAR_BRAND_MIN_LENGTH,
  CAR_MODEL_MAX_LENGTH,
  CAR_PRICE_MAX,
  CAR_PRICE_MIN,
  CAR_YEAR_MAX,
  CAR_YEAR_MIN,
  DEPENDENTS_MAX,
  LOAN_AMOUNT_MAX,
  LOAN_AMOUNT_MIN,
  LOAN_PURPOSE_MAX_LENGTH,
  LOAN_PURPOSE_MIN_LENGTH,
  LOAN_TERM_MAX,
  LOAN_TERM_MIN,
  MASKS,
  MONTHLY_INCOME_MIN,
  NON_NEGATIVE_MIN,
  PROPERTY_VALUE_MIN,
  experienceExceedsTotal,
  exceedsMortgageLimit,
  isCarLoan,
  isEmployed,
  isMortgage,
  isSelfEmployed,
  isTooOld,
  isTooYoung,
  livesElsewhere,
  maskPattern,
  needsIncomeSource,
  paymentRatioTooHigh,
  remainingExceedsAmount,
  type CreditInput,
} from '../../../shared/domain/credit';
import { msg } from '../../../shared/messages/credit';
import { afterSyncRules, orEmpty, reportSection, requiredNumber, serverCheck } from '../kit/zod';

// ── Field rule builders ──────────────────────────────────────────────────────
/** Required text: not empty. */
const filled = (required: string) => z.string().min(1, required);

/** Required masked text: not empty, then the whole mask matched. */
const masked = (mask: string, required: string, pattern: string) =>
  filled(required).regex(maskPattern(mask), pattern);

/** Required email. A failed `min` stops the pipe, so an empty value reports "required" only. */
const email = (required: string, format: string) => filled(required).pipe(z.email(format));

/** Must be ticked. */
const accepted = (required: string) => z.boolean().refine((checked) => checked, required);

/** Select with an empty placeholder option: `''` fails `required`. */
const chosen = <const T extends readonly [string, ...string[]]>(values: T, required: string) =>
  z.enum(['', ...values]).refine((value) => value !== '', required);

const address = (p: 'registrationAddress' | 'residenceAddress') =>
  z.object({
    region: filled(msg(`${p}.region.required`)),
    city: filled(msg(`${p}.city.required`)),
    street: filled(msg(`${p}.street.required`)),
    house: filled(msg(`${p}.house.required`)),
    apartment: z.string(),
    postalCode: masked(
      MASKS.postalCode,
      msg(`${p}.postalCode.required`),
      msg(`${p}.postalCode.pattern`)
    ),
  });

// ── Conditional sections: validated only while shown ────────────────────────
const mortgageSection = z.object({
  propertyValue: requiredNumber(
    z.number().min(PROPERTY_VALUE_MIN, msg('propertyValue.min')),
    msg('propertyValue.required')
  ),
});

const carSection = z.object({
  carBrand: filled(msg('carBrand.required'))
    .min(CAR_BRAND_MIN_LENGTH, msg('carBrand.minLength'))
    .max(CAR_BRAND_MAX_LENGTH, msg('carBrand.maxLength')),
  carModel: filled(msg('carModel.required')).max(CAR_MODEL_MAX_LENGTH, msg('carModel.maxLength')),
  carYear: requiredNumber(
    z.number().min(CAR_YEAR_MIN, msg('carYear.min')).max(CAR_YEAR_MAX, msg('carYear.max')),
    msg('carYear.required')
  ),
  carPrice: requiredNumber(
    z.number().min(CAR_PRICE_MIN, msg('carPrice.min')).max(CAR_PRICE_MAX, msg('carPrice.max')),
    msg('carPrice.required')
  ),
});

const employerSection = z.object({
  companyName: filled(msg('companyName.required')),
  companyInn: masked(MASKS.inn10, msg('companyInn.required'), msg('companyInn.pattern')),
  companyPhone: masked(MASKS.phone, msg('companyPhone.required'), msg('companyPhone.pattern')),
  companyAddress: filled(msg('companyAddress.required')),
  position: filled(msg('position.required')),
});

const businessSection = z.object({
  businessType: filled(msg('businessType.required')),
  businessInn: masked(MASKS.inn12, msg('businessInn.required'), msg('businessInn.pattern')),
  businessActivity: filled(msg('businessActivity.required')),
});

const residenceSection = z.object({ residenceAddress: address('residenceAddress') });

/** Address values without rules: the residence address while it is a hidden copy. */
const addressValue = z.object({
  region: z.string(),
  city: z.string(),
  street: z.string(),
  house: z.string(),
  apartment: z.string(),
  postalCode: z.string(),
});

// ── Array rows ───────────────────────────────────────────────────────────────
const nonNegative = (required: string, min: string) =>
  requiredNumber(z.number().min(NON_NEGATIVE_MIN, min), required);

const property = z.object({
  type: chosen(['apartment', 'house', 'car', 'land'], msg('properties[].type.required')),
  description: filled(msg('properties[].description.required')),
  estimatedValue: nonNegative(
    msg('properties[].estimatedValue.required'),
    msg('properties[].estimatedValue.min')
  ),
  hasEncumbrance: z.boolean(),
});

const existingLoan = z
  .object({
    bank: filled(msg('existingLoans[].bank.required')),
    type: filled(msg('existingLoans[].type.required')),
    amount: nonNegative(msg('existingLoans[].amount.required'), msg('existingLoans[].amount.min')),
    remainingAmount: nonNegative(
      msg('existingLoans[].remainingAmount.required'),
      msg('existingLoans[].remainingAmount.min')
    ),
    monthlyPayment: nonNegative(
      msg('existingLoans[].monthlyPayment.required'),
      msg('existingLoans[].monthlyPayment.min')
    ),
    maturityDate: filled(msg('existingLoans[].maturityDate.required')),
  })
  // Cross-field rule within the row (zod docs, refine `path`).
  .refine((loan) => !remainingExceedsAmount(loan.remainingAmount, loan.amount), {
    path: ['remainingAmount'],
    error: msg('existingLoans[].remainingAmount.maxAmount'),
  });

const coBorrower = z.object({
  personalData: z.object({
    lastName: filled(msg('coBorrowers[].personalData.lastName.required')),
    firstName: filled(msg('coBorrowers[].personalData.firstName.required')),
    middleName: filled(msg('coBorrowers[].personalData.middleName.required')),
    birthDate: filled(msg('coBorrowers[].personalData.birthDate.required')),
  }),
  phone: masked(
    MASKS.phone,
    msg('coBorrowers[].phone.required'),
    msg('coBorrowers[].phone.pattern')
  ),
  email: email(msg('coBorrowers[].email.required'), msg('coBorrowers[].email.email')),
  relationship: filled(msg('coBorrowers[].relationship.required')),
  monthlyIncome: nonNegative(
    msg('coBorrowers[].monthlyIncome.required'),
    msg('coBorrowers[].monthlyIncome.min')
  ),
});

// ── The form ─────────────────────────────────────────────────────────────────
const creditSchema = z
  .object({
    // Step 1
    loanType: chosen(
      ['consumer', 'mortgage', 'car', 'business', 'refinancing'],
      msg('loanType.required')
    ),
    loanAmount: requiredNumber(
      z
        .number()
        .min(LOAN_AMOUNT_MIN, msg('loanAmount.min'))
        .max(LOAN_AMOUNT_MAX, msg('loanAmount.max')),
      msg('loanAmount.required')
    ),
    loanTerm: requiredNumber(
      z.number().min(LOAN_TERM_MIN, msg('loanTerm.min')).max(LOAN_TERM_MAX, msg('loanTerm.max')),
      msg('loanTerm.required')
    ),
    loanPurpose: filled(msg('loanPurpose.required'))
      .min(LOAN_PURPOSE_MIN_LENGTH, msg('loanPurpose.minLength'))
      .max(LOAN_PURPOSE_MAX_LENGTH, msg('loanPurpose.maxLength')),
    propertyValue: z.number().nullable(),
    carBrand: z.string(),
    carModel: z.string(),
    carYear: z.number().nullable(),
    carPrice: z.number().nullable(),

    // Step 2
    personalData: z.object({
      lastName: filled(msg('personalData.lastName.required')),
      firstName: filled(msg('personalData.firstName.required')),
      middleName: filled(msg('personalData.middleName.required')),
      birthDate: filled(msg('personalData.birthDate.required'))
        .refine((date) => !isTooYoung(date), msg('personalData.birthDate.minAge'))
        .refine((date) => !isTooOld(date), msg('personalData.birthDate.maxAge')),
      gender: z.enum(['male', 'female'], msg('personalData.gender.required')),
      birthPlace: filled(msg('personalData.birthPlace.required')),
    }),
    passportData: z.object({
      series: masked(
        MASKS.passportSeries,
        msg('passportData.series.required'),
        msg('passportData.series.pattern')
      ),
      number: masked(
        MASKS.passportNumber,
        msg('passportData.number.required'),
        msg('passportData.number.pattern')
      ),
      issueDate: filled(msg('passportData.issueDate.required')),
      issuedBy: filled(msg('passportData.issuedBy.required')),
      departmentCode: masked(
        MASKS.departmentCode,
        msg('passportData.departmentCode.required'),
        msg('passportData.departmentCode.pattern')
      ),
    }),
    inn: masked(MASKS.inn12, msg('inn.required'), msg('inn.pattern')),
    snils: masked(MASKS.snils, msg('snils.required'), msg('snils.pattern')),

    // Step 3
    phoneMain: masked(MASKS.phone, msg('phoneMain.required'), msg('phoneMain.pattern')),
    phoneAdditional: orEmpty(
      z.string().regex(maskPattern(MASKS.phone), msg('phoneAdditional.pattern'))
    ),
    email: email(msg('email.required'), msg('email.email')),
    sameEmail: z.boolean(),
    emailAdditional: orEmpty(z.email(msg('emailAdditional.email'))),
    registrationAddress: address('registrationAddress'),
    sameAsRegistration: z.boolean(),
    residenceAddress: addressValue,

    // Step 4
    employmentStatus: z.enum(
      ['employed', 'selfEmployed', 'unemployed', 'retired', 'student'],
      msg('employmentStatus.required')
    ),
    companyName: z.string(),
    companyInn: z.string(),
    companyPhone: z.string(),
    companyAddress: z.string(),
    position: z.string(),
    workExperienceTotal: nonNegative(
      msg('workExperienceTotal.required'),
      msg('workExperienceTotal.min')
    ),
    workExperienceCurrent: nonNegative(
      msg('workExperienceCurrent.required'),
      msg('workExperienceCurrent.min')
    ),
    monthlyIncome: requiredNumber(
      z.number().min(MONTHLY_INCOME_MIN, msg('monthlyIncome.min')),
      msg('monthlyIncome.required')
    ),
    additionalIncome: z.number().min(NON_NEGATIVE_MIN, msg('additionalIncome.min')).nullable(),
    additionalIncomeSource: z.string(),
    businessType: z.string(),
    businessInn: z.string(),
    businessActivity: z.string(),

    // Step 5
    maritalStatus: z.enum(
      ['single', 'married', 'divorced', 'widowed'],
      msg('maritalStatus.required')
    ),
    dependents: requiredNumber(
      z
        .number()
        .min(NON_NEGATIVE_MIN, msg('dependents.min'))
        .max(DEPENDENTS_MAX, msg('dependents.max')),
      msg('dependents.required')
    ),
    education: chosen(
      ['secondary', 'specialized', 'higher', 'postgraduate'],
      msg('education.required')
    ),
    hasProperty: z.boolean(),
    properties: z.array(property),
    hasExistingLoans: z.boolean(),
    existingLoans: z.array(existingLoan),
    hasCoBorrower: z.boolean(),
    coBorrowers: z.array(coBorrower),

    // Step 6
    agreePersonalData: accepted(msg('agreePersonalData.required')),
    agreeCreditHistory: accepted(msg('agreeCreditHistory.required')),
    agreeMarketing: z.boolean(),
    agreeTerms: accepted(msg('agreeTerms.required')),
    confirmAccuracy: accepted(msg('confirmAccuracy.required')),
    electronicSignature: masked(
      MASKS.smsCode,
      msg('electronicSignature.required'),
      msg('electronicSignature.pattern')
    ).refine(serverCheck(creditApi.verifySmsCode), {
      error: msg('electronicSignature.invalid'),
      when: afterSyncRules,
    }),
  })
  .superRefine((v, ctx) => {
    // Conditional sections (CREDIT_VISIBILITY).
    if (isMortgage(v.loanType)) reportSection(ctx, mortgageSection, v);
    if (isCarLoan(v.loanType)) reportSection(ctx, carSection, v);
    if (isEmployed(v.employmentStatus)) reportSection(ctx, employerSection, v);
    if (isSelfEmployed(v.employmentStatus)) reportSection(ctx, businessSection, v);
    if (livesElsewhere(v.sameAsRegistration)) reportSection(ctx, residenceSection, v);

    // Cross-field rules. They come after the field's own issues, so a field shows its own rule first.
    if (exceedsMortgageLimit(v.loanType, v.loanAmount, v.propertyValue)) {
      ctx.addIssue({
        code: 'custom',
        path: ['loanAmount'],
        message: msg('loanAmount.maxMortgage'),
      });
    }
    if (experienceExceedsTotal(v.workExperienceCurrent, v.workExperienceTotal)) {
      ctx.addIssue({
        code: 'custom',
        path: ['workExperienceCurrent'],
        message: msg('workExperienceCurrent.maxTotal'),
      });
    }
    if (paymentRatioTooHigh(v)) {
      ctx.addIssue({
        code: 'custom',
        path: ['monthlyIncome'],
        message: msg('monthlyIncome.paymentRatio'),
      });
    }
    if (needsIncomeSource(v.additionalIncome) && v.additionalIncomeSource === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['additionalIncomeSource'],
        message: msg('additionalIncomeSource.required'),
      });
    }
  }) satisfies z.ZodType<CreditInput, CreditInput>;

export const creditResolver = zodResolver(creditSchema);
