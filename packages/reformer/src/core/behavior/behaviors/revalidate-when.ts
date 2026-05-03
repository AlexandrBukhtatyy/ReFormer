/**
 * Перевалидация полей при изменениях
 *
 * @group Behaviors
 * @category Behavior Rules
 * @module behaviors/revalidateWhen
 */

import { effect } from '@preact/signals-core';
import type { FormNode } from '../../nodes/form-node';
import type { FieldPathNode, FormFields, FormValue } from '../../types';
import { getCurrentBehaviorRegistry } from '../../utils/registry-helpers';
import type { RevalidateWhenOptions, BehaviorHandlerFn } from '../types';

/**
 * Перевалидирует поле при изменении других полей
 *
 * @group Behaviors
 * @category Behavior Rules
 *
 * @param target - Поле для перевалидации
 * @param triggers - Поля-триггеры (НЕ должно содержать `target`)
 * @param options - Опции (`debounce`)
 *
 * @example Парная перевалидация — confirmPassword при смене password
 * ```typescript
 * import { revalidateWhen, type BehaviorSchemaFn } from '@reformer/core/behaviors';
 * import { equalTo } from '@reformer/core/validators';
 * import type { FieldPath } from '@reformer/core';
 *
 * interface RegistrationForm { password: string; confirmPassword: string }
 *
 * export const validation = (path: FieldPath<RegistrationForm>) => {
 *   equalTo(path.confirmPassword, path.password, { message: 'Пароли не совпадают' });
 * };
 *
 * export const behavior: BehaviorSchemaFn<RegistrationForm> = (path) => {
 *   // Если пользователь сначала ввёл confirm, потом меняет password —
 *   // без revalidateWhen ошибка confirmPassword останется устаревшей.
 *   revalidateWhen(path.confirmPassword, [path.password]);
 * };
 * ```
 *
 * @example Несколько триггеров + `debounce` для async-валидаторов
 * ```typescript
 * import { revalidateWhen, type BehaviorSchemaFn } from '@reformer/core/behaviors';
 *
 * interface MortgageForm {
 *   propertyValue: number;
 *   loanAmount: number;
 *   initialPayment: number; // правило: initialPayment >= propertyValue * 0.2 - loanAmount
 * }
 *
 * export const mortgageBehavior: BehaviorSchemaFn<MortgageForm> = (path) => {
 *   revalidateWhen(
 *     path.initialPayment,
 *     [path.propertyValue, path.loanAmount],
 *     { debounce: 300 }, // не дёргаем сервер на каждый keystroke
 *   );
 * };
 * ```
 *
 * @see [docs/llms/27-revalidate-when.md](../../../../docs/llms/27-revalidate-when.md)
 */
export function revalidateWhen<TForm>(
  target: FieldPathNode<TForm, FormValue>,
  triggers: FieldPathNode<TForm, FormValue>[],
  options?: RevalidateWhenOptions
): void {
  const { debounce } = options || {};

  const handler: BehaviorHandlerFn<FormFields> = (form, _context, withDebounce) => {
    const targetNode = form.getFieldByPath(target.__path);
    if (!targetNode) return null;

    const sourceNodes = triggers
      .map((field) => form.getFieldByPath(field.__path))
      .filter((node): node is FormNode<FormValue> => node !== undefined);

    if (sourceNodes.length === 0) return null;

    return effect(() => {
      // Отслеживаем изменения source полей
      sourceNodes.forEach((node) => node!.value.value);

      withDebounce(() => {
        // Перезапускаем валидацию target поля
        targetNode.validate();
      });
    });
  };

  getCurrentBehaviorRegistry().register(handler, { debounce });
}
