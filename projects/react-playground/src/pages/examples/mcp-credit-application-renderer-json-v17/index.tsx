import { useMemo, useRef } from 'react';
import { type ValidationSchemaFn } from '@reformer/core';
import {
  required,
  min,
  max,
  minLength,
  maxLength,
  pattern,
  email as emailValidator,
  applyWhen,
} from '@reformer/core/validators';
import { FormField } from '@reformer/ui-kit';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';
import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';

import { JsonFormApp } from './JsonFormApp';
import { createCreditForm } from './createCreditForm';
import { buildRegistry } from './registry';
import schemaJson from './schema.json';
import type { CreditApplicationForm } from './types';

const fullSchema = schemaJson as JsonFormSchema;

// Pull a specific step from the full schema, wrap as a single-step JsonFormSchema.
function buildStepSchema(stepSelector: string): JsonFormSchema {
  type ContainerNode = JsonNode & { selector?: string; children?: JsonNode[] };
  const root = fullSchema.root as ContainerNode;
  const step = (root.children ?? []).find(
    (c): c is ContainerNode => (c as ContainerNode).selector === stepSelector
  );
  if (!step) {
    throw new Error(`Step "${stepSelector}" not found in JSON schema`);
  }
  return {
    version: '1.0',
    root: {
      selector: 'credit-form-root',
      component: 'FormRoot',
      children: [step],
    },
  } as JsonFormSchema;
}

const CURRENT_YEAR = new Date().getFullYear();

// Per-step validation (only the fields visible on that step).
const STEP_VALIDATIONS: Record<number, ValidationSchemaFn<CreditApplicationForm>> = {
  1: (path) => {
    required(path.loanType);
    required(path.loanAmount, { message: 'Введите сумму' });
    min(path.loanAmount, 50000);
    max(path.loanAmount, 10000000);
    required(path.loanTerm);
    min(path.loanTerm, 6);
    max(path.loanTerm, 240);
    required(path.loanPurpose);
    minLength(path.loanPurpose, 10);
    maxLength(path.loanPurpose, 500);
    applyWhen(
      path.loanType,
      (lt) => lt === 'mortgage',
      (p) => {
        required(p.propertyValue);
        min(p.propertyValue, 1000000);
      }
    );
    applyWhen(
      path.loanType,
      (lt) => lt === 'car',
      (p) => {
        required(p.carBrand);
        required(p.carModel);
        required(p.carYear);
        min(p.carYear, 2000);
        max(p.carYear, CURRENT_YEAR + 1);
        required(p.carPrice);
        min(p.carPrice, 300000);
      }
    );
  },
  2: (path) => {
    required(path.personalData.lastName);
    required(path.personalData.firstName);
    required(path.personalData.middleName);
    required(path.personalData.birthDate);
    required(path.personalData.gender);
    required(path.personalData.birthPlace);
    required(path.passportData.series);
    required(path.passportData.number);
    required(path.passportData.issueDate);
    required(path.passportData.issuedBy);
    required(path.passportData.departmentCode);
    required(path.inn);
    pattern(path.inn, /^\d{12}$/, { message: 'ИНН должен содержать 12 цифр' });
    required(path.snils);
  },
  3: (path) => {
    required(path.phoneMain);
    pattern(path.phoneMain, /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, {
      message: 'Неверный формат телефона',
    });
    required(path.email);
    emailValidator(path.email);
    required(path.registrationAddress.region);
    required(path.registrationAddress.city);
    required(path.registrationAddress.street);
    required(path.registrationAddress.house);
    required(path.registrationAddress.postalCode);
    applyWhen(
      path.sameAsRegistration,
      (v) => v === false,
      (p) => {
        required(p.residenceAddress.region);
        required(p.residenceAddress.city);
        required(p.residenceAddress.street);
        required(p.residenceAddress.house);
        required(p.residenceAddress.postalCode);
      }
    );
  },
  4: (path) => {
    required(path.employmentStatus);
    required(path.workExperienceTotal);
    min(path.workExperienceTotal, 0);
    required(path.workExperienceCurrent);
    min(path.workExperienceCurrent, 0);
    required(path.monthlyIncome);
    min(path.monthlyIncome, 10000);
    applyWhen(
      path.employmentStatus,
      (s) => s === 'employed',
      (p) => {
        required(p.companyName);
        required(p.companyInn);
        required(p.companyPhone);
        required(p.companyAddress);
        required(p.position);
      }
    );
    applyWhen(
      path.employmentStatus,
      (s) => s === 'selfEmployed',
      (p) => {
        required(p.businessType);
        required(p.businessInn);
        required(p.businessActivity);
      }
    );
  },
  5: (path) => {
    required(path.maritalStatus);
    required(path.dependents);
    min(path.dependents, 0);
    max(path.dependents, 10);
    required(path.education);
  },
  6: (path) => {
    required(path.electronicSignature);
    pattern(path.electronicSignature, /^\d{6}$/, { message: '6-значный код' });
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

const STEP_DEFS = [
  { number: 1, title: 'Кредит', icon: '💰', selector: 'step-1' },
  { number: 2, title: 'Личные', icon: '👤', selector: 'step-2' },
  { number: 3, title: 'Контакты', icon: '📞', selector: 'step-3' },
  { number: 4, title: 'Работа', icon: '💼', selector: 'step-4' },
  { number: 5, title: 'Доп. инфо', icon: '📋', selector: 'step-5' },
  { number: 6, title: 'Подтверждение', icon: '✓', selector: 'step-6' },
];

export function McpCreditApplicationRendererJsonV17() {
  const form = useMemo(() => createCreditForm(), []);
  const navRef = useRef<FormWizardHandle<CreditApplicationForm>>(null);

  const stepSchemas = useMemo(
    () => Object.fromEntries(STEP_DEFS.map((s) => [s.number, buildStepSchema(s.selector)])),
    []
  );

  const steps: FormWizardStep<CreditApplicationForm>[] = useMemo(
    () =>
      STEP_DEFS.map((s) => ({
        number: s.number,
        title: s.title,
        icon: s.icon,
        body: () => (
          <JsonFormApp
            schema={stepSchemas[s.number]}
            form={form}
            buildRegistry={buildRegistry}
            fieldWrapper={FormField}
          />
        ),
      })),
    [form, stepSchemas]
  );

  const handleSubmit = async () => {
    const values = form.getValue();
    console.log('[mcp-credit-renderer-json-v17] submitted:', values);
    alert('Заявка отправлена');
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">
        Заявка на кредит (renderer-json v17)
      </h1>
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

export default McpCreditApplicationRendererJsonV17;
