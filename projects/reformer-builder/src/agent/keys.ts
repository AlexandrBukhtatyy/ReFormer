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
