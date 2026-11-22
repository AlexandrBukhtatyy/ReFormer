/**
 * Вид на реестр служб в терминах возможностей — реализация того, что объявлено контрактом.
 *
 * Сами возможности (`Capability`, `defineCapability`, `meetsRequirement`, `CapabilityAccess`)
 * живут в пакете `@reformer/builder-plugin-api`. Решение «второго реестра нет, возможность —
 * это токен службы плюс версия» записано там же, рядом с объявлением.
 *
 * @module shell/platform/primitives/capability
 */

import {
  toDisposable,
  type Capability,
  type CapabilityAccess,
  type Disposable,
  type ServiceRegistry,
} from '@reformer/builder-plugin-api/internal';

export interface CapabilityAccessOptions {
  /**
   * Кто ОБЪЯВИЛ эту возможность — для сообщения об отказе `require`.
   *
   * Реестр служб такого вопроса не понимает: он знает занятые слоты, а не декларации. Поэтому
   * подсказку даёт тот, у кого декларации есть, — рантайм плагинов. Без неё отказ всё равно
   * внятен, просто короче: «никто не предоставил» вместо «объявляет плагин «kits», включите его».
   */
  readonly providers?: (capabilityId: string) => readonly string[];
}

/** Собирает вид на реестр. Хранилища у вида своего нет — всё читается из `services`. */
export function createCapabilityAccess(
  services: ServiceRegistry,
  options?: CapabilityAccessOptions
): CapabilityAccess {
  const hint = (cap: Capability<unknown>): string => {
    const providers = options?.providers?.(cap.id) ?? [];
    if (providers.length === 0) {
      return 'ни один плагин её не объявляет — возможно, нужный плагин не установлен';
    }
    return (
      `её объявляет ${providers.length === 1 ? 'плагин' : 'плагины'} ` +
      `${providers.map((id) => `«${id}»`).join(', ')} — проверьте, включён ли он и поднялся ли`
    );
  };

  return {
    get<T>(cap: Capability<T>): T | undefined {
      return services.get(cap);
    },

    require<T>(cap: Capability<T>): T {
      const impl = services.get(cap);
      if (impl === undefined) {
        throw new Error(
          `возможность «${cap.id}» версии ${cap.version} не предоставлена: ${hint(cap)}`
        );
      }
      return impl;
    },

    observe<T>(cap: Capability<T>, listener: (impl: T | undefined) => void): Disposable {
      const deliver = (): void => listener(services.get(cap));
      const subscription = services.onDidChange((event) => {
        if (event.id === cap.id) deliver();
      });
      deliver();
      // Собственный `Disposable`, а не подписка реестра: так вызывающий не может снять чужую,
      // а повторное освобождение остаётся безвредным (`toDisposable` одноразов).
      return toDisposable(() => subscription.dispose());
    },
  };
}
