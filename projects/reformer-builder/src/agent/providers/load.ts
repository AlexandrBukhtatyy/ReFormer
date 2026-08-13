/**
 * Ленивая активация канала.
 *
 * SDK и адаптеры провайдеров грузятся отдельным чанком: `dist` билдера и так велик, а тот, кто
 * ассистентом не пользуется, не должен платить за него размером первого экрана.
 *
 * @module reformer-builder/agent/providers/load
 */

import { loadProviderConfig, type ProviderConfig } from '../keys';
import { registerProvider, resetProviders } from './registry';
import type { AiProvider } from './types';

/** Загрузить модуль каналов (общая точка динамического импорта). */
async function byok() {
  return import('./byok');
}

/** Список моделей канала. */
export async function fetchModels(config: ProviderConfig): Promise<string[]> {
  const { listModels } = await byok();
  return listModels(config);
}

/** Сделать канал активным. Прежние каналы снимаются: одновременно активен ровно один. */
export async function activateProvider(config: ProviderConfig): Promise<AiProvider> {
  const { createByokProvider } = await byok();
  const provider = createByokProvider(config);
  resetProviders();
  registerProvider(provider);
  return provider;
}

/**
 * Восстановить канал из сохранённых настроек при открытии панели.
 * Молча ничего не делает, если настроек нет или модель не выбрана.
 */
export async function restoreProvider(): Promise<void> {
  const config = loadProviderConfig();
  if (!config?.model) return;
  await activateProvider(config);
}
