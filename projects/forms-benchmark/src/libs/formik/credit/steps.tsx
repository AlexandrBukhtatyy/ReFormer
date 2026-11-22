/**
 * The six steps: fields, sections and computed values in the order of the baseline markup
 * (`baseline/credit/CreditForm.tsx`). Step components render once per mount; Formik updates reach
 * only the bound fields and the few components that read values (`Shown`, `FieldArray`, copies).
 */
import type { ReactNode } from 'react';
import { FieldArray, type FieldArrayRenderProps } from 'formik';
import { ArrayFrame, ArrayRow, Section } from '../../../shared/ui/array';
import {
  CREDIT_ARRAYS,
  SECTION_TITLES,
  type CreditArrayKey,
  type CreditValues,
} from '../../../shared/domain/credit';
import {
  CarModelField,
  CityField,
  Computed,
  EmailAdditionalField,
  FastCreditField,
  PropertyTypeField,
  RegionField,
  ResidenceCopy,
  Shown,
} from './fields';
import {
  changeCarBrand,
  changeEmploymentStatus,
  changeLoanType,
  toggleArray,
  toggleSameAsRegistration,
  toggleSameEmail,
} from './changes';

export function LoanStep() {
  return (
    <>
      <FastCreditField name="loanType" onValueChange={changeLoanType} />
      {/* Cross rule (mortgage limit): its result lands in errors.loanAmount, FastField's own slice. */}
      <FastCreditField name="loanAmount" />
      <FastCreditField name="loanTerm" />
      <FastCreditField name="loanPurpose" />
      <Shown field="propertyValue">
        <Section title={SECTION_TITLES.mortgage}>
          <FastCreditField name="propertyValue" />
          <Computed name="initialPayment" />
        </Section>
      </Shown>
      <Shown field="carBrand">
        <Section title={SECTION_TITLES.car}>
          <FastCreditField name="carBrand" onValueChange={changeCarBrand} />
          <CarModelField />
          <FastCreditField name="carYear" />
          <FastCreditField name="carPrice" />
        </Section>
      </Shown>
      <Section title={SECTION_TITLES.calculation}>
        <Computed name="interestRate" />
        <Computed name="monthlyPayment" />
      </Section>
    </>
  );
}

export function PersonalStep() {
  return (
    <>
      <Section title={SECTION_TITLES.personalData}>
        <FastCreditField name="personalData.lastName" />
        <FastCreditField name="personalData.firstName" />
        <FastCreditField name="personalData.middleName" />
        <FastCreditField name="personalData.birthDate" />
        <FastCreditField name="personalData.gender" />
        <FastCreditField name="personalData.birthPlace" />
        <Computed name="fullName" />
        <Computed name="age" />
      </Section>
      <Section title={SECTION_TITLES.passportData}>
        <FastCreditField name="passportData.series" />
        <FastCreditField name="passportData.number" />
        <FastCreditField name="passportData.issueDate" />
        <FastCreditField name="passportData.issuedBy" />
        <FastCreditField name="passportData.departmentCode" />
      </Section>
      <FastCreditField name="inn" />
      <FastCreditField name="snils" />
    </>
  );
}

function Address({ of }: { of: 'registrationAddress' | 'residenceAddress' }) {
  return (
    <>
      <RegionField address={of} />
      <CityField address={of} />
      <FastCreditField name={`${of}.street`} />
      <FastCreditField name={`${of}.house`} />
      <FastCreditField name={`${of}.apartment`} />
      <FastCreditField name={`${of}.postalCode`} />
    </>
  );
}

export function ContactsStep() {
  return (
    <>
      <FastCreditField name="phoneMain" />
      <FastCreditField name="phoneAdditional" />
      <FastCreditField name="email" />
      <FastCreditField name="sameEmail" onValueChange={toggleSameEmail} />
      <EmailAdditionalField />
      <Section title={SECTION_TITLES.registrationAddress}>
        <Address of="registrationAddress" />
      </Section>
      <FastCreditField name="sameAsRegistration" onValueChange={toggleSameAsRegistration} />
      <ResidenceCopy />
      <Shown field="residenceAddress">
        <Section title={SECTION_TITLES.residenceAddress}>
          <Address of="residenceAddress" />
        </Section>
      </Shown>
    </>
  );
}

export function EmploymentStep() {
  return (
    <>
      <FastCreditField name="employmentStatus" onValueChange={changeEmploymentStatus} />
      <Shown field="companyName">
        <Section title={SECTION_TITLES.employer}>
          <FastCreditField name="companyName" />
          <FastCreditField name="companyInn" />
          <FastCreditField name="companyPhone" />
          <FastCreditField name="companyAddress" />
          <FastCreditField name="position" />
        </Section>
      </Shown>
      <Shown field="businessType">
        <Section title={SECTION_TITLES.business}>
          <FastCreditField name="businessType" />
          <FastCreditField name="businessInn" />
          <FastCreditField name="businessActivity" />
        </Section>
      </Shown>
      <FastCreditField name="workExperienceTotal" />
      {/* Cross rule: not more than the total experience. */}
      <FastCreditField name="workExperienceCurrent" />
      <Section title={SECTION_TITLES.income}>
        {/* Cross rule: payment ≤ 50 % of income (loan, rate and both incomes). */}
        <FastCreditField name="monthlyIncome" />
        <FastCreditField name="additionalIncome" />
        {/* Required while additionalIncome > 0. */}
        <FastCreditField name="additionalIncomeSource" />
        <Computed name="totalIncome" />
        <Computed name="paymentToIncomeRatio" />
      </Section>
    </>
  );
}

/** Row fields of each array (`row` — `properties.0`). */
const ROWS: Record<CreditArrayKey, (row: string) => ReactNode> = {
  properties: (row) => (
    <>
      <PropertyTypeField name={`${row}.type`} />
      <FastCreditField name={`${row}.description`} />
      <FastCreditField name={`${row}.estimatedValue`} />
      <FastCreditField name={`${row}.hasEncumbrance`} />
    </>
  ),
  existingLoans: (row) => (
    <>
      <FastCreditField name={`${row}.bank`} />
      <FastCreditField name={`${row}.type`} />
      <FastCreditField name={`${row}.amount`} />
      {/* Cross rule within the row: not more than the amount. */}
      <FastCreditField name={`${row}.remainingAmount`} />
      <FastCreditField name={`${row}.monthlyPayment`} />
      <FastCreditField name={`${row}.maturityDate`} />
    </>
  ),
  coBorrowers: (row) => (
    <>
      <FastCreditField name={`${row}.personalData.lastName`} />
      <FastCreditField name={`${row}.personalData.firstName`} />
      <FastCreditField name={`${row}.personalData.middleName`} />
      <FastCreditField name={`${row}.personalData.birthDate`} />
      <FastCreditField name={`${row}.phone`} />
      <FastCreditField name={`${row}.email`} />
      <FastCreditField name={`${row}.relationship`} />
      <FastCreditField name={`${row}.monthlyIncome`} />
    </>
  ),
};

/** Flag + array: rows through `<FieldArray>` (`push`/`remove`), rendered while the flag is set. */
function ArrayBlock({ array, children }: { array: CreditArrayKey; children?: ReactNode }) {
  const { flag, title, rowTitle, addLabel, empty } = CREDIT_ARRAYS[array];
  return (
    <>
      <FastCreditField name={flag} onValueChange={toggleArray(array)} />
      <Shown field={array}>
        <FieldArray name={array}>
          {({ push, remove, form }: FieldArrayRenderProps) => {
            const rows: readonly unknown[] = (form.values as CreditValues)[array];
            return (
              <ArrayFrame
                path={array}
                title={title}
                addLabel={addLabel}
                onAdd={() => push(empty())}
              >
                {rows.map((_, i) => (
                  <ArrayRow
                    key={i}
                    path={array}
                    index={i}
                    title={rowTitle}
                    onRemove={() => remove(i)}
                  >
                    {ROWS[array](`${array}.${i}`)}
                  </ArrayRow>
                ))}
              </ArrayFrame>
            );
          }}
        </FieldArray>
        {children}
      </Shown>
    </>
  );
}

export function AdditionalStep() {
  return (
    <>
      <FastCreditField name="maritalStatus" />
      <FastCreditField name="dependents" />
      <FastCreditField name="education" />
      <ArrayBlock array="properties" />
      <ArrayBlock array="existingLoans" />
      <ArrayBlock array="coBorrowers">
        <Computed name="coBorrowersIncome" />
      </ArrayBlock>
    </>
  );
}

export function ConfirmationStep() {
  return (
    <>
      <FastCreditField name="agreePersonalData" />
      <FastCreditField name="agreeCreditHistory" />
      <FastCreditField name="agreeMarketing" />
      <FastCreditField name="agreeTerms" />
      <FastCreditField name="confirmAccuracy" />
      <FastCreditField name="electronicSignature" />
    </>
  );
}
