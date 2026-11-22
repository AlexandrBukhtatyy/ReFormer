/**
 * Модель формы: начальные значения и шаблоны новых строк массивов.
 * Числовые поля — `number | null`: это контракт InputNumber (пустой ввод — null).
 */
import { arrayOf, createModel } from '@reformer/core';
import type { Beneficiary, Claim, Driver, InsuranceApplicationForm, Traveler } from './types';

const blankTraveler = (): Traveler => ({ fullName: '', birthDate: '', passportNumber: '' });

const blankDriver = (): Driver => ({
  fullName: '',
  birthDate: '',
  licenseNumber: '',
  licenseIssueDate: '',
  drivingExperience: null,
  accidentsCount: 0,
  isMainDriver: false,
});

const blankBeneficiary = (): Beneficiary => ({
  fullName: '',
  birthDate: '',
  relationship: 'spouse',
  share: null,
  phone: '',
});

const blankClaim = (): Claim => ({
  date: '',
  type: 'accident',
  description: '',
  amount: null,
  atFault: false,
});

/** Начальные значения. Шаблоны arrayOf не копируются, поэтому это фабрика, а не константа. */
export const createInitialValues = (): InsuranceApplicationForm => ({
  insuranceType: 'casco',
  insurancePeriod: 12,
  startDate: '',
  endDate: '',
  coverageAmount: null,
  deductible: null,
  paymentType: 'single',
  installments: null,

  insuredType: 'individual',
  personalData: { lastName: '', firstName: '', middleName: '', birthDate: '', gender: 'male' },
  companyData: { name: '', inn: '', ogrn: '', kpp: '', ceoName: '' },
  passportData: { series: '', number: '', issueDate: '', issuedBy: '' },
  phone: '',
  email: '',
  fullName: '',
  age: null,

  vehicle: {
    vin: '',
    brand: '',
    model: '',
    year: null,
    mileage: null,
    enginePower: null,
    bodyType: 'sedan',
    transmission: 'manual',
    marketValue: null,
    licensePlate: '',
    registrationCert: '',
    hasAntiTheft: false,
    antiTheftBrand: '',
    garageParking: false,
    usagePurpose: 'personal',
  },
  property: {
    type: 'apartment',
    address: { region: '', city: '', street: '', house: '', apartment: '' },
    area: null,
    floors: null,
    floor: null,
    yearBuilt: null,
    wallMaterial: 'brick',
    marketValue: null,
    hasAlarm: false,
    hasFireAlarm: false,
    ownershipDoc: '',
  },
  propertyCoverageOptions: { structure: true, interior: false, movables: false, liability: false },
  health: {
    height: null,
    weight: null,
    bmi: null,
    bloodPressure: '',
    isSmoker: false,
    smokingYears: null,
    hasChronicDiseases: false,
    chronicDiseases: '',
    hadSurgeries: false,
    surgeries: '',
    occupation: '',
    isHighRiskJob: false,
    practicesSports: false,
    extremeSports: false,
  },
  lifeCoverageOptions: { death: true, disability: false, criticalIllness: false, accident: false },
  travel: {
    destination: 'europe',
    tripPurpose: 'tourism',
    departureDate: '',
    returnDate: '',
    tripDuration: null,
    isMultipleTrips: false,
  },
  travelers: arrayOf(blankTraveler),
  travelCoverageOptions: {
    medical: true,
    baggage: false,
    tripCancellation: false,
    flightDelay: false,
    carRental: false,
  },

  drivers: arrayOf(blankDriver),
  unlimitedDrivers: false,
  minDriverAge: null,
  minDriverExperience: null,
  beneficiaries: arrayOf(blankBeneficiary),
  totalBeneficiaryShare: null,

  hasPreviousInsurance: false,
  previousInsurer: '',
  previousPolicyNumber: '',
  previousPolicyEndDate: '',
  hadClaims: false,
  claims: arrayOf(blankClaim),
  promoCode: '',
  referralSource: 'internet',
  agentCode: '',
  additionalNotes: '',

  basePremium: null,
  ageCoefficient: null,
  experienceCoefficient: null,
  regionCoefficient: null,
  claimsCoefficient: null,
  deductibleDiscount: null,
  promoDiscount: null,
  multiPolicyDiscount: null,
  totalPremium: null,
  installmentAmount: null,
  agreePersonalData: false,
  agreeTerms: false,
  agreeElectronicPolicy: false,
  agreeMarketing: false,
  confirmAccuracy: false,
  electronicSignature: '',
});

/** Модель — по одной на сборку. */
export const createApplicationModel = () =>
  createModel<InsuranceApplicationForm>(createInitialValues());
