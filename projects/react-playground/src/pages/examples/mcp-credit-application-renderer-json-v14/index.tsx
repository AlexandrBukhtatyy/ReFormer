/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useEffect, useRef, type ReactNode } from 'react';
import {
  createForm,
  createFieldPath,
  extractPath,
  FieldPathNavigator,
  useFormControl,
  useFormControlValue,
  type FormProxy,
  type FormSchema,
  type FieldConfig,
  type FieldPath,
  type FieldPathNode,
  type FormFields,
  type ArrayNode,
  type ValidationSchemaFn,
  type BehaviorSchemaFn,
} from '@reformer/core';
import { required, min, max, minLength, maxLength, email, applyWhen } from '@reformer/core/validators';
import { computeFrom } from '@reformer/core/behaviors';
import {
  Input,
  Select,
  Textarea,
  Checkbox,
  RadioGroup,
  FormField,
  Box,
  Section,
} from '@reformer/ui-kit';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';
import { FormArray } from '@reformer/cdk/form-array';
import {
  RenderNodeComponent,
  RenderContextProvider,
  createRenderSchema,
  type RenderNode,
  type RenderSchemaFn,
  type FieldWrapperProps,
} from '@reformer/renderer-react';
import {
  defineRegistry,
  FIELD_WRAPPER,
  createRenderSchemaFromJson,
  type JsonFormSchema,
} from '@reformer/renderer-json';

import jsonSchemaSrc from './schema.json';

// ---------- Types (Recipe 2: type aliases, not interface) ----------

type LoanType = 'consumer' | 'mortgage' | 'car';
type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed';
type MaritalStatus = 'single' | 'married' | 'divorced';
type PropertyType = 'apartment' | 'house' | 'land';

type PropertyItem = {
  type: PropertyType;
  description: string;
  estimatedValue: number;
};

type CreditApplicationForm = {
  // Step 1
  loanType: LoanType;
  loanAmount: number | null;
  loanTerm: number;
  loanPurpose: string;
  // Step 2
  lastName: string;
  firstName: string;
  middleName: string;
  fullName: string;
  birthDate: string;
  // Step 3
  phoneMain: string;
  email: string;
  city: string;
  // Step 4
  employmentStatus: EmploymentStatus;
  companyName: string;
  monthlyIncome: number | null;
  additionalIncome: number | null;
  totalIncome: number;
  // Step 5
  maritalStatus: MaritalStatus;
  dependents: number;
  hasProperty: boolean;
  properties: PropertyItem[];
  // Step 6
  agreePersonalData: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
};

// ---------- Source values (registered in registry) ----------

const LOAN_TYPE_OPTIONS = [
  { value: 'consumer', label: 'Потребительский' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'car', label: 'Автокредит' },
];

const EMPLOYMENT_OPTIONS = [
  { value: 'employed', label: 'Работаю по найму' },
  { value: 'selfEmployed', label: 'ИП / самозанятый' },
  { value: 'unemployed', label: 'Не работаю' },
];

const MARITAL_OPTIONS = [
  { value: 'single', label: 'Холост / не замужем' },
  { value: 'married', label: 'В браке' },
  { value: 'divorced', label: 'Разведён(а)' },
];

const PROPERTY_TYPE_OPTIONS = [
  { value: 'apartment', label: 'Квартира' },
  { value: 'house', label: 'Дом' },
  { value: 'land', label: 'Земельный участок' },
];

const propertyTemplate = (): PropertyItem => ({
  type: 'apartment',
  description: '',
  estimatedValue: 0,
});

// ---------- Form schema (createForm with FieldConfig) ----------

const formSchema: FormSchema<CreditApplicationForm> = {
  loanType: {
    value: 'consumer',
    component: Select,
    componentProps: { label: 'Тип кредита', options: LOAN_TYPE_OPTIONS },
  } satisfies FieldConfig<LoanType>,
  loanAmount: {
    value: null,
    component: Input,
    componentProps: { label: 'Сумма кредита (₽)', type: 'number' },
  },
  loanTerm: {
    value: 12,
    component: Input,
    componentProps: { label: 'Срок кредита (месяцев)', type: 'number' },
  },
  loanPurpose: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Цель кредита' },
  },
  lastName: { value: '', component: Input, componentProps: { label: 'Фамилия' } },
  firstName: { value: '', component: Input, componentProps: { label: 'Имя' } },
  middleName: { value: '', component: Input, componentProps: { label: 'Отчество' } },
  fullName: {
    value: '',
    component: Input,
    componentProps: { label: 'Полное имя', readOnly: true },
  },
  birthDate: {
    value: '',
    component: Input,
    componentProps: { label: 'Дата рождения', type: 'date' },
  },
  phoneMain: { value: '', component: Input, componentProps: { label: 'Основной телефон' } },
  email: {
    value: '',
    component: Input,
    componentProps: { label: 'Email', type: 'email' },
  },
  city: { value: '', component: Input, componentProps: { label: 'Город' } },
  employmentStatus: {
    value: 'employed',
    component: RadioGroup,
    componentProps: { label: 'Статус занятости', options: EMPLOYMENT_OPTIONS },
  } satisfies FieldConfig<EmploymentStatus>,
  companyName: {
    value: '',
    component: Input,
    componentProps: { label: 'Название компании' },
  },
  monthlyIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Ежемесячный доход (₽)', type: 'number' },
  },
  additionalIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Дополнительный доход (₽)', type: 'number' },
  },
  totalIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Общий доход (₽)', type: 'number', readOnly: true },
  },
  maritalStatus: {
    value: 'single',
    component: Select,
    componentProps: { label: 'Семейное положение', options: MARITAL_OPTIONS },
  } satisfies FieldConfig<MaritalStatus>,
  dependents: {
    value: 0,
    component: Input,
    componentProps: { label: 'Количество иждивенцев', type: 'number' },
  },
  hasProperty: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'У меня есть имущество' },
  },
  properties: [
    {
      type: {
        value: 'apartment',
        component: Select,
        componentProps: { label: 'Тип имущества', options: PROPERTY_TYPE_OPTIONS },
      } satisfies FieldConfig<PropertyType>,
      description: { value: '', component: Textarea, componentProps: { label: 'Описание' } },
      estimatedValue: {
        value: 0,
        component: Input,
        componentProps: { label: 'Оценочная стоимость (₽)', type: 'number' },
      },
    },
  ],
  agreePersonalData: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Согласие на обработку персональных данных' },
  },
  agreeTerms: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Согласие с условиями кредитования' },
  },
  confirmAccuracy: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Подтверждаю точность введенных данных' },
  },
};

// ---------- Validation ----------

const step1Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.loanType, { message: 'Выберите тип кредита' });
  required(path.loanAmount, { message: 'Введите сумму' });
  min(path.loanAmount, 50000, { message: 'Минимальная сумма 50 000 ₽' });
  max(path.loanAmount, 10_000_000, { message: 'Максимум 10 000 000 ₽' });
  required(path.loanTerm, { message: 'Введите срок' });
  min(path.loanTerm, 6);
  max(path.loanTerm, 240);
  required(path.loanPurpose, { message: 'Опишите цель' });
  minLength(path.loanPurpose, 10);
  maxLength(path.loanPurpose, 500);
};

const step2Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.lastName, { message: 'Введите фамилию' });
  required(path.firstName, { message: 'Введите имя' });
  required(path.middleName, { message: 'Введите отчество' });
  required(path.birthDate, { message: 'Выберите дату рождения' });
};

const step3Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.phoneMain, { message: 'Введите телефон' });
  required(path.email, { message: 'Введите email' });
  email(path.email, { message: 'Неверный формат email' });
  required(path.city, { message: 'Введите город' });
};

const step4Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.employmentStatus, { message: 'Выберите статус' });
  // Conditional: companyName required only when employed
  applyWhen(
    path.employmentStatus,
    (status) => status === 'employed',
    (p) => {
      required(p.companyName, { message: 'Введите название компании' });
    }
  );
  required(path.monthlyIncome, { message: 'Введите доход' });
  min(path.monthlyIncome, 10000, { message: 'Минимальный доход 10 000 ₽' });
};

const step5Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.maritalStatus, { message: 'Выберите семейное положение' });
  required(path.dependents, { message: 'Введите количество' });
  min(path.dependents, 0);
  max(path.dependents, 10);
};

const step6Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.agreePersonalData, { message: 'Необходимо согласие' });
  required(path.agreeTerms, { message: 'Необходимо согласие' });
  required(path.confirmAccuracy, { message: 'Подтвердите точность данных' });
};

const fullValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  step1Validation(path);
  step2Validation(path);
  step3Validation(path);
  step4Validation(path);
  step5Validation(path);
  step6Validation(path);
};

const stepValidations: Record<number, ValidationSchemaFn<CreditApplicationForm>> = {
  1: step1Validation,
  2: step2Validation,
  3: step3Validation,
  4: step4Validation,
  5: step5Validation,
  6: step6Validation,
};

// ---------- Behavior (computed fields) ----------

const behavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // C.4 fullName
  computeFrom(
    [path.lastName, path.firstName, path.middleName],
    path.fullName,
    ({ lastName, firstName, middleName }: CreditApplicationForm) =>
      [lastName, firstName, middleName].filter(Boolean).join(' ').trim()
  );
  // C.6 totalIncome
  computeFrom(
    [path.monthlyIncome, path.additionalIncome],
    path.totalIncome,
    ({ monthlyIncome, additionalIncome }: CreditApplicationForm) =>
      (monthlyIncome ?? 0) + (additionalIncome ?? 0)
  );
};

// ---------- RendererFormArraySection (app-level glue, ~80 LOC) ----------

interface RendererFormArraySectionProps<T extends FormFields> {
  control: ArrayNode<T> | FieldPathNode<unknown, unknown>;
  itemComponent: (itemPath: FieldPath<T>) => RenderNode<T>;
  title?: string;
  addButtonLabel?: string;
  removeButtonLabel?: string;
  initialValue?: Partial<FormFields>;
  form?: FormProxy<unknown>;
  fieldWrapper?: React.ComponentType<FieldWrapperProps>;
}

const navigator = new FieldPathNavigator();

function resolveArrayNode<T extends FormFields>(
  control: RendererFormArraySectionProps<T>['control'],
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
  if (!form) return null;
  try {
    const pathStr = extractPath(control as FieldPathNode<unknown, unknown>);
    const node = navigator.getNodeByPath(form, pathStr);
    return (node as unknown as ArrayNode<T>) ?? null;
  } catch {
    return null;
  }
}

function RendererFormArraySection<T extends FormFields>({
  control,
  itemComponent,
  title,
  addButtonLabel = '+ Добавить',
  removeButtonLabel = 'Удалить',
  initialValue,
  form,
  fieldWrapper,
}: RendererFormArraySectionProps<T>): ReactNode {
  const arrayNode = resolveArrayNode<T>(control, form);
  const lengthCtrl = useFormControl(
    (arrayNode ?? undefined) as unknown as Parameters<typeof useFormControl>[0]
  );
  if (!arrayNode) return null;
  const length = (lengthCtrl as unknown as { length?: number } | undefined)?.length ?? 0;
  return (
    <section className="space-y-3 mt-4">
      {title ? <h3 className="text-base font-semibold mb-2">{title}</h3> : null}
      <FormArray.Root control={arrayNode}>
        <FormArray.List className="space-y-3">
          {({ control: itemForm, index, remove }) => {
            const renderNode = itemComponent(createFieldPath<T>());
            return (
              <div
                className="rounded-md border p-4 space-y-3"
                data-testid={`array-item-${index}`}
              >
                <RenderNodeComponent
                  node={renderNode}
                  form={itemForm as unknown as FormProxy<T>}
                  fieldWrapper={fieldWrapper}
                />
                {length > 0 ? (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={remove}
                      className="text-sm text-red-600 underline"
                      data-testid={`array-item-${index}-remove`}
                    >
                      {removeButtonLabel}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          }}
        </FormArray.List>
        <div>
          <FormArray.AddButton
            initialValue={initialValue}
            data-testid="array-add"
            className="text-sm text-blue-600 underline"
          >
            {addButtonLabel}
          </FormArray.AddButton>
        </div>
      </FormArray.Root>
    </section>
  );
}
(RendererFormArraySection as any).__selfManagedChildren = true;

// ---------- FormRoot (closure-pattern container) ----------

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

// ---------- Registry ----------

const registry = defineRegistry((reg) => {
  reg.field('Input', Input);
  reg.field('Select', Select);
  reg.field('Textarea', Textarea);
  reg.field('Checkbox', Checkbox);
  reg.field('RadioGroup', RadioGroup);
  reg.container('Box', Box);
  reg.container('Section', Section);
  reg.container('FormRoot', FormRoot);
  reg.container('FormArraySection', RendererFormArraySection);
  reg.container(FIELD_WRAPPER, FormField);
  reg.source('LOAN_TYPE_OPTIONS', LOAN_TYPE_OPTIONS);
  reg.source('EMPLOYMENT_OPTIONS', EMPLOYMENT_OPTIONS);
  reg.source('MARITAL_OPTIONS', MARITAL_OPTIONS);
  reg.source('PROPERTY_TYPE_OPTIONS', PROPERTY_TYPE_OPTIONS);
  reg.source('PROPERTY_TEMPLATE', propertyTemplate);
});

// ---------- Page ----------

const STEP_TITLES = [
  { number: 1, title: 'Кредит', icon: '💰' },
  { number: 2, title: 'Личные данные', icon: '👤' },
  { number: 3, title: 'Контакты', icon: '📞' },
  { number: 4, title: 'Работа', icon: '💼' },
  { number: 5, title: 'Доп. инфо', icon: '📋' },
  { number: 6, title: 'Подтверждение', icon: '✅' },
];

export default function MccaRendererJsonV14Page() {
  const form = useMemo(
    () =>
      createForm<CreditApplicationForm>({
        form: formSchema,
        validation: fullValidation,
        behavior,
      }),
    []
  );

  // JSON → RenderSchemaFn → RenderSchemaProxy
  const jsonSchema = jsonSchemaSrc as unknown as JsonFormSchema;
  const renderSchemaFn: RenderSchemaFn<CreditApplicationForm> = useMemo(
    () => createRenderSchemaFromJson<CreditApplicationForm>(jsonSchema, registry),
    [jsonSchema]
  );
  const schemaProxy = useMemo(() => createRenderSchema(renderSchemaFn), [renderSchemaFn]);

  // Extract step bodies from generated RenderNode tree.
  // Top-level structure: FormRoot { children: [step1-body, step2-body, ...] }
  const rootNode = useMemo(
    () => renderSchemaFn(createFieldPath<CreditApplicationForm>()),
    [renderSchemaFn]
  );

  const stepBodies = useMemo<RenderNode<CreditApplicationForm>[]>(() => {
    if (!('children' in rootNode) || !rootNode.children) return [];
    return rootNode.children as RenderNode<CreditApplicationForm>[];
  }, [rootNode]);

  // hideWhen for properties array based on hasProperty
  const hasProperty = useFormControlValue(form.hasProperty);
  useEffect(() => {
    schemaProxy.node('properties-section').setHidden(!hasProperty);
  }, [schemaProxy, hasProperty]);

  const wizardRef = useRef<FormWizardHandle<CreditApplicationForm>>(null);

  const handleSubmit = async () => {
    const values = form.getValue();
    window.alert(`Заявка отправлена!\n\n${JSON.stringify(values, null, 2).slice(0, 400)}`);
  };

  const steps: FormWizardStep<CreditApplicationForm>[] = STEP_TITLES.map((s, i) => ({
    number: s.number,
    title: s.title,
    icon: s.icon,
    body: (stepBodies[i] ?? { component: Box, children: [] }) as FormWizardStep<CreditApplicationForm>['body'],
  }));

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-bold mb-4">
        MCP Credit Application — renderer-json v14
      </h1>
      <p className="text-sm text-gray-600 mb-4">
        Форма заявки на кредит, сгенерированная MCP-only sub-agent'ом из JSON-схемы.
      </p>
      <RenderContextProvider<CreditApplicationForm>
        value={{
          form,
          settings: { fieldWrapper: FormField },
        }}
      >
        <FormWizard
          ref={wizardRef}
          form={form}
          config={{ stepValidations, fullValidation }}
          steps={steps}
          onSubmit={handleSubmit}
        />
      </RenderContextProvider>
    </div>
  );
}
