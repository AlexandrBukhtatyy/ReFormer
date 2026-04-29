/**
 * RenderSchema for the iter-7 page-2 credit-application form.
 *
 * Architecture (per add-wizard.json B2 + add-form-array.json):
 *  - Root: <FormRoot> with `__selfManagedChildren = true` and `form` injected
 *    via componentProps closure. FormRoot just maps children → RenderNodeComponent.
 *  - Children: 6 step containers, each with `selector: 'stepN'`. The wizard
 *    drives visibility via setHidden in index.tsx (NOT via hideWhen here —
 *    setHidden is the authoritative path for currentStep-driven visibility).
 *  - Conditional sub-sections inside steps get their own selectors and use
 *    top-level `hideWhen(...)` calls AFTER `createRenderSchema(...)`.
 *  - 3 FormArray sections (properties, existingLoans, coBorrowers) use the
 *    custom `FormArrayBlock` component below — it resolves
 *    `FieldPath → ArrayNode` via `FieldPathNavigator + extractPath`
 *    (regression test for Patch C: `<T extends FormFields>` constraint).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReactNode } from 'react';
import {
  type ArrayNode,
  type FieldPath,
  type FieldPathNode,
  type FormFields,
  type FormProxy,
  FieldPathNavigator,
  createFieldPath,
  extractPath,
} from '@reformer/core';
import { FormArray } from '@reformer/cdk/form-array';
import {
  RenderNodeComponent,
  createRenderSchema,
  hideWhen,
  type RenderNode,
} from '@reformer/renderer-react';
import { Box, Section } from '@reformer/ui-kit';
import type { CreditApplicationForm, Property, ExistingLoan, CoBorrower } from './types';

// ============================================================================
// FormRoot — self-managed root container.
//
// Critical bits (renderer-react/01-overview.md gotcha #1 & #2):
//  - `__selfManagedChildren = true` — RenderNodeComponent will pass children
//    through as raw RenderNode[] (not pre-rendered ReactNodes) AND will
//    forward `form` via componentProps.
//  - `children` is a TOP-LEVEL prop on the node (NOT inside componentProps).
// ============================================================================

interface FormRootProps<T> {
  form: FormProxy<T>;
  children: RenderNode<T>[];
}

function FormRoot<T>({ form, children }: FormRootProps<T>): ReactNode {
  return (
    <>
      {children.map((child, i) => (
        <RenderNodeComponent key={i} node={child} form={form} />
      ))}
    </>
  );
}
(FormRoot as any).__selfManagedChildren = true;

// ============================================================================
// FormArrayBlock — custom self-managed array section.
//
// Patch C constraint: <T extends FormFields> — ArrayNode<T> requires it. The
// resolver function MUST carry the constraint, not work it around with `any`.
//
// `control` is what the schema author wrote — `path.properties`, which is a
// FieldPathNode (a Proxy created by createFieldPath()). It is NOT yet an
// ArrayNode. We resolve it through extractPath → navigator.getNodeByPath.
// ============================================================================

const navigator = new FieldPathNavigator();

function resolveArrayNode<T extends FormFields>(
  control: FieldPathNode<unknown, unknown> | ArrayNode<T>,
  form: FormProxy<unknown> | undefined
): ArrayNode<T> | null {
  if (
    control &&
    typeof control === 'object' &&
    typeof (control as ArrayNode<T>).push === 'function' &&
    typeof (control as ArrayNode<T>).removeAt === 'function'
  ) {
    return control as ArrayNode<T>;
  }
  if (!form) {
    if (typeof console !== 'undefined') {
      console.warn('[FormArrayBlock] no form available — cannot resolve FieldPath');
    }
    return null;
  }
  try {
    const pathStr = extractPath(control as FieldPathNode<unknown, unknown>);
    const node = navigator.getNodeByPath(form, pathStr);
    if (!node) {
      if (typeof console !== 'undefined') {
        console.warn(`[FormArrayBlock] no ArrayNode at "${pathStr}"`);
      }
      return null;
    }
    return node as unknown as ArrayNode<T>;
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[FormArrayBlock] resolve failed', err);
    }
    return null;
  }
}

interface FormArrayBlockProps<T extends FormFields> {
  control: FieldPathNode<unknown, unknown> | ArrayNode<T>;
  /** Render-prop returning per-item RenderNode for the inner template. */
  itemRender: (itemPath: FieldPath<T>) => RenderNode<T>;
  /** Default leaf values pushed by AddButton — MUST be plain leaves. */
  initialValue: Partial<FormFields>;
  title: string;
  addLabel: string;
  removeLabel?: string;
  emptyLabel?: string;
  /** Auto-injected by RenderNodeComponent (selfManagedChildren contract). */
  form?: FormProxy<unknown>;
}

function FormArrayBlock<T extends FormFields>({
  control,
  itemRender,
  initialValue,
  title,
  addLabel,
  removeLabel = 'Удалить',
  emptyLabel,
  form,
}: FormArrayBlockProps<T>): ReactNode {
  const arrayNode = resolveArrayNode<T>(control, form);
  if (!arrayNode) return null;

  return (
    <section className="space-y-3 mt-2">
      <h3 className="text-base font-semibold text-gray-700 mb-2">{title}</h3>
      <FormArray.Root control={arrayNode}>
        <FormArray.List className="space-y-3">
          {({ control: itemForm, index, remove }) => {
            const itemPath = createFieldPath<T>();
            const node = itemRender(itemPath);
            return (
              <div
                className="rounded-md border bg-white p-4 space-y-3"
                data-testid={`array-item-${index}`}
              >
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-sm text-gray-700">Элемент #{index + 1}</h4>
                  <button
                    type="button"
                    onClick={remove}
                    data-testid={`array-item-${index}-remove`}
                    className="text-sm text-red-600 hover:underline"
                  >
                    {removeLabel}
                  </button>
                </div>
                <RenderNodeComponent node={node} form={itemForm as unknown as FormProxy<T>} />
              </div>
            );
          }}
        </FormArray.List>

        <FormArray.Empty>
          <div className="p-4 bg-gray-50 border border-dashed border-gray-300 rounded text-center text-sm text-gray-500">
            {emptyLabel ?? 'Пока нет ни одного элемента'}
          </div>
        </FormArray.Empty>

        <div>
          <FormArray.AddButton
            initialValue={initialValue}
            data-testid="array-add"
            className="mt-2 inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
          >
            {addLabel}
          </FormArray.AddButton>
        </div>
      </FormArray.Root>
    </section>
  );
}
(FormArrayBlock as any).__selfManagedChildren = true;

// ============================================================================
// Plain-leaf factories for AddButton.initialValue.
// CRITICAL (add-form-array.json risk #1): NEVER FieldConfig (`{ value, … }`)
// here — only raw leaf primitives matching the item shape.
// ============================================================================

const propertyInitialValue: Property = {
  type: 'apartment',
  description: '',
  estimatedValue: 0,
  hasEncumbrance: false,
};

const existingLoanInitialValue: ExistingLoan = {
  bank: '',
  type: '',
  amount: 0,
  remainingAmount: 0,
  monthlyPayment: 0,
  maturityDate: '',
};

const coBorrowerInitialValue: CoBorrower = {
  personalData: {
    lastName: '',
    firstName: '',
    middleName: '',
    birthDate: '',
  },
  phone: '',
  email: '',
  relationship: '',
  monthlyIncome: 0,
};

// ============================================================================
// createCreditApplicationRenderSchema — public factory.
// ============================================================================

export function createCreditApplicationRenderSchema(form: FormProxy<CreditApplicationForm>) {
  const schema = createRenderSchema<CreditApplicationForm>(
    (path) =>
      ({
        selector: 'root',
        component: FormRoot,
        // form injected here via closure — see overview.md "Simpler closure pattern".
        componentProps: { form },
        children: [
          // ===== STEP 1 ========================================================
          {
            selector: 'step1',
            component: Section,
            componentProps: {
              title: 'Шаг 1: Основная информация о кредите',
              titleAs: 'h2',
              titleClassName: 'text-xl font-bold',
              className: 'space-y-6',
            },
            children: [
              { component: path.loanType },
              {
                component: Box,
                componentProps: { className: 'grid grid-cols-2 gap-4' },
                children: [{ component: path.loanAmount }, { component: path.loanTerm }],
              },
              { component: path.loanPurpose },
              {
                selector: 'mortgage-section',
                component: Section,
                componentProps: {
                  title: 'Информация о недвижимости',
                  titleClassName: 'text-lg font-semibold mt-4',
                  className: 'space-y-4',
                },
                children: [{ component: path.propertyValue }, { component: path.initialPayment }],
              },
              {
                selector: 'car-section',
                component: Section,
                componentProps: {
                  title: 'Информация об автомобиле',
                  titleClassName: 'text-lg font-semibold mt-4',
                  className: 'space-y-4',
                },
                children: [
                  { component: path.carBrand },
                  { component: path.carModel },
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [{ component: path.carYear }, { component: path.carPrice }],
                  },
                ],
              },
              {
                component: Section,
                componentProps: {
                  title: 'Расчёт',
                  titleClassName: 'text-lg font-semibold mt-4',
                  className: 'space-y-4',
                },
                children: [
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      { component: path.interestRate },
                      { component: path.monthlyPayment },
                    ],
                  },
                ],
              },
            ],
          },

          // ===== STEP 2 ========================================================
          {
            selector: 'step2',
            component: Section,
            componentProps: {
              title: 'Шаг 2: Персональные данные',
              titleAs: 'h2',
              titleClassName: 'text-xl font-bold',
              className: 'space-y-6',
            },
            children: [
              {
                component: Section,
                componentProps: { title: 'Личные данные', titleClassName: 'text-lg font-semibold' },
                children: [
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-3 gap-4' },
                    children: [
                      { component: path.personalData.lastName },
                      { component: path.personalData.firstName },
                      { component: path.personalData.middleName },
                    ],
                  },
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      { component: path.personalData.birthDate },
                      { component: path.personalData.gender },
                    ],
                  },
                  { component: path.personalData.birthPlace },
                  { component: path.fullName },
                ],
              },
              {
                component: Section,
                componentProps: {
                  title: 'Паспортные данные',
                  titleClassName: 'text-lg font-semibold',
                },
                children: [
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      { component: path.passportData.series },
                      { component: path.passportData.number },
                    ],
                  },
                  { component: path.passportData.issuedBy },
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      { component: path.passportData.issueDate },
                      { component: path.passportData.departmentCode },
                    ],
                  },
                ],
              },
              {
                component: Section,
                componentProps: { title: 'Документы', titleClassName: 'text-lg font-semibold' },
                children: [
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [{ component: path.inn }, { component: path.snils }],
                  },
                ],
              },
            ],
          },

          // ===== STEP 3 ========================================================
          {
            selector: 'step3',
            component: Section,
            componentProps: {
              title: 'Шаг 3: Контактная информация',
              titleAs: 'h2',
              titleClassName: 'text-xl font-bold',
              className: 'space-y-6',
            },
            children: [
              {
                component: Section,
                componentProps: { title: 'Контакты', titleClassName: 'text-lg font-semibold' },
                children: [
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [{ component: path.phoneMain }, { component: path.phoneAdditional }],
                  },
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [{ component: path.email }, { component: path.emailAdditional }],
                  },
                ],
              },
              {
                component: Section,
                componentProps: {
                  title: 'Адрес регистрации',
                  titleClassName: 'text-lg font-semibold',
                },
                children: [
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      { component: path.registrationAddress.region },
                      { component: path.registrationAddress.city },
                    ],
                  },
                  { component: path.registrationAddress.street },
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-3 gap-4' },
                    children: [
                      { component: path.registrationAddress.house },
                      { component: path.registrationAddress.apartment },
                      { component: path.registrationAddress.postalCode },
                    ],
                  },
                ],
              },
              { component: path.sameAsRegistration },
              {
                selector: 'residence-address-section',
                component: Section,
                componentProps: {
                  title: 'Адрес проживания',
                  titleClassName: 'text-lg font-semibold',
                },
                children: [
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      { component: path.residenceAddress.region },
                      { component: path.residenceAddress.city },
                    ],
                  },
                  { component: path.residenceAddress.street },
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-3 gap-4' },
                    children: [
                      { component: path.residenceAddress.house },
                      { component: path.residenceAddress.apartment },
                      { component: path.residenceAddress.postalCode },
                    ],
                  },
                ],
              },
            ],
          },

          // ===== STEP 4 ========================================================
          {
            selector: 'step4',
            component: Section,
            componentProps: {
              title: 'Шаг 4: Информация о занятости',
              titleAs: 'h2',
              titleClassName: 'text-xl font-bold',
              className: 'space-y-6',
            },
            children: [
              { component: path.employmentStatus },
              {
                selector: 'employer-section',
                component: Section,
                componentProps: {
                  title: 'Информация о работодателе',
                  titleClassName: 'text-lg font-semibold mt-4',
                  className: 'space-y-4',
                },
                children: [
                  { component: path.companyName },
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [{ component: path.companyInn }, { component: path.companyPhone }],
                  },
                  { component: path.companyAddress },
                  { component: path.position },
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      { component: path.workExperienceTotal },
                      { component: path.workExperienceCurrent },
                    ],
                  },
                ],
              },
              {
                selector: 'business-section',
                component: Section,
                componentProps: {
                  title: 'Информация о бизнесе',
                  titleClassName: 'text-lg font-semibold mt-4',
                  className: 'space-y-4',
                },
                children: [
                  { component: path.businessType },
                  { component: path.businessInn },
                  { component: path.businessActivity },
                ],
              },
              {
                selector: 'income-section',
                component: Section,
                componentProps: {
                  title: 'Доход',
                  titleClassName: 'text-lg font-semibold mt-4',
                  className: 'space-y-4',
                },
                children: [
                  { component: path.monthlyIncome },
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      { component: path.additionalIncome },
                      { component: path.additionalIncomeSource },
                    ],
                  },
                  { component: path.totalIncome },
                ],
              },
              {
                selector: 'unemployed-warning',
                component: Box,
                componentProps: {
                  className:
                    'p-4 mt-4 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800',
                  children:
                    'При статусе "не работаю" одобрение возможно только при наличии созаёмщика с подтверждённым доходом.',
                },
              },
            ],
          },

          // ===== STEP 5 ========================================================
          {
            selector: 'step5',
            component: Section,
            componentProps: {
              title: 'Шаг 5: Дополнительная информация',
              titleAs: 'h2',
              titleClassName: 'text-xl font-bold',
              className: 'space-y-6',
            },
            children: [
              {
                component: Section,
                componentProps: { title: 'Личное', titleClassName: 'text-lg font-semibold' },
                children: [
                  { component: path.maritalStatus },
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [{ component: path.dependents }, { component: path.education }],
                  },
                ],
              },
              // Имущество
              {
                component: Box,
                componentProps: { className: 'space-y-3' },
                children: [
                  { component: path.hasProperty },
                  {
                    selector: 'properties-array',
                    component: FormArrayBlock,
                    componentProps: {
                      // FieldPath, NOT a resolved ArrayNode — Block resolves via FieldPathNavigator.
                      control: path.properties,
                      title: 'Имущество',
                      addLabel: '+ Добавить имущество',
                      emptyLabel: 'Нет имущества — нажмите «Добавить»',
                      initialValue: propertyInitialValue,
                      itemRender: (itemPath: FieldPath<Property>) =>
                        ({
                          component: Box,
                          componentProps: { className: 'space-y-3' },
                          children: [
                            { component: itemPath.type },
                            { component: itemPath.description },
                            { component: itemPath.estimatedValue },
                            { component: itemPath.hasEncumbrance },
                          ],
                        }) as RenderNode<Property>,
                    },
                  },
                ],
              },
              // Существующие кредиты
              {
                component: Box,
                componentProps: { className: 'space-y-3' },
                children: [
                  { component: path.hasExistingLoans },
                  {
                    selector: 'existing-loans-array',
                    component: FormArrayBlock,
                    componentProps: {
                      control: path.existingLoans,
                      title: 'Существующие кредиты',
                      addLabel: '+ Добавить кредит',
                      emptyLabel: 'Нет других кредитов — нажмите «Добавить»',
                      initialValue: existingLoanInitialValue,
                      itemRender: (itemPath: FieldPath<ExistingLoan>) =>
                        ({
                          component: Box,
                          componentProps: { className: 'space-y-3' },
                          children: [
                            { component: itemPath.bank },
                            { component: itemPath.type },
                            {
                              component: Box,
                              componentProps: { className: 'grid grid-cols-2 gap-4' },
                              children: [
                                { component: itemPath.amount },
                                { component: itemPath.remainingAmount },
                              ],
                            },
                            {
                              component: Box,
                              componentProps: { className: 'grid grid-cols-2 gap-4' },
                              children: [
                                { component: itemPath.monthlyPayment },
                                { component: itemPath.maturityDate },
                              ],
                            },
                          ],
                        }) as RenderNode<ExistingLoan>,
                    },
                  },
                ],
              },
              // Созаёмщики
              {
                component: Box,
                componentProps: { className: 'space-y-3' },
                children: [
                  { component: path.hasCoBorrower },
                  {
                    selector: 'co-borrowers-array',
                    component: FormArrayBlock,
                    componentProps: {
                      control: path.coBorrowers,
                      title: 'Созаёмщики',
                      addLabel: '+ Добавить созаёмщика',
                      emptyLabel: 'Нет созаёмщиков — нажмите «Добавить»',
                      initialValue: coBorrowerInitialValue,
                      itemRender: (itemPath: FieldPath<CoBorrower>) =>
                        ({
                          component: Box,
                          componentProps: { className: 'space-y-3' },
                          children: [
                            {
                              component: Box,
                              componentProps: { className: 'grid grid-cols-3 gap-4' },
                              children: [
                                { component: itemPath.personalData.lastName },
                                { component: itemPath.personalData.firstName },
                                { component: itemPath.personalData.middleName },
                              ],
                            },
                            { component: itemPath.personalData.birthDate },
                            {
                              component: Box,
                              componentProps: { className: 'grid grid-cols-2 gap-4' },
                              children: [
                                { component: itemPath.phone },
                                { component: itemPath.email },
                              ],
                            },
                            {
                              component: Box,
                              componentProps: { className: 'grid grid-cols-2 gap-4' },
                              children: [
                                { component: itemPath.relationship },
                                { component: itemPath.monthlyIncome },
                              ],
                            },
                          ],
                        }) as RenderNode<CoBorrower>,
                    },
                  },
                ],
              },
            ],
          },

          // ===== STEP 6 ========================================================
          {
            selector: 'step6',
            component: Section,
            componentProps: {
              title: 'Шаг 6: Подтверждение и согласия',
              titleAs: 'h2',
              titleClassName: 'text-xl font-bold',
              className: 'space-y-6',
            },
            children: [
              {
                component: Section,
                componentProps: {
                  title: 'Обязательные согласия',
                  titleClassName: 'text-lg font-semibold',
                  className: 'space-y-3',
                },
                children: [
                  { component: path.agreePersonalData },
                  { component: path.agreeCreditHistory },
                  { component: path.agreeTerms },
                  { component: path.confirmAccuracy },
                ],
              },
              {
                component: Section,
                componentProps: {
                  title: 'Опциональные согласия',
                  titleClassName: 'text-lg font-semibold mt-4',
                },
                children: [{ component: path.agreeMarketing }],
              },
              {
                component: Section,
                componentProps: {
                  title: 'Электронная подпись',
                  titleClassName: 'text-lg font-semibold mt-4',
                  className: 'space-y-3',
                },
                children: [{ component: path.electronicSignature }],
              },
            ],
          },
        ],
      }) as RenderNode<CreditApplicationForm>
  );

  // ============== Conditional sub-section visibility =======================
  // Top-level hideWhen calls — NOT inside the node config.
  // (add-wizard.json B2 explicit rule.)

  hideWhen(schema.node('mortgage-section'), () => form.loanType.value.value !== 'mortgage');
  hideWhen(schema.node('car-section'), () => form.loanType.value.value !== 'car');
  hideWhen(
    schema.node('residence-address-section'),
    () => form.sameAsRegistration.value.value === true
  );
  hideWhen(schema.node('employer-section'), () => form.employmentStatus.value.value !== 'employed');
  hideWhen(
    schema.node('business-section'),
    () => form.employmentStatus.value.value !== 'selfEmployed'
  );
  hideWhen(schema.node('income-section'), () => form.employmentStatus.value.value === 'unemployed');
  hideWhen(
    schema.node('unemployed-warning'),
    () => form.employmentStatus.value.value !== 'unemployed'
  );
  hideWhen(schema.node('properties-array'), () => !form.hasProperty.value.value);
  hideWhen(schema.node('existing-loans-array'), () => !form.hasExistingLoans.value.value);
  hideWhen(schema.node('co-borrowers-array'), () => !form.hasCoBorrower.value.value);

  return schema;
}
