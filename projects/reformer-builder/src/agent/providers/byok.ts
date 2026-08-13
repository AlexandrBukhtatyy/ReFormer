/**
 * Каналы на ключе пользователя (BYOK).
 *
 * Список моделей НЕ захардкожен: он запрашивается у провайдера. Модели меняются чаще, чем
 * выходят версии редактора, и вшитый список устаревает молча — пользователь видит выбор, которого
 * уже нет, и не видит того, что появилось.
 *
 * Модуль грузится динамически (`providers/load`), поэтому SDK не попадает в первый чанк.
 *
 * @module reformer-builder/agent/providers/byok
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import {
  DEFAULT_LOCAL_BASE_URL,
  PROVIDER_LABEL,
  PROVIDER_ORIGIN,
  type ProviderConfig,
  type ProviderKind,
} from '../keys';
import { streamViaAiSdk } from './ai-sdk';
import type { AiCapabilities, AiDetection, AiProvider } from './types';

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
    throw new Error(`${response.status} ${response.statusText || 'ошибка запроса моделей'}`);
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
  if (!modelId) throw new Error('Модель не выбрана.');

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
    displayName: `${PROVIDER_LABEL[config.kind]}${config.model ? ` · ${config.model}` : ''}`,
    origin: PROVIDER_ORIGIN[config.kind],

    async detect(): Promise<AiDetection> {
      if (config.kind !== 'openai-compatible' && !config.apiKey) {
        return { available: false, reason: 'Не задан ключ API.' };
      }
      try {
        await listModels(config);
        return { available: true };
      } catch (e) {
        return { available: false, reason: e instanceof Error ? e.message : String(e) };
      }
    },

    capabilities: () => capabilitiesOf(config.kind),

    stream: (req, signal) => streamViaAiSdk(modelOf(config), req, signal),
  };
}
