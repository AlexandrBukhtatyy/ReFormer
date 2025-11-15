/**
 * Copy values between fields
 */

import type { FieldPathNode } from '../../types';
import { getCurrentBehaviorRegistry } from '../../utils/registry-helpers';
import type { CopyFromOptions } from '../types';
import { createCopyBehavior } from '../behavior-factories';

/**
 * Копирует значения из одного поля/группы в другое при выполнении условия
 *
 * @param target - Куда копировать
 * @param source - Откуда копировать
 * @param options - Опции копирования
 *
 * @example
 * ```typescript
 * const schema: BehaviorSchemaFn<MyForm> = (path) => {
 *   // Копировать адрес регистрации в адрес проживания
 *   copyFrom(path.residenceAddress, path.registrationAddress, {
 *     when: (form) => form.sameAsRegistration === true,
 *     fields: 'all'
 *   });
 * };
 * ```
 */
export function copyFrom<TForm extends Record<string, any>, TSource, TTarget>(
  target: FieldPathNode<TForm, TTarget>,
  source: FieldPathNode<TForm, TSource>,
  options?: CopyFromOptions<TForm, TSource>
): void {
  const { debounce } = options || {};

  const handler = createCopyBehavior(target, source, options);
  getCurrentBehaviorRegistry().register(handler, { debounce });
}
