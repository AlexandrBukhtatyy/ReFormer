/**
 * Вспомогательные функции для работы с реестрами
 *
 * Централизует логику получения текущего активного реестра валидации/поведения
 * из context stack, избегая дублирования кода в schema-validators.ts,
 * array-validators.ts и schema-behaviors.ts
 */

import { ValidationRegistry } from '../validation/validation-registry';
import { BehaviorRegistry } from '../behavior/behavior-registry';

/**
 * Получить текущий активный ValidationRegistry из context stack
 *
 * Используется внутри validation schema функций (validate, validateAsync, required и т.д.)
 * для регистрации валидаторов в активном контексте GroupNode
 *
 * @returns Текущий ValidationRegistry или заглушка в production
 * @throws Error если нет активного контекста (только в DEV режиме)
 *
 * @internal
 *
 * @example
 * ```typescript
 * function required(fieldPath, options) {
 *   const registry = getCurrentValidationRegistry();
 *   registry.registerSync(path, validator, options);
 * }
 * ```
 */
export function getCurrentValidationRegistry(): ValidationRegistry {
  const registry = ValidationRegistry.getCurrent();

  if (!registry) {
    if (import.meta.env.DEV) {
      throw new Error(
        'No active ValidationRegistry context. Make sure to call applyValidationSchema() within a GroupNode context.'
      );
    }

    // В production возвращаем заглушку чтобы не ломать приложение
    return {
      registerSync: () => {},
      registerAsync: () => {},
      registerTree: () => {},
      enterCondition: () => {},
      exitCondition: () => {},
      registerArrayItemValidation: () => {},
    } as unknown as ValidationRegistry;
  }

  return registry;
}

/**
 * Получить текущий активный BehaviorRegistry из context stack
 *
 * Используется внутри behavior schema функций (copyFrom, enableWhen, computeFrom и т.д.)
 * для регистрации поведений в активном контексте GroupNode
 *
 * @returns Текущий BehaviorRegistry или заглушка в production
 * @throws Error если нет активного контекста (только в DEV режиме)
 *
 * @internal
 *
 * @example
 * ```typescript
 * function copyFrom(target, source, options) {
 *   const registry = getCurrentBehaviorRegistry();
 *   const handler = createCopyBehavior(target, source, options);
 *   registry.register(handler, { debounce: options?.debounce });
 * }
 * ```
 */
export function getCurrentBehaviorRegistry(): BehaviorRegistry {
  const registry = BehaviorRegistry.getCurrent();

  if (!registry) {
    if (import.meta.env.DEV) {
      throw new Error(
        'No active BehaviorRegistry context. Make sure to call applyBehaviorSchema() within a GroupNode context.'
      );
    }

    // В production возвращаем заглушку чтобы не ломать приложение
    return {
      register: () => {},
    } as unknown as BehaviorRegistry;
  }

  return registry;
}
