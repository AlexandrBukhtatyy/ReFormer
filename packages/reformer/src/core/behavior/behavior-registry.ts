/**
 * BehaviorRegistry - регистрация и управление behavior схемами
 *
 * Аналогично ValidationRegistry, но для реактивного поведения форм
 */

import type { GroupNode } from '../nodes/group-node';
import type { BehaviorHandlerFn, BehaviorOptions } from './types';
import { BehaviorContextImpl } from './behavior-context';
import { RegistryStack } from '../utils/registry-stack';
import { FormValue } from '../types';

/**
 * Зарегистрированный behavior с опциями
 */
interface RegisteredBehavior<T extends Record<string, FormValue>> {
  /** Handler функция behavior */
  handler: BehaviorHandlerFn<T>;
  /** Debounce в миллисекундах */
  debounce?: number;
}

/**
 * Реестр behaviors для формы
 *
 * Каждый экземпляр GroupNode создает собственный реестр (композиция).
 * Устраняет race conditions и изолирует формы друг от друга.
 *
 * Context stack используется для tracking текущего активного реестра:
 * - beginRegistration() помещает this в stack
 * - endRegistration() извлекает из stack
 * - getCurrent() возвращает текущий активный реестр
 *
 * @example
 * ```typescript
 * class GroupNode {
 *   private readonly behaviorRegistry = new BehaviorRegistry();
 *
 *   applyBehaviorSchema(schemaFn) {
 *     this.behaviorRegistry.beginRegistration(); // Pushes this to stack
 *     schemaFn(createBehaviorFieldPath(this));   // Uses getCurrent()
 *     return this.behaviorRegistry.endRegistration(this); // Pops from stack
 *   }
 * }
 * ```
 */
export class BehaviorRegistry {
  /**
   * Stack активных контекстов регистрации
   * Используется для изоляции форм друг от друга
   */
  private static contextStack = new RegistryStack<BehaviorRegistry>();

  private registrations: RegisteredBehavior<Record<string, FormValue>>[] = [];
  private isRegistering = false;

  /**
   * Получить текущий активный реестр из context stack
   *
   * @returns Текущий активный реестр или null
   *
   * @example
   * ```typescript
   * // В schema-behaviors.ts
   * export function copyFrom(...) {
   *   const registry = BehaviorRegistry.getCurrent();
   *   if (registry) {
   *     registry.register({ ... });
   *   }
   * }
   * ```
   */
  static getCurrent(): BehaviorRegistry | null {
    return BehaviorRegistry.contextStack.getCurrent();
  }

  /**
   * Начать регистрацию behaviors
   * Вызывается перед применением схемы
   *
   * Помещает this в context stack для изоляции форм
   */
  beginRegistration(): void {
    this.isRegistering = true;
    this.registrations = [];
    // Помещаем this в stack для tracking текущего активного реестра
    BehaviorRegistry.contextStack.push(this);
  }

  /**
   * Зарегистрировать behavior handler
   * Вызывается функциями из schema-behaviors.ts
   *
   * @param handler - BehaviorHandlerFn функция
   * @param options - Опции behavior (debounce)
   *
   * @example
   * ```typescript
   * const handler = createCopyBehavior(target, source, { when: ... });
   * registry.register(handler, { debounce: 300 });
   * ```
   */
  register(handler: BehaviorHandlerFn, options?: BehaviorOptions): void {
    if (!this.isRegistering) {
      if (import.meta.env.DEV) {
        throw new Error('BehaviorRegistry: call beginRegistration() before registering behaviors');
      }
      return;
    }

    this.registrations.push({
      handler,
      debounce: options?.debounce,
    });
  }

  /**
   * Завершить регистрацию и применить behaviors к форме
   * Создает effect подписки для всех зарегистрированных behaviors
   *
   * Извлекает this из context stack
   *
   * @param form - GroupNode формы
   * @returns Количество зарегистрированных behaviors и функция cleanup
   */
  endRegistration<T extends Record<string, FormValue>>(
    form: GroupNode<T>
  ): { count: number; cleanup: () => void } {
    this.isRegistering = false;

    // Извлекаем из stack с проверкой
    BehaviorRegistry.contextStack.verify(this, 'BehaviorRegistry');

    const context = new BehaviorContextImpl(form);
    const disposeCallbacks: Array<() => void> = [];

    // Создаем effect подписки для каждого behavior
    for (const registered of this.registrations) {
      const dispose = this.createEffect(registered, form, context);
      if (dispose) {
        disposeCallbacks.push(dispose);
      }
    }

    // Функция cleanup для отписки от всех effects
    const cleanup = () => {
      disposeCallbacks.forEach((dispose) => dispose());
    };

    return {
      count: this.registrations.length,
      cleanup,
    };
  }

  /**
   * Создать effect подписку для behavior
   * @private
   */
  private createEffect<T extends Record<string, FormValue>>(
    registered: RegisteredBehavior<T>,
    form: GroupNode<T>,
    context: BehaviorContextImpl<T>
  ): (() => void) | null {
    const { handler, debounce: debounceMs = 0 } = registered;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    // Обертка для debounce
    const withDebounce = (callback: () => void) => {
      if (debounceMs > 0) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(callback, debounceMs);
      } else {
        callback();
      }
    };

    // Cleanup функция для debounce таймера
    const cleanupDebounce = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    };

    // Вызываем handler напрямую
    const effectDispose = handler(form, context, withDebounce);

    if (!effectDispose) {
      return null;
    }

    // Возвращаем комбинированный cleanup
    // который очищает и effect, и debounce таймер
    return () => {
      cleanupDebounce();
      if (effectDispose) {
        effectDispose();
      }
    };
  }
}

// ============================================================================
// Глобальный экземпляр BehaviorRegistry УДАЛЕН
// ============================================================================
//
// Ранее здесь был глобальный Singleton экземпляр BehaviorRegistry,
// который создавал race conditions и нарушал изоляцию форм.
//
//  Теперь каждый GroupNode создает собственный экземпляр BehaviorRegistry:
//
// @example
// ```typescript
// class GroupNode {
//   private readonly behaviorRegistry = new BehaviorRegistry();
//
//   applyBehaviorSchema(schemaFn) {
//     this.behaviorRegistry.beginRegistration();
//     schemaFn(createBehaviorFieldPath(this));
//     return this.behaviorRegistry.endRegistration(this);
//   }
// }
// ```
//
// Это обеспечивает:
// - Полную изоляцию форм друг от друга
// - Отсутствие race conditions при параллельной регистрации
// - Возможность применять разные behavior схемы к разным формам одновременно
