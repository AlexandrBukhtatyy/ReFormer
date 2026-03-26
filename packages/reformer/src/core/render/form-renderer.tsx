/**
 * FormRenderer - компонент для декларативного рендеринга формы
 *
 * @module core/render/form-renderer
 */

import type { ReactNode } from 'react';
import type { FormProxy } from '../types';
import { createFieldPath } from '../utils/field-path';
import type { FormRendererProps } from './types';
import { RenderNodeComponent } from './render-node';

/**
 * FormRenderer - рендеринг формы на основе RenderSchema
 *
 * Принимает форму и функцию рендеринга, возвращает готовый React-компонент.
 * RenderSchema определяет структуру страницы: расположение полей,
 * контейнеры, секции и условия отображения.
 *
 * @example
 * ```tsx
 * const renderSchema: RenderSchemaFn<MyForm> = (path) => ({
 *   component: Box,
 *   componentProps: {
 *     className: 'flex flex-col gap-6',
 *     children: [
 *       {
 *         component: Section,
 *         componentProps: {
 *           title: 'Личные данные',
 *           className: 'grid grid-cols-2 gap-4',
 *           children: [
 *             { component: path.firstName },
 *             { component: path.lastName },
 *             { component: path.email, componentProps: { className: 'col-span-2' } },
 *           ],
 *         },
 *       },
 *       {
 *         component: Section,
 *         componentProps: {
 *           title: 'Адрес',
 *           hidden: (form) => !form.needsAddress.value.value,
 *           children: [
 *             { component: path.address.city },
 *             { component: path.address.street },
 *           ],
 *         },
 *       },
 *     ],
 *   },
 * });
 *
 * function MyFormPage() {
 *   const form = useForm(schema);
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <FormRenderer form={form} render={renderSchema} />
 *       <button type="submit">Отправить</button>
 *     </form>
 *   );
 * }
 * ```
 */
export function FormRenderer<T>({ form, render, fieldWrapper }: FormRendererProps<T>): ReactNode {
  const path = createFieldPath<T>();
  const rootNode = render(path);

  return (
    <RenderNodeComponent
      node={rootNode}
      form={form as FormProxy<T>}
      path={path}
      fieldWrapper={fieldWrapper}
    />
  );
}
