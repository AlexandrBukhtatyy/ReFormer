/**
 * Copy values between fields
 */

import type { FieldPathNode } from '../../types';
import type { CopyFromOptions } from '../types';
import { watchField } from './watch-field';

/**
 * Копирует значения из одного поля/группы в другое при выполнении условия
 *
 * @param source - Откуда копировать
 * @param target - Куда копировать
 * @param options - Опции копирования
 *
 * @example
 * ```typescript
 * const schema: BehaviorSchemaFn<MyForm> = (path) => {
 *   // Копировать адрес регистрации в адрес проживания
 *   copyFrom(path.registrationAddress, path.residenceAddress, {
 *     when: (form) => form.sameAsRegistration === true,
 *     fields: 'all'
 *   });
 * };
 * ```
 */
export function copyFrom<TForm, TSource, TTarget>(
  source: FieldPathNode<TForm, TSource>,
  target: FieldPathNode<TForm, TTarget>,
  options?: CopyFromOptions<TSource, TForm>
): void {
  const { when, fields = 'all', transform, debounce } = options || {};

  watchField<TForm, TSource>(
    source,
    (sourceValue, ctx) => {
      // Проверка условия
      if (when) {
        const formValue = ctx.form.getValue() as TForm;
        if (!when(formValue)) return;
      }

      // Трансформация значения
      const value = transform ? transform(sourceValue) : sourceValue;

      // Получаем target node
      const targetNode = ctx.form.getFieldByPath(target.__path);
      if (!targetNode) return;

      // Копирование
      if (fields === 'all' || !fields) {
        targetNode.setValue(value, { emitEvent: false });
      } else {
        // Частичное копирование для групп
        const patch: Record<string, unknown> = {};
        fields.forEach((key) => {
          if (sourceValue && typeof sourceValue === 'object') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            patch[key as string] = (sourceValue as any)[key];
          }
        });
        if ('patchValue' in targetNode) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (targetNode as any).patchValue(patch);
        }
      }
    },
    { debounce }
  );
}
