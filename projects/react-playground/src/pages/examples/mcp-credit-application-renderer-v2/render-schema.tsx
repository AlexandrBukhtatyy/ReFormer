/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Render schema for the credit-application form (renderer-react v2 — page 2).
 *
 * Layout uses ui-kit `Section` + `Box`. Steps are wrapped in named `Section`s
 * (selectors `step1`..`step6`) so the wizard in `index.tsx` can call
 * `schema.node('stepN').setHidden(...)` to navigate between steps.
 *
 * Stage 4 — FormArray UI:
 *   The 3 array fields on step 5 (`properties`, `existingLoans`, `coBorrowers`)
 *   are rendered through custom block components (PropertiesArrayBlock,
 *   ExistingLoansArrayBlock, CoBorrowersArrayBlock). Each:
 *     - reads its toggle (`hasProperty` / `hasExistingLoans` / `hasCoBorrower`)
 *       reactively via `useFormControl` and conditionally returns `null`
 *       (per @reformer/core/arrays — `enableWhen + resetOnDisable` on whole
 *       ArrayNode hangs the page; gate rendering in JSX instead).
 *     - uses the headless `FormArray.Root / List / AddButton` compound from
 *       @reformer/cdk/form-array.
 *     - renders each item's fields with `FormField.Root + Label + Control + Error`
 *       from @reformer/cdk/form-field.
 *     - shows a "Удалить" button on each card (only when length > 1).
 *     - shows "Добавить" below the list, which pushes a fresh template
 *       (factories live in `schema.ts`).
 */
import { useFormControl, type FormProxy } from '@reformer/core';
import { FormArray } from '@reformer/cdk/form-array';
import { FormField as CdkFormField } from '@reformer/cdk/form-field';
import {
  createRenderSchema,
  RenderNodeComponent,
  type RenderNode,
  type RenderSchemaProxy,
} from '@reformer/renderer-react';
import { Box, Button, Section } from '@reformer/ui-kit';
import { coBorrowerTemplate, existingLoanTemplate, propertyTemplate } from './schema';
import type { CreditApplicationForm } from './types';

/* -----------------------------------------------------------------
 * FormRoot — minimal user-defined root that propagates `form` down
 * (see renderer-react Quick Start). Without this, FieldRenderNodes
 * silently render to null.
 * ----------------------------------------------------------------- */
function FormRoot<T>({ form, children }: { form: FormProxy<T>; children: RenderNode<T>[] }) {
  return (
    <>
      {children.map((child, i) => (
        <RenderNodeComponent key={i} node={child} form={form} />
      ))}
    </>
  );
}

(FormRoot as any).__selfManagedChildren = true;

/* -----------------------------------------------------------------
 * Layout helpers.
 * ----------------------------------------------------------------- */

const rowGrid2 = 'grid grid-cols-1 md:grid-cols-2 gap-4';
const rowGrid3 = 'grid grid-cols-1 md:grid-cols-3 gap-4';
const sectionTitle = 'text-xl font-bold mb-4 text-gray-900';
const sectionShell = 'space-y-4 bg-white border rounded-lg p-6 shadow-sm';
const arrayCard = 'rounded-md border p-4 space-y-3 bg-gray-50';

/* -----------------------------------------------------------------
 * Field — minimal accessible wrapper using the cdk FormField compound.
 * Used inside FormArray.List render-prop where each item field needs
 * label + input + error. Mirrors what `settings.fieldWrapper={FormField}`
 * does outside the array.
 * ----------------------------------------------------------------- */

function ArrayItemField({ control }: { control: any }) {
  return (
    <CdkFormField.Root control={control}>
      <div className="space-y-1">
        <CdkFormField.Label className="text-sm font-medium text-gray-700" />
        <CdkFormField.Control />
        <CdkFormField.Error className="text-xs text-red-600" />
      </div>
    </CdkFormField.Root>
  );
}

/* -----------------------------------------------------------------
 * Array block components — closure-capture `form` and gate render
 * by their respective toggle.
 * ----------------------------------------------------------------- */

function makePropertiesArrayBlock(form: FormProxy<CreditApplicationForm>) {
  return function PropertiesArrayBlock() {
    const hasPropertyState = useFormControl(form.step5.hasProperty) as unknown as {
      value: boolean;
    };
    const propsState = useFormControl(form.step5.properties) as unknown as {
      length: number;
    };
    const hasProperty = hasPropertyState.value;
    const length = propsState.length;
    if (!hasProperty) return null;

    return (
      <Section
        title="Имущество"
        titleAs="h3"
        titleClassName="text-base font-semibold mb-2 text-gray-700"
        className="space-y-4 mt-2"
      >
        <FormArray.Root control={form.step5.properties}>
          <FormArray.List className="space-y-4">
            {({ control, remove }) => (
              <div className={arrayCard} data-testid="property-card">
                <div className={rowGrid2}>
                  <ArrayItemField control={(control as any).type} />
                  <ArrayItemField control={(control as any).estimatedValue} />
                </div>
                <ArrayItemField control={(control as any).description} />
                <ArrayItemField control={(control as any).hasEncumbrance} />
                {length > 1 && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={remove}
                      data-testid="property-remove"
                    >
                      Удалить
                    </Button>
                  </div>
                )}
              </div>
            )}
          </FormArray.List>
          <div>
            <FormArray.AddButton initialValue={propertyTemplate() as any} asChild>
              <Button type="button" variant="outline" size="sm" data-testid="property-add">
                Добавить имущество
              </Button>
            </FormArray.AddButton>
          </div>
        </FormArray.Root>
      </Section>
    );
  };
}

function makeExistingLoansArrayBlock(form: FormProxy<CreditApplicationForm>) {
  return function ExistingLoansArrayBlock() {
    const hasExistingLoansState = useFormControl(form.step5.hasExistingLoans) as unknown as {
      value: boolean;
    };
    const loansState = useFormControl(form.step5.existingLoans) as unknown as {
      length: number;
    };
    const hasExistingLoans = hasExistingLoansState.value;
    const length = loansState.length;
    if (!hasExistingLoans) return null;

    return (
      <Section
        title="Действующие кредиты"
        titleAs="h3"
        titleClassName="text-base font-semibold mb-2 text-gray-700"
        className="space-y-4 mt-2"
      >
        <FormArray.Root control={form.step5.existingLoans}>
          <FormArray.List className="space-y-4">
            {({ control, remove }) => (
              <div className={arrayCard} data-testid="loan-card">
                <div className={rowGrid2}>
                  <ArrayItemField control={(control as any).bank} />
                  <ArrayItemField control={(control as any).type} />
                </div>
                <div className={rowGrid3}>
                  <ArrayItemField control={(control as any).amount} />
                  <ArrayItemField control={(control as any).remainingAmount} />
                  <ArrayItemField control={(control as any).monthlyPayment} />
                </div>
                <ArrayItemField control={(control as any).maturityDate} />
                {length > 1 && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={remove}
                      data-testid="loan-remove"
                    >
                      Удалить
                    </Button>
                  </div>
                )}
              </div>
            )}
          </FormArray.List>
          <div>
            <FormArray.AddButton initialValue={existingLoanTemplate() as any} asChild>
              <Button type="button" variant="outline" size="sm" data-testid="loan-add">
                Добавить кредит
              </Button>
            </FormArray.AddButton>
          </div>
        </FormArray.Root>
      </Section>
    );
  };
}

function makeCoBorrowersArrayBlock(form: FormProxy<CreditApplicationForm>) {
  return function CoBorrowersArrayBlock() {
    const hasCoBorrowerState = useFormControl(form.step5.hasCoBorrower) as unknown as {
      value: boolean;
    };
    const coBorrowersState = useFormControl(form.step5.coBorrowers) as unknown as {
      length: number;
    };
    const hasCoBorrower = hasCoBorrowerState.value;
    const length = coBorrowersState.length;
    if (!hasCoBorrower) return null;

    return (
      <Section
        title="Созаемщики"
        titleAs="h3"
        titleClassName="text-base font-semibold mb-2 text-gray-700"
        className="space-y-4 mt-2"
      >
        <FormArray.Root control={form.step5.coBorrowers}>
          <FormArray.List className="space-y-4">
            {({ control, remove }) => (
              <div className={arrayCard} data-testid="coborrower-card">
                <div className={rowGrid3}>
                  <ArrayItemField control={(control as any).personalData.lastName} />
                  <ArrayItemField control={(control as any).personalData.firstName} />
                  <ArrayItemField control={(control as any).personalData.middleName} />
                </div>
                <div className={rowGrid3}>
                  <ArrayItemField control={(control as any).personalData.birthDate} />
                  <ArrayItemField control={(control as any).personalData.gender} />
                  <ArrayItemField control={(control as any).personalData.birthPlace} />
                </div>
                <div className={rowGrid2}>
                  <ArrayItemField control={(control as any).phone} />
                  <ArrayItemField control={(control as any).email} />
                </div>
                <div className={rowGrid2}>
                  <ArrayItemField control={(control as any).relationship} />
                  <ArrayItemField control={(control as any).monthlyIncome} />
                </div>
                {length > 1 && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={remove}
                      data-testid="coborrower-remove"
                    >
                      Удалить
                    </Button>
                  </div>
                )}
              </div>
            )}
          </FormArray.List>
          <div>
            <FormArray.AddButton initialValue={coBorrowerTemplate() as any} asChild>
              <Button type="button" variant="outline" size="sm" data-testid="coborrower-add">
                Добавить созаемщика
              </Button>
            </FormArray.AddButton>
          </div>
        </FormArray.Root>
      </Section>
    );
  };
}

/* -----------------------------------------------------------------
 * createCreditApplicationRenderSchema — closure factory.
 * ----------------------------------------------------------------- */
export function createCreditApplicationRenderSchema(
  form: FormProxy<CreditApplicationForm>
): RenderSchemaProxy<CreditApplicationForm> {
  const PropertiesArrayBlock = makePropertiesArrayBlock(form);
  const ExistingLoansArrayBlock = makeExistingLoansArrayBlock(form);
  const CoBorrowersArrayBlock = makeCoBorrowersArrayBlock(form);

  return createRenderSchema<CreditApplicationForm>((path) => ({
    component: FormRoot,
    componentProps: { form },
    children: [
      /* ============================== Step 1 ============================== */
      {
        selector: 'step1',
        component: Section,
        componentProps: {
          title: 'Шаг 1. Параметры кредита',
          titleAs: 'h2',
          titleClassName: sectionTitle,
          className: sectionShell,
        },
        children: [
          { component: path.step1.loanType },
          {
            component: Box,
            componentProps: { className: rowGrid2 },
            children: [{ component: path.step1.loanAmount }, { component: path.step1.loanTerm }],
          },
          { component: path.step1.loanPurpose },
          {
            selector: 'step1-mortgage-row',
            component: Box,
            componentProps: { className: rowGrid2 },
            children: [
              { component: path.step1.propertyValue },
              { component: path.step1.initialPayment },
            ],
          },
          {
            selector: 'step1-car-row',
            component: Box,
            componentProps: { className: rowGrid2 },
            children: [
              { component: path.step1.carBrand },
              { component: path.step1.carModel },
              { component: path.step1.carYear },
              { component: path.step1.carPrice },
            ],
          },
          {
            component: Box,
            componentProps: { className: rowGrid2 },
            children: [
              { component: path.step1.interestRate },
              { component: path.step1.monthlyPayment },
            ],
          },
        ],
      },

      /* ============================== Step 2 ============================== */
      {
        selector: 'step2',
        component: Section,
        componentProps: {
          title: 'Шаг 2. Личные данные',
          titleAs: 'h2',
          titleClassName: sectionTitle,
          className: sectionShell,
        },
        children: [
          {
            component: Box,
            componentProps: { className: rowGrid3 },
            children: [
              { component: path.step2.personalData.lastName },
              { component: path.step2.personalData.firstName },
              { component: path.step2.personalData.middleName },
            ],
          },
          {
            component: Box,
            componentProps: { className: rowGrid3 },
            children: [
              { component: path.step2.personalData.birthDate },
              { component: path.step2.personalData.gender },
              { component: path.step2.personalData.birthPlace },
            ],
          },
          {
            component: Box,
            componentProps: { className: rowGrid2 },
            children: [{ component: path.step2.fullName }, { component: path.step2.age }],
          },
          {
            component: Section,
            componentProps: {
              title: 'Паспортные данные',
              titleAs: 'h3',
              titleClassName: 'text-base font-semibold mb-2 text-gray-700',
              className: 'space-y-4 mt-4',
            },
            children: [
              {
                component: Box,
                componentProps: { className: rowGrid3 },
                children: [
                  { component: path.step2.passportData.series },
                  { component: path.step2.passportData.number },
                  { component: path.step2.passportData.departmentCode },
                ],
              },
              {
                component: Box,
                componentProps: { className: rowGrid2 },
                children: [
                  { component: path.step2.passportData.issueDate },
                  { component: path.step2.passportData.issuedBy },
                ],
              },
            ],
          },
          {
            component: Box,
            componentProps: { className: rowGrid2 },
            children: [{ component: path.step2.inn }, { component: path.step2.snils }],
          },
        ],
      },

      /* ============================== Step 3 ============================== */
      {
        selector: 'step3',
        component: Section,
        componentProps: {
          title: 'Шаг 3. Контактная информация',
          titleAs: 'h2',
          titleClassName: sectionTitle,
          className: sectionShell,
        },
        children: [
          {
            component: Box,
            componentProps: { className: rowGrid2 },
            children: [
              { component: path.step3.phoneMain },
              { component: path.step3.phoneAdditional },
            ],
          },
          {
            component: Box,
            componentProps: { className: rowGrid2 },
            children: [{ component: path.step3.email }, { component: path.step3.emailAdditional }],
          },
          {
            component: Section,
            componentProps: {
              title: 'Адрес регистрации',
              titleAs: 'h3',
              titleClassName: 'text-base font-semibold mb-2 text-gray-700',
              className: 'space-y-4 mt-4',
            },
            children: [
              {
                component: Box,
                componentProps: { className: rowGrid2 },
                children: [
                  { component: path.step3.registrationAddress.region },
                  { component: path.step3.registrationAddress.city },
                ],
              },
              {
                component: Box,
                componentProps: { className: rowGrid3 },
                children: [
                  { component: path.step3.registrationAddress.street },
                  { component: path.step3.registrationAddress.house },
                  { component: path.step3.registrationAddress.apartment },
                ],
              },
              { component: path.step3.registrationAddress.postalCode },
            ],
          },
          { component: path.step3.sameAsRegistration },
          {
            selector: 'step3-residence',
            component: Section,
            componentProps: {
              title: 'Адрес проживания',
              titleAs: 'h3',
              titleClassName: 'text-base font-semibold mb-2 text-gray-700',
              className: 'space-y-4 mt-4',
            },
            children: [
              {
                component: Box,
                componentProps: { className: rowGrid2 },
                children: [
                  { component: path.step3.residenceAddress.region },
                  { component: path.step3.residenceAddress.city },
                ],
              },
              {
                component: Box,
                componentProps: { className: rowGrid3 },
                children: [
                  { component: path.step3.residenceAddress.street },
                  { component: path.step3.residenceAddress.house },
                  { component: path.step3.residenceAddress.apartment },
                ],
              },
              { component: path.step3.residenceAddress.postalCode },
            ],
          },
        ],
      },

      /* ============================== Step 4 ============================== */
      {
        selector: 'step4',
        component: Section,
        componentProps: {
          title: 'Шаг 4. Информация о занятости',
          titleAs: 'h2',
          titleClassName: sectionTitle,
          className: sectionShell,
        },
        children: [
          { component: path.step4.employmentStatus },
          {
            selector: 'step4-employed',
            component: Section,
            componentProps: {
              title: 'Работа по найму',
              titleAs: 'h3',
              titleClassName: 'text-base font-semibold mb-2 text-gray-700',
              className: 'space-y-4 mt-4',
            },
            children: [
              {
                component: Box,
                componentProps: { className: rowGrid2 },
                children: [
                  { component: path.step4.companyName },
                  { component: path.step4.companyInn },
                ],
              },
              {
                component: Box,
                componentProps: { className: rowGrid2 },
                children: [
                  { component: path.step4.companyPhone },
                  { component: path.step4.companyAddress },
                ],
              },
              { component: path.step4.position },
            ],
          },
          {
            selector: 'step4-self-employed',
            component: Section,
            componentProps: {
              title: 'ИП / Самозанятый',
              titleAs: 'h3',
              titleClassName: 'text-base font-semibold mb-2 text-gray-700',
              className: 'space-y-4 mt-4',
            },
            children: [
              {
                component: Box,
                componentProps: { className: rowGrid2 },
                children: [
                  { component: path.step4.businessType },
                  { component: path.step4.businessInn },
                ],
              },
              { component: path.step4.businessActivity },
            ],
          },
          {
            component: Box,
            componentProps: { className: rowGrid2 },
            children: [
              { component: path.step4.workExperienceTotal },
              { component: path.step4.workExperienceCurrent },
            ],
          },
          {
            component: Box,
            componentProps: { className: rowGrid2 },
            children: [
              { component: path.step4.monthlyIncome },
              { component: path.step4.additionalIncome },
            ],
          },
          { component: path.step4.additionalIncomeSource },
          {
            component: Box,
            componentProps: { className: rowGrid2 },
            children: [
              { component: path.step4.totalIncome },
              { component: path.step4.paymentToIncomeRatio },
            ],
          },
        ],
      },

      /* ============================== Step 5 ============================== */
      {
        selector: 'step5',
        component: Section,
        componentProps: {
          title: 'Шаг 5. Дополнительная информация',
          titleAs: 'h2',
          titleClassName: sectionTitle,
          className: sectionShell,
        },
        children: [
          {
            component: Box,
            componentProps: { className: rowGrid3 },
            children: [
              { component: path.step5.maritalStatus },
              { component: path.step5.dependents },
              { component: path.step5.education },
            ],
          },
          { component: path.step5.hasProperty },
          {
            selector: 'step5-properties',
            component: PropertiesArrayBlock,
          },
          { component: path.step5.hasExistingLoans },
          {
            selector: 'step5-existing-loans',
            component: ExistingLoansArrayBlock,
          },
          { component: path.step5.hasCoBorrower },
          {
            selector: 'step5-coborrowers',
            component: CoBorrowersArrayBlock,
          },
          { component: path.step5.coBorrowersIncome },
        ],
      },

      /* ============================== Step 6 ============================== */
      {
        selector: 'step6',
        component: Section,
        componentProps: {
          title: 'Шаг 6. Подтверждение и согласия',
          titleAs: 'h2',
          titleClassName: sectionTitle,
          className: sectionShell,
        },
        children: [
          { component: path.step6.agreePersonalData },
          { component: path.step6.agreeCreditHistory },
          { component: path.step6.agreeMarketing },
          { component: path.step6.agreeTerms },
          { component: path.step6.confirmAccuracy },
          { component: path.step6.electronicSignature },
        ],
      },
    ],
  }));
}
