/**
 * Кредитная заявка на `@reformer/core` + headless `@reformer/cdk` — порт демо
 * `react-playground/src/pages/demo/complex-multy-step-form` («React руками») на нейтральный UI.
 *
 * Сборка, правила, поведение и поток шагов — общие с JSON-вариантом (../../reformer-kit/credit).
 * Здесь — только раскладка шагов: поля `<Field control={form.x} />` (компонент и пропсы — в схеме,
 * ./schema.ts), условные секции — по предикатам домена через `useFormControlValue`
 * (18-conditional-fields.md, «Скрытие в JSX»), массивы — `useFieldArray` из
 * `@reformer/cdk/field-array` со строкой под `React.memo` по `control` (cdk 02-field-array.md),
 * вычисляемые — `<Computed control={form.x} />`, визард — снимок
 * потока `useFormFlow` на общем `WizardShell` (../../reformer-kit/wizard.tsx).
 */
import { memo, useState, type ComponentType, type FormEvent, type ReactNode } from 'react';
import type { FormArray, FormGroup } from '@reformer/core';
import { useFormBundle, useFormControlValue } from '@reformer/core/react';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { useFieldArray } from '@reformer/cdk/field-array';
import {
  CREDIT_ARRAYS,
  CREDIT_STEPS,
  SECTION_TITLES,
  isCarLoan,
  isEmployed,
  isMortgage,
  isSelfEmployed,
  livesElsewhere,
  type CreditAddress,
  type CreditArrayKey,
  type CreditValues,
} from '../../../shared/domain/credit';
import { ArrayFrame, ArrayRow, Section } from '../../../shared/ui/array';
import { Page, SubmitResult } from '../../../shared/ui/layout';
import { Computed, Field } from '../../reformer-kit/Field';
import { FlowWizard } from '../../reformer-kit/wizard';
import { creditBehavior } from '../../reformer-kit/credit/behavior';
import {
  createCreditForm,
  sendCredit,
  useCreditStart,
  type CreditDictionaries,
} from '../../reformer-kit/credit/form';
import { creditMessages } from '../../reformer-kit/credit/rules';
import { creditSchema } from './schema';

type Form = FormGroup<CreditValues>;

function LoanStep({ form }: { form: Form }) {
  const loanType = useFormControlValue(form.loanType);
  return (
    <>
      <Field control={form.loanType} />
      <Field control={form.loanAmount} />
      <Field control={form.loanTerm} />
      <Field control={form.loanPurpose} />
      {isMortgage(loanType) ? (
        <Section title={SECTION_TITLES.mortgage}>
          <Field control={form.propertyValue} />
          <Computed control={form.initialPayment} />
        </Section>
      ) : null}
      {isCarLoan(loanType) ? (
        <Section title={SECTION_TITLES.car}>
          <Field control={form.carBrand} />
          <Field control={form.carModel} />
          <Field control={form.carYear} />
          <Field control={form.carPrice} />
        </Section>
      ) : null}
      <Section title={SECTION_TITLES.calculation}>
        <Computed control={form.interestRate} />
        <Computed control={form.monthlyPayment} />
      </Section>
    </>
  );
}

function PersonalStep({ form }: { form: Form }) {
  const person = form.personalData;
  const passport = form.passportData;
  return (
    <>
      <Section title={SECTION_TITLES.personalData}>
        <Field control={person.lastName} />
        <Field control={person.firstName} />
        <Field control={person.middleName} />
        <Field control={person.birthDate} />
        <Field control={person.gender} />
        <Field control={person.birthPlace} />
        <Computed control={form.fullName} />
        <Computed control={form.age} />
      </Section>
      <Section title={SECTION_TITLES.passportData}>
        <Field control={passport.series} />
        <Field control={passport.number} />
        <Field control={passport.issueDate} />
        <Field control={passport.issuedBy} />
        <Field control={passport.departmentCode} />
      </Section>
      <Field control={form.inn} />
      <Field control={form.snils} />
    </>
  );
}

/** Подформа адреса — одна на регистрацию и проживание. */
function Address({ group }: { group: FormGroup<CreditAddress> }) {
  return (
    <>
      <Field control={group.region} />
      <Field control={group.city} />
      <Field control={group.street} />
      <Field control={group.house} />
      <Field control={group.apartment} />
      <Field control={group.postalCode} />
    </>
  );
}

function ContactsStep({ form }: { form: Form }) {
  const sameAsRegistration = useFormControlValue(form.sameAsRegistration);
  return (
    <>
      <Field control={form.phoneMain} />
      <Field control={form.phoneAdditional} />
      <Field control={form.email} />
      <Field control={form.sameEmail} />
      <Field control={form.emailAdditional} />
      <Section title={SECTION_TITLES.registrationAddress}>
        <Address group={form.registrationAddress} />
      </Section>
      <Field control={form.sameAsRegistration} />
      {livesElsewhere(sameAsRegistration) ? (
        <Section title={SECTION_TITLES.residenceAddress}>
          <Address group={form.residenceAddress} />
        </Section>
      ) : null}
    </>
  );
}

function EmploymentStep({ form }: { form: Form }) {
  const status = useFormControlValue(form.employmentStatus);
  return (
    <>
      <Field control={form.employmentStatus} />
      {isEmployed(status) ? (
        <Section title={SECTION_TITLES.employer}>
          <Field control={form.companyName} />
          <Field control={form.companyInn} />
          <Field control={form.companyPhone} />
          <Field control={form.companyAddress} />
          <Field control={form.position} />
        </Section>
      ) : null}
      {isSelfEmployed(status) ? (
        <Section title={SECTION_TITLES.business}>
          <Field control={form.businessType} />
          <Field control={form.businessInn} />
          <Field control={form.businessActivity} />
        </Section>
      ) : null}
      <Field control={form.workExperienceTotal} />
      <Field control={form.workExperienceCurrent} />
      <Section title={SECTION_TITLES.income}>
        <Field control={form.monthlyIncome} />
        <Field control={form.additionalIncome} />
        <Field control={form.additionalIncomeSource} />
        <Computed control={form.totalIncome} />
        <Computed control={form.paymentToIncomeRatio} />
      </Section>
    </>
  );
}

interface RowProps<T extends object> {
  array: CreditArrayKey;
  rows: FormArray<T>;
  control: FormGroup<T>;
  index: number;
  render: (row: FormGroup<T>) => ReactNode;
}

/**
 * Строка массива — отдельный компонент под `React.memo` по `control` строки, как велит
 * `@reformer/cdk` (02-field-array.md: «wrap heavy rows in `React.memo` on `control`»;
 * 07-troubleshooting.md, «FieldArray.List ререндерит весь массив»): `useFieldArray` перерисовывает
 * список на каждую правку внутри любой строки, memo оставляет перерисовку строке, у которой сменился
 * индекс. Удаление — `rows.removeAt(index)`: замыкание `item.remove` новое на каждый пересчёт
 * `items` и сбивало бы memo. Путь DOM-контракта поля строки (`properties-0-description`) поле
 * берёт из своего живого пути в модели — префикс строки разметке массива задавать не нужно.
 */
function RowImpl<T extends object>({ array, rows, control, index, render }: RowProps<T>) {
  return (
    <ArrayRow
      path={array}
      index={index}
      title={CREDIT_ARRAYS[array].rowTitle}
      onRemove={() => rows.removeAt(index)}
    >
      {render(control)}
    </ArrayRow>
  );
}
const Row = memo(RowImpl) as typeof RowImpl;

/** Массив под-форм: headless `useFieldArray`, строки — общие `ArrayFrame`/`ArrayRow`. */
function Rows<T extends object>({
  array,
  control,
  children,
}: {
  array: CreditArrayKey;
  control: FormArray<T>;
  children: (row: FormGroup<T>) => ReactNode;
}) {
  const { items, add } = useFieldArray(control);
  const meta = CREDIT_ARRAYS[array];
  return (
    <ArrayFrame path={array} title={meta.title} addLabel={meta.addLabel} onAdd={() => add()}>
      {items.map((item) => (
        <Row
          key={item.id}
          array={array}
          rows={control}
          control={item.control}
          index={item.index}
          render={children}
        />
      ))}
    </ArrayFrame>
  );
}

function AdditionalStep({ form }: { form: Form }) {
  const hasProperty = useFormControlValue(form.hasProperty);
  const hasExistingLoans = useFormControlValue(form.hasExistingLoans);
  const hasCoBorrower = useFormControlValue(form.hasCoBorrower);
  return (
    <>
      <Field control={form.maritalStatus} />
      <Field control={form.dependents} />
      <Field control={form.education} />
      <Field control={form.hasProperty} />
      {hasProperty ? (
        <Rows array="properties" control={form.properties}>
          {(row) => (
            <>
              <Field control={row.type} />
              <Field control={row.description} />
              <Field control={row.estimatedValue} />
              <Field control={row.hasEncumbrance} />
            </>
          )}
        </Rows>
      ) : null}
      <Field control={form.hasExistingLoans} />
      {hasExistingLoans ? (
        <Rows array="existingLoans" control={form.existingLoans}>
          {(row) => (
            <>
              <Field control={row.bank} />
              <Field control={row.type} />
              <Field control={row.amount} />
              <Field control={row.remainingAmount} />
              <Field control={row.monthlyPayment} />
              <Field control={row.maturityDate} />
            </>
          )}
        </Rows>
      ) : null}
      <Field control={form.hasCoBorrower} />
      {hasCoBorrower ? (
        <>
          <Rows array="coBorrowers" control={form.coBorrowers}>
            {(row) => (
              <>
                <Field control={row.personalData.lastName} />
                <Field control={row.personalData.firstName} />
                <Field control={row.personalData.middleName} />
                <Field control={row.personalData.birthDate} />
                <Field control={row.phone} />
                <Field control={row.email} />
                <Field control={row.relationship} />
                <Field control={row.monthlyIncome} />
              </>
            )}
          </Rows>
          <Computed control={form.coBorrowersIncome} />
        </>
      ) : null}
    </>
  );
}

function ConfirmationStep({ form }: { form: Form }) {
  return (
    <>
      <Field control={form.agreePersonalData} />
      <Field control={form.agreeCreditHistory} />
      <Field control={form.agreeMarketing} />
      <Field control={form.agreeTerms} />
      <Field control={form.confirmAccuracy} />
      <Field control={form.electronicSignature} />
    </>
  );
}

/** Тело шага по id шага потока. */
const STEP_BODIES: Record<string, ComponentType<{ form: Form }>> = {
  loan: LoanStep,
  applicant: PersonalStep,
  contacts: ContactsStep,
  employment: EmploymentStep,
  additional: AdditionalStep,
  confirmation: ConfirmationStep,
};

function CreditWizardForm({
  initial,
  dictionaries,
}: {
  initial: CreditValues;
  dictionaries: CreditDictionaries;
}) {
  const bundle = useFormBundle(() =>
    createCreditForm(initial, { schema: creditSchema(dictionaries), behavior: creditBehavior })
  );
  const [result, setResult] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const outcome = await bundle.submission.submit(sendCredit);
    if (outcome.status === 'submitted') setResult(outcome.result);
  };

  return (
    <form noValidate onSubmit={onSubmit}>
      <FlowWizard flow={bundle.flow!} steps={CREDIT_STEPS}>
        {(stepId) => {
          const Step = STEP_BODIES[stepId];
          return <Step form={bundle.form} />;
        }}
      </FlowWizard>
      {result ? <SubmitResult>{result}</SubmitResult> : null}
    </form>
  );
}

export function CreditForm() {
  const { dictionaries, initial } = useCreditStart();
  return (
    <ValidationMessagesProvider messages={creditMessages}>
      <Page title="Заявка на кредит">
        {initial ? <CreditWizardForm initial={initial} dictionaries={dictionaries} /> : null}
      </Page>
    </ValidationMessagesProvider>
  );
}
