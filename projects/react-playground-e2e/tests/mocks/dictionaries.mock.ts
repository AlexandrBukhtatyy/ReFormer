/**
 * Mock data for Dictionaries API responses
 * Includes banks, cities, regions, property types, car models, etc.
 */

// ============================================================================
// Types
// ============================================================================

export interface Option {
  value: string;
  label: string;
}

export interface DictionariesResponse {
  banks: Option[];
  cities: Option[];
  propertyTypes: Option[];
}

// ============================================================================
// Banks Dictionary
// ============================================================================

export const MOCK_BANKS: Option[] = [
  { value: 'sberbank', label: 'Сбербанк' },
  { value: 'vtb', label: 'ВТБ' },
  { value: 'alfabank', label: 'Альфа-Банк' },
  { value: 'tinkoff', label: 'Тинькофф' },
  { value: 'gazprombank', label: 'Газпромбанк' },
  { value: 'raiffeisen', label: 'Райффайзенбанк' },
  { value: 'rosbank', label: 'Росбанк' },
  { value: 'sovcombank', label: 'Совкомбанк' },
  { value: 'otkritie', label: 'Открытие' },
  { value: 'unicredit', label: 'ЮниКредит Банк' },
];

// ============================================================================
// Property Types Dictionary
// ============================================================================

export const MOCK_PROPERTY_TYPES: Option[] = [
  { value: 'apartment', label: 'Квартира' },
  { value: 'house', label: 'Дом' },
  { value: 'townhouse', label: 'Таунхаус' },
  { value: 'car', label: 'Автомобиль' },
  { value: 'land', label: 'Земельный участок' },
  { value: 'garage', label: 'Гараж' },
  { value: 'commercial', label: 'Коммерческая недвижимость' },
  { value: 'other', label: 'Другое' },
];

// ============================================================================
// Loan Types Dictionary
// ============================================================================

export const MOCK_LOAN_TYPES: Option[] = [
  { value: 'consumer', label: 'Потребительский кредит' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'car', label: 'Автокредит' },
  { value: 'business', label: 'Кредит для бизнеса' },
  { value: 'refinancing', label: 'Рефинансирование' },
];

// ============================================================================
// Employment Status Dictionary
// ============================================================================

export const MOCK_EMPLOYMENT_STATUSES: Option[] = [
  { value: 'employed', label: 'Работаю по найму' },
  { value: 'selfEmployed', label: 'Самозанятый/ИП' },
  { value: 'unemployed', label: 'Не работаю' },
  { value: 'retired', label: 'Пенсионер' },
  { value: 'student', label: 'Студент' },
];

// ============================================================================
// Marital Status Dictionary
// ============================================================================

export const MOCK_MARITAL_STATUSES: Option[] = [
  { value: 'single', label: 'Холост/Не замужем' },
  { value: 'married', label: 'Женат/Замужем' },
  { value: 'divorced', label: 'В разводе' },
  { value: 'widowed', label: 'Вдовец/Вдова' },
];

// ============================================================================
// Education Level Dictionary
// ============================================================================

export const MOCK_EDUCATION_LEVELS: Option[] = [
  { value: 'secondary', label: 'Среднее' },
  { value: 'specialized', label: 'Среднее специальное' },
  { value: 'higher', label: 'Высшее' },
  { value: 'postgraduate', label: 'Послевузовское' },
];

// ============================================================================
// Regions Dictionary
// ============================================================================

export const MOCK_REGIONS: Option[] = [
  { value: 'moscow_region', label: 'Московская область' },
  { value: 'leningrad_region', label: 'Ленинградская область' },
  { value: 'sverdlovsk_region', label: 'Свердловская область' },
  { value: 'novosibirsk_region', label: 'Новосибирская область' },
  { value: 'tatarstan', label: 'Республика Татарстан' },
  { value: 'krasnodar_region', label: 'Краснодарский край' },
  { value: 'chelyabinsk_region', label: 'Челябинская область' },
  { value: 'samara_region', label: 'Самарская область' },
  { value: 'nizhny_novgorod_region', label: 'Нижегородская область' },
  { value: 'rostov_region', label: 'Ростовская область' },
];

// ============================================================================
// Cities by Region Dictionary
// ============================================================================

export const MOCK_CITIES: Record<string, Option[]> = {
  moscow_region: [
    { value: 'moscow', label: 'Москва' },
    { value: 'podolsk', label: 'Подольск' },
    { value: 'balashikha', label: 'Балашиха' },
    { value: 'khimki', label: 'Химки' },
    { value: 'mytishchi', label: 'Мытищи' },
    { value: 'korolev', label: 'Королёв' },
    { value: 'lyubertsy', label: 'Люберцы' },
    { value: 'odintsovo', label: 'Одинцово' },
  ],
  leningrad_region: [
    { value: 'spb', label: 'Санкт-Петербург' },
    { value: 'gatchina', label: 'Гатчина' },
    { value: 'vyborg', label: 'Выборг' },
    { value: 'vsevolozhsk', label: 'Всеволожск' },
    { value: 'kolpino', label: 'Колпино' },
    { value: 'pushkin', label: 'Пушкин' },
  ],
  sverdlovsk_region: [
    { value: 'ekaterinburg', label: 'Екатеринбург' },
    { value: 'nizhny_tagil', label: 'Нижний Тагил' },
    { value: 'kamensk_uralsky', label: 'Каменск-Уральский' },
    { value: 'pervouralsk', label: 'Первоуральск' },
  ],
  novosibirsk_region: [
    { value: 'novosibirsk', label: 'Новосибирск' },
    { value: 'berdsk', label: 'Бердск' },
    { value: 'iskitim', label: 'Искитим' },
  ],
  tatarstan: [
    { value: 'kazan', label: 'Казань' },
    { value: 'naberezhnye_chelny', label: 'Набережные Челны' },
    { value: 'nizhnekamsk', label: 'Нижнекамск' },
    { value: 'almetyevsk', label: 'Альметьевск' },
  ],
  krasnodar_region: [
    { value: 'krasnodar', label: 'Краснодар' },
    { value: 'sochi', label: 'Сочи' },
    { value: 'novorossiysk', label: 'Новороссийск' },
    { value: 'anapa', label: 'Анапа' },
  ],
  chelyabinsk_region: [
    { value: 'chelyabinsk', label: 'Челябинск' },
    { value: 'magnitogorsk', label: 'Магнитогорск' },
    { value: 'zlatoust', label: 'Златоуст' },
  ],
  samara_region: [
    { value: 'samara', label: 'Самара' },
    { value: 'tolyatti', label: 'Тольятти' },
    { value: 'syzran', label: 'Сызрань' },
  ],
  nizhny_novgorod_region: [
    { value: 'nizhny_novgorod', label: 'Нижний Новгород' },
    { value: 'dzerzhinsk', label: 'Дзержинск' },
    { value: 'arzamas', label: 'Арзамас' },
  ],
  rostov_region: [
    { value: 'rostov', label: 'Ростов-на-Дону' },
    { value: 'taganrog', label: 'Таганрог' },
    { value: 'shakhty', label: 'Шахты' },
    { value: 'volgodonsk', label: 'Волгодонск' },
  ],
};

// ============================================================================
// Car Brands Dictionary
// ============================================================================

export const MOCK_CAR_BRANDS: Option[] = [
  { value: 'toyota', label: 'Toyota' },
  { value: 'bmw', label: 'BMW' },
  { value: 'mercedes', label: 'Mercedes-Benz' },
  { value: 'audi', label: 'Audi' },
  { value: 'volkswagen', label: 'Volkswagen' },
  { value: 'hyundai', label: 'Hyundai' },
  { value: 'kia', label: 'Kia' },
  { value: 'skoda', label: 'Skoda' },
  { value: 'lada', label: 'LADA' },
  { value: 'mazda', label: 'Mazda' },
  { value: 'nissan', label: 'Nissan' },
  { value: 'ford', label: 'Ford' },
];

// ============================================================================
// Car Models by Brand Dictionary
// ============================================================================

export const MOCK_CAR_MODELS: Record<string, Option[]> = {
  toyota: [
    { value: 'camry', label: 'Camry' },
    { value: 'corolla', label: 'Corolla' },
    { value: 'rav4', label: 'RAV4' },
    { value: 'land_cruiser', label: 'Land Cruiser' },
    { value: 'highlander', label: 'Highlander' },
    { value: 'prius', label: 'Prius' },
  ],
  bmw: [
    { value: '3_series', label: '3 Series' },
    { value: '5_series', label: '5 Series' },
    { value: '7_series', label: '7 Series' },
    { value: 'x3', label: 'X3' },
    { value: 'x5', label: 'X5' },
    { value: 'x7', label: 'X7' },
  ],
  mercedes: [
    { value: 'c_class', label: 'C-Class' },
    { value: 'e_class', label: 'E-Class' },
    { value: 's_class', label: 'S-Class' },
    { value: 'gle', label: 'GLE' },
    { value: 'gls', label: 'GLS' },
    { value: 'glc', label: 'GLC' },
  ],
  audi: [
    { value: 'a3', label: 'A3' },
    { value: 'a4', label: 'A4' },
    { value: 'a6', label: 'A6' },
    { value: 'a8', label: 'A8' },
    { value: 'q3', label: 'Q3' },
    { value: 'q5', label: 'Q5' },
    { value: 'q7', label: 'Q7' },
  ],
  volkswagen: [
    { value: 'polo', label: 'Polo' },
    { value: 'golf', label: 'Golf' },
    { value: 'passat', label: 'Passat' },
    { value: 'tiguan', label: 'Tiguan' },
    { value: 'touareg', label: 'Touareg' },
  ],
  hyundai: [
    { value: 'solaris', label: 'Solaris' },
    { value: 'creta', label: 'Creta' },
    { value: 'tucson', label: 'Tucson' },
    { value: 'santa_fe', label: 'Santa Fe' },
    { value: 'elantra', label: 'Elantra' },
  ],
  kia: [
    { value: 'rio', label: 'Rio' },
    { value: 'ceed', label: "Ceed" },
    { value: 'sportage', label: 'Sportage' },
    { value: 'sorento', label: 'Sorento' },
    { value: 'optima', label: 'Optima' },
  ],
  skoda: [
    { value: 'rapid', label: 'Rapid' },
    { value: 'octavia', label: 'Octavia' },
    { value: 'superb', label: 'Superb' },
    { value: 'kodiaq', label: 'Kodiaq' },
    { value: 'karoq', label: 'Karoq' },
  ],
  lada: [
    { value: 'vesta', label: 'Vesta' },
    { value: 'granta', label: 'Granta' },
    { value: 'niva', label: 'Niva' },
    { value: 'largus', label: 'Largus' },
    { value: 'xray', label: 'XRAY' },
  ],
  mazda: [
    { value: 'mazda3', label: 'Mazda3' },
    { value: 'mazda6', label: 'Mazda6' },
    { value: 'cx5', label: 'CX-5' },
    { value: 'cx9', label: 'CX-9' },
  ],
  nissan: [
    { value: 'qashqai', label: 'Qashqai' },
    { value: 'x_trail', label: 'X-Trail' },
    { value: 'murano', label: 'Murano' },
    { value: 'pathfinder', label: 'Pathfinder' },
  ],
  ford: [
    { value: 'focus', label: 'Focus' },
    { value: 'mondeo', label: 'Mondeo' },
    { value: 'kuga', label: 'Kuga' },
    { value: 'explorer', label: 'Explorer' },
  ],
};

// ============================================================================
// Combined Dictionaries Response
// ============================================================================

export const MOCK_DICTIONARIES: DictionariesResponse = {
  banks: MOCK_BANKS,
  cities: MOCK_CITIES['moscow_region'], // Default cities for Moscow region
  propertyTypes: MOCK_PROPERTY_TYPES,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get cities for a specific region
 */
export function getCitiesByRegion(region: string): Option[] {
  return MOCK_CITIES[region] ?? MOCK_CITIES['moscow_region'];
}

/**
 * Get car models for a specific brand
 */
export function getCarModelsByBrand(brand: string): Option[] {
  return MOCK_CAR_MODELS[brand.toLowerCase()] ?? [];
}

/**
 * Get label by value from options array
 */
export function getLabelByValue(options: Option[], value: string): string | undefined {
  return options.find((opt) => opt.value === value)?.label;
}
