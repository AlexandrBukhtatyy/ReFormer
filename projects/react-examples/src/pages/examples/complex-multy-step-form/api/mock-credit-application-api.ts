/**
 * Mock API для загрузки данных кредитной заявки
 *
 * Имитирует серверные запросы с задержкой 2 секунды
 */

// ============================================================================
// Типы для API
// ============================================================================

export interface DictionariesResponse {
  banks: Array<{ value: string; label: string }>;
  cities: Array<{ value: string; label: string }>;
  propertyTypes: Array<{ value: string; label: string }>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// Mock данные - справочники
// ============================================================================

const MOCK_DICTIONARIES: DictionariesResponse = {
  banks: [
    { value: 'sberbank', label: 'Сбербанк' },
    { value: 'vtb', label: 'ВТБ' },
    { value: 'alfabank', label: 'Альфа-Банк' },
    { value: 'tinkoff', label: 'Тинькофф' },
    { value: 'gazprombank', label: 'Газпромбанк' },
    { value: 'raiffeisen', label: 'Райффайзенбанк' },
    { value: 'rosbank', label: 'Росбанк' },
    { value: 'sovcombank', label: 'Совкомбанк' },
  ],
  cities: [
    { value: 'moscow', label: 'Москва' },
    { value: 'spb', label: 'Санкт-Петербург' },
    { value: 'novosibirsk', label: 'Новосибирск' },
    { value: 'ekaterinburg', label: 'Екатеринбург' },
    { value: 'kazan', label: 'Казань' },
    { value: 'nn', label: 'Нижний Новгород' },
    { value: 'chelyabinsk', label: 'Челябинск' },
    { value: 'samara', label: 'Самара' },
    { value: 'omsk', label: 'Омск' },
    { value: 'rostov', label: 'Ростов-на-Дону' },
  ],
  propertyTypes: [
    { value: 'apartment', label: 'Квартира' },
    { value: 'house', label: 'Дом' },
    { value: 'car', label: 'Автомобиль' },
    { value: 'land', label: 'Земельный участок' },
  ],
};

// ============================================================================
// Конфигурация имитации ошибок
// ============================================================================

let simulateError = false;

export const setSimulateError = (value: boolean) => {
  simulateError = value;
};

export const getSimulateError = () => simulateError;

// ============================================================================
// API функции
// ============================================================================

/**
 * Имитация задержки сети (2 секунды)
 */
const delay = (ms: number = 2000) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Загрузка справочников
 */
// TODO: Заменить контракт на AxiosResponse
export const fetchDictionaries = async (): Promise<ApiResponse<DictionariesResponse>> => {
  await delay(2000);

  if (simulateError) {
    return {
      success: false,
      error: 'Ошибка загрузки справочников. Попробуйте позже.',
    };
  }

  return {
    success: true,
    data: MOCK_DICTIONARIES,
  };
};
