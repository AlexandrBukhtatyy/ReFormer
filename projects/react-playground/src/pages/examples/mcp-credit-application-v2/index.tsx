import { useMemo, useState } from 'react';
import { useArrayLength, useFormControlValue } from '@reformer/core';
import {
  Button,
  Checkbox,
  FormField,
  Input,
  InputMask,
  RadioGroup,
  Select,
  Textarea,
} from '@reformer/ui-kit';
import { PlusIcon, TrashIcon } from 'lucide-react';
import { creditApplicationForm } from './schema';

// ───── Option lists (mirror those in schema.ts — only what's used in templates) ─────

const PROPERTY_TYPE_OPTIONS = [
  { value: 'apartment', label: 'Квартира' },
  { value: 'house', label: 'Дом' },
  { value: 'land', label: 'Земельный участок' },
  { value: 'commercial', label: 'Коммерческая' },
  { value: 'car', label: 'Автомобиль' },
];

const GENDER_OPTIONS = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];

// ───── FormArray push() payload templates ─────
//
// To push a new array item we must supply the SAME `{ value, component, componentProps }`
// FieldConfig shape that the schema declares for the template item — NOT plain primitives.
// (Documented in the MCP `add-form-array` prompt and the `form-array` recipe.)

const propertyTemplate = () => ({
  type: {
    value: 'apartment',
    component: Select,
    componentProps: {
      label: 'Тип имущества',
      options: PROPERTY_TYPE_OPTIONS,
      placeholder: 'Выберите тип',
    },
  },
  description: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Описание', placeholder: 'Опишите имущество', rows: 2 },
  },
  estimatedValue: {
    value: 0,
    component: Input,
    componentProps: { label: 'Оценочная стоимость (₽)', type: 'number', placeholder: '0' },
  },
  hasEncumbrance: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Имеется обременение (залог)' },
  },
});

const existingLoanTemplate = () => ({
  bank: {
    value: '',
    component: Input,
    componentProps: { label: 'Банк', placeholder: 'Название банка' },
  },
  type: {
    value: '',
    component: Input,
    componentProps: { label: 'Тип кредита', placeholder: 'Тип кредита' },
  },
  amount: {
    value: 0,
    component: Input,
    componentProps: { label: 'Сумма кредита (₽)', type: 'number', placeholder: '0' },
  },
  remainingAmount: {
    value: 0,
    component: Input,
    componentProps: { label: 'Остаток задолженности (₽)', type: 'number', placeholder: '0' },
  },
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: { label: 'Ежемесячный платёж (₽)', type: 'number', placeholder: '0' },
  },
  maturityDate: {
    value: '',
    component: Input,
    componentProps: { label: 'Дата погашения', type: 'date' },
  },
});

const coBorrowerTemplate = () => ({
  personalData: {
    lastName: {
      value: '',
      component: Input,
      componentProps: { label: 'Фамилия', placeholder: 'Введите фамилию' },
    },
    firstName: {
      value: '',
      component: Input,
      componentProps: { label: 'Имя', placeholder: 'Введите имя' },
    },
    middleName: {
      value: '',
      component: Input,
      componentProps: { label: 'Отчество', placeholder: 'Введите отчество' },
    },
    birthDate: {
      value: '',
      component: Input,
      componentProps: { label: 'Дата рождения', type: 'date' },
    },
    gender: {
      value: 'male',
      component: RadioGroup,
      componentProps: { label: 'Пол', options: GENDER_OPTIONS, className: '!flex-row gap-6' },
    },
    birthPlace: {
      value: '',
      component: Input,
      componentProps: { label: 'Место рождения', placeholder: 'Введите место рождения' },
    },
  },
  phone: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Телефон',
      mask: '+7 (999) 999-99-99',
      placeholder: '+7 (___) ___-__-__',
    },
  },
  email: {
    value: '',
    component: Input,
    componentProps: { label: 'Email', type: 'email', placeholder: 'example@mail.com' },
  },
  relationship: {
    value: '',
    component: Input,
    componentProps: { label: 'Родство', placeholder: 'Укажите родство' },
  },
  monthlyIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Ежемесячный доход (₽)', type: 'number', placeholder: '0' },
  },
});

export default function McpCreditApplicationV2() {
  const form = useMemo(() => creditApplicationForm, []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Subscribe to array lengths — re-renders the card list when push/removeAt happens.
  const propertyCount = useArrayLength(form.step5.properties);
  const loanCount = useArrayLength(form.step5.existingLoans);
  const coBorrowerCount = useArrayLength(form.step5.coBorrowers);

  // Subscribe to toggle values — show/hide each array section.
  const hasProperty = useFormControlValue(form.step5.hasProperty);
  const hasExistingLoans = useFormControlValue(form.step5.hasExistingLoans);
  const hasCoBorrower = useFormControlValue(form.step5.hasCoBorrower);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      form.markAsTouched();
      const ok = await form.validate();
      if (!ok) {
        return;
      }
      const values = form.getValue();

      console.log('values', values);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="max-w-4xl mx-auto p-6 space-y-6" onSubmit={handleSubmit} noValidate>
      <h1 className="text-2xl font-bold text-gray-900">Заявка на кредит</h1>

      {/* ===== Шаг 1. Кредит ===== */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold mb-4">Шаг 1. Параметры кредита</h2>

        <FormField control={form.step1.loanType} testId="loanType" />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.step1.loanAmount} testId="loanAmount" />
          <FormField control={form.step1.loanTerm} testId="loanTerm" />
        </div>

        <FormField control={form.step1.loanPurpose} testId="loanPurpose" />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.step1.propertyValue} testId="propertyValue" />
          <FormField control={form.step1.initialPayment} testId="initialPayment" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.step1.carBrand} testId="carBrand" />
          <FormField control={form.step1.carModel} testId="carModel" />
          <FormField control={form.step1.carYear} testId="carYear" />
          <FormField control={form.step1.carPrice} testId="carPrice" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.step1.interestRate} testId="interestRate" />
          <FormField control={form.step1.monthlyPayment} testId="monthlyPayment" />
        </div>
      </section>

      {/* ===== Шаг 2. Личные данные ===== */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold mb-4">Шаг 2. Личные данные</h2>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.step2.personalData.lastName} testId="personalData.lastName" />
          <FormField control={form.step2.personalData.firstName} testId="personalData.firstName" />
          <FormField
            control={form.step2.personalData.middleName}
            testId="personalData.middleName"
          />
          <FormField control={form.step2.personalData.birthDate} testId="personalData.birthDate" />
        </div>

        <FormField control={form.step2.personalData.gender} testId="personalData.gender" />
        <FormField control={form.step2.personalData.birthPlace} testId="personalData.birthPlace" />

        <h3 className="text-base font-semibold mt-2">Паспортные данные</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.step2.passportData.series} testId="passportData.series" />
          <FormField control={form.step2.passportData.number} testId="passportData.number" />
          <FormField control={form.step2.passportData.issueDate} testId="passportData.issueDate" />
          <FormField
            control={form.step2.passportData.departmentCode}
            testId="passportData.departmentCode"
          />
        </div>
        <FormField control={form.step2.passportData.issuedBy} testId="passportData.issuedBy" />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.step2.inn} testId="inn" />
          <FormField control={form.step2.snils} testId="snils" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.step2.fullName} testId="fullName" />
          <FormField control={form.step2.age} testId="age" />
        </div>
      </section>

      {/* ===== Шаг 3. Контакты ===== */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold mb-4">Шаг 3. Контактная информация</h2>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.step3.phoneMain} testId="phoneMain" />
          <FormField control={form.step3.phoneAdditional} testId="phoneAdditional" />
          <FormField control={form.step3.email} testId="email" />
          <FormField control={form.step3.emailAdditional} testId="emailAdditional" />
        </div>

        <h3 className="text-base font-semibold mt-2">Адрес регистрации</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.step3.registrationAddress.region}
            testId="registrationAddress.region"
          />
          <FormField
            control={form.step3.registrationAddress.city}
            testId="registrationAddress.city"
          />
          <FormField
            control={form.step3.registrationAddress.street}
            testId="registrationAddress.street"
          />
          <FormField
            control={form.step3.registrationAddress.house}
            testId="registrationAddress.house"
          />
          <FormField
            control={form.step3.registrationAddress.apartment}
            testId="registrationAddress.apartment"
          />
          <FormField
            control={form.step3.registrationAddress.postalCode}
            testId="registrationAddress.postalCode"
          />
        </div>

        <FormField control={form.step3.sameAsRegistration} testId="sameAsRegistration" />

        <h3 className="text-base font-semibold mt-2">Адрес проживания</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.step3.residenceAddress.region}
            testId="residenceAddress.region"
          />
          <FormField control={form.step3.residenceAddress.city} testId="residenceAddress.city" />
          <FormField
            control={form.step3.residenceAddress.street}
            testId="residenceAddress.street"
          />
          <FormField control={form.step3.residenceAddress.house} testId="residenceAddress.house" />
          <FormField
            control={form.step3.residenceAddress.apartment}
            testId="residenceAddress.apartment"
          />
          <FormField
            control={form.step3.residenceAddress.postalCode}
            testId="residenceAddress.postalCode"
          />
        </div>
      </section>

      {/* ===== Шаг 4. Занятость ===== */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold mb-4">Шаг 4. Информация о занятости</h2>

        <FormField control={form.step4.employmentStatus} testId="employmentStatus" />

        <h3 className="text-base font-semibold mt-2">Работа по найму</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.step4.companyName} testId="companyName" />
          <FormField control={form.step4.companyInn} testId="companyInn" />
          <FormField control={form.step4.companyPhone} testId="companyPhone" />
          <FormField control={form.step4.position} testId="position" />
        </div>
        <FormField control={form.step4.companyAddress} testId="companyAddress" />

        <h3 className="text-base font-semibold mt-2">Стаж и доход</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.step4.workExperienceTotal} testId="workExperienceTotal" />
          <FormField control={form.step4.workExperienceCurrent} testId="workExperienceCurrent" />
          <FormField control={form.step4.monthlyIncome} testId="monthlyIncome" />
          <FormField control={form.step4.additionalIncome} testId="additionalIncome" />
        </div>
        <FormField control={form.step4.additionalIncomeSource} testId="additionalIncomeSource" />

        <h3 className="text-base font-semibold mt-2">ИП / самозанятый</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.step4.businessType} testId="businessType" />
          <FormField control={form.step4.businessInn} testId="businessInn" />
        </div>
        <FormField control={form.step4.businessActivity} testId="businessActivity" />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.step4.totalIncome} testId="totalIncome" />
          <FormField control={form.step4.paymentToIncomeRatio} testId="paymentToIncomeRatio" />
        </div>
      </section>

      {/* ===== Шаг 5. Дополнительно ===== */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold mb-4">Шаг 5. Дополнительная информация</h2>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.step5.maritalStatus} testId="maritalStatus" />
          <FormField control={form.step5.dependents} testId="dependents" />
        </div>
        <FormField control={form.step5.education} testId="education" />

        {/* ── Имущество (FormArray) ── */}
        <FormField control={form.step5.hasProperty} testId="hasProperty" />
        {hasProperty && (
          <div className="space-y-3">
            <h3 className="text-base font-semibold">Имущество</h3>
            {Array.from({ length: propertyCount }, (_, i) => {
              const item = form.step5.properties.at(i);
              if (!item) return null;
              return (
                <div
                  key={i}
                  className="rounded-md border border-gray-200 p-4 space-y-3 relative"
                  data-testid={`property-card-${i}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="text-sm font-semibold text-gray-700">Имущество #{i + 1}</h4>
                    {propertyCount > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => form.step5.properties.removeAt(i)}
                        aria-label="Удалить имущество"
                        data-testid={`remove-property-${i}`}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <FormField control={item.type} testId={`properties.${i}.type`} />
                  <FormField control={item.description} testId={`properties.${i}.description`} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={item.estimatedValue}
                      testId={`properties.${i}.estimatedValue`}
                    />
                    <FormField
                      control={item.hasEncumbrance}
                      testId={`properties.${i}.hasEncumbrance`}
                    />
                  </div>
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => form.step5.properties.push(propertyTemplate())}
              data-testid="add-property"
            >
              <PlusIcon className="h-4 w-4" />
              Добавить имущество
            </Button>
          </div>
        )}

        {/* ── Существующие кредиты (FormArray) ── */}
        <FormField control={form.step5.hasExistingLoans} testId="hasExistingLoans" />
        {hasExistingLoans && (
          <div className="space-y-3">
            <h3 className="text-base font-semibold">Существующие кредиты</h3>
            {Array.from({ length: loanCount }, (_, i) => {
              const item = form.step5.existingLoans.at(i);
              if (!item) return null;
              return (
                <div
                  key={i}
                  className="rounded-md border border-gray-200 p-4 space-y-3 relative"
                  data-testid={`existing-loan-card-${i}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="text-sm font-semibold text-gray-700">Кредит #{i + 1}</h4>
                    {loanCount > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => form.step5.existingLoans.removeAt(i)}
                        aria-label="Удалить кредит"
                        data-testid={`remove-existing-loan-${i}`}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={item.bank} testId={`existingLoans.${i}.bank`} />
                    <FormField control={item.type} testId={`existingLoans.${i}.type`} />
                    <FormField control={item.amount} testId={`existingLoans.${i}.amount`} />
                    <FormField
                      control={item.remainingAmount}
                      testId={`existingLoans.${i}.remainingAmount`}
                    />
                    <FormField
                      control={item.monthlyPayment}
                      testId={`existingLoans.${i}.monthlyPayment`}
                    />
                    <FormField
                      control={item.maturityDate}
                      testId={`existingLoans.${i}.maturityDate`}
                    />
                  </div>
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => form.step5.existingLoans.push(existingLoanTemplate())}
              data-testid="add-existing-loan"
            >
              <PlusIcon className="h-4 w-4" />
              Добавить кредит
            </Button>
          </div>
        )}

        {/* ── Созаёмщики (FormArray) ── */}
        <FormField control={form.step5.hasCoBorrower} testId="hasCoBorrower" />
        {hasCoBorrower && (
          <div className="space-y-3">
            <h3 className="text-base font-semibold">Созаёмщики</h3>
            {Array.from({ length: coBorrowerCount }, (_, i) => {
              const item = form.step5.coBorrowers.at(i);
              if (!item) return null;
              return (
                <div
                  key={i}
                  className="rounded-md border border-gray-200 p-4 space-y-3 relative"
                  data-testid={`co-borrower-card-${i}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="text-sm font-semibold text-gray-700">Созаёмщик #{i + 1}</h4>
                    {coBorrowerCount > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => form.step5.coBorrowers.removeAt(i)}
                        aria-label="Удалить созаёмщика"
                        data-testid={`remove-co-borrower-${i}`}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={item.personalData.lastName}
                      testId={`coBorrowers.${i}.personalData.lastName`}
                    />
                    <FormField
                      control={item.personalData.firstName}
                      testId={`coBorrowers.${i}.personalData.firstName`}
                    />
                    <FormField
                      control={item.personalData.middleName}
                      testId={`coBorrowers.${i}.personalData.middleName`}
                    />
                    <FormField
                      control={item.personalData.birthDate}
                      testId={`coBorrowers.${i}.personalData.birthDate`}
                    />
                  </div>
                  <FormField
                    control={item.personalData.gender}
                    testId={`coBorrowers.${i}.personalData.gender`}
                  />
                  <FormField
                    control={item.personalData.birthPlace}
                    testId={`coBorrowers.${i}.personalData.birthPlace`}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={item.phone} testId={`coBorrowers.${i}.phone`} />
                    <FormField control={item.email} testId={`coBorrowers.${i}.email`} />
                    <FormField
                      control={item.relationship}
                      testId={`coBorrowers.${i}.relationship`}
                    />
                    <FormField
                      control={item.monthlyIncome}
                      testId={`coBorrowers.${i}.monthlyIncome`}
                    />
                  </div>
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => form.step5.coBorrowers.push(coBorrowerTemplate())}
              data-testid="add-co-borrower"
            >
              <PlusIcon className="h-4 w-4" />
              Добавить созаёмщика
            </Button>
          </div>
        )}

        <FormField control={form.step5.coBorrowersIncome} testId="coBorrowersIncome" />
      </section>

      {/* ===== Шаг 6. Подтверждение ===== */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold mb-4">Шаг 6. Подтверждение и согласия</h2>

        <FormField control={form.step6.agreePersonalData} testId="agreePersonalData" />
        <FormField control={form.step6.agreeCreditHistory} testId="agreeCreditHistory" />
        <FormField control={form.step6.agreeMarketing} testId="agreeMarketing" />
        <FormField control={form.step6.agreeTerms} testId="agreeTerms" />
        <FormField control={form.step6.confirmAccuracy} testId="confirmAccuracy" />
        <FormField control={form.step6.electronicSignature} testId="electronicSignature" />
      </section>

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isSubmitting} data-testid="submit">
          {isSubmitting ? 'Проверка…' : 'Отправить заявку'}
        </Button>
      </div>
    </form>
  );
}
