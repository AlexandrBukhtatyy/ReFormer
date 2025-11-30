/**
 * Трансформеры данных для конвертации между форматом формы и форматом API
 *
 * - deserialize: API → Форма (при загрузке данных)
 * - serialize: Форма → API (при сохранении)
 */

import type { CreditApplicationForm } from '@/forms/credit-application/types/credit-application.types';
import type { ApiApplicationData } from '@/forms/credit-application/services/api';

/**
 * Десериализация данных API в формат формы
 * Преобразует данные с сервера в формат, понятный форме
 */
export function deserializeApplication(api: ApiApplicationData): Partial<CreditApplicationForm> {
  return {
    loanType: api.loanType as CreditApplicationForm['loanType'],
    loanAmount: api.loanAmount,
    loanTerm: api.loanTerm,
    loanPurpose: api.loanPurpose,
    propertyValue: api.propertyValue,
    initialPayment: api.initialPayment,
    carBrand: api.carBrand,
    carModel: api.carModel,
    carYear: api.carYear,
    carPrice: api.carPrice,
    personalData: {
      ...api.personalData,
    },
    passportData: {
      ...api.passportData,
    },
    inn: api.inn,
    snils: api.snils,
    phoneMain: api.phoneMain,
    phoneAdditional: api.phoneAdditional,
    email: api.email,
    emailAdditional: api.emailAdditional,
    registrationAddress: { ...api.registrationAddress },
    sameAsRegistration: api.sameAsRegistration,
    residenceAddress: { ...api.residenceAddress },
    employmentStatus: api.employmentStatus as CreditApplicationForm['employmentStatus'],
    companyName: api.companyName,
    companyInn: api.companyInn,
    companyPhone: api.companyPhone,
    companyAddress: api.companyAddress,
    position: api.position,
    workExperienceTotal: api.workExperienceTotal,
    workExperienceCurrent: api.workExperienceCurrent,
    monthlyIncome: api.monthlyIncome,
    additionalIncome: api.additionalIncome,
    additionalIncomeSource: api.additionalIncomeSource,
    businessType: api.businessType,
    businessInn: api.businessInn,
    businessActivity: api.businessActivity,
    maritalStatus: api.maritalStatus as CreditApplicationForm['maritalStatus'],
    dependents: api.dependents,
    education: api.education as CreditApplicationForm['education'],
    hasProperty: api.hasProperty,
    properties: api.properties.map((p) => ({
      ...p,
      type: p.type as CreditApplicationForm['properties'][0]['type'],
    })),
    hasExistingLoans: api.hasExistingLoans,
    existingLoans: [...api.existingLoans],
    hasCoBorrower: api.hasCoBorrower,
    coBorrowers: [...api.coBorrowers],
    agreePersonalData: api.agreePersonalData,
    agreeCreditHistory: api.agreeCreditHistory,
    agreeMarketing: api.agreeMarketing,
    agreeTerms: api.agreeTerms,
    confirmAccuracy: api.confirmAccuracy,
    electronicSignature: api.electronicSignature,
  };
}

/**
 * Сериализация данных формы в формат API
 * Преобразует данные формы в формат для отправки на сервер
 */
export function serializeApplication(form: CreditApplicationForm): ApiApplicationData {
  return {
    loanType: form.loanType,
    loanAmount: form.loanAmount,
    loanTerm: form.loanTerm,
    loanPurpose: form.loanPurpose,
    propertyValue: form.propertyValue,
    initialPayment: form.initialPayment,
    carBrand: form.carBrand,
    carModel: form.carModel,
    carYear: form.carYear,
    carPrice: form.carPrice,
    personalData: {
      ...form.personalData,
    },
    passportData: {
      ...form.passportData,
    },
    inn: form.inn,
    snils: form.snils,
    phoneMain: form.phoneMain,
    phoneAdditional: form.phoneAdditional,
    email: form.email,
    emailAdditional: form.emailAdditional,
    registrationAddress: { ...form.registrationAddress },
    sameAsRegistration: form.sameAsRegistration,
    residenceAddress: { ...form.residenceAddress },
    employmentStatus: form.employmentStatus,
    companyName: form.companyName,
    companyInn: form.companyInn,
    companyPhone: form.companyPhone,
    companyAddress: form.companyAddress,
    position: form.position,
    workExperienceTotal: form.workExperienceTotal,
    workExperienceCurrent: form.workExperienceCurrent,
    monthlyIncome: form.monthlyIncome,
    additionalIncome: form.additionalIncome,
    additionalIncomeSource: form.additionalIncomeSource,
    businessType: form.businessType,
    businessInn: form.businessInn,
    businessActivity: form.businessActivity,
    maritalStatus: form.maritalStatus,
    dependents: form.dependents,
    education: form.education,
    hasProperty: form.hasProperty,
    properties: form.properties.map((p) => ({ ...p })),
    hasExistingLoans: form.hasExistingLoans,
    existingLoans: form.existingLoans.map((l) => ({ ...l })),
    hasCoBorrower: form.hasCoBorrower,
    coBorrowers: form.coBorrowers.map((c) => ({
      ...c,
      personalData: { ...c.personalData },
    })),
    agreePersonalData: form.agreePersonalData,
    agreeCreditHistory: form.agreeCreditHistory,
    agreeMarketing: form.agreeMarketing,
    agreeTerms: form.agreeTerms,
    confirmAccuracy: form.confirmAccuracy,
    electronicSignature: form.electronicSignature,
  };
}
