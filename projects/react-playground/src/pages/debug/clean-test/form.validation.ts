/**
 * Валидация над моделью: по одному набору правил на шаг и предупреждения вне шагов.
 * Условные ветки — validateWhen: скрытые поля не должны блокировать переход между шагами.
 * Правила — константы модуля: отмена устаревших прогонов ключится по их идентичности.
 */
import type { FormValidation, ValidationIssue } from '@reformer/core';
import {
  apply,
  applyEach,
  defineValidation,
  validate,
  validateAsync,
  validateWhen,
  type AsyncRule,
  type Rule,
} from '@reformer/core/validation';
import {
  email,
  max,
  maxLength,
  min,
  minAge,
  minLength,
  pastDate,
  pattern,
  required,
} from '@reformer/core/validators';
import { validatePromo } from './api';
import {
  isVehicleInsurance,
  todayIso,
  type Beneficiary,
  type CompanyData,
  type Driver,
  type Health,
  type InsuranceApplicationForm,
  type PassportData,
  type PersonalData,
  type PropertyObject,
  type Travel,
  type Traveler,
  type Vehicle,
  type Claim,
} from './types';

type Form = InsuranceApplicationForm;

const PHONE_PATTERN = /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/;

/** Даты — строки YYYY-MM-DD: их лексикографический порядок совпадает с хронологическим. */
const notBeforeToday =
  (code: string): Rule<string> =>
  (value) =>
    value && value < todayIso() ? { code } : null;

// ---------------------------------------------------------------------------
// Шаг 1: тип страхования и основные параметры
// ---------------------------------------------------------------------------

export const insuranceStepRules = defineValidation<Form>(({ model }) => {
  validate(model.$.insuranceType, [required()]);
  validate(model.$.insurancePeriod, [required()]);
  validate(model.$.startDate, [required(), notBeforeToday('startDate.past')]);
  validate(model.$.coverageAmount, [
    required(),
    min(100_000, { code: 'coverageAmount.range' }),
    max(50_000_000, { code: 'coverageAmount.range' }),
  ]);
  validate(model.$.deductible, [min(0)]);
  validate(model.$.paymentType, [required()]);
  validateWhen(
    () => model.paymentType === 'installments',
    () => validate(model.$.installments, [required()])
  );
});

// ---------------------------------------------------------------------------
// Шаг 2: данные страхователя
// ---------------------------------------------------------------------------

const personalDataRules = defineValidation<PersonalData>(({ model }) => {
  validate(model.$.lastName, [required()]);
  validate(model.$.firstName, [required()]);
  validate(model.$.birthDate, [required()]);
  validate(model.$.gender, [required()]);
});

const passportDataRules = defineValidation<PassportData>(({ model }) => {
  validate(model.$.series, [
    required(),
    pattern(/^\d{2} \d{2}$/, { code: 'passportData.series.pattern' }),
  ]);
  validate(model.$.number, [
    required(),
    pattern(/^\d{6}$/, { code: 'passportData.number.pattern' }),
  ]);
  validate(model.$.issueDate, [required()]);
  validate(model.$.issuedBy, [required()]);
});

const companyDataRules = defineValidation<CompanyData>(({ model }) => {
  validate(model.$.name, [required()]);
  validate(model.$.inn, [required(), pattern(/^\d{10}$/, { code: 'companyData.inn.pattern' })]);
  validate(model.$.ogrn, [required(), pattern(/^\d{13}$/, { code: 'companyData.ogrn.pattern' })]);
  validate(model.$.kpp, [required(), pattern(/^\d{9}$/, { code: 'companyData.kpp.pattern' })]);
  validate(model.$.ceoName, [required()]);
});

export const insuredStepRules = defineValidation<Form>(({ model }) => {
  validate(model.$.insuredType, [required()]);
  validateWhen(
    () => model.insuredType === 'individual',
    () => {
      apply(model.$.personalData, personalDataRules);
      apply(model.$.passportData, passportDataRules);
      validate(model.$.age, [min(18, { code: 'age.range' }), max(75, { code: 'age.range' })]);
    }
  );
  validateWhen(
    () => model.insuredType === 'company',
    () => apply(model.$.companyData, companyDataRules)
  );
  validate(model.$.phone, [required(), pattern(PHONE_PATTERN, { code: 'phone.pattern' })]);
  validate(model.$.email, [required(), email()]);
});

// ---------------------------------------------------------------------------
// Шаг 3: объект страхования
// ---------------------------------------------------------------------------

const vehicleRules = defineValidation<Vehicle>(({ model }) => {
  validate(model.$.vin, [
    required(),
    minLength(17, { code: 'vehicle.vin.length' }),
    maxLength(17, { code: 'vehicle.vin.length' }),
  ]);
  validate(model.$.brand, [required()]);
  validate(model.$.model, [required()]);
  validate(model.$.year, [
    required(),
    min(1990, { code: 'vehicle.year.range', params: { max: new Date().getFullYear() } }),
    max(new Date().getFullYear(), { code: 'vehicle.year.range' }),
  ]);
  validate(model.$.mileage, [required(), min(0)]);
  validate(model.$.enginePower, [required(), min(1)]);
  validate(model.$.bodyType, [required()]);
  validate(model.$.transmission, [required()]);
  validate(model.$.licensePlate, [required()]);
  validate(model.$.registrationCert, [required()]);
  validate(model.$.usagePurpose, [required()]);
  validateWhen(
    () => model.hasAntiTheft,
    () => validate(model.$.antiTheftBrand, [required()])
  );
});

const propertyRules = defineValidation<PropertyObject>(({ model }) => {
  validate(model.$.type, [required()]);
  validate(model.$.address.region, [required()]);
  validate(model.$.address.city, [required()]);
  validate(model.$.address.street, [required()]);
  validate(model.$.address.house, [required()]);
  validate(model.$.area, [required(), min(1)]);
  validate(model.$.floors, [required(), min(1)]);
  validateWhen(
    () => model.type === 'apartment',
    () => validate(model.$.floor, [required(), min(1)])
  );
  validate(model.$.yearBuilt, [
    required(),
    min(1800, { code: 'property.yearBuilt.range', params: { max: new Date().getFullYear() } }),
    max(new Date().getFullYear(), { code: 'property.yearBuilt.range' }),
  ]);
  validate(model.$.wallMaterial, [required()]);
  validate(model.$.marketValue, [required(), min(0)]);
  validate(model.$.ownershipDoc, [required()]);
});

const healthRules = defineValidation<Health>(({ model }) => {
  validate(model.$.height, [required(), min(100), max(250)]);
  validate(model.$.weight, [required(), min(30), max(300)]);
  validateWhen(
    () => model.isSmoker,
    () => validate(model.$.smokingYears, [required(), min(0)])
  );
  validateWhen(
    () => model.hasChronicDiseases,
    () => validate(model.$.chronicDiseases, [required()])
  );
  validateWhen(
    () => model.hadSurgeries,
    () => validate(model.$.surgeries, [required()])
  );
  validate(model.$.occupation, [required()]);
});

const returnAfterDeparture = (travel: Travel): ValidationIssue | null =>
  travel.departureDate && travel.returnDate && travel.returnDate <= travel.departureDate
    ? { code: 'travel.returnDate.order' }
    : null;

const travelRules = defineValidation<Travel>(({ model, cross }) => {
  validate(model.$.destination, [required()]);
  validate(model.$.tripPurpose, [required()]);
  validate(model.$.departureDate, [required(), notBeforeToday('travel.departureDate.past')]);
  validate(model.$.returnDate, [required()]);
  cross(model.$.returnDate, returnAfterDeparture);
});

const travelerRules = defineValidation<Traveler>(({ model }) => {
  validate(model.$.fullName, [required()]);
  validate(model.$.birthDate, [required()]);
  validate(model.$.passportNumber, [required()]);
});

const atLeastOneOption = (options: Record<string, boolean>): ValidationIssue | null =>
  Object.values(options).some(Boolean) ? null : { code: 'coverage.atLeastOne' };

export const objectStepRules = defineValidation<Form>(({ model, cross }) => {
  validateWhen(
    () => isVehicleInsurance(model.insuranceType),
    () => apply(model.$.vehicle, vehicleRules)
  );
  validateWhen(
    () => model.insuranceType === 'casco',
    () => validate(model.$.vehicle.marketValue, [required(), min(0)])
  );

  validateWhen(
    () => model.insuranceType === 'property',
    () => {
      apply(model.$.property, propertyRules);
      cross(model.$.propertyCoverageOptions.structure, (values) =>
        atLeastOneOption({ ...values.propertyCoverageOptions })
      );
    }
  );

  validateWhen(
    () => model.insuranceType === 'life',
    () => {
      apply(model.$.health, healthRules);
      cross(model.$.lifeCoverageOptions.death, (values) =>
        atLeastOneOption({ ...values.lifeCoverageOptions })
      );
    }
  );

  validateWhen(
    () => model.insuranceType === 'travel',
    () => {
      apply(model.$.travel, travelRules);
      validate(model.$.travelers, [minLength(1, { code: 'travelers.required' })]);
      applyEach(model.$.travelers, travelerRules);
      cross(model.$.travelCoverageOptions.medical, (values) =>
        atLeastOneOption({ ...values.travelCoverageOptions })
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Шаг 4: водители и выгодоприобретатели
// ---------------------------------------------------------------------------

const driverRules = defineValidation<Driver>(({ model }) => {
  validate(model.$.fullName, [required()]);
  validate(model.$.birthDate, [required(), minAge(18, { code: 'driver.birthDate.minAge' })]);
  validate(model.$.licenseNumber, [required()]);
  validate(model.$.licenseIssueDate, [
    required(),
    pastDate({ code: 'driver.licenseIssueDate.future' }),
  ]);
  validate(model.$.accidentsCount, [required(), min(0)]);
});

const beneficiaryRules = defineValidation<Beneficiary>(({ model }) => {
  validate(model.$.fullName, [required()]);
  validate(model.$.birthDate, [required()]);
  validate(model.$.relationship, [required()]);
  validate(model.$.share, [required(), min(1), max(100)]);
  validate(model.$.phone, [required(), pattern(PHONE_PATTERN, { code: 'phone.pattern' })]);
});

const sharesSumTo100 = (form: Form): ValidationIssue | null => {
  const total = form.totalBeneficiaryShare ?? 0;
  return total === 100 ? null : { code: 'beneficiaries.total', params: { total } };
};

export const peopleStepRules = defineValidation<Form>(({ model, cross }) => {
  validateWhen(
    () => isVehicleInsurance(model.insuranceType) && !model.unlimitedDrivers,
    () => {
      validate(model.$.drivers, [minLength(1, { code: 'drivers.required' })]);
      applyEach(model.$.drivers, driverRules);
    }
  );
  validateWhen(
    () => model.insuranceType === 'life',
    () => {
      applyEach(model.$.beneficiaries, beneficiaryRules);
      cross(model.$.totalBeneficiaryShare, sharesSumTo100);
    }
  );
});

// ---------------------------------------------------------------------------
// Шаг 5: история и дополнительная информация
// ---------------------------------------------------------------------------

const claimRules = defineValidation<Claim>(({ model }) => {
  validate(model.$.date, [required()]);
  validate(model.$.type, [required()]);
  validate(model.$.description, [required()]);
  validate(model.$.amount, [required(), min(0)]);
});

/**
 * Недействительный промокод — предупреждение, а не ошибка: спецификация разрешает
 * «продолжить без скидки». Сбой сервиса проверки по той же причине не блокирует шаг.
 */
const promoCodeIsValid: AsyncRule<string> = async (code, { signal }) => {
  if (!code.trim()) return null;
  try {
    const { valid } = await validatePromo(code, signal);
    return valid ? null : { code: 'promoCode.invalid', severity: 'warning' };
  } catch {
    return null;
  }
};

export const historyStepRules = defineValidation<Form>(({ model }) => {
  validateWhen(
    () => model.hasPreviousInsurance,
    () => {
      validate(model.$.previousInsurer, [required()]);
      validate(model.$.previousPolicyNumber, [required()]);
      validate(model.$.previousPolicyEndDate, [required()]);
    }
  );
  validateWhen(
    () => model.hadClaims,
    () => {
      validate(model.$.claims, [minLength(1, { code: 'claims.required' })]);
      applyEach(model.$.claims, claimRules);
    }
  );
  validateAsync(model.$.promoCode, [promoCodeIsValid]);
});

// ---------------------------------------------------------------------------
// Шаг 6: расчёт и подтверждение
// ---------------------------------------------------------------------------

export const confirmationStepRules = defineValidation<Form>(({ model }) => {
  // required() считает false пустым значением — это и есть «must be true».
  const mustBeChecked = required({ code: 'agreement.required' });
  validate(model.$.agreePersonalData, [mustBeChecked]);
  validate(model.$.agreeTerms, [mustBeChecked]);
  validate(model.$.agreeElectronicPolicy, [mustBeChecked]);
  validate(model.$.confirmAccuracy, [mustBeChecked]);
  validate(model.$.electronicSignature, [
    required(),
    pattern(/^\d{6}$/, { code: 'electronicSignature.pattern' }),
  ]);
});

// ---------------------------------------------------------------------------
// Предупреждения: показываются, но переход и отправку не блокируют
// ---------------------------------------------------------------------------

const bmiOutOfRange = (form: Form): ValidationIssue | null => {
  const { bmi } = form.health;
  return bmi !== null && (bmi > 30 || bmi < 18)
    ? { code: 'health.bmi.risk', severity: 'warning', params: { bmi } }
    : null;
};

const youngestDriver = (form: Form): ValidationIssue | null =>
  form.minDriverAge !== null && form.minDriverAge < 22
    ? { code: 'minDriverAge.risk', severity: 'warning' }
    : null;

export const warningRules = defineValidation<Form>(({ model, cross }) => {
  validateWhen(
    () => model.insuranceType === 'life',
    () => cross(model.$.health.bmi, bmiOutOfRange)
  );
  validateWhen(
    () => isVehicleInsurance(model.insuranceType) && !model.unlimitedDrivers,
    () => cross(model.$.minDriverAge, youngestDriver)
  );
});

/**
 * Правила шагов уходят в поток (form.flow.ts), здесь — правила вне шагов и стратегия.
 * Живая проверка гасит показанные ошибки по мере исправления, а не только по «Далее».
 */
export const formValidation: FormValidation<Form> = {
  extras: warningRules,
  strategy: 'change',
  debounce: 300,
};
