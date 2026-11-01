/**
 * Типы формы, перечисления, постоянные справочники и чистые расчёты предметной области.
 * Расчёты живут здесь, потому что нужны и поведению (живой пересчёт), и моку сервера.
 */

export type InsuranceType = 'casco' | 'osago' | 'property' | 'life' | 'travel';
export type PaymentType = 'single' | 'installments';
export type InsuredType = 'individual' | 'company';
export type Gender = 'male' | 'female';
export type BodyType = 'sedan' | 'hatchback' | 'suv' | 'wagon' | 'coupe' | 'minivan' | 'pickup';
export type Transmission = 'manual' | 'automatic';
export type UsagePurpose = 'personal' | 'taxi' | 'training' | 'commercial';
export type PropertyType = 'apartment' | 'house' | 'townhouse' | 'commercial' | 'land';
export type WallMaterial = 'brick' | 'concrete' | 'wood' | 'panel' | 'monolith' | 'other';
export type TravelDestination = 'europe' | 'asia' | 'usa_canada' | 'cis' | 'worldwide';
export type TripPurpose = 'tourism' | 'business' | 'study' | 'work' | 'other';
export type Relationship = 'spouse' | 'child' | 'parent' | 'sibling' | 'other';
export type ClaimType = 'accident' | 'theft' | 'damage' | 'natural' | 'medical' | 'other';
export type ReferralSource = 'internet' | 'friends' | 'tv' | 'agent' | 'other';

export type FormMode = 'create' | 'edit' | 'view';

export interface Option<V extends string | number = string> {
  value: V;
  label: string;
}

export interface PersonalData {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  gender: Gender;
}

export interface CompanyData {
  name: string;
  inn: string;
  ogrn: string;
  kpp: string;
  ceoName: string;
}

export interface PassportData {
  series: string;
  number: string;
  issueDate: string;
  issuedBy: string;
}

export interface Vehicle {
  vin: string;
  brand: string;
  model: string;
  year: number | null;
  mileage: number | null;
  enginePower: number | null;
  bodyType: BodyType;
  transmission: Transmission;
  marketValue: number | null;
  licensePlate: string;
  registrationCert: string;
  hasAntiTheft: boolean;
  antiTheftBrand: string;
  garageParking: boolean;
  usagePurpose: UsagePurpose;
}

export interface PropertyAddress {
  region: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
}

export interface PropertyObject {
  type: PropertyType;
  address: PropertyAddress;
  area: number | null;
  floors: number | null;
  floor: number | null;
  yearBuilt: number | null;
  wallMaterial: WallMaterial;
  marketValue: number | null;
  hasAlarm: boolean;
  hasFireAlarm: boolean;
  ownershipDoc: string;
}

export interface PropertyCoverageOptions {
  structure: boolean;
  interior: boolean;
  movables: boolean;
  liability: boolean;
}

export interface Health {
  height: number | null;
  weight: number | null;
  bmi: number | null;
  bloodPressure: string;
  isSmoker: boolean;
  smokingYears: number | null;
  hasChronicDiseases: boolean;
  chronicDiseases: string;
  hadSurgeries: boolean;
  surgeries: string;
  occupation: string;
  isHighRiskJob: boolean;
  practicesSports: boolean;
  extremeSports: boolean;
}

export interface LifeCoverageOptions {
  death: boolean;
  disability: boolean;
  criticalIllness: boolean;
  accident: boolean;
}

export interface Travel {
  destination: TravelDestination;
  tripPurpose: TripPurpose;
  departureDate: string;
  returnDate: string;
  tripDuration: number | null;
  isMultipleTrips: boolean;
}

export interface Traveler {
  fullName: string;
  birthDate: string;
  passportNumber: string;
}

export interface TravelCoverageOptions {
  medical: boolean;
  baggage: boolean;
  tripCancellation: boolean;
  flightDelay: boolean;
  carRental: boolean;
}

export interface Driver {
  fullName: string;
  birthDate: string;
  licenseNumber: string;
  licenseIssueDate: string;
  drivingExperience: number | null;
  accidentsCount: number | null;
  isMainDriver: boolean;
}

export interface Beneficiary {
  fullName: string;
  birthDate: string;
  relationship: Relationship;
  share: number | null;
  phone: string;
}

export interface Claim {
  date: string;
  type: ClaimType;
  description: string;
  amount: number | null;
  atFault: boolean;
}

export interface InsuranceApplicationForm {
  // Шаг 1
  insuranceType: InsuranceType;
  insurancePeriod: number | null;
  startDate: string;
  endDate: string;
  coverageAmount: number | null;
  deductible: number | null;
  paymentType: PaymentType;
  installments: number | null;
  // Шаг 2
  insuredType: InsuredType;
  personalData: PersonalData;
  companyData: CompanyData;
  passportData: PassportData;
  phone: string;
  email: string;
  fullName: string;
  age: number | null;
  // Шаг 3
  vehicle: Vehicle;
  property: PropertyObject;
  propertyCoverageOptions: PropertyCoverageOptions;
  health: Health;
  lifeCoverageOptions: LifeCoverageOptions;
  travel: Travel;
  travelers: Traveler[];
  travelCoverageOptions: TravelCoverageOptions;
  // Шаг 4
  drivers: Driver[];
  unlimitedDrivers: boolean;
  minDriverAge: number | null;
  minDriverExperience: number | null;
  beneficiaries: Beneficiary[];
  totalBeneficiaryShare: number | null;
  // Шаг 5
  hasPreviousInsurance: boolean;
  previousInsurer: string;
  previousPolicyNumber: string;
  previousPolicyEndDate: string;
  hadClaims: boolean;
  claims: Claim[];
  promoCode: string;
  referralSource: ReferralSource;
  agentCode: string;
  additionalNotes: string;
  // Шаг 6
  basePremium: number | null;
  ageCoefficient: number | null;
  experienceCoefficient: number | null;
  regionCoefficient: number | null;
  claimsCoefficient: number | null;
  deductibleDiscount: number | null;
  promoDiscount: number | null;
  multiPolicyDiscount: number | null;
  totalPremium: number | null;
  installmentAmount: number | null;
  agreePersonalData: boolean;
  agreeTerms: boolean;
  agreeElectronicPolicy: boolean;
  agreeMarketing: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;
}

// ---------------------------------------------------------------------------
// Постоянные справочники
// ---------------------------------------------------------------------------

export const INSURANCE_TYPES: Option<InsuranceType>[] = [
  { value: 'casco', label: 'КАСКО' },
  { value: 'osago', label: 'ОСАГО' },
  { value: 'property', label: 'Недвижимость' },
  { value: 'life', label: 'Жизнь и здоровье' },
  { value: 'travel', label: 'Путешествия' },
];

export const INSURANCE_PERIODS: Option<number>[] = [
  { value: 3, label: '3 месяца' },
  { value: 6, label: '6 месяцев' },
  { value: 12, label: '1 год' },
  { value: 24, label: '2 года' },
  { value: 36, label: '3 года' },
];

export const PAYMENT_TYPES: Option<PaymentType>[] = [
  { value: 'single', label: 'Единовременно' },
  { value: 'installments', label: 'В рассрочку' },
];

export const INSTALLMENT_COUNTS: Option<number>[] = [
  { value: 2, label: '2 платежа' },
  { value: 3, label: '3 платежа' },
  { value: 4, label: '4 платежа' },
  { value: 6, label: '6 платежей' },
  { value: 12, label: '12 платежей' },
];

export const INSURED_TYPES: Option<InsuredType>[] = [
  { value: 'individual', label: 'Физическое лицо' },
  { value: 'company', label: 'Юридическое лицо' },
];

export const GENDERS: Option<Gender>[] = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];

export const BODY_TYPES: Option<BodyType>[] = [
  { value: 'sedan', label: 'Седан' },
  { value: 'hatchback', label: 'Хэтчбек' },
  { value: 'suv', label: 'Внедорожник' },
  { value: 'wagon', label: 'Универсал' },
  { value: 'coupe', label: 'Купе' },
  { value: 'minivan', label: 'Минивэн' },
  { value: 'pickup', label: 'Пикап' },
];

export const TRANSMISSIONS: Option<Transmission>[] = [
  { value: 'manual', label: 'Механика' },
  { value: 'automatic', label: 'Автомат' },
];

export const USAGE_PURPOSES: Option<UsagePurpose>[] = [
  { value: 'personal', label: 'Личное' },
  { value: 'taxi', label: 'Такси' },
  { value: 'training', label: 'Учебный' },
  { value: 'commercial', label: 'Коммерческое' },
];

export const PROPERTY_TYPES: Option<PropertyType>[] = [
  { value: 'apartment', label: 'Квартира' },
  { value: 'house', label: 'Дом' },
  { value: 'townhouse', label: 'Таунхаус' },
  { value: 'commercial', label: 'Коммерческая' },
  { value: 'land', label: 'Земельный участок' },
];

export const WALL_MATERIALS: Option<WallMaterial>[] = [
  { value: 'brick', label: 'Кирпич' },
  { value: 'concrete', label: 'Бетон' },
  { value: 'wood', label: 'Дерево' },
  { value: 'panel', label: 'Панель' },
  { value: 'monolith', label: 'Монолит' },
  { value: 'other', label: 'Другое' },
];

export const TRAVEL_DESTINATIONS: Option<TravelDestination>[] = [
  { value: 'europe', label: 'Европа' },
  { value: 'asia', label: 'Азия' },
  { value: 'usa_canada', label: 'США и Канада' },
  { value: 'cis', label: 'СНГ' },
  { value: 'worldwide', label: 'Весь мир' },
];

export const TRIP_PURPOSES: Option<TripPurpose>[] = [
  { value: 'tourism', label: 'Туризм' },
  { value: 'business', label: 'Бизнес' },
  { value: 'study', label: 'Обучение' },
  { value: 'work', label: 'Работа' },
  { value: 'other', label: 'Другое' },
];

export const RELATIONSHIPS: Option<Relationship>[] = [
  { value: 'spouse', label: 'Супруг(а)' },
  { value: 'child', label: 'Ребенок' },
  { value: 'parent', label: 'Родитель' },
  { value: 'sibling', label: 'Брат/сестра' },
  { value: 'other', label: 'Другое' },
];

export const CLAIM_TYPES: Option<ClaimType>[] = [
  { value: 'accident', label: 'ДТП' },
  { value: 'theft', label: 'Угон/кража' },
  { value: 'damage', label: 'Повреждение' },
  { value: 'natural', label: 'Стихийное бедствие' },
  { value: 'medical', label: 'Медицинский случай' },
  { value: 'other', label: 'Другое' },
];

export const REFERRAL_SOURCES: Option<ReferralSource>[] = [
  { value: 'internet', label: 'Интернет' },
  { value: 'friends', label: 'Рекомендации друзей' },
  { value: 'tv', label: 'Телевидение' },
  { value: 'agent', label: 'Страховой агент' },
  { value: 'other', label: 'Другое' },
];

/** Маски из спецификации: 9 — цифра, остальное — литералы. */
export const MASKS = {
  phone: '+7 (999) 999-99-99',
  inn: '9999999999',
  ogrn: '9999999999999',
  kpp: '999999999',
  passportSeries: '99 99',
  passportNumber: '999999',
  smsCode: '999999',
};

// ---------------------------------------------------------------------------
// Маска: InputMask из ui-kit литералы не вставляет, форматирует поведение
// ---------------------------------------------------------------------------

/** Привести ввод к маске. Идемпотентна: повторный вызов на результате значение не меняет. */
export function formatByMask(raw: string, mask: string): string {
  const firstSlot = mask.indexOf('9');
  const literalHead = (firstSlot < 0 ? mask : mask.slice(0, firstSlot)).replace(/[^+\d]/g, '');
  const literalDigits = literalHead.replace(/\D/g, '');
  const allDigits = raw.replace(/\D/g, '');
  // Цифра из литерала маски («7» в «+7 (…») вводом не считается, только если она уже в значении.
  const digits =
    literalHead !== '' && raw.startsWith(literalHead)
      ? allDigits.slice(literalDigits.length)
      : allDigits;

  let result = '';
  let next = 0;
  for (const slot of mask) {
    if (next >= digits.length) break;
    if (slot === '9') {
      result += digits.charAt(next);
      next += 1;
    } else {
      result += slot;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Даты (строки YYYY-MM-DD, как у input[type=date]; часовой пояс — локальный)
// ---------------------------------------------------------------------------

const pad = (value: number): string => String(value).padStart(2, '0');

export const toIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const todayIso = (): string => toIsoDate(new Date());

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Дата + N месяцев; конец месяца не переносится (31 янв + 1 мес = 28/29 фев). */
export function addMonths(value: string, months: number | null): string {
  const start = parseIsoDate(value);
  if (!start || months === null) return '';
  const day = start.getDate();
  const result = new Date(start.getFullYear(), start.getMonth() + months, 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return toIsoDate(result);
}

/** Полных лет от даты до сегодня; будущая или пустая дата — null. */
export function fullYearsSince(value: string): number | null {
  const start = parseIsoDate(value);
  if (!start) return null;
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  const beforeAnniversary =
    now.getMonth() < start.getMonth() ||
    (now.getMonth() === start.getMonth() && now.getDate() < start.getDate());
  if (beforeAnniversary) years -= 1;
  return years < 0 ? null : years;
}

/** Разница в днях; конец раньше начала или равен ему — null. */
export function daysBetween(from: string, to: string): number | null {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (!start || !end) return null;
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return days > 0 ? days : null;
}

// ---------------------------------------------------------------------------
// Расчёт стоимости
// Спецификация задаёт только диапазоны коэффициентов и общую формулу; пороги и ставки ниже —
// собственное решение (см. отчёт, раздел 4).
// ---------------------------------------------------------------------------

export const round2 = (value: number): number => Math.round(value * 100) / 100;

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

export const isVehicleInsurance = (type: InsuranceType): boolean =>
  type === 'casco' || type === 'osago';

const BASE_RATES: Record<InsuranceType, number> = {
  casco: 0.05,
  osago: 0.01,
  property: 0.005,
  life: 0.01,
  travel: 0.002,
};

export function calculateBasePremium(
  type: InsuranceType,
  coverageAmount: number | null
): number | null {
  if (coverageAmount === null) return null;
  return round2(coverageAmount * BASE_RATES[type]);
}

/** Диапазон 1.0–1.8: для транспорта — по младшему водителю, иначе по страхователю. */
export function calculateAgeCoefficient(
  type: InsuranceType,
  insuredType: InsuredType,
  age: number | null,
  minDriverAge: number | null
): number {
  const relevantAge = isVehicleInsurance(type)
    ? minDriverAge
    : insuredType === 'individual'
      ? age
      : null;
  if (relevantAge === null) return 1;
  if (relevantAge < 22) return 1.8;
  if (relevantAge < 25) return 1.5;
  if (relevantAge < 30) return 1.2;
  if (relevantAge >= 65) return 1.4;
  return 1;
}

/** Диапазон 1.0–1.6: только для транспорта; неограниченный список водителей — максимум. */
export function calculateExperienceCoefficient(
  type: InsuranceType,
  unlimitedDrivers: boolean,
  minDriverExperience: number | null
): number {
  if (!isVehicleInsurance(type)) return 1;
  if (unlimitedDrivers) return 1.6;
  if (minDriverExperience === null) return 1;
  if (minDriverExperience < 1) return 1.6;
  if (minDriverExperience < 3) return 1.4;
  if (minDriverExperience < 5) return 1.2;
  return 1;
}

const DESTINATION_COEFFICIENTS: Record<TravelDestination, number> = {
  cis: 0.8,
  europe: 1.2,
  asia: 1.4,
  worldwide: 1.8,
  usa_canada: 2,
};

/** Диапазон 0.8–2.0. У транспорта и жизни поля региона нет — коэффициент 1. */
export function calculateRegionCoefficient(
  type: InsuranceType,
  propertyRegion: string,
  destination: TravelDestination
): number {
  if (type === 'travel') return DESTINATION_COEFFICIENTS[destination];
  if (type !== 'property') return 1;
  const region = propertyRegion.toLowerCase();
  if (region.includes('моск')) return 1.5;
  if (region.includes('петербург') || region.includes('ленинград')) return 1.3;
  return region === '' ? 1 : 0.9;
}

/** КБМ, диапазон 0.5–2.5: ДТП водителей и случаи по вине страхователя повышают его. */
export function calculateClaimsCoefficient(
  accidents: readonly (number | null)[],
  claimsAtFault: readonly boolean[],
  hasPreviousInsurance: boolean
): number {
  const accidentsTotal = accidents.reduce<number>((sum, count) => sum + (count ?? 0), 0);
  const atFaultTotal = claimsAtFault.filter(Boolean).length;
  const incidents = accidentsTotal + atFaultTotal;
  if (incidents === 0) return hasPreviousInsurance ? 0.8 : 1;
  return round2(clamp(1 + incidents * 0.3, 0.5, 2.5));
}

/** Скидка за франшизу, %: deductible / coverageAmount * 50%. */
export function calculateDeductibleDiscount(
  deductible: number | null,
  coverageAmount: number | null
): number {
  if (!deductible || !coverageAmount) return 0;
  return round2(clamp((deductible / coverageAmount) * 50, 0, 50));
}

/** Скидка за комплексное страхование, %: «другие полисы» — признак предыдущего полиса. */
export const calculateMultiPolicyDiscount = (hasPreviousInsurance: boolean): number =>
  hasPreviousInsurance ? 10 : 0;

export interface RiskFactors {
  type: InsuranceType;
  vehicle: Pick<Vehicle, 'enginePower' | 'hasAntiTheft' | 'garageParking' | 'usagePurpose'>;
  property: Pick<PropertyObject, 'hasAlarm' | 'hasFireAlarm'>;
  health: Pick<Health, 'isSmoker' | 'hasChronicDiseases' | 'isHighRiskJob' | 'extremeSports'>;
}

const USAGE_FACTORS: Record<UsagePurpose, number> = {
  personal: 1,
  training: 1.3,
  commercial: 1.4,
  taxi: 1.5,
};

/**
 * Поля «влияет на коэффициент / скидку» без собственной строки в расчёте спецификации:
 * мощность, противоугонка, гараж, цель использования, сигнализации, факторы здоровья.
 */
export function calculateRiskFactor({ type, vehicle, property, health }: RiskFactors): number {
  let factor = 1;
  if (isVehicleInsurance(type)) {
    const power = vehicle.enginePower ?? 0;
    if (power > 200) factor *= 1.2;
    else if (power > 120) factor *= 1.1;
    factor *= USAGE_FACTORS[vehicle.usagePurpose];
    if (vehicle.garageParking) factor *= 0.95;
    if (vehicle.hasAntiTheft) factor *= 0.9;
  }
  if (type === 'property') {
    if (property.hasAlarm) factor *= 0.95;
    if (property.hasFireAlarm) factor *= 0.95;
  }
  if (type === 'life') {
    if (health.isSmoker) factor *= 1.3;
    if (health.hasChronicDiseases) factor *= 1.4;
    if (health.isHighRiskJob) factor *= 1.3;
    if (health.extremeSports) factor *= 1.25;
  }
  return factor;
}

export interface TotalPremiumInput {
  basePremium: number | null;
  ageCoefficient: number | null;
  experienceCoefficient: number | null;
  regionCoefficient: number | null;
  claimsCoefficient: number | null;
  riskFactor: number;
  deductibleDiscount: number | null;
  promoDiscount: number | null;
  multiPolicyDiscount: number | null;
}

/** basePremium * коэффициенты * (1 - скидки); скидки заданы в процентах. */
export function calculateTotalPremium(input: TotalPremiumInput): number | null {
  if (input.basePremium === null) return null;
  const discounts =
    (input.deductibleDiscount ?? 0) + (input.promoDiscount ?? 0) + (input.multiPolicyDiscount ?? 0);
  return round2(
    input.basePremium *
      (input.ageCoefficient ?? 1) *
      (input.experienceCoefficient ?? 1) *
      (input.regionCoefficient ?? 1) *
      (input.claimsCoefficient ?? 1) *
      input.riskFactor *
      Math.max(0, 1 - discounts / 100)
  );
}

/** Рассрочка: totalPremium / installments * 1.05; единовременно — весь платёж. */
export function calculateInstallmentAmount(
  totalPremium: number | null,
  paymentType: PaymentType,
  installments: number | null
): number | null {
  if (totalPremium === null) return null;
  if (paymentType !== 'installments') return totalPremium;
  if (!installments) return null;
  return round2((totalPremium / installments) * 1.05);
}
