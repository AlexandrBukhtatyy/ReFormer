/**
 * Данные «сервера» кредитной заявки: справочники, регионы, города, модели авто, сохранённая
 * заявка, верный код из СМС. Только данные — модуль импортирует и e2e (ожидаемые значения).
 * Реализации берут их через `creditApi`, не отсюда.
 */
import { CREDIT_INITIAL_INPUT, type CreditInput, type Option } from '../domain/credit';

/** `GET /api/v1/regions`. */
export const REGIONS: readonly Option[] = [
  { value: 'moscow', label: 'Москва' },
  { value: 'spb', label: 'Санкт-Петербург' },
  { value: 'ekaterinburg', label: 'Екатеринбург' },
  { value: 'kazan', label: 'Казань' },
  { value: 'novosibirsk', label: 'Новосибирск' },
];

/** `GET /api/v1/cities?region=…`; неизвестный регион — пустой список. */
export const CITIES_BY_REGION: Readonly<Record<string, readonly Option[]>> = {
  moscow: [
    { value: 'moscow', label: 'Москва' },
    { value: 'zelenograd', label: 'Зеленоград' },
    { value: 'troitsk', label: 'Троицк' },
  ],
  spb: [
    { value: 'spb', label: 'Санкт-Петербург' },
    { value: 'kolpino', label: 'Колпино' },
    { value: 'pushkin', label: 'Пушкин' },
  ],
  ekaterinburg: [
    { value: 'ekaterinburg', label: 'Екатеринбург' },
    { value: 'berezovsky', label: 'Березовский' },
  ],
  kazan: [
    { value: 'kazan', label: 'Казань' },
    { value: 'zelenodolsk', label: 'Зеленодольск' },
  ],
  novosibirsk: [
    { value: 'novosibirsk', label: 'Новосибирск' },
    { value: 'berdsk', label: 'Бердск' },
  ],
};

/** `GET /api/v1/car-models?brand=…`: ключ — марка в нижнем регистре; неизвестная — пустой список. */
export const CAR_MODELS_BY_BRAND: Readonly<Record<string, readonly Option[]>> = {
  toyota: [
    { value: 'camry', label: 'Camry' },
    { value: 'corolla', label: 'Corolla' },
    { value: 'rav4', label: 'RAV4' },
    { value: 'land_cruiser', label: 'Land Cruiser' },
  ],
  bmw: [
    { value: '3_series', label: '3 Series' },
    { value: '5_series', label: '5 Series' },
    { value: 'x5', label: 'X5' },
  ],
  mercedes: [
    { value: 'c_class', label: 'C-Class' },
    { value: 'e_class', label: 'E-Class' },
    { value: 'glc', label: 'GLC' },
  ],
};

export interface CreditDictionaries {
  /** Банки — форма их не использует (банк кредита — текстовое поле по спеке), ответ как в спеке. */
  banks: Option[];
  /** Опции `properties[].type`. */
  propertyTypes: Option[];
}

/** `GET /api/v1/dictionaries`. */
export const DICTIONARIES: CreditDictionaries = {
  banks: [
    { value: 'sberbank', label: 'Сбербанк' },
    { value: 'vtb', label: 'ВТБ' },
    { value: 'alfabank', label: 'Альфа-Банк' },
    { value: 'tinkoff', label: 'Тинькофф' },
    { value: 'gazprombank', label: 'Газпромбанк' },
  ],
  propertyTypes: [
    { value: 'apartment', label: 'Квартира' },
    { value: 'house', label: 'Дом' },
    { value: 'car', label: 'Автомобиль' },
    { value: 'land', label: 'Земельный участок' },
  ],
};

/** Верный код подтверждения (BENCH-CONTRACT §8). */
export const SMS_VALID_CODE = '123456';

/**
 * `GET /api/v1/credit-applications/1` — заявка «1» эталонного демо (потребительский кредит),
 * регион и город приведены к значениям справочников. Все шаги 1–5 валидны, шаг 6 пуст.
 * Вложенные объекты, не заданные здесь, — общие с `CREDIT_INITIAL_INPUT`: `getApplication` отдаёт копию.
 */
export const CREDIT_APPLICATION_1: CreditInput = {
  ...CREDIT_INITIAL_INPUT,
  loanType: 'consumer',
  loanAmount: 500000,
  loanTerm: 24,
  loanPurpose: 'Ремонт квартиры',
  personalData: {
    lastName: 'Иванов',
    firstName: 'Иван',
    middleName: 'Иванович',
    birthDate: '1985-05-15',
    gender: 'male',
    birthPlace: 'г. Москва',
  },
  passportData: {
    series: '45 12',
    number: '123456',
    issueDate: '2005-05-20',
    issuedBy: 'Отделением УФМС России по г. Москве',
    departmentCode: '770-025',
  },
  inn: '771234567890',
  snils: '123-456-789 00',
  phoneMain: '+7 (999) 123-45-67',
  phoneAdditional: '+7 (495) 987-65-43',
  email: 'ivan.ivanov@example.com',
  emailAdditional: 'i.ivanov@work.com',
  registrationAddress: {
    region: 'moscow',
    city: 'moscow',
    street: 'ул. Ленина',
    house: '10',
    apartment: '25',
    postalCode: '123456',
  },
  sameAsRegistration: true,
  employmentStatus: 'employed',
  companyName: 'ООО "Ромашка"',
  companyInn: '7712345678',
  companyPhone: '+7 (495) 123-45-67',
  companyAddress: 'г. Москва, ул. Тверская, д. 1',
  position: 'Ведущий специалист',
  workExperienceTotal: 12,
  workExperienceCurrent: 6,
  monthlyIncome: 150000,
  additionalIncome: 0,
  maritalStatus: 'married',
  dependents: 2,
  education: 'higher',
};

export const CREDIT_APPLICATIONS: Readonly<Record<string, CreditInput>> = {
  '1': CREDIT_APPLICATION_1,
};
