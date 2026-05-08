/**
 * Credit application form — clean baseline (target=renderer-react).
 *
 * Page component: instantiates the form, builds the RenderSchema, and renders
 * it via FormRenderer with FormField as the field-wrapper.
 */

import { useMemo } from 'react';
import { FormRenderer } from '@reformer/renderer-react';
import { FormField } from '@reformer/ui-kit';
import {
  createCreditApplicationForm,
  createCreditApplicationRenderSchema,
  type CreditApplicationForm,
} from './schema';

const MOCK_DATA: Partial<CreditApplicationForm> = {
  loanType: 'consumer',
  loanAmount: 500000,
  loanTerm: 24,
  loanPurpose: 'Ремонт квартиры',
  personalData: {
    lastName: 'Иванов',
    firstName: 'Иван',
    middleName: 'Иванович',
    birthDate: '1990-05-15',
    gender: 'male',
    birthPlace: 'г. Москва',
  },
  passportData: {
    series: '4509',
    number: '123456',
    issueDate: '2010-06-20',
    issuedBy: 'ОУФМС России по г. Москве',
    departmentCode: '770-001',
  },
  inn: '770401234567',
  snils: '12345678901',
  phoneMain: '+7 (901) 123-45-67',
  phoneAdditional: '',
  email: 'ivanov@example.com',
  emailAdditional: '',
  registrationAddress: {
    region: 'Москва',
    city: 'Москва',
    street: 'Тверская',
    house: '12',
    apartment: '34',
    postalCode: '125009',
  },
  sameAsRegistration: true,
  employmentStatus: 'employed',
  companyName: 'ООО Тестовая Компания',
  companyInn: '7704567890',
  companyPhone: '+7 (495) 123-45-67',
  companyAddress: 'г. Москва, ул. Ленина, 1',
  position: 'Старший разработчик',
  workExperienceTotal: 8,
  workExperienceCurrent: 3,
  monthlyIncome: 150000,
  additionalIncome: 0,
  additionalIncomeSource: '',
  maritalStatus: 'single',
  dependents: 0,
  education: 'higher',
  hasProperty: false,
  hasExistingLoans: false,
  hasCoBorrower: false,
  agreePersonalData: true,
  agreeCreditHistory: true,
  agreeMarketing: false,
  agreeTerms: true,
  confirmAccuracy: true,
  electronicSignature: 'Иванов И.И.',
};

export default function CreditApplicationRendererReactClean() {
  const form = useMemo(() => {
    const f = createCreditApplicationForm();
    f.patchValue(MOCK_DATA);
    return f;
  }, []);
  const schema = useMemo(() => createCreditApplicationRenderSchema(form), [form]);

  return (
    <div className="w-full">
      <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />
    </div>
  );
}
