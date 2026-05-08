// MCP Credit Application iter-18 / renderer-json
// Stack: schema.json + closure pattern + JsonFormApp wrapper.

import { useMemo, useEffect, useRef } from 'react';
import {
  Box,
  Checkbox,
  FormField,
  Input,
  InputMask,
  RadioGroup,
  Section,
  Select,
  Textarea,
} from '@reformer/ui-kit';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';
import {
  createRenderSchemaFromJson,
  defineRegistry,
  FIELD_WRAPPER,
  type JsonFormSchema,
  type RegistryBuilder,
} from '@reformer/renderer-json';
import type { RenderNode, RenderSchemaFn } from '@reformer/renderer-react';
import {
  FormRenderer,
  createRenderSchema,
} from '@reformer/renderer-react';
import {
  useFormControlValue,
  type FormProxy,
  type ValidationSchemaFn,
} from '@reformer/core';
import { required, min, max, applyWhen } from '@reformer/core/validators';
import { createCreditApplicationForm } from './form';
import type { CreditApplicationForm } from './types';
import schemaJson from './schema.json';
import {
  LOAN_TYPES,
  GENDER_OPTIONS,
  EMPLOYMENT_STATUS_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  EDUCATION_OPTIONS,
  PROPERTY_TYPES,
  PROPERTY_TEMPLATE,
  EXISTING_LOAN_TEMPLATE,
  CO_BORROWER_TEMPLATE,
} from './sources';
import { RendererFormArraySection } from './RendererFormArraySection';

interface StepsSchemaJson {
  version: string;
  steps: Record<string, unknown>;
}

const STEP_VALIDATIONS: Record<number, ValidationSchemaFn<CreditApplicationForm>> = {
  1: (path) => {
    required(path.loanType);
    required(path.loanAmount);
    min(path.loanAmount, 50000);
    max(path.loanAmount, 10000000);
    required(path.loanTerm);
    min(path.loanTerm, 6);
    max(path.loanTerm, 240);
    required(path.loanPurpose);
    applyWhen(
      path.loanType,
      (v) => v === 'mortgage',
      (p) => required(p.propertyValue)
    );
    applyWhen(
      path.loanType,
      (v) => v === 'car',
      (p) => {
        required(p.carBrand);
        required(p.carModel);
        required(p.carYear);
        required(p.carPrice);
      }
    );
  },
  2: (path) => {
    required(path.personalData.lastName);
    required(path.personalData.firstName);
    required(path.personalData.middleName);
    required(path.personalData.birthDate);
    required(path.personalData.birthPlace);
    required(path.passportData.series);
    required(path.passportData.number);
    required(path.passportData.issueDate);
    required(path.passportData.issuedBy);
    required(path.passportData.departmentCode);
    required(path.inn);
    required(path.snils);
  },
  3: (path) => {
    required(path.phoneMain);
    required(path.email);
    required(path.registrationAddress.region);
    required(path.registrationAddress.city);
    required(path.registrationAddress.street);
    required(path.registrationAddress.house);
    required(path.registrationAddress.postalCode);
  },
  4: (path) => {
    required(path.employmentStatus);
    required(path.workExperienceTotal);
    required(path.workExperienceCurrent);
    required(path.monthlyIncome);
  },
  5: (path) => {
    required(path.maritalStatus);
    required(path.dependents);
    required(path.education);
  },
  6: (path) => {
    required(path.electronicSignature);
  },
};

const fullValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  STEP_VALIDATIONS[1](path);
  STEP_VALIDATIONS[2](path);
  STEP_VALIDATIONS[3](path);
  STEP_VALIDATIONS[4](path);
  STEP_VALIDATIONS[5](path);
  STEP_VALIDATIONS[6](path);
};

function buildRegistryFn(reg: RegistryBuilder) {
  // Field components
  reg.field('Input', Input);
  reg.field('InputMask', InputMask);
  reg.field('Select', Select);
  reg.field('Textarea', Textarea);
  reg.field('Checkbox', Checkbox);
  reg.field('RadioGroup', RadioGroup);

  // Containers
  reg.container('Box', Box);
  reg.container('Section', Section);
  reg.container(
    'FormArraySection',
    RendererFormArraySection as unknown as React.ComponentType<unknown>
  );
  reg.container(FIELD_WRAPPER, FormField);

  // Source values
  reg.source('LOAN_TYPES', LOAN_TYPES);
  reg.source('GENDER_OPTIONS', GENDER_OPTIONS);
  reg.source('EMPLOYMENT_STATUS_OPTIONS', EMPLOYMENT_STATUS_OPTIONS);
  reg.source('MARITAL_STATUS_OPTIONS', MARITAL_STATUS_OPTIONS);
  reg.source('EDUCATION_OPTIONS', EDUCATION_OPTIONS);
  reg.source('PROPERTY_TYPES', PROPERTY_TYPES);
  reg.source('PROPERTY_TEMPLATE', PROPERTY_TEMPLATE);
  reg.source('EXISTING_LOAN_TEMPLATE', EXISTING_LOAN_TEMPLATE);
  reg.source('CO_BORROWER_TEMPLATE', CO_BORROWER_TEMPLATE);
}

// Convert a single step body (a JsonNode subtree) into a RenderSchemaProxy.
function buildStepSchema(
  stepBody: unknown,
  registry: ReturnType<typeof defineRegistry>,
  form: FormProxy<CreditApplicationForm>
) {
  const jsonSchema: JsonFormSchema = {
    version: '1.0',
    root: stepBody as JsonFormSchema['root'],
  };
  const baseFn = createRenderSchemaFromJson<CreditApplicationForm>(jsonSchema, registry);
  // Wrap to inject form into root componentProps so RendererFormArraySection
  // can resolve its `control` FieldPathNode against the live form.
  const wrappedFn: RenderSchemaFn<CreditApplicationForm> = (path) => {
    const root = baseFn(path);
    return {
      ...root,
      componentProps: {
        ...((root as { componentProps?: Record<string, unknown> }).componentProps ?? {}),
        form,
      },
    } as RenderNode<CreditApplicationForm>;
  };
  return createRenderSchema<CreditApplicationForm>(wrappedFn);
}

function CreditApplicationFormRendererJsonV18() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const navRef = useRef<FormWizardHandle<CreditApplicationForm>>(null);

  const registry = useMemo(() => defineRegistry((reg) => buildRegistryFn(reg)), []);

  const data = schemaJson as StepsSchemaJson;
  const stepSchemas = useMemo(
    () => ({
      step1: buildStepSchema(data.steps.step1, registry, form),
      step2: buildStepSchema(data.steps.step2, registry, form),
      step3: buildStepSchema(data.steps.step3, registry, form),
      step4: buildStepSchema(data.steps.step4, registry, form),
      step5: buildStepSchema(data.steps.step5, registry, form),
      step6: buildStepSchema(data.steps.step6, registry, form),
    }),
    [data, registry, form]
  );

  // Conditional sections via setHidden using form control values.
  const loanType = useFormControlValue(form.loanType);
  const employmentStatus = useFormControlValue(form.employmentStatus);
  const sameAsRegistration = useFormControlValue(form.sameAsRegistration);
  const hasProperty = useFormControlValue(form.hasProperty);
  const hasExistingLoans = useFormControlValue(form.hasExistingLoans);
  const hasCoBorrower = useFormControlValue(form.hasCoBorrower);

  useEffect(() => {
    stepSchemas.step1.node('mortgage-section')?.setHidden(loanType !== 'mortgage');
  }, [loanType, stepSchemas.step1]);
  useEffect(() => {
    stepSchemas.step1.node('car-section')?.setHidden(loanType !== 'car');
  }, [loanType, stepSchemas.step1]);

  useEffect(() => {
    stepSchemas.step3
      .node('residence-address-section')
      ?.setHidden(sameAsRegistration === true);
  }, [sameAsRegistration, stepSchemas.step3]);

  useEffect(() => {
    stepSchemas.step4
      .node('employed-section')
      ?.setHidden(employmentStatus !== 'employed');
  }, [employmentStatus, stepSchemas.step4]);
  useEffect(() => {
    stepSchemas.step4
      .node('self-employed-section')
      ?.setHidden(employmentStatus !== 'selfEmployed');
  }, [employmentStatus, stepSchemas.step4]);

  useEffect(() => {
    stepSchemas.step5.node('properties-section')?.setHidden(hasProperty !== true);
  }, [hasProperty, stepSchemas.step5]);
  useEffect(() => {
    stepSchemas.step5
      .node('existing-loans-section')
      ?.setHidden(hasExistingLoans !== true);
  }, [hasExistingLoans, stepSchemas.step5]);
  useEffect(() => {
    stepSchemas.step5.node('co-borrowers-section')?.setHidden(hasCoBorrower !== true);
  }, [hasCoBorrower, stepSchemas.step5]);

  const steps: FormWizardStep<CreditApplicationForm>[] = useMemo(
    () => [
      {
        number: 1,
        title: 'Кредит',
        icon: '💰',
        body: (
          <FormRenderer render={stepSchemas.step1} settings={{ fieldWrapper: FormField }} />
        ),
      },
      {
        number: 2,
        title: 'Личные',
        icon: '👤',
        body: (
          <FormRenderer render={stepSchemas.step2} settings={{ fieldWrapper: FormField }} />
        ),
      },
      {
        number: 3,
        title: 'Контакты',
        icon: '📞',
        body: (
          <FormRenderer render={stepSchemas.step3} settings={{ fieldWrapper: FormField }} />
        ),
      },
      {
        number: 4,
        title: 'Работа',
        icon: '💼',
        body: (
          <FormRenderer render={stepSchemas.step4} settings={{ fieldWrapper: FormField }} />
        ),
      },
      {
        number: 5,
        title: 'Доп. инфо',
        icon: '📋',
        body: (
          <FormRenderer render={stepSchemas.step5} settings={{ fieldWrapper: FormField }} />
        ),
      },
      {
        number: 6,
        title: 'Подтверждение',
        icon: '✅',
        body: (
          <FormRenderer render={stepSchemas.step6} settings={{ fieldWrapper: FormField }} />
        ),
      },
    ],
    [stepSchemas]
  );

  const handleSubmit = async () => {
    const values = form.getValue();
    console.log('CreditApplication v18 / renderer-json submitted:', values);
    alert('Заявка отправлена!');
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-xl font-semibold mb-4">
        MCP Credit Application — iter-18 / renderer-json
      </h2>
      <FormWizard
        ref={navRef}
        form={form}
        config={{ stepValidations: STEP_VALIDATIONS, fullValidation }}
        steps={steps}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

export default CreditApplicationFormRendererJsonV18;
