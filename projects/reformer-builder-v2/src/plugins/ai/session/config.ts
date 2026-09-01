/**
 * Настройки канала к модели и ключ API.
 *
 * ## Что изменилось против v1
 *
 * В v1 весь объект настроек — ВМЕСТЕ С КЛЮЧОМ — лежал одной записью в `localStorage`. Здесь они
 * разведены, и разведены по времени жизни:
 *
 * - **настройки** (вид канала, базовый URL, модель, пределы) — обычные данные плагина
 *   (`PluginStorage`): им положено пережить перезагрузку страницы;
 * - **ключ** — секрет (`SecretStorage`), и по умолчанию он живёт только память сессии. Чтобы он
 *   пережил перезагрузку, надо сказать об этом ЯВНО ({@link SaveOptions.persistKey}) — цена ошибки
 *   несимметрична: забытый в памяти ключ стоит одного повторного ввода, забытый на диске живёт до
 *   тех пор, пока о нём не вспомнят.
 *
 * `localStorage` не используется вовсе: он синхронный, общий на весь источник и доступен любому
 * скрипту на странице без единого рубежа.
 *
 * ## Про сам подход BYOK
 *
 * Прямой вызов провайдера из браузера означает, что ключ доступен странице — это осознанный
 * компромисс ради работы без бэкенда, и он приемлем ровно для локального инструмента с ключом
 * самого пользователя. Anthropic описывает такой сценарий явно, поэтому заголовок
 * `anthropic-dangerous-direct-browser-access` и существует.
 *
 * Ключ никогда не попадает ни в контекст модели, ни в журнал вызовов, ни в ключ кэша провайдера.
 *
 * @module plugins/ai/session/config
 */

/** Вид канала. */
export type ProviderKind = 'anthropic' | 'openai' | 'openai-compatible';

/**
 * Настройки одного канала — БЕЗ ключа.
 *
 * Ключ здесь отсутствует не по забывчивости: тип описывает то, что кладётся в обычное хранилище,
 * и секрет в нём означал бы, что достаточно один раз забыть про разделение — и ключ уедет на диск
 * вместе с моделью и пределами. Полный набор для запроса собирает {@link ProviderConfig}.
 */
export interface ProviderSettings {
  kind: ProviderKind;
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

/** Настройки вместе с ключом — то, из чего собирается канал. */
export interface ProviderConfig extends ProviderSettings {
  /** Ключ API. У локального сервера обычно не требуется. */
  apiKey?: string;
}

/** Поля пределов в форме настроек — как они введены, строками. */
export type LimitFields = Partial<Record<keyof ProviderLimits, string>>;

/** Необязательные пределы канала. */
export type ProviderLimits = Pick<
  ProviderSettings,
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

/** Ключ записи настроек в хранилище плагина. */
export const SETTINGS_KEY = 'provider';

/** Ключ записи API-ключа в секретах плагина. */
export const API_KEY_SECRET = 'apiKey';

/** Значения по умолчанию для локального OpenAI-совместимого сервера (Ollama). */
export const DEFAULT_LOCAL_BASE_URL = 'http://localhost:11434/v1';

/** Чем настройки читаются и пишутся — ровно то, что даёт `PluginContext`. */
export interface ConfigStore {
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    set<T>(key: string, value: T): Promise<void>;
    delete(key: string): Promise<void>;
  };
  secrets: {
    get(key: string): Promise<string | undefined>;
    set(key: string, value: string, opts?: { persist?: boolean }): Promise<void>;
    delete(key: string): Promise<void>;
  };
}

/** Настройки ли это. Хранилище отдаёт то, что положила ПРЕЖНЯЯ версия плагина, — проверяет читающий. */
function isSettings(value: unknown): value is ProviderSettings {
  if (typeof value !== 'object' || value === null) return false;
  const kind = (value as { kind?: unknown }).kind;
  return kind === 'anthropic' || kind === 'openai' || kind === 'openai-compatible';
}

/**
 * Прочитать настройки канала вместе с ключом.
 *
 * `null` — канал не настроен. Настройки без ключа — законное состояние: у локального сервера ключ
 * не нужен вовсе, а у платного он мог остаться в сессии, которая уже кончилась. Решает это
 * `detect()` канала, а не чтение настроек.
 */
export async function loadProviderConfig(store: ConfigStore): Promise<ProviderConfig | null> {
  const stored = await store.storage.get<unknown>(SETTINGS_KEY);
  if (!isSettings(stored)) return null;
  const apiKey = await store.secrets.get(API_KEY_SECRET);
  return { ...stored, ...(apiKey ? { apiKey } : {}) };
}

/** Как сохранять. */
export interface SaveOptions {
  /**
   * Пережить ли ключу перезагрузку страницы. По умолчанию НЕТ — см. шапку модуля.
   *
   * Значение спрашивается у пользователя галочкой «запомнить ключ», а не выводится из чего-либо:
   * это его решение о его секрете.
   */
  persistKey?: boolean;
}

/**
 * Сохранить настройки канала.
 *
 * Ключ уходит в секреты, всё остальное — в обычное хранилище. Пустой ключ СТИРАЕТ секрет, а не
 * пишет пустую строку: иначе «я убрал ключ» и «ключ пустой» стали бы неразличимы.
 */
export async function saveProviderConfig(
  store: ConfigStore,
  config: ProviderConfig,
  opts: SaveOptions = {}
): Promise<void> {
  const { apiKey, ...settings } = config;
  await store.storage.set<ProviderSettings>(SETTINGS_KEY, settings);
  if (apiKey) {
    await store.secrets.set(API_KEY_SECRET, apiKey, { persist: opts.persistKey === true });
  } else {
    await store.secrets.delete(API_KEY_SECRET);
  }
}

/** Забыть ключ и настройки. */
export async function clearProviderConfig(store: ConfigStore): Promise<void> {
  await store.storage.delete(SETTINGS_KEY);
  await store.secrets.delete(API_KEY_SECRET);
}

/** Человекочитаемое имя канала — ключ словаря плагина, а не готовая строка. */
export const PROVIDER_LABEL_KEY: Record<ProviderKind, string> = {
  anthropic: 'provider.anthropic',
  openai: 'provider.openai',
  'openai-compatible': 'provider.local',
};

/** Куда уходит запрос — показывается пользователю рядом с выбором канала. */
export const PROVIDER_ORIGIN: Record<ProviderKind, 'browser' | 'loopback'> = {
  anthropic: 'browser',
  openai: 'browser',
  'openai-compatible': 'loopback',
};
