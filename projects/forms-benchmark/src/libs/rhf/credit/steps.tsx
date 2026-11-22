/**
 * The six wizard steps: field order, sections and computed values as on the baseline page.
 *
 * Conditional sections and computed values (C.1–C.8) are small components that subscribe to their
 * own inputs with `useWatch` + `compute` (re-render only when the derived value changes), so a
 * keystroke never re-renders the step or the form host.
 */
import type { ReactNode } from 'react';
import { useFieldArray, useWatch, type FieldPathValues } from 'react-hook-form';
import { creditApi } from '../../../shared/api/credit-client';
import {
  COMPUTED_LABELS,
  CREDIT_ARRAYS,
  CREDIT_COPIES,
  CREDIT_INITIAL_INPUT,
  CREDIT_STEPS,
  CREDIT_VISIBILITY,
  SECTION_TITLES,
  computeAge,
  computeCoBorrowersIncome,
  computeFullName,
  computeInitialPayment,
  computeInterestRate,
  computeMonthlyPayment,
  computePaymentToIncomeRatio,
  computeTotalIncome,
  isCarLoan,
  isEmployed,
  isMortgage,
  isSelfEmployed,
  livesElsewhere,
  type CreditArrayKey,
  type CreditComputed,
  type CreditInput,
  type Option,
} from '../../../shared/domain/credit';
import { ReadonlyValue } from '../../../shared/ui/controls';
import { ArrayFrame, ArrayRow, Section } from '../../../shared/ui/array';
import { setDependent, useCopies, type CopyRule } from '../kit/dependent';
import { ApiSelectField, CreditField, useCreditForm, type CreditPath } from './fields';

export interface Dictionaries {
  regions: readonly Option[];
  propertyTypes: readonly Option[];
}

const computed = (key: keyof CreditComputed, value: string | number | null) => (
  <ReadonlyValue path={key} label={COMPUTED_LABELS[key]} value={value} />
);

/**
 * Hidden by a condition → back to the initial value, error dropped (CREDIT_VISIBILITY). Arrays are
 * cleared by their flag (`useFieldArray`), the residence address is a copy (CREDIT_COPIES).
 */
const HIDING_RULES = CREDIT_VISIBILITY.filter((rule) =>
  rule.fields.every((f) => !(f in CREDIT_ARRAYS) && f !== 'residenceAddress')
);

function useResetHidden(): () => void {
  const methods = useCreditForm();
  return () => {
    const values = methods.getValues();
    for (const rule of HIDING_RULES) {
      if (rule.visible(values)) continue;
      for (const name of rule.fields) setDependent(methods, name, CREDIT_INITIAL_INPUT[name]);
    }
  };
}

// ── Step 1 ───────────────────────────────────────────────────────────────────
const LOAN_INPUTS = [
  'loanType',
  'loanAmount',
  'loanTerm',
  'registrationAddress.region',
  'hasProperty',
  'properties',
] as const;

/** C.1 and C.2 from their inputs. */
function loanFigures([
  loanType,
  loanAmount,
  loanTerm,
  region,
  hasProperty,
  properties,
]: FieldPathValues<CreditInput, typeof LOAN_INPUTS>) {
  const interestRate = computeInterestRate(loanType, region, hasProperty, properties.length);
  return {
    interestRate,
    monthlyPayment: computeMonthlyPayment(loanAmount, loanTerm, interestRate),
  };
}

function LoanCalculation() {
  const { control } = useCreditForm();
  const { interestRate, monthlyPayment } = useWatch({
    control,
    name: LOAN_INPUTS,
    compute: loanFigures,
  });
  return (
    <Section title={SECTION_TITLES.calculation}>
      {computed('interestRate', interestRate)}
      {computed('monthlyPayment', monthlyPayment)}
    </Section>
  );
}

function InitialPayment() {
  const { control } = useCreditForm();
  const initialPayment = useWatch({
    control,
    name: ['loanType', 'propertyValue'] as const,
    compute: ([loanType, propertyValue]) => computeInitialPayment(loanType, propertyValue),
  });
  return computed('initialPayment', initialPayment);
}

function MortgageSection() {
  const { control } = useCreditForm();
  const shown = useWatch({ control, name: 'loanType', compute: isMortgage });
  if (!shown) return null;
  return (
    <Section title={SECTION_TITLES.mortgage}>
      <CreditField name="propertyValue" />
      <InitialPayment />
    </Section>
  );
}

function CarSection() {
  const { control } = useCreditForm();
  const shown = useWatch({ control, name: 'loanType', compute: isCarLoan });
  if (!shown) return null;
  return (
    <Section title={SECTION_TITLES.car}>
      <CreditField name="carBrand" />
      <ApiSelectField name="carModel" source="carBrand" load={creditApi.getCarModels} />
      <CreditField name="carYear" />
      <CreditField name="carPrice" />
    </Section>
  );
}

export function LoanStep() {
  const resetHidden = useResetHidden();
  return (
    <>
      <CreditField name="loanType" onChange={resetHidden} />
      <CreditField name="loanAmount" />
      <CreditField name="loanTerm" />
      <CreditField name="loanPurpose" />
      <MortgageSection />
      <CarSection />
      <LoanCalculation />
    </>
  );
}

// ── Step 2 ───────────────────────────────────────────────────────────────────
function NameAndAge() {
  const { control } = useCreditForm();
  const fullName = useWatch({
    control,
    name: ['personalData.lastName', 'personalData.firstName', 'personalData.middleName'] as const,
    compute: ([lastName, firstName, middleName]) =>
      computeFullName({ lastName, firstName, middleName }),
  });
  const age = useWatch({
    control,
    name: 'personalData.birthDate',
    compute: (birthDate) => computeAge(birthDate),
  });
  return (
    <>
      {computed('fullName', fullName)}
      {computed('age', age)}
    </>
  );
}

export function PersonalStep() {
  return (
    <>
      <Section title={SECTION_TITLES.personalData}>
        <CreditField name="personalData.lastName" />
        <CreditField name="personalData.firstName" />
        <CreditField name="personalData.middleName" />
        <CreditField name="personalData.birthDate" />
        <CreditField name="personalData.gender" />
        <CreditField name="personalData.birthPlace" />
        <NameAndAge />
      </Section>
      <Section title={SECTION_TITLES.passportData}>
        <CreditField name="passportData.series" />
        <CreditField name="passportData.number" />
        <CreditField name="passportData.issueDate" />
        <CreditField name="passportData.issuedBy" />
        <CreditField name="passportData.departmentCode" />
      </Section>
      <CreditField name="inn" />
      <CreditField name="snils" />
    </>
  );
}

// ── Step 3 ───────────────────────────────────────────────────────────────────
/** CREDIT_COPIES; a cleared flag puts the target back to its initial value. */
const COPY_RULES: readonly CopyRule<CreditInput>[] = CREDIT_COPIES.map((rule) => ({
  ...rule,
  cleared: () => structuredClone(CREDIT_INITIAL_INPUT[rule.target]),
}));

function EmailAdditionalField() {
  const { control } = useCreditForm();
  const copied = useWatch({ control, name: 'sameEmail' });
  return <CreditField name="emailAdditional" readOnly={copied} />;
}

function AddressFields({
  prefix,
  regions,
}: {
  prefix: 'registrationAddress' | 'residenceAddress';
  regions: readonly Option[];
}) {
  return (
    <>
      <CreditField name={`${prefix}.region`} options={regions} />
      <ApiSelectField
        name={`${prefix}.city`}
        source={`${prefix}.region`}
        load={creditApi.getCities}
      />
      <CreditField name={`${prefix}.street`} />
      <CreditField name={`${prefix}.house`} />
      <CreditField name={`${prefix}.apartment`} />
      <CreditField name={`${prefix}.postalCode`} />
    </>
  );
}

function ResidenceSection({ regions }: { regions: readonly Option[] }) {
  const { control } = useCreditForm();
  const shown = useWatch({ control, name: 'sameAsRegistration', compute: livesElsewhere });
  if (!shown) return null;
  return (
    <Section title={SECTION_TITLES.residenceAddress}>
      <AddressFields prefix="residenceAddress" regions={regions} />
    </Section>
  );
}

export function ContactsStep({ regions }: { regions: readonly Option[] }) {
  useCopies(COPY_RULES);
  return (
    <>
      <CreditField name="phoneMain" />
      <CreditField name="phoneAdditional" />
      <CreditField name="email" />
      <CreditField name="sameEmail" />
      <EmailAdditionalField />
      <Section title={SECTION_TITLES.registrationAddress}>
        <AddressFields prefix="registrationAddress" regions={regions} />
      </Section>
      <CreditField name="sameAsRegistration" />
      <ResidenceSection regions={regions} />
    </>
  );
}

// ── Step 4 ───────────────────────────────────────────────────────────────────
function EmployerSection() {
  const { control } = useCreditForm();
  const shown = useWatch({ control, name: 'employmentStatus', compute: isEmployed });
  if (!shown) return null;
  return (
    <Section title={SECTION_TITLES.employer}>
      <CreditField name="companyName" />
      <CreditField name="companyInn" />
      <CreditField name="companyPhone" />
      <CreditField name="companyAddress" />
      <CreditField name="position" />
    </Section>
  );
}

function BusinessSection() {
  const { control } = useCreditForm();
  const shown = useWatch({ control, name: 'employmentStatus', compute: isSelfEmployed });
  if (!shown) return null;
  return (
    <Section title={SECTION_TITLES.business}>
      <CreditField name="businessType" />
      <CreditField name="businessInn" />
      <CreditField name="businessActivity" />
    </Section>
  );
}

const INCOME_INPUTS = ['monthlyIncome', 'additionalIncome', ...LOAN_INPUTS] as const;

/** C.6 and C.7 (C.7 needs the payment C.2, i.e. the loan inputs of step 1). */
function IncomeFigures() {
  const { control } = useCreditForm();
  const { totalIncome, paymentToIncomeRatio } = useWatch({
    control,
    name: INCOME_INPUTS,
    compute: ([monthlyIncome, additionalIncome, ...loan]) => {
      const total = computeTotalIncome(monthlyIncome, additionalIncome);
      return {
        totalIncome: total,
        paymentToIncomeRatio: computePaymentToIncomeRatio(loanFigures(loan).monthlyPayment, total),
      };
    },
  });
  return (
    <>
      {computed('totalIncome', totalIncome)}
      {computed('paymentToIncomeRatio', paymentToIncomeRatio)}
    </>
  );
}

export function EmploymentStep() {
  const resetHidden = useResetHidden();
  return (
    <>
      <CreditField name="employmentStatus" onChange={resetHidden} />
      <EmployerSection />
      <BusinessSection />
      <CreditField name="workExperienceTotal" />
      <CreditField name="workExperienceCurrent" />
      <Section title={SECTION_TITLES.income}>
        <CreditField name="monthlyIncome" />
        <CreditField name="additionalIncome" />
        <CreditField name="additionalIncomeSource" />
        <IncomeFigures />
      </Section>
    </>
  );
}

// ── Step 5 ───────────────────────────────────────────────────────────────────
/** Row fields of each array (path after `array[].`), in screen order. */
const ROW_FIELDS = Object.fromEntries(
  (Object.keys(CREDIT_ARRAYS) as CreditArrayKey[]).map((array) => [
    array,
    CREDIT_STEPS[4].fields
      .filter((f) => f.startsWith(`${array}[]`))
      .map((f) => f.slice(`${array}[].`.length)),
  ])
) as Record<CreditArrayKey, string[]>;

/**
 * Flag + field array (`useFieldArray`): ticking the flag appends one empty row, clearing it removes
 * all rows. `shouldFocus: false` — appending does not move focus (no library adds focus moves).
 */
function ArrayBlock({
  array,
  options,
  children,
}: {
  array: CreditArrayKey;
  options?: readonly Option[];
  children?: ReactNode;
}) {
  const { control } = useCreditForm();
  const { flag, title, rowTitle, addLabel, empty } = CREDIT_ARRAYS[array];
  const { fields, append, remove } = useFieldArray({ control, name: array });
  const shown = useWatch({ control, name: flag });
  const add = () => append(empty(), { shouldFocus: false });
  return (
    <>
      <CreditField name={flag} onChange={(event) => (event.target.checked ? add() : remove())} />
      {shown ? (
        <ArrayFrame path={array} title={title} addLabel={addLabel} onAdd={add}>
          {fields.map((row, index) => (
            <ArrayRow
              key={row.id}
              path={array}
              index={index}
              title={rowTitle}
              onRemove={() => remove(index)}
            >
              {ROW_FIELDS[array].map((f) => (
                <CreditField
                  key={f}
                  name={`${array}.${index}.${f}` as CreditPath}
                  options={options}
                />
              ))}
            </ArrayRow>
          ))}
        </ArrayFrame>
      ) : null}
      {shown ? children : null}
    </>
  );
}

function CoBorrowersIncome() {
  const { control } = useCreditForm();
  const income = useWatch({ control, name: 'coBorrowers', compute: computeCoBorrowersIncome });
  return computed('coBorrowersIncome', income);
}

export function AdditionalStep({ propertyTypes }: { propertyTypes: readonly Option[] }) {
  return (
    <>
      <CreditField name="maritalStatus" />
      <CreditField name="dependents" />
      <CreditField name="education" />
      <ArrayBlock array="properties" options={propertyTypes} />
      <ArrayBlock array="existingLoans" />
      <ArrayBlock array="coBorrowers">
        <CoBorrowersIncome />
      </ArrayBlock>
    </>
  );
}

// ── Step 6 ───────────────────────────────────────────────────────────────────
export function ConfirmationStep() {
  return (
    <>
      <CreditField name="agreePersonalData" />
      <CreditField name="agreeCreditHistory" />
      <CreditField name="agreeMarketing" />
      <CreditField name="agreeTerms" />
      <CreditField name="confirmAccuracy" />
      <CreditField name="electronicSignature" />
    </>
  );
}
