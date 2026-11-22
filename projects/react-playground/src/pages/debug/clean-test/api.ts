/**
 * Мок серверного API формы: все ответы — функции с задержкой, как и предусмотрено спецификацией.
 */
import { delay } from './data-sources';
import { createInitialValues } from './model';
import {
  addMonths,
  calculateAgeCoefficient,
  calculateBasePremium,
  calculateClaimsCoefficient,
  calculateDeductibleDiscount,
  calculateExperienceCoefficient,
  calculateMultiPolicyDiscount,
  calculateRegionCoefficient,
  calculateRiskFactor,
  calculateTotalPremium,
  toIsoDate,
  type InsuranceApplicationForm,
} from './types';

/** Демо-значения мока: подсказка выводится рядом с полем кода. */
export const DEMO_SMS_CODE = '123456';
/** Код агента, на котором мок отвечает 500: так проверяется ошибка отправки. */
export const FAILING_AGENT_CODE = 'FAIL';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

const relativeDate = (daysFromToday: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return toIsoDate(date);
};

const demoApplication = (): InsuranceApplicationForm => ({
  ...createInitialValues(),
  insuranceType: 'casco',
  insurancePeriod: 12,
  startDate: relativeDate(7),
  coverageAmount: 2_000_000,
  deductible: 50_000,
  insuredType: 'individual',
  personalData: {
    lastName: 'Иванов',
    firstName: 'Иван',
    middleName: 'Иванович',
    birthDate: '1985-05-15',
    gender: 'male',
  },
  passportData: {
    series: '45 01',
    number: '123456',
    issueDate: '2010-06-01',
    issuedBy: 'Отделением УФМС по г. Москве',
  },
  phone: '+7 (916) 123-45-67',
  email: 'ivanov@example.com',
  vehicle: {
    ...createInitialValues().vehicle,
    vin: 'XTA21140012345678',
    brand: 'toyota',
    model: 'camry',
    year: 2020,
    mileage: 50_000,
    enginePower: 181,
    bodyType: 'sedan',
    transmission: 'automatic',
    marketValue: 2_500_000,
    licensePlate: 'А123АА777',
    registrationCert: '77 00 123456',
    hasAntiTheft: true,
    antiTheftBrand: 'StarLine',
    garageParking: true,
  },
  drivers: [
    {
      fullName: 'Иванов Иван Иванович',
      birthDate: '1985-05-15',
      licenseNumber: '77 00 123456',
      licenseIssueDate: '2005-07-01',
      drivingExperience: null,
      accidentsCount: 0,
      isMainDriver: true,
    },
  ],
  hasPreviousInsurance: true,
  previousInsurer: 'АльфаСтрахование',
  previousPolicyNumber: 'ABC-123456',
  previousPolicyEndDate: relativeDate(-30),
});

/** GET /api/insurance/applications/{id} */
export async function fetchApplication(id: string): Promise<InsuranceApplicationForm> {
  await delay(500);
  if (id !== 'demo') throw new ApiError(404, `Заявка с ID "${id}" не найдена`);
  return demoApplication();
}

export interface PromoResult {
  valid: boolean;
  /** Доля, а не проценты: 0.1 — как в примере ответа спецификации. */
  discount: number;
}

const PROMO_CODES: Record<string, number> = { PROMO2024: 0.1, WELCOME15: 0.15, SPRING5: 0.05 };

/** POST /api/insurance/validate-promo */
export async function validatePromo(code: string, signal?: AbortSignal): Promise<PromoResult> {
  await delay(250, signal);
  const discount = PROMO_CODES[code.trim().toUpperCase()];
  return discount === undefined ? { valid: false, discount: 0 } : { valid: true, discount };
}

export interface PremiumResult {
  basePremium: number | null;
  ageCoefficient: number;
  experienceCoefficient: number;
  regionCoefficient: number;
  claimsCoefficient: number;
  /** Скидки — доли, как в примере ответа спецификации. */
  deductibleDiscount: number;
  promoDiscount: number;
  multiPolicyDiscount: number;
  totalPremium: number | null;
}

/** POST /api/insurance/calculate-premium */
export async function calculatePremium(
  values: InsuranceApplicationForm,
  signal?: AbortSignal
): Promise<PremiumResult> {
  await delay(300, signal);
  const basePremium = calculateBasePremium(values.insuranceType, values.coverageAmount);
  const ageCoefficient = calculateAgeCoefficient(
    values.insuranceType,
    values.insuredType,
    values.age,
    values.minDriverAge
  );
  const experienceCoefficient = calculateExperienceCoefficient(
    values.insuranceType,
    values.unlimitedDrivers,
    values.minDriverExperience
  );
  const regionCoefficient = calculateRegionCoefficient(
    values.insuranceType,
    values.property.address.region,
    values.travel.destination
  );
  const claimsCoefficient = calculateClaimsCoefficient(
    values.drivers.map((driver) => driver.accidentsCount),
    values.claims.map((claim) => claim.atFault),
    values.hasPreviousInsurance
  );
  const deductibleDiscount = calculateDeductibleDiscount(values.deductible, values.coverageAmount);
  const promoDiscount = values.promoDiscount ?? 0;
  const multiPolicyDiscount = calculateMultiPolicyDiscount(values.hasPreviousInsurance);
  const totalPremium = calculateTotalPremium({
    basePremium,
    ageCoefficient,
    experienceCoefficient,
    regionCoefficient,
    claimsCoefficient,
    riskFactor: calculateRiskFactor({
      type: values.insuranceType,
      vehicle: values.vehicle,
      property: values.property,
      health: values.health,
    }),
    deductibleDiscount,
    promoDiscount,
    multiPolicyDiscount,
  });
  return {
    basePremium,
    ageCoefficient,
    experienceCoefficient,
    regionCoefficient,
    claimsCoefficient,
    deductibleDiscount: deductibleDiscount / 100,
    promoDiscount: promoDiscount / 100,
    multiPolicyDiscount: multiPolicyDiscount / 100,
    totalPremium,
  };
}

/** POST /api/insurance/send-verification */
export async function sendVerification(phone: string): Promise<void> {
  await delay(300);
  if (!phone) throw new ApiError(400, 'Не указан номер телефона');
}

export interface CreatedApplication {
  id: string;
  policyNumber: string;
  message: string;
}

/** Неверный код из СМС — отдельная причина отказа: форма показывает её под полем. */
export class InvalidSmsCodeError extends ApiError {
  constructor() {
    super(400, 'Неверный код подтверждения');
    this.name = 'InvalidSmsCodeError';
  }
}

/** POST /api/insurance/applications */
export async function createApplication(
  values: InsuranceApplicationForm
): Promise<CreatedApplication> {
  await delay(600);
  if (values.agentCode.trim().toUpperCase() === FAILING_AGENT_CODE) {
    throw new ApiError(500, 'Сервер не отвечает. Повторите отправку');
  }
  if (values.electronicSignature !== DEMO_SMS_CODE) throw new InvalidSmsCodeError();
  const year = new Date().getFullYear();
  const serial = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  return {
    id: `INS-${year}-${serial}`,
    policyNumber: `POL-${year}-${serial}`,
    message: `Заявка успешно создана. Полис будет отправлен на ${values.email}. Действует до ${
      values.endDate || addMonths(values.startDate, values.insurancePeriod)
    }.`,
  };
}
