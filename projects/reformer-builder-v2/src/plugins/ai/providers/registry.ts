/**
 * Реестр каналов к модели.
 *
 * Пуст, пока пользователь не настроил ключ: билдер обязан работать ровно так же, если канал не
 * выбран, — панель ассистента объясняет, чего не хватает, а не молча не отвечает.
 *
 * Провайдеры регистрируются динамическим импортом (`providers/load`): SDK и адаптеры не должны
 * попадать в первый чанк — за чат не платит тот, кто его не открывал.
 *
 * ## Почему это объект, а не модульные функции
 *
 * В v1 реестром была модульная `Map`. Плагину так нельзя по той же причине, по какой нельзя
 * модульный каталог: плагин выключают и включают снова, а модульное состояние переживает и то и
 * другое — второй экземпляр Host в том же процессе (так устроены тесты рантайма) получил бы чужие
 * каналы. Здесь владелец реестра — плагин, и снимается он вместе с ним.
 *
 * @module plugins/ai/providers/registry
 */

import type { AiProvider } from './types';

/** Реестр каналов. */
export interface ProviderRegistry {
  /** Зарегистрировать канал. Повторная регистрация того же id заменяет запись. */
  register(provider: AiProvider): void;
  /** Убрать канал (например, пользователь удалил ключ). */
  unregister(id: string): void;
  list(): AiProvider[];
  get(id: string): AiProvider | undefined;
  /**
   * Канал, пригодный для правок формы: без tool-calling агентский цикл невозможен, и предлагать
   * такой канал как редактирующий — значит обещать то, чего он не умеет.
   */
  firstEditing(): AiProvider | undefined;
  /** Забыть все каналы (смена настроек, деактивация плагина). */
  reset(): void;
}

/** Создать реестр каналов. */
export function createProviderRegistry(): ProviderRegistry {
  const providers = new Map<string, AiProvider>();

  return {
    register: (provider) => {
      providers.set(provider.id, provider);
    },
    unregister: (id) => {
      providers.delete(id);
    },
    list: () => [...providers.values()],
    get: (id) => providers.get(id),
    firstEditing: () => [...providers.values()].find((p) => p.capabilities().tools),
    reset: () => providers.clear(),
  };
}
