/**
 * Реестр каналов к модели.
 *
 * Пуст, пока пользователь не настроил ключ: билдер обязан работать ровно как раньше, если провайдер
 * не выбран, — панель ассистента объясняет, чего не хватает, а не молча не отвечает.
 *
 * Провайдеры регистрируются динамическим импортом (этап 4): SDK и адаптеры не должны попадать в
 * первый чанк — за чат не платит тот, кто его не открывал.
 *
 * @module reformer-builder/agent/providers/registry
 */

import type { AiProvider } from './types';

const providers = new Map<string, AiProvider>();

/** Зарегистрировать канал. Повторная регистрация того же id заменяет запись. */
export function registerProvider(provider: AiProvider): void {
  providers.set(provider.id, provider);
}

/** Убрать канал (например, пользователь удалил ключ). */
export function unregisterProvider(id: string): void {
  providers.delete(id);
}

/** Все зарегистрированные каналы. */
export function listProviders(): AiProvider[] {
  return [...providers.values()];
}

/** Канал по идентификатору. */
export function getProvider(id: string): AiProvider | undefined {
  return providers.get(id);
}

/**
 * Канал, пригодный для правок формы: без tool-calling агентский цикл невозможен, и предлагать
 * такой канал как редактирующий — значит обещать то, чего он не умеет.
 */
export function firstEditingProvider(): AiProvider | undefined {
  return listProviders().find((p) => p.capabilities().tools);
}

/** Сбросить реестр (тесты, смена настроек). */
export function resetProviders(): void {
  providers.clear();
}
