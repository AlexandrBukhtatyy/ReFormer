import { useMemo } from 'react';
import { FormField } from '@reformer/ui-kit';
import { creditApplicationForm } from './schema';

export default function McpCreditApplicationV2() {
  const form = useMemo(() => creditApplicationForm, []);

  // Template item proxies for FormArray fields (stage 1: render template once, no add/remove yet).
  const propertyItem = form.step5.properties.at(0);
  const loanItem = form.step5.existingLoans.at(0);
  const coBorrowerItem = form.step5.coBorrowers.at(0);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
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

        <FormField control={form.step5.hasProperty} testId="hasProperty" />
        {propertyItem && (
          <div className="border border-gray-200 rounded-md p-4 space-y-4">
            <h3 className="text-base font-semibold">Имущество</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={propertyItem.type} testId="properties.0.type" />
              <FormField
                control={propertyItem.estimatedValue}
                testId="properties.0.estimatedValue"
              />
            </div>
            <FormField control={propertyItem.description} testId="properties.0.description" />
            <FormField control={propertyItem.hasEncumbrance} testId="properties.0.hasEncumbrance" />
          </div>
        )}

        <FormField control={form.step5.hasExistingLoans} testId="hasExistingLoans" />
        {loanItem && (
          <div className="border border-gray-200 rounded-md p-4 space-y-4">
            <h3 className="text-base font-semibold">Существующий кредит</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={loanItem.bank} testId="existingLoans.0.bank" />
              <FormField control={loanItem.type} testId="existingLoans.0.type" />
              <FormField control={loanItem.amount} testId="existingLoans.0.amount" />
              <FormField
                control={loanItem.remainingAmount}
                testId="existingLoans.0.remainingAmount"
              />
              <FormField
                control={loanItem.monthlyPayment}
                testId="existingLoans.0.monthlyPayment"
              />
              <FormField control={loanItem.maturityDate} testId="existingLoans.0.maturityDate" />
            </div>
          </div>
        )}

        <FormField control={form.step5.hasCoBorrower} testId="hasCoBorrower" />
        {coBorrowerItem && (
          <div className="border border-gray-200 rounded-md p-4 space-y-4">
            <h3 className="text-base font-semibold">Созаемщик</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={coBorrowerItem.personalData.lastName}
                testId="coBorrowers.0.personalData.lastName"
              />
              <FormField
                control={coBorrowerItem.personalData.firstName}
                testId="coBorrowers.0.personalData.firstName"
              />
              <FormField
                control={coBorrowerItem.personalData.middleName}
                testId="coBorrowers.0.personalData.middleName"
              />
              <FormField
                control={coBorrowerItem.personalData.birthDate}
                testId="coBorrowers.0.personalData.birthDate"
              />
            </div>
            <FormField
              control={coBorrowerItem.personalData.gender}
              testId="coBorrowers.0.personalData.gender"
            />
            <FormField
              control={coBorrowerItem.personalData.birthPlace}
              testId="coBorrowers.0.personalData.birthPlace"
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={coBorrowerItem.phone} testId="coBorrowers.0.phone" />
              <FormField control={coBorrowerItem.email} testId="coBorrowers.0.email" />
              <FormField
                control={coBorrowerItem.relationship}
                testId="coBorrowers.0.relationship"
              />
              <FormField
                control={coBorrowerItem.monthlyIncome}
                testId="coBorrowers.0.monthlyIncome"
              />
            </div>
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
    </div>
  );
}
