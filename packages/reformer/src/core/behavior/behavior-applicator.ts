/**
 * Применение behavior схемы к форме
 *
 * Извлечено из GroupNode для соблюдения SRP (Single Responsibility Principle).
 * Управляет процессом регистрации и применения behaviors.
 *
 * @template T Тип формы
 *
 * @example
 * ```typescript
 * class GroupNode {
 *   private readonly behaviorApplicator = new BehaviorApplicator(this);
 *
 *   applyBehaviorSchema(schemaFn: BehaviorSchemaFn<T>): () => void {
 *     return this.behaviorApplicator.apply(schemaFn);
 *   }
 * }
 * ```
 */

import type { GroupNode } from '../nodes/group-node';
import type { BehaviorSchemaFn } from './types';
import { BehaviorRegistry } from './behavior-registry';
import { createFieldPath as createBehaviorFieldPath } from './create-field-path';
import { FormErrorHandler, ErrorStrategy } from '../utils/error-handler';

/**
 * Класс для применения behavior схемы к форме
 *
 * Выполняет:
 * 1. Начало регистрации behaviors (beginRegistration)
 * 2. Выполнение схемы (регистрация behaviors)
 * 3. Завершение регистрации (endRegistration) - применение behaviors
 * 4. Возврат функции cleanup для отписки
 *
 * @template T Тип формы (объект)
 */
export class BehaviorApplicator<T> {
  private readonly form: GroupNode<T>;
  private readonly behaviorRegistry: BehaviorRegistry;

  constructor(form: GroupNode<T>, behaviorRegistry: BehaviorRegistry) {
    this.form = form;
    this.behaviorRegistry = behaviorRegistry;
  }

  /**
   * Применить behavior схему к форме
   *
   * Этапы:
   * 1. Начать регистрацию (beginRegistration)
   * 2. Выполнить схему (регистрация behaviors)
   * 3. Завершить регистрацию (endRegistration) - применить behaviors
   * 4. Вернуть функцию cleanup для отписки
   *
   * @param schemaFn Функция-схема behavior
   * @returns Функция отписки от всех behaviors
   *
   * @example
   * ```typescript
   * const cleanup = behaviorApplicator.apply((path) => {
   *   copyFrom(path.residenceAddress, path.registrationAddress, {
   *     when: (form) => form.sameAsRegistration === true
   *   });
   *
   *   enableWhen(path.propertyValue, (form) => form.loanType === 'mortgage');
   *
   *   computeFrom(
   *     path.initialPayment,
   *     [path.propertyValue],
   *     (propertyValue) => propertyValue ? propertyValue * 0.2 : null
   *   );
   * });
   *
   * // Cleanup при unmount
   * useEffect(() => cleanup, []);
   * ```
   */
  apply(schemaFn: BehaviorSchemaFn<T>): () => void {
    this.behaviorRegistry.beginRegistration();

    try {
      // 1. Создать field path для type-safe доступа к полям
      const path = createBehaviorFieldPath<T>();

      // 2. Выполнить схему (регистрация behaviors)
      schemaFn(path);

      // 3. Завершить регистрацию и применить behaviors
      //  Используем публичный метод getProxy() для получения proxy-инстанса
      const formToUse = this.form.getProxy();
      const result = this.behaviorRegistry.endRegistration(formToUse);

      // 4. Вернуть функцию cleanup
      return result.cleanup;
    } catch (error) {
      FormErrorHandler.handle(error, 'BehaviorApplicator', ErrorStrategy.THROW);
      // TypeScript требует return, но код никогда не дойдет сюда
      throw error;
    }
  }
}
