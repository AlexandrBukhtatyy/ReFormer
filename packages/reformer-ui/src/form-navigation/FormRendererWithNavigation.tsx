/**
 * FormRendererWithNavigation - расширенный FormRenderer с поддержкой NavigationRenderNode
 *
 * Используйте этот компонент вместо FormRenderer когда ваша RenderSchema
 * содержит NavigationRenderNode для multi-step форм.
 *
 * @module form-navigation/FormRendererWithNavigation
 */

import type { ReactNode } from 'react';
import {
  type FormProxy,
  type FormRendererProps,
  type NavigationRenderNode,
  RenderNodeComponent,
  createFieldPath,
  isNavigationRenderNode,
} from '@reformer/core';
import { NavigationRenderer } from './NavigationRenderer';

/**
 * Props для FormRendererWithNavigation
 */
export type FormRendererWithNavigationProps<T> = FormRendererProps<T>;

/**
 * FormRendererWithNavigation - рендеринг формы с поддержкой навигации
 *
 * Расширяет стандартный FormRenderer добавляя обработку NavigationRenderNode.
 * Если корневой узел - NavigationRenderNode, использует NavigationRenderer
 * для рендеринга multi-step формы.
 *
 * @example
 * ```tsx
 * import { FormRendererWithNavigation } from '@reformer/ui/form-navigation';
 *
 * const renderSchema: RenderSchemaFn<MyForm> = (path) => ({
 *   component: FormNavigation,
 *   componentProps: {
 *     steps: STEPS,
 *     stepValidations: STEP_VALIDATIONS,
 *     fullValidation: myValidation,
 *     onSubmit: handleSubmit,
 *     children: [
 *       { selector: 'indicator', component: StepIndicator },
 *       { selector: 'step:1', children: [{ component: path.email }] },
 *       { selector: 'step:2', children: [{ component: path.password }] },
 *       { selector: 'actions', component: NavigationActions },
 *       { selector: 'progress', component: NavigationProgress },
 *     ],
 *   },
 * });
 *
 * function MyFormPage() {
 *   const form = useMemo(() => createForm(schema), []);
 *
 *   return (
 *     <FormRendererWithNavigation
 *       form={form}
 *       render={renderSchema}
 *       fieldWrapper={FormField}
 *     />
 *   );
 * }
 * ```
 */
export function FormRendererWithNavigation<T>({
  form,
  render,
  fieldWrapper,
}: FormRendererWithNavigationProps<T>): ReactNode {
  const path = createFieldPath<T>();
  const rootNode = render(path);

  // Если корневой узел - NavigationRenderNode, используем NavigationRenderer
  if (isNavigationRenderNode(rootNode)) {
    return (
      <NavigationRenderer
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        node={rootNode as NavigationRenderNode<any>}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        form={form as FormProxy<any>}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        path={path as any}
        fieldWrapper={fieldWrapper}
      />
    );
  }

  // Иначе используем стандартный RenderNodeComponent
  return (
    <RenderNodeComponent
      node={rootNode}
      form={form as FormProxy<T>}
      path={path}
      fieldWrapper={fieldWrapper}
    />
  );
}

FormRendererWithNavigation.displayName = 'FormRendererWithNavigation';
