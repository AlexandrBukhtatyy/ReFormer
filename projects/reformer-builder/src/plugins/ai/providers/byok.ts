/**
 * Каналы на ключе пользователя (BYOK).
 *
 * Список моделей НЕ захардкожен: он запрашивается у провайдера. Модели меняются чаще, чем
 * выходят версии редактора, и вшитый список устаревает молча — пользователь видит выбор, которого
 * уже нет, и не видит того, что появилось.
 *
 * Модуль грузится динамически (`providers/load`), поэтому SDK не попадает в первый чанк.
 *
 * @module plugins/ai/providers/byok
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import {
  DEFAULT_LOCAL_BASE_URL,
  PROVIDER_ORIGIN,
  type ProviderConfig,
  type ProviderKind,
} from '../session/config';
import { streamViaAiSdk, type AiSdkTuning } from './ai-sdk';
import type { AiCapabilities, AiDetection, AiProvider } from './types';

/**
 * Причина недоступности канала — ключ словаря плагина, а не готовая фраза.
 *
 * `AiDetection.reason` показывается пользователю, а остальные его значения приходят от сервера
 * (`401 Unauthorized`) и переводу не подлежат вовсе. Единственная НАША причина названа ключом,
 * чтобы панель могла её перевести и отличить от серверного текста.
 */
const NO_API_KEY = 'provider.noApiKey';

/** Версия Anthropic API, требуемая заголовком. */
const ANTHROPIC_VERSION = '2023-06-01';

/**
 * Заголовок, которым Anthropic разрешает прямой вызов из браузера. Без него запрос не проходит
 * preflight; наличие — осознанное признание того, что ключ доступен странице.
 */
const ANTHROPIC_BROWSER_HEADERS = {
  'anthropic-version': ANTHROPIC_VERSION,
  'anthropic-dangerous-direct-browser-access': 'true',
};

/** Базовый URL канала. */
function baseUrlOf(config: ProviderConfig): string {
  if (config.kind === 'anthropic') return 'https://api.anthropic.com/v1';
  if (config.kind === 'openai') return 'https://api.openai.com/v1';
  return (config.baseUrl || DEFAULT_LOCAL_BASE_URL).replace(/\/+$/, '');
}

/** Заголовки авторизации канала. */
function headersOf(config: ProviderConfig): Record<string, string> {
  if (config.kind === 'anthropic') {
    return { 'x-api-key': config.apiKey ?? '', ...ANTHROPIC_BROWSER_HEADERS };
  }
  return config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {};
}

/**
 * Список моделей канала. У всех трёх видов эндпоинт `/models`, но форма ответа различается
 * мелочами, поэтому разбор терпимый: берём то, что похоже на идентификаторы.
 */
export async function listModels(config: ProviderConfig): Promise<string[]> {
  const response = await fetch(`${baseUrlOf(config)}/models`, { headers: headersOf(config) });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText || 'model list request failed'}`);
  }
  const payload = (await response.json()) as { data?: Array<{ id?: string }> };
  return (payload.data ?? [])
    .map((m) => m.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .sort();
}

/** Модель SDK для канала. */
function modelOf(config: ProviderConfig): LanguageModel {
  const modelId = config.model;
  if (!modelId) throw new Error('provider.noModel');

  switch (config.kind) {
    case 'anthropic':
      return createAnthropic({
        apiKey: config.apiKey ?? '',
        headers: ANTHROPIC_BROWSER_HEADERS,
      })(modelId);
    case 'openai':
      return createOpenAI({ apiKey: config.apiKey ?? '' })(modelId);
    case 'openai-compatible':
      return createOpenAICompatible({
        name: 'local',
        baseURL: baseUrlOf(config),
        ...(config.apiKey ? { apiKey: config.apiKey } : {}),
      })(modelId);
  }
}

/**
 * Чем удешевлять запросы на этом канале.
 *
 * Ход агента — это десятки запросов с одинаковым началом: системный промпт и определения
 * инструментов, около трёх тысяч токенов, пересылаются заново каждый раз. Каждый канал экономит их
 * по-своему, поэтому единого способа тут нет:
 *
 *  - Anthropic кэширует явно, по пометке на префиксе;
 *  - OpenAI кэширует сам, но лучше попадает, если запросы одного разговора помечены общим ключом;
 *  - локальный сервер не тарифицирует ничего и переиспользует префикс сам, зато упирается в
 *    физическое окно модели — ему нужна прополка контекста и короткий предел повторов: если
 *    `localhost` не ответил, ждать его дважды с нарастающей паузой значит подарить шагу шесть
 *    секунд без единого шанса на успех.
 *
 * Ключ кэша OpenAI — случайный идентификатор сессии редактора. В нём не должно быть ни ключа API,
 * ни чего-либо из формы: он уходит на сервер как есть.
 */
export function tuningOf(config: ProviderConfig): AiSdkTuning {
  // Потолок вывода задаёт пользователь; по умолчанию его нет — см. ProviderConfig.maxOutputTokens.
  const limit = config.maxOutputTokens ? { maxOutputTokens: config.maxOutputTokens } : {};
  switch (config.kind) {
    case 'anthropic':
      return { cacheBreakpoints: true, pruneContext: false, maxRetries: 2, ...limit };
    case 'openai':
      return {
        cacheBreakpoints: false,
        promptCacheKey: sessionCacheKey(),
        pruneContext: false,
        maxRetries: 2,
        ...limit,
      };
    case 'openai-compatible':
      // Единственный канал, где полоть выгодно: кэша префикса нет, зато контекст упирается в
      // физическое окно модели, и рассуждение с прошлых шагов съедает больше половины запроса.
      return { cacheBreakpoints: false, pruneContext: true, maxRetries: 1, ...limit };
  }
}

/** Идентификатор сессии редактора: один на всё время работы вкладки. */
let cacheKey: string | null = null;

function sessionCacheKey(): string {
  return (cacheKey ??= `rb-${Math.random().toString(36).slice(2, 12)}`);
}

/** Возможности канала. Локальные модели tool-calling умеют не всегда — предупреждаем честно. */
function capabilitiesOf(kind: ProviderKind): AiCapabilities {
  return {
    streaming: true,
    tools: true,
    images: kind !== 'openai-compatible',
    languages: ['ru', 'en'],
  };
}

/** Создать канал по настройкам пользователя. */
export function createByokProvider(config: ProviderConfig): AiProvider {
  return {
    id: config.kind,
    // Идентификатор канала и модель, без перевода: имя вида («Локальный (OpenAI-совместимый)»)
    // показывает панель — она владеет словарём, а канал словаря не знает. Ключ перевода лежит
    // рядом с настройками: `PROVIDER_LABEL_KEY`.
    displayName: `${config.kind}${config.model ? ` · ${config.model}` : ''}`,
    origin: PROVIDER_ORIGIN[config.kind],

    async detect(): Promise<AiDetection> {
      if (config.kind !== 'openai-compatible' && !config.apiKey) {
        return { available: false, reason: NO_API_KEY };
      }
      try {
        await listModels(config);
        return { available: true };
      } catch (e) {
        return { available: false, reason: e instanceof Error ? e.message : String(e) };
      }
    },

    capabilities: () => capabilitiesOf(config.kind),

    stream: (req, signal) => streamViaAiSdk(modelOf(config), req, signal, tuningOf(config)),
  };
}
