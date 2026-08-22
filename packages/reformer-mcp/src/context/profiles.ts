/**
 * Профили выдачи: сколько контекста нужно для СЛЕДУЮЩЕГО шага, а не «сколько есть».
 *
 * Три режима отвечают на три разных вопроса и потому включают разные части:
 *
 *   minimal        — «каким API это делается». Решение, сигнатура, один пример. Хватает,
 *                    когда агент уже понимает задачу и ему нужно имя и форма вызова.
 *   implementation — «как это написать». Плюс правила, анти-паттерны и ссылки на секции.
 *                    Режим по умолчанию.
 *   debug          — «почему моё не работает». Анти-паттерны и troubleshooting выходят
 *                    вперёд примера: сломанный код у агента уже есть, ему нужен диагноз.
 *
 * Числа — не догма, а потолок по умолчанию: вызывающий может задать `maxTokens` сам.
 * Ориентир взят из замеров: медиана задачи на корпусе eval — около 300 токенов, p95 — 1 437,
 * поэтому 1 000 покрывает типичную задачу целиком, а 1 800 — тяжёлую.
 */

export type ContextProfile = 'minimal' | 'implementation' | 'debug' | 'full';

/** Что включает профиль и в каком порядке важности. */
export interface ProfileSpec {
  /** Потолок по умолчанию; `null` — без ограничения. */
  maxTokens: number | null;
  /**
   * Приоритеты частей. Меньше — важнее; отсутствие ключа означает «часть не включается».
   * Именно порядком, а не булевыми флагами: при нехватке бюджета выпадает наименее важное.
   */
  priority: Partial<Record<ContextPart, number>>;
}

/** Части собираемого контекста. */
export type ContextPart =
  | 'decision' // какой оператор выбрать и почему
  | 'signature' // сигнатуры рекомендованных символов
  | 'example' // канонический пример
  | 'purpose' // назначение темы одной фразой
  | 'rules' // ключевые правила темы (Key Concepts)
  | 'antiPatterns' // как НЕ надо, с объяснением
  | 'troubleshooting' // частые поломки и их причины
  | 'related' // соседние символы
  | 'sources'; // URI секций для чтения целиком

export const PROFILES: Record<ContextProfile, ProfileSpec> = {
  minimal: {
    maxTokens: 400,
    priority: { decision: 0, signature: 1, example: 2 },
  },
  implementation: {
    maxTokens: 1000,
    priority: {
      decision: 0,
      signature: 1,
      example: 2,
      purpose: 3,
      antiPatterns: 4,
      rules: 5,
      related: 6,
      sources: 7,
    },
  },
  debug: {
    maxTokens: 1800,
    priority: {
      decision: 0,
      // Сломанный код у агента уже есть — сначала диагноз, потом эталон.
      antiPatterns: 1,
      troubleshooting: 2,
      signature: 3,
      example: 4,
      purpose: 5,
      sources: 6,
    },
  },
  full: {
    maxTokens: null,
    priority: {
      decision: 0,
      purpose: 1,
      signature: 2,
      example: 3,
      rules: 4,
      antiPatterns: 5,
      troubleshooting: 6,
      related: 7,
      sources: 8,
    },
  },
};

export function resolveProfile(name: string | undefined): ContextProfile {
  return name === 'minimal' || name === 'debug' || name === 'full' ? name : 'implementation';
}
