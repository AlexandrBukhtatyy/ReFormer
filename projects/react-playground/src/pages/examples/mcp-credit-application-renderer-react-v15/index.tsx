import { useCallback, useMemo, useRef, useState, type FC } from 'react';
import type { FormProxy } from '@reformer/core';
import {
  FormRenderer,
  createRenderSchema,
  type RenderNode,
  type RenderSchemaFn,
} from '@reformer/renderer-react';
import {
  Box,
  Section,
  FormField,
  FormArraySection,
  FormWizard,
} from '@reformer/ui-kit';
import {
  createCreditApplicationForm,
  STEP_VALIDATIONS,
  newPropertyItem,
  newExistingLoan,
  newCoBorrower,
  type CreditApplicationForm,
  type PropertyItem,
  type ExistingLoan,
  type CoBorrower,
} from './schema';

// ---------- Item subcomponents for FormArraySection ----------

const PropertyItemForm: FC<{ control: FormProxy<PropertyItem> }> = ({ control }) => (
  <div className="grid grid-cols-1 gap-3">
    <FormField control={control.type} testId="property-type" />
    <FormField control={control.description} testId="property-description" />
    <FormField control={control.estimatedValue} testId="property-estimatedValue" />
    <FormField control={control.hasEncumbrance} testId="property-hasEncumbrance" />
  </div>
);

const ExistingLoanForm: FC<{ control: FormProxy<ExistingLoan> }> = ({ control }) => (
  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
    <FormField control={control.bank} testId="loan-bank" />
    <FormField control={control.type} testId="loan-type" />
    <FormField control={control.amount} testId="loan-amount" />
    <FormField control={control.remainingAmount} testId="loan-remainingAmount" />
    <FormField control={control.monthlyPayment} testId="loan-monthlyPayment" />
    <FormField control={control.maturityDate} testId="loan-maturityDate" />
  </div>
);

const CoBorrowerForm: FC<{ control: FormProxy<CoBorrower> }> = ({ control }) => (
  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
    <FormField control={control.personalData.lastName} testId="cob-lastName" />
    <FormField control={control.personalData.firstName} testId="cob-firstName" />
    <FormField control={control.personalData.middleName} testId="cob-middleName" />
    <FormField control={control.personalData.birthDate} testId="cob-birthDate" />
    <FormField control={control.phone} testId="cob-phone" />
    <FormField control={control.email} testId="cob-email" />
    <FormField control={control.relationship} testId="cob-relationship" />
    <FormField control={control.monthlyIncome} testId="cob-monthlyIncome" />
  </div>
);

// ---------- Step body components (for steps with arrays — FC body) ----------

const Step5Body: FC<{ control: FormProxy<CreditApplicationForm> }> = ({ control }) => (
  <div className="space-y-6">
    <Section title="Личное" className="space-y-3">
      <FormField control={control.maritalStatus} testId="maritalStatus" />
      <FormField control={control.dependents} testId="dependents" />
      <FormField control={control.education} testId="education" />
    </Section>

    <Section title="Имущество" className="space-y-3">
      <FormField control={control.hasProperty} testId="hasProperty" />
      <FormArraySection<PropertyItem>
        control={control.properties}
        itemComponent={PropertyItemForm}
        title="Список имущества"
        itemLabel="Имущество"
        addButtonLabel="+ Добавить имущество"
        emptyMessage="Имущество не добавлено"
        initialValue={newPropertyItem()}
      />
    </Section>

    <Section title="Существующие кредиты" className="space-y-3">
      <FormField control={control.hasExistingLoans} testId="hasExistingLoans" />
      <FormArraySection<ExistingLoan>
        control={control.existingLoans}
        itemComponent={ExistingLoanForm}
        title="Список кредитов"
        itemLabel="Кредит"
        addButtonLabel="+ Добавить кредит"
        emptyMessage="Кредиты не добавлены"
        initialValue={newExistingLoan()}
      />
    </Section>

    <Section title="Созаемщики" className="space-y-3">
      <FormField control={control.hasCoBorrower} testId="hasCoBorrower" />
      <FormArraySection<CoBorrower>
        control={control.coBorrowers}
        itemComponent={CoBorrowerForm}
        title="Список созаемщиков"
        itemLabel="Созаемщик"
        addButtonLabel="+ Добавить созаемщика"
        emptyMessage="Созаемщики не добавлены"
        initialValue={newCoBorrower()}
      />
    </Section>

    <Section title="Сводка" className="space-y-3">
      <FormField control={control.coBorrowersIncome} testId="coBorrowersIncome" />
    </Section>
  </div>
);

// ---------- Render schema (FormWizard as root) ----------

function buildRenderSchema(
  form: FormProxy<CreditApplicationForm>,
  handleSubmit: () => Promise<void>
) {
  const renderFn: RenderSchemaFn<CreditApplicationForm> = (path) => {
    // Step 1 body — RenderNode subtree
    const step1Body: RenderNode<CreditApplicationForm> = {
      component: Box,
      componentProps: { className: 'space-y-4' },
      children: [
        {
          component: Section,
          componentProps: { title: 'Параметры кредита', className: 'space-y-3' },
          children: [
            { component: path.loanType },
            { component: path.loanAmount },
            { component: path.loanTerm },
            { component: path.loanPurpose },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Ипотека (для loanType=mortgage)', className: 'space-y-3' },
          children: [
            { component: path.propertyValue },
            { component: path.initialPayment },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Автокредит (для loanType=car)', className: 'space-y-3' },
          children: [
            { component: path.carBrand },
            { component: path.carModel },
            { component: path.carYear },
            { component: path.carPrice },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Расчёт', className: 'space-y-3' },
          children: [
            { component: path.interestRate },
            { component: path.monthlyPayment },
          ],
        },
      ],
    };

    // Step 2 body — Personal Data + Passport + INN/SNILS
    const step2Body: RenderNode<CreditApplicationForm> = {
      component: Box,
      componentProps: { className: 'space-y-4' },
      children: [
        {
          component: Section,
          componentProps: { title: 'Личные данные', className: 'space-y-3' },
          children: [
            { component: path.personalData.lastName },
            { component: path.personalData.firstName },
            { component: path.personalData.middleName },
            { component: path.personalData.birthDate },
            { component: path.personalData.gender },
            { component: path.personalData.birthPlace },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Паспортные данные', className: 'space-y-3' },
          children: [
            { component: path.passportData.series },
            { component: path.passportData.number },
            { component: path.passportData.issueDate },
            { component: path.passportData.issuedBy },
            { component: path.passportData.departmentCode },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Документы', className: 'space-y-3' },
          children: [
            { component: path.inn },
            { component: path.snils },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Сводка', className: 'space-y-3' },
          children: [
            { component: path.fullName },
            { component: path.age },
          ],
        },
      ],
    };

    // Step 3 body — Contacts
    const step3Body: RenderNode<CreditApplicationForm> = {
      component: Box,
      componentProps: { className: 'space-y-4' },
      children: [
        {
          component: Section,
          componentProps: { title: 'Контакты', className: 'space-y-3' },
          children: [
            { component: path.phoneMain },
            { component: path.phoneAdditional },
            { component: path.email },
            { component: path.emailAdditional },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Адрес регистрации', className: 'space-y-3' },
          children: [
            { component: path.registrationAddress.region },
            { component: path.registrationAddress.city },
            { component: path.registrationAddress.street },
            { component: path.registrationAddress.house },
            { component: path.registrationAddress.apartment },
            { component: path.registrationAddress.postalCode },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Адрес проживания', className: 'space-y-3' },
          children: [
            { component: path.sameAsRegistration },
            { component: path.residenceAddress.region },
            { component: path.residenceAddress.city },
            { component: path.residenceAddress.street },
            { component: path.residenceAddress.house },
            { component: path.residenceAddress.apartment },
            { component: path.residenceAddress.postalCode },
          ],
        },
      ],
    };

    // Step 4 body — Employment
    const step4Body: RenderNode<CreditApplicationForm> = {
      component: Box,
      componentProps: { className: 'space-y-4' },
      children: [
        {
          component: Section,
          componentProps: { title: 'Занятость', className: 'space-y-3' },
          children: [{ component: path.employmentStatus }],
        },
        {
          component: Section,
          componentProps: { title: 'Работа по найму', className: 'space-y-3' },
          children: [
            { component: path.companyName },
            { component: path.companyInn },
            { component: path.companyPhone },
            { component: path.companyAddress },
            { component: path.position },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Стаж и доход', className: 'space-y-3' },
          children: [
            { component: path.workExperienceTotal },
            { component: path.workExperienceCurrent },
            { component: path.monthlyIncome },
            { component: path.additionalIncome },
            { component: path.additionalIncomeSource },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'ИП / Самозанятый', className: 'space-y-3' },
          children: [
            { component: path.businessType },
            { component: path.businessInn },
            { component: path.businessActivity },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Сводный доход', className: 'space-y-3' },
          children: [
            { component: path.totalIncome },
            { component: path.paymentToIncomeRatio },
          ],
        },
      ],
    };

    // Step 6 body — Confirmation
    const step6Body: RenderNode<CreditApplicationForm> = {
      component: Box,
      componentProps: { className: 'space-y-4' },
      children: [
        {
          component: Section,
          componentProps: { title: 'Согласия', className: 'space-y-3' },
          children: [
            { component: path.agreePersonalData },
            { component: path.agreeCreditHistory },
            { component: path.agreeMarketing },
            { component: path.agreeTerms },
          ],
        },
        {
          component: Section,
          componentProps: { title: 'Подтверждение', className: 'space-y-3' },
          children: [
            { component: path.confirmAccuracy },
            { component: path.electronicSignature },
          ],
        },
      ],
    };

    return {
      selector: 'wizard',
      component: FormWizard,
      componentProps: {
        form,
        config: {
          stepValidations: STEP_VALIDATIONS,
          fullValidation: (p: typeof path) => {
            // Compose all step validations for final submit
            STEP_VALIDATIONS[1](p);
            STEP_VALIDATIONS[2](p);
            STEP_VALIDATIONS[3](p);
            STEP_VALIDATIONS[4](p);
            STEP_VALIDATIONS[5](p);
            STEP_VALIDATIONS[6](p);
          },
        },
        onSubmit: handleSubmit,
        steps: [
          { number: 1, title: 'Кредит', icon: '💰', body: step1Body },
          { number: 2, title: 'Личные данные', icon: '👤', body: step2Body },
          { number: 3, title: 'Контакты', icon: '📞', body: step3Body },
          { number: 4, title: 'Работа', icon: '💼', body: step4Body },
          { number: 5, title: 'Доп. инфо', icon: 'ℹ️', body: Step5Body },
          { number: 6, title: 'Подтверждение', icon: '✅', body: step6Body },
        ],
      },
    };
  };

  return createRenderSchema<CreditApplicationForm>(renderFn);
}

// ---------- Page ----------

export default function McpCreditApplicationRendererReactV15Page() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const submittedRef = useRef(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    submittedRef.current = true;
    const values = form.getValue() as CreditApplicationForm;
    // Mock submit — log + show success message
    console.log('[mcp-credit-renderer-react-v15] submitted', values);
    await new Promise((r) => setTimeout(r, 200));
    setSubmitMessage('Заявка успешно отправлена');
  }, [form]);

  const schema = useMemo(() => buildRenderSchema(form, handleSubmit), [form, handleSubmit]);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-2xl font-bold">MCP Credit Application — renderer-react v15</h1>
      <p className="mb-6 text-sm text-gray-600">
        iter-15 generated via MCP-only sandbox: createRenderSchema + FormRenderer + FormWizard root pattern.
      </p>
      {submitMessage && (
        <div
          className="mb-4 rounded border border-green-300 bg-green-50 p-3 text-green-800"
          data-testid="submit-success"
        >
          {submitMessage}
        </div>
      )}
      <FormRenderer<CreditApplicationForm> render={schema} settings={{ fieldWrapper: FormField }} />
    </div>
  );
}
