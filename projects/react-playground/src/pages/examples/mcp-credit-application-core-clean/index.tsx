/**
 * Credit Application Form — clean baseline (target=core)
 *
 * Multi-step wizard built with @reformer/core + @reformer/ui-kit FormWizard.
 * Spec: docs/specs/credit-application-form.md.
 */

import { useMemo, useRef, type FC } from 'react';
import { useFormControlValue, type FormProxy } from '@reformer/core';
import { FormField } from '@reformer/ui-kit';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import { FormArraySection } from '@reformer/ui-kit/form-array';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';

import {
  createCreditApplicationForm,
  STEP_VALIDATIONS,
  fullValidation,
  type CreditApplicationForm,
  type LoanType,
  type EmploymentStatus,
  type PropertyItem,
  type ExistingLoanItem,
  type CoBorrowerItem,
} from './schema';

// ============================================================================
// Step 1 — basic loan info
// ============================================================================

const BasicInfoStep: FC<{ control: FormProxy<CreditApplicationForm> }> = ({ control }) => {
  const loanType = useFormControlValue(control.loanType) as LoanType;

  return (
    <div className="space-y-6" data-testid="step-basic-info">
      <h2 className="text-xl font-bold" data-testid="step-heading">
        Основная информация о кредите
      </h2>

      <FormField control={control.loanType} />
      <FormField control={control.loanAmount} />
      <FormField control={control.loanTerm} />
      <FormField control={control.loanPurpose} />

      {loanType === 'mortgage' && (
        <>
          <h3 className="text-lg font-semibold mt-4">Информация о недвижимости</h3>
          <FormField control={control.propertyValue} />
          <FormField control={control.initialPayment} />
        </>
      )}

      {loanType === 'car' && (
        <>
          <h3 className="text-lg font-semibold mt-4">Информация об автомобиле</h3>
          <FormField control={control.carBrand} />
          <FormField control={control.carModel} />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.carYear} />
            <FormField control={control.carPrice} />
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-4 mt-6 p-4 bg-gray-50 rounded">
        <FormField control={control.interestRate} />
        <FormField control={control.monthlyPayment} />
      </div>
    </div>
  );
};

// ============================================================================
// Step 2 — personal data
// ============================================================================

const PersonalDataStep: FC<{ control: FormProxy<CreditApplicationForm> }> = ({
  control,
}) => (
  <div className="space-y-6" data-testid="step-personal-data">
    <h2 className="text-xl font-bold" data-testid="step-heading">
      Персональные данные
    </h2>

    <h3 className="text-lg font-semibold">ФИО и личные данные</h3>
    <div className="grid grid-cols-3 gap-4">
      <FormField control={control.personalData.lastName} />
      <FormField control={control.personalData.firstName} />
      <FormField control={control.personalData.middleName} />
    </div>
    <FormField control={control.fullName} />

    <div className="grid grid-cols-2 gap-4">
      <FormField control={control.personalData.birthDate} />
      <FormField control={control.age} />
    </div>

    <FormField control={control.personalData.gender} />
    <FormField control={control.personalData.birthPlace} />

    <h3 className="text-lg font-semibold mt-4">Паспортные данные</h3>
    <div className="grid grid-cols-2 gap-4">
      <FormField control={control.passportData.series} />
      <FormField control={control.passportData.number} />
    </div>
    <FormField control={control.passportData.issueDate} />
    <FormField control={control.passportData.issuedBy} />
    <FormField control={control.passportData.departmentCode} />

    <h3 className="text-lg font-semibold mt-4">Документы</h3>
    <FormField control={control.inn} />
    <FormField control={control.snils} />
  </div>
);

// ============================================================================
// Step 3 — contact info
// ============================================================================

const ContactInfoStep: FC<{ control: FormProxy<CreditApplicationForm> }> = ({
  control,
}) => {
  const sameAsRegistration = useFormControlValue(control.sameAsRegistration) as boolean;

  return (
    <div className="space-y-6" data-testid="step-contact-info">
      <h2 className="text-xl font-bold" data-testid="step-heading">
        Контактная информация
      </h2>

      <h3 className="text-lg font-semibold">Телефоны</h3>
      <FormField control={control.phoneMain} />
      <FormField control={control.phoneAdditional} />

      <h3 className="text-lg font-semibold mt-4">Email</h3>
      <FormField control={control.email} />
      <FormField control={control.sameEmail} />
      <FormField control={control.emailAdditional} />

      <h3 className="text-lg font-semibold mt-4">Адрес регистрации</h3>
      <FormField control={control.registrationAddress.region} />
      <FormField control={control.registrationAddress.city} />
      <FormField control={control.registrationAddress.street} />
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.registrationAddress.house} />
        <FormField control={control.registrationAddress.apartment} />
      </div>
      <FormField control={control.registrationAddress.postalCode} />

      <FormField control={control.sameAsRegistration} />

      {!sameAsRegistration && (
        <>
          <h3 className="text-lg font-semibold mt-4">Адрес проживания</h3>
          <FormField control={control.residenceAddress.region} />
          <FormField control={control.residenceAddress.city} />
          <FormField control={control.residenceAddress.street} />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.residenceAddress.house} />
            <FormField control={control.residenceAddress.apartment} />
          </div>
          <FormField control={control.residenceAddress.postalCode} />
        </>
      )}
    </div>
  );
};

// ============================================================================
// Step 4 — employment
// ============================================================================

const EmploymentStep: FC<{ control: FormProxy<CreditApplicationForm> }> = ({
  control,
}) => {
  const employmentStatus = useFormControlValue(
    control.employmentStatus
  ) as EmploymentStatus;

  return (
    <div className="space-y-6" data-testid="step-employment">
      <h2 className="text-xl font-bold" data-testid="step-heading">
        Информация о занятости
      </h2>

      <FormField control={control.employmentStatus} />

      {employmentStatus === 'employed' && (
        <>
          <h3 className="text-lg font-semibold mt-4">Работа по найму</h3>
          <FormField control={control.companyName} />
          <FormField control={control.companyInn} />
          <FormField control={control.companyPhone} />
          <FormField control={control.companyAddress} />
          <FormField control={control.position} />
        </>
      )}

      {employmentStatus === 'selfEmployed' && (
        <>
          <h3 className="text-lg font-semibold mt-4">Индивидуальный предприниматель</h3>
          <FormField control={control.businessType} />
          <FormField control={control.businessInn} />
          <FormField control={control.businessActivity} />
        </>
      )}

      <h3 className="text-lg font-semibold mt-4">Стаж работы</h3>
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.workExperienceTotal} />
        <FormField control={control.workExperienceCurrent} />
      </div>

      <h3 className="text-lg font-semibold mt-4">Доход</h3>
      <FormField control={control.monthlyIncome} />
      <FormField control={control.additionalIncome} />
      <FormField control={control.additionalIncomeSource} />

      <div className="grid grid-cols-2 gap-4 mt-4 p-4 bg-gray-50 rounded">
        <FormField control={control.totalIncome} />
        <FormField control={control.paymentToIncomeRatio} />
      </div>
    </div>
  );
};

// ============================================================================
// Step 5 — additional info (arrays)
// ============================================================================

const PropertyItemForm: FC<{ control: FormProxy<PropertyItem> }> = ({ control }) => (
  <div className="space-y-3">
    <FormField control={control.type} />
    <FormField control={control.description} />
    <FormField control={control.estimatedValue} />
    <FormField control={control.hasEncumbrance} />
  </div>
);

const ExistingLoanItemForm: FC<{ control: FormProxy<ExistingLoanItem> }> = ({
  control,
}) => (
  <div className="space-y-3">
    <FormField control={control.bank} />
    <FormField control={control.type} />
    <div className="grid grid-cols-2 gap-3">
      <FormField control={control.amount} />
      <FormField control={control.remainingAmount} />
    </div>
    <FormField control={control.monthlyPayment} />
    <FormField control={control.maturityDate} />
  </div>
);

const CoBorrowerItemForm: FC<{ control: FormProxy<CoBorrowerItem> }> = ({ control }) => (
  <div className="space-y-3">
    <h4 className="font-semibold">Личные данные созаемщика</h4>
    <div className="grid grid-cols-3 gap-3">
      <FormField control={control.personalData.lastName} />
      <FormField control={control.personalData.firstName} />
      <FormField control={control.personalData.middleName} />
    </div>
    <div className="grid grid-cols-2 gap-3">
      <FormField control={control.personalData.birthDate} />
      <FormField control={control.personalData.gender} />
    </div>
    <FormField control={control.personalData.birthPlace} />
    <FormField control={control.phone} />
    <FormField control={control.email} />
    <FormField control={control.relationship} />
    <FormField control={control.monthlyIncome} />
  </div>
);

const AdditionalInfoStep: FC<{ control: FormProxy<CreditApplicationForm> }> = ({
  control,
}) => {
  const hasProperty = useFormControlValue(control.hasProperty) as boolean;
  const hasExistingLoans = useFormControlValue(control.hasExistingLoans) as boolean;
  const hasCoBorrower = useFormControlValue(control.hasCoBorrower) as boolean;

  return (
    <div className="space-y-6" data-testid="step-additional-info">
      <h2 className="text-xl font-bold" data-testid="step-heading">
        Дополнительная информация
      </h2>

      <h3 className="text-lg font-semibold">Личное</h3>
      <FormField control={control.maritalStatus} />
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.dependents} />
        <FormField control={control.education} />
      </div>

      <div className="space-y-4">
        <FormField control={control.hasProperty} />
        <FormArraySection<PropertyItem>
          title="Имущество"
          control={control.properties}
          itemComponent={PropertyItemForm}
          itemLabel="Имущество"
          addButtonLabel="+ Добавить имущество"
          emptyMessage='Нажмите "Добавить имущество" для добавления записи'
          hasItems={hasProperty}
          initialValue={{
            type: 'apartment',
            description: '',
            estimatedValue: 0,
            hasEncumbrance: false,
          }}
        />
      </div>

      <div className="space-y-4">
        <FormField control={control.hasExistingLoans} />
        <FormArraySection<ExistingLoanItem>
          title="Существующие кредиты"
          control={control.existingLoans}
          itemComponent={ExistingLoanItemForm}
          itemLabel="Кредит"
          addButtonLabel="+ Добавить кредит"
          emptyMessage='Нажмите "Добавить кредит" для добавления записи'
          hasItems={hasExistingLoans}
          initialValue={{
            bank: '',
            type: '',
            amount: 0,
            remainingAmount: 0,
            monthlyPayment: 0,
            maturityDate: '',
          }}
        />
      </div>

      <div className="space-y-4">
        <FormField control={control.hasCoBorrower} />
        <FormArraySection<CoBorrowerItem>
          title="Созаемщики"
          control={control.coBorrowers}
          itemComponent={CoBorrowerItemForm}
          itemLabel="Созаемщик"
          addButtonLabel="+ Добавить созаемщика"
          emptyMessage='Нажмите "Добавить созаемщика" для добавления записи'
          hasItems={hasCoBorrower}
          initialValue={{
            personalData: {
              lastName: '',
              firstName: '',
              middleName: '',
              birthDate: '',
              gender: 'male',
              birthPlace: '',
            },
            phone: '',
            email: '',
            relationship: '',
            monthlyIncome: 0,
          }}
        />
        <FormField control={control.coBorrowersIncome} />
      </div>
    </div>
  );
};

// ============================================================================
// Step 6 — confirmation
// ============================================================================

const ConfirmationStep: FC<{ control: FormProxy<CreditApplicationForm> }> = ({
  control,
}) => (
  <div className="space-y-6" data-testid="step-confirmation">
    <h2 className="text-xl font-bold" data-testid="step-heading">
      Подтверждение и согласия
    </h2>

    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Согласия</h3>
      <FormField control={control.agreePersonalData} />
      <FormField control={control.agreeCreditHistory} />
      <FormField control={control.agreeMarketing} />
      <FormField control={control.agreeTerms} />
    </div>

    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Подтверждение</h3>
      <FormField control={control.confirmAccuracy} />
      <FormField control={control.electronicSignature} />
    </div>
  </div>
);

// ============================================================================
// Wizard
// ============================================================================

const STEPS: FormWizardStep<CreditApplicationForm>[] = [
  { number: 1, title: 'Кредит', icon: '💰', body: BasicInfoStep },
  { number: 2, title: 'Данные', icon: '👤', body: PersonalDataStep },
  { number: 3, title: 'Контакты', icon: '📞', body: ContactInfoStep },
  { number: 4, title: 'Работа', icon: '💼', body: EmploymentStep },
  { number: 5, title: 'Доп. инфо', icon: '📋', body: AdditionalInfoStep },
  { number: 6, title: 'Подтверждение', icon: '✓', body: ConfirmationStep },
];

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

const McpCreditApplicationCoreCleanPage: FC = () => {
  const navRef = useRef<FormWizardHandle<CreditApplicationForm>>(null);
  const form = useMemo(() => {
    const f = createCreditApplicationForm();
    f.patchValue(MOCK_DATA);
    return f;
  }, []);

  const config = useMemo(
    () => ({
      stepValidations: STEP_VALIDATIONS,
      fullValidation,
    }),
    []
  );

  const handleSubmit = async () => {
    const result = await navRef.current?.submit(async (values: CreditApplicationForm) => {
      // eslint-disable-next-line no-console
      console.log('Credit application submitted:', values);
      return { id: `app-${Date.now()}` };
    });

    if (result) {
      // eslint-disable-next-line no-alert
      alert(`Заявка успешно отправлена! ID: ${result.id}`);
    } else {
      // eslint-disable-next-line no-alert
      alert('Пожалуйста, исправьте ошибки в форме');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6" data-testid="credit-application-form">
      <h1 className="text-2xl font-bold mb-6">Заявка на кредит (clean baseline)</h1>
      <FormWizard
        ref={navRef}
        form={form}
        config={config}
        steps={STEPS}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export default McpCreditApplicationCoreCleanPage;
