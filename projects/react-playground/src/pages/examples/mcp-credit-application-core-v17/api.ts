// Mock API helpers for async-options + async-validators.
// Replaces real /api/v1/cities, /api/v1/car-models, /api/v1/check-email, etc.

export type Option = { value: string; label: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const CITIES_BY_REGION: Record<string, Option[]> = {
  Москва: [
    { value: 'moscow', label: 'Москва' },
    { value: 'zelenograd', label: 'Зеленоград' },
  ],
  'Санкт-Петербург': [
    { value: 'spb', label: 'Санкт-Петербург' },
    { value: 'pushkin', label: 'Пушкин' },
  ],
  Татарстан: [
    { value: 'kazan', label: 'Казань' },
    { value: 'naberezhnye-chelny', label: 'Набережные Челны' },
  ],
  Свердловская: [
    { value: 'ekb', label: 'Екатеринбург' },
    { value: 'nizhny-tagil', label: 'Нижний Тагил' },
  ],
};

const CAR_MODELS_BY_BRAND: Record<string, Option[]> = {
  Toyota: [
    { value: 'camry', label: 'Camry' },
    { value: 'corolla', label: 'Corolla' },
    { value: 'rav4', label: 'RAV4' },
  ],
  Lada: [
    { value: 'vesta', label: 'Vesta' },
    { value: 'granta', label: 'Granta' },
    { value: 'niva', label: 'Niva' },
  ],
  BMW: [
    { value: 'x3', label: 'X3' },
    { value: 'x5', label: 'X5' },
    { value: '5-series', label: '5 Series' },
  ],
  Kia: [
    { value: 'rio', label: 'Rio' },
    { value: 'k5', label: 'K5' },
    { value: 'sportage', label: 'Sportage' },
  ],
};

export async function fetchCitiesByRegion(region: string): Promise<Option[]> {
  await sleep(400);
  // Поиск по подстроке (регион пишется свободно)
  const key = Object.keys(CITIES_BY_REGION).find((k) =>
    region.toLowerCase().includes(k.toLowerCase())
  );
  return key ? CITIES_BY_REGION[key] : [];
}

export async function fetchCarModelsByBrand(brand: string): Promise<Option[]> {
  await sleep(400);
  const key = Object.keys(CAR_MODELS_BY_BRAND).find((k) =>
    brand.toLowerCase().includes(k.toLowerCase())
  );
  return key ? CAR_MODELS_BY_BRAND[key] : [];
}

const TAKEN_EMAILS = new Set(['admin@bank.ru', 'test@test.com', 'taken@example.com']);

export async function checkEmailAvailable(email: string): Promise<boolean> {
  await sleep(500);
  return !TAKEN_EMAILS.has(email.toLowerCase().trim());
}

// Валидация ИНН по контрольным цифрам — 12 знаков (физлицо).
function innChecksum12(inn: string): boolean {
  if (!/^\d{12}$/.test(inn)) return false;
  const c1coef = [7, 2, 4, 10, 3, 5, 9, 4, 1, 6, 8];
  const c2coef = [3, 7, 2, 4, 10, 3, 5, 9, 4, 1, 6, 8];
  const sum1 = c1coef.reduce((s, c, i) => s + c * Number(inn[i]), 0);
  const c11 = (sum1 % 11) % 10;
  const sum2 = c2coef.reduce((s, c, i) => s + c * Number(inn[i]), 0);
  const c12 = (sum2 % 11) % 10;
  return Number(inn[10]) === c11 && Number(inn[11]) === c12;
}

export async function checkInnValid(inn: string): Promise<boolean> {
  await sleep(400);
  return innChecksum12(inn);
}

// Submit-mock — POST /api/v1/credit-applications.
export async function submitApplication<T>(
  payload: T
): Promise<{ id: string; success: boolean }> {
  await sleep(800);
  // eslint-disable-next-line no-console
  console.log('[mcp-credit-core-v17] submit payload:', payload);
  return { id: `app-${Date.now()}`, success: true };
}
