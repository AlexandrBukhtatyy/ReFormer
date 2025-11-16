/**
 * Создание типизированного FieldPath для Behavior Schema
 * Аналогично createFieldPath из validators
 */

import type { FieldPath, FieldPathNode } from '../types';

/**
 * Создать типизированный путь к полям формы
 * Используется для декларативного описания behavior схем
 *
 * @example
 * ```typescript
 * const schema: BehaviorSchemaFn<MyForm> = (path) => {
 *   // path.email, path.address.city и т.д. - типизированы
 *   copyFrom(path.residenceAddress, path.registrationAddress, {
 *     when: (form) => form.sameAsRegistration
 *   });
 * };
 * ```
 */
export function createFieldPath<T>(): FieldPath<T> {
  return createFieldPathProxy('');
}

/**
 * Создать Proxy для вложенного доступа к полям
 * @private
 */
function createFieldPathProxy<T>(currentPath: string): FieldPath<T> {
  return new Proxy(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    {} as any,
    {
      get(__target, prop: string) {
        // Поддержка обоих вариантов для обратной совместимости
        if (prop === '__path' || prop === '__fieldPath') {
          return currentPath || prop;
        }

        if (prop === '__key') {
          const parts = currentPath.split('.');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (parts[parts.length - 1] || prop) as any;
        }

        const newPath = currentPath ? `${currentPath}.${prop}` : prop;

        // Создаем объект FieldPathNode с вложенным Proxy
        const node: FieldPathNode<T, unknown> = {
          __path: newPath,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          __key: prop as any,
          __formType: undefined as unknown as T,
          __fieldType: undefined as unknown,
        };

        // Возвращаем Proxy, который поддерживает дальнейшую вложенность
        return new Proxy(node, {
          get(_target, nestedProp: string) {
            // Поддержка обоих вариантов для обратной совместимости
            if (nestedProp === '__path' || nestedProp === '__fieldPath') {
              return newPath;
            }

            if (nestedProp === '__key') {
              return prop;
            }

            if (nestedProp === '__formType' || nestedProp === '__fieldType') {
              return undefined;
            }

            // Для вложенных свойств создаем новый Proxy
            const nestedPath = `${newPath}.${nestedProp}`;
            return createFieldPathProxy<T>(nestedPath);
          },
        });
      },
    }
  );
}
