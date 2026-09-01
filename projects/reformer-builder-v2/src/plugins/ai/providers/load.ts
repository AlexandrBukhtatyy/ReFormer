/**
 * Ленивая активация канала.
 *
 * SDK и адаптеры провайдеров грузятся отдельным чанком: бандл билдера и так велик, а тот, кто
 * ассистентом не пользуется, не должен платить за него размером первого экрана.
 *
 * @module plugins/ai/providers/load
 */

import { loadProviderConfig, type ConfigStore, type ProviderConfig } from '../session/config';
import type { ProviderRegistry } from './registry';
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
export async function activateProvider(
  registry: ProviderRegistry,
  config: ProviderConfig
): Promise<AiProvider> {
  const { createByokProvider } = await byok();
  const provider = createByokProvider(config);
  registry.reset();
  registry.register(provider);
  return provider;
}

/**
 * Восстановить канал из сохранённых настроек при открытии панели.
 *
 * Молча ничего не делает, если настроек нет или модель не выбрана. Ключа при этом может не быть
 * вовсе — секрет по умолчанию живёт только сессию, — и это не повод не поднимать канал: у
 * локального сервера ключ не нужен, а у платного об отсутствии скажет `detect()`.
 */
export async function restoreProvider(
  registry: ProviderRegistry,
  store: ConfigStore
): Promise<AiProvider | null> {
  const config = await loadProviderConfig(store);
  if (!config?.model) return null;
  return activateProvider(registry, config);
}
