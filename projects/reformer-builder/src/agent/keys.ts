/**
 * Настройки канала к модели, включая ключ API.
 *
 * Ключ хранится ЛОКАЛЬНО и в отдельном ключе хранилища — он не должен смешиваться ни с настройками
 * редактора, ни с черновиками, и никогда не попадает ни в контекст модели, ни в журнал вызовов.
 *
 * Про сам подход. Прямой вызов провайдера из браузера означает, что ключ доступен странице —
 * это осознанный компромисс ради работы без бэкенда, и он приемлем ровно для локального
 * инструмента с ключом самого пользователя. Anthropic описывает такой сценарий явно, поэтому
 * заголовок `anthropic-dangerous-direct-browser-access` и существует.
 *
 * @module reformer-builder/agent/keys
 */

/** Вид канала. */
export type ProviderKind = 'anthropic' | 'openai' | 'openai-compatible';

/** Настройки одного канала. */
export interface ProviderConfig {
  kind: ProviderKind;
  /** Ключ API. У локального сервера обычно не требуется. */
  apiKey?: string;
  /** Базовый URL — только для OpenAI-совместимого локального сервера. */
  baseUrl?: string;
  /** Выбранная модель. */
  model?: string;
  /**
   * Потолок вывода одного шага в токенах. По умолчанию не задан — предела нет.
   *
   * Настройка, а не константа: у think-моделей рассуждение съедает вывод целиком, и любое
   * зашитое число обрывало бы ответ на полуслове у одних и ничего не значило у других. Задавать
   * его стоит осознанно — например, чтобы зациклившаяся модель не писала ответ бесконечно.
   */
  maxOutputTokens?: number;
  /**
   * Предел шагов «модель → инструмент → модель» за ход. По умолчанию не задан — предела нет.
   *
   * Тоже настройка, а не константа: зашитое число обрывало работу на середине формы, потому что
   * цена задачи в шагах зависит от модели — одна собирает шесть полей одним вызовом, другая
   * шестью. Задают его как страховку от зацикливания, прежде всего на платных каналах.
   */
  maxSteps?: number;
  /**
   * Потолок входных токенов на один ход. По умолчанию не задан — предела нет.
   *
   * Мера стоимости честнее, чем число шагов: цена шага растёт вместе с диалогом, и двадцать шагов
   * в начале хода стоят кратно меньше двадцати в конце. На платном канале ограничивать стоит то,
   * за что выставляют счёт.
   */
  maxInputTokens?: number;
}

/** Поля пределов в форме настроек — как они введены, строками. */
export type LimitFields = Partial<Record<keyof ProviderLimits, string>>;

/** Необязательные пределы канала. */
export type ProviderLimits = Pick<
  ProviderConfig,
  'maxSteps' | 'maxOutputTokens' | 'maxInputTokens'
>;

/**
 * Необязательные пределы из полей ввода.
 *
 * Пустое поле, ноль и мусор означают одно и то же — «без предела», и ключ не должен появиться
 * вовсе: `maxSteps: 0` прочиталось бы как «ноль шагов» и остановило бы ход, не начав его, а
 * `maxOutputTokens: 0` оборвало бы ответ на первом же токене.
 *
 * @param fields - Значения полей как есть; отсутствующее поле равносильно пустому.
 */
export function limitsFrom(fields: LimitFields): ProviderLimits {
  const positive = (raw = ''): number | undefined => {
    const value = Number(raw.trim());
    return raw.trim() && Number.isFinite(value) && value > 0 ? value : undefined;
  };
  const out: ProviderLimits = {};
  for (const key of ['maxSteps', 'maxOutputTokens', 'maxInputTokens'] as const) {
    const value = positive(fields[key]);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

const STORAGE_KEY = 'rb.agent.provider';

/** Значения по умолчанию для локального OpenAI-совместимого сервера (Ollama). */
export const DEFAULT_LOCAL_BASE_URL = 'http://localhost:11434/v1';

/** Прочитать настройки канала. */
export function loadProviderConfig(): ProviderConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProviderConfig;
    return parsed.kind ? parsed : null;
  } catch {
    // Повреждённое хранилище не должно ронять загрузку редактора.
    return null;
  }
}

/** Сохранить настройки канала. */
export function saveProviderConfig(config: ProviderConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Приватный режим/переполненное хранилище: канал просто не переживёт перезагрузку.
  }
}

/** Забыть ключ и настройки. */
export function clearProviderConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // см. saveProviderConfig
  }
}

/** Человекочитаемое имя канала. */
export const PROVIDER_LABEL: Record<ProviderKind, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  'openai-compatible': 'Локальный (OpenAI-совместимый)',
};

/** Куда уходит запрос — показывается пользователю рядом с выбором канала. */
export const PROVIDER_ORIGIN: Record<ProviderKind, 'browser' | 'loopback'> = {
  anthropic: 'browser',
  openai: 'browser',
  'openai-compatible': 'loopback',
};
