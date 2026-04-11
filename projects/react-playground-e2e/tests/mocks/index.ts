/**
 * Mocks barrel export
 */

// API Mocks
export {
  mockAllApis,
  mockAllApisForHappyPath,
  mockAllApisWithErrors,
  mockAllApisWithDelay,
  mockCreditApplicationApi,
  mockDictionariesApi,
  mockRegionsApi,
  mockCitiesApi,
  mockCarModelsApi,
  mockSubmitApplicationApi,
  type MockApiOptions,
} from './api.mocks';

// Credit Application Mock Data
export {
  MOCK_CREDIT_APPLICATION_1,
  MOCK_CREDIT_APPLICATION_2,
  MOCK_CAR_LOAN_APPLICATION,
  MOCK_EMPTY_APPLICATION,
  getMockApplicationById,
  type CreditApplicationMock,
  type PersonalData,
  type PassportData,
  type Address,
  type Property,
  type ExistingLoan,
  type CoBorrower,
} from './credit-application.mock';

// Dictionaries Mock Data
export {
  MOCK_DICTIONARIES,
  MOCK_BANKS,
  MOCK_PROPERTY_TYPES,
  MOCK_LOAN_TYPES,
  MOCK_EMPLOYMENT_STATUSES,
  MOCK_MARITAL_STATUSES,
  MOCK_EDUCATION_LEVELS,
  MOCK_REGIONS,
  MOCK_CITIES,
  MOCK_CAR_BRANDS,
  MOCK_CAR_MODELS,
  getCitiesByRegion,
  getCarModelsByBrand,
  getLabelByValue,
  type Option,
  type DictionariesResponse,
} from './dictionaries.mock';
