/**
 * Root `ObjectFieldTemplate`s of the steps whose sections group top-level fields (the baseline
 * markup: «Ипотека», «Расчёт», «Личные данные» with the computed name and age, …). Set per step via
 * `ui:ObjectFieldTemplate`.
 * https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates#objectfieldtemplate
 */
import type { ReactNode } from 'react';
import type { ObjectFieldTemplateProps } from '@rjsf/utils';
import { SECTION_TITLES } from '../../../shared/domain/credit';
import { Section } from '../../../shared/ui/array';

type Part = string | { title: string; fields: readonly string[] };

/**
 * A layout: the step's properties in the listed order, a group framed by `Section`. A group with none
 * of its fields in the schema now (a `then` that is off) renders nothing.
 */
function stepLayout(parts: readonly Part[]) {
  return function StepLayout({ properties }: ObjectFieldTemplateProps) {
    const content = new Map<string, ReactNode>(properties.map((p) => [p.name, p.content]));
    return (
      <>
        {parts.map((part) => {
          if (typeof part === 'string') return content.get(part);
          const fields = part.fields.filter((name) => content.has(name));
          return fields.length > 0 ? (
            <Section key={part.title} title={part.title}>
              {fields.map((name) => content.get(name))}
            </Section>
          ) : null;
        })}
      </>
    );
  };
}

export const LoanLayout = stepLayout([
  'loanType',
  'loanAmount',
  'loanTerm',
  'loanPurpose',
  { title: SECTION_TITLES.mortgage, fields: ['propertyValue', 'initialPayment'] },
  { title: SECTION_TITLES.car, fields: ['carBrand', 'carModel', 'carYear', 'carPrice'] },
  { title: SECTION_TITLES.calculation, fields: ['interestRate', 'monthlyPayment'] },
]);

export const PersonalLayout = stepLayout([
  { title: SECTION_TITLES.personalData, fields: ['personalData', 'fullName', 'age'] },
  'passportData',
  'inn',
  'snils',
]);

export const EmploymentLayout = stepLayout([
  'employmentStatus',
  {
    title: SECTION_TITLES.employer,
    fields: ['companyName', 'companyInn', 'companyPhone', 'companyAddress', 'position'],
  },
  { title: SECTION_TITLES.business, fields: ['businessType', 'businessInn', 'businessActivity'] },
  'workExperienceTotal',
  'workExperienceCurrent',
  {
    title: SECTION_TITLES.income,
    fields: [
      'monthlyIncome',
      'additionalIncome',
      'additionalIncomeSource',
      'totalIncome',
      'paymentToIncomeRatio',
    ],
  },
]);
