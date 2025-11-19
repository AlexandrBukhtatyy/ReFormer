/**
 * Copy values between fields
 */

import type { FieldPathNode, FormFields, FormValue } from '../../types';
import type { CopyFromOptions } from '../types';
import { watchField } from './watch-field';

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
export function copyFrom<
  TForm extends FormFields,
  TSource extends FieldPathNode<TForm, FormValue>,
  TTarget extends FieldPathNode<TForm, FormValue>,
>(target: TTarget, source: TSource, options?: CopyFromOptions<FormValue>): void {
  const { when, fields = 'all', transform, debounce } = options || {};

  watchField(
    source,
    (sourceValue, ctx) => {
      // Проверка условия
      if (when) {
        const formValue = ctx.getForm();
        if (!when(formValue)) return;
      }

      // Трансформация значения
      const value = (transform ? transform(sourceValue) : sourceValue) as FormValue;

      // Получаем target node
      const targetNode = ctx.getFieldNode(target.__path);
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
