/**
 * RendererFormArraySection — generic, registry-friendly array UI (app-level).
 *
 * Лежит на уровне приложения, а не в `@reformer/renderer-react`, потому что
 * это **сборка из примитивов** (`FormArray.Root + List + AddButton`,
 * `RenderNodeComponent`, `useFormControl`), а не базовый rendering primitive.
 * Класть подобную сборку в библиотеку = намертво фиксировать стили + поведение
 * + кнопки на уровне SDK. Держим её в app, чтобы любой проект мог адаптировать
 * под свои UI-кит / классы / data-testid конвенции.
 *
 * Что библиотека всё-таки даёт (и от чего этот компонент зависит):
 * - `__selfManagedChildren = true` marker — `RenderNodeComponent` пробрасывает
 *   `form` prop в такие компоненты вместо рекурсивного рендеринга детей.
 * - `RenderNodeComponent` сам — для рендера item-template как подформы.
 * - `FieldPathNavigator` + `extractPath` — резолв `FieldPathNode → ArrayNode`.
 *
 * Контракт регистрации (один раз на проект):
 * ```tsx
 * import { RendererFormArraySection } from '@/components/RendererFormArraySection';
 * import { defineRegistry } from '@reformer/renderer-json';
 *
 * export const registry = defineRegistry((reg) => {
 *   reg.container('FormArraySection', RendererFormArraySection);
 *   // ...other components
 * });
 * ```
 *
 * Использование из JSON (через `$template` для item):
 * ```jsonc
 * {
 *   "selector": "step5.properties-section",
 *   "component": "FormArraySection",
 *   "componentProps": {
 *     "control": "step5.properties",
 *     "title": "Имущество",
 *     "addButtonLabel": "+ Добавить имущество",
 *     "removeButtonLabel": "Удалить",
 *     "initialValue": "PROPERTY_TEMPLATE",
 *     "itemComponent": {
 *       "$template": {
 *         "component": "Box",
 *         "componentProps": { "className": "grid grid-cols-2 gap-4" },
 *         "children": [
 *           { "model": "type", "component": "Select", "componentProps": { "label": "Тип", "options": "PROPERTY_TYPES" } },
 *           { "model": "estimatedValue", "component": "Input", "componentProps": { "label": "Оценочная стоимость (₽)" } }
 *         ]
 *       }
 *     }
 *   }
 * }
 * ```
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { type ReactNode } from 'react';
import {
  FieldPathNavigator,
  createFieldPath,
  extractPath,
  useFormControl,
  type FieldPath,
  type FieldPathNode,
  type FormFields,
  type FormProxy,
  type ArrayNode,
} from '@reformer/core';
import { FormArray } from '@reformer/cdk/form-array';
import {
  RenderNodeComponent,
  type RenderNode,
  type FieldWrapperProps,
} from '@reformer/renderer-react';

/**
 * Props for {@link RendererFormArraySection}.
 *
 * `control` accepts either a resolved `ArrayNode<T>` (when used directly from
 * TS RenderSchema) OR a `FieldPathNode` (when resolved by the `renderer-json`
 * converter from a `control: "step5.properties"` string). Both paths work.
 *
 * `itemComponent` accepts either a function `(itemPath) => RenderNode` (the
 * shape produced by `{ $template }` resolution in `renderer-json`) or an
 * inline `RenderNode` (rare; mostly for direct TS usage).
 *
 * `initialValue` MUST be plain leaf values matching the item shape — NEVER a
 * FieldConfig template. Misuse silently corrupts items (Textarea shows
 * `[object Object]`, checkbox flips true). Convention: define a plain-leaf
 * factory in registry as a `source`, reference it from JSON by string.
 */
export interface RendererFormArraySectionProps<T extends FormFields> {
  /** Resolved ArrayNode or FieldPathNode pointing to one. */
  control: ArrayNode<T> | FieldPathNode<unknown, unknown>;
  /** Render-prop producing per-item RenderNode given itemPath. */
  itemComponent: (itemPath: FieldPath<T>) => RenderNode<T>;
  /** Section title (rendered as h2/h3/h4). */
  title?: string;
  /** Title heading level. Default `'h3'`. */
  titleAs?: 'h2' | 'h3' | 'h4';
  /** Title CSS class. */
  titleClassName?: string;
  /** Outer section wrapper class. */
  className?: string;
  /** Per-item card wrapper class. Default: `'rounded-md border p-4 space-y-3'`. */
  cardClassName?: string;
  /** "Add" button label. Default `'+ Добавить'`. */
  addButtonLabel?: string;
  /** "Remove" button label. Default `'Удалить'`. */
  removeButtonLabel?: string;
  /**
   * Plain leaf values for new items pushed by the AddButton. Matches the
   * item type shape. NEVER pass FieldConfig (`{ value, component }`) — that
   * is for the schema literal only, not for runtime push.
   */
  initialValue?: Partial<FormFields>;
  /** Show "Remove" button even when only one item left. Default `false`. */
  showRemoveOnSingle?: boolean;
  /** Empty-state label, shown only if length === 0. */
  emptyLabel?: string;
  /** Optional max items (AddButton disabled when reached). */
  maxItems?: number;
  /**
   * Form proxy. Auto-injected by `RenderNodeComponent` when this component is
   * rendered as a self-managed child (which it always is — see marker below).
   * Pass explicitly only when using outside the standard render tree.
   */
  form?: FormProxy<unknown>;
  /**
   * Field wrapper for child fields rendered inside item template. Auto-injected
   * by `RenderNodeComponent`; override to use a different per-section wrapper.
   */
  fieldWrapper?: React.ComponentType<FieldWrapperProps>;
}

const navigator = new FieldPathNavigator();

function resolveArrayNode<T extends FormFields>(
  control: RendererFormArraySectionProps<T>['control'],
  form: FormProxy<unknown> | undefined
): ArrayNode<T> | null {
  // Already an ArrayNode? It will have these methods.
  // (FieldPathNode is a Proxy without `push` / `at` etc.)
  if (
    control &&
    typeof control === 'object' &&
    typeof (control as ArrayNode<T>).push === 'function' &&
    typeof (control as ArrayNode<T>).removeAt === 'function'
  ) {
    return control as ArrayNode<T>;
  }
  // FieldPathNode → resolve via navigator.
  if (!form) {
    if (typeof console !== 'undefined') {
      console.warn(
        '[RendererFormArraySection] control is a FieldPath but no `form` prop available. ' +
          'Ensure this component is rendered inside FormRenderer with form available, ' +
          'or pass form explicitly.'
      );
    }
    return null;
  }
  try {
    const pathStr = extractPath(control as FieldPathNode<unknown, unknown>);
    const node = navigator.getNodeByPath(form, pathStr);
    if (!node) {
      if (typeof console !== 'undefined') {
        console.warn(`[RendererFormArraySection] No ArrayNode at path "${pathStr}".`);
      }
      return null;
    }
    return node as unknown as ArrayNode<T>;
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[RendererFormArraySection] Failed to resolve control:', err);
    }
    return null;
  }
}

/**
 * Generic registry-friendly array UI.
 *
 * @see {@link RendererFormArraySectionProps}
 */
export function RendererFormArraySection<T extends FormFields>({
  control,
  itemComponent,
  title,
  titleAs: TitleTag = 'h3',
  titleClassName = 'text-base font-semibold text-gray-700 mb-2',
  className = 'space-y-3 mt-2',
  cardClassName = 'rounded-md border p-4 space-y-3',
  addButtonLabel = '+ Добавить',
  removeButtonLabel = 'Удалить',
  initialValue,
  showRemoveOnSingle = false,
  emptyLabel,
  maxItems,
  form,
  fieldWrapper,
}: RendererFormArraySectionProps<T>): ReactNode {
  const arrayNode = resolveArrayNode<T>(control, form);
  if (!arrayNode) return null;

  // Subscribe to length so add/remove triggers re-render.
  const lengthCtrl = useFormControl(arrayNode as unknown as Parameters<typeof useFormControl>[0]);
  const length = (lengthCtrl as unknown as { length?: number } | undefined)?.length ?? 0;
  const atMaxItems = maxItems != null && length >= maxItems;

  return (
    <section className={className}>
      {title ? <TitleTag className={titleClassName}>{title}</TitleTag> : null}

      {length === 0 && emptyLabel ? (
        <p className="text-sm text-gray-500 italic">{emptyLabel}</p>
      ) : null}

      <FormArray.Root control={arrayNode}>
        <FormArray.List className="space-y-3">
          {({ control: itemForm, index, remove }) => {
            const itemPath = createFieldPath<T>();
            const renderNode = itemComponent(itemPath);
            const showRemove = showRemoveOnSingle || length > 1;
            return (
              <div className={cardClassName} data-testid={`array-item-${index}`}>
                <RenderNodeComponent
                  node={renderNode}
                  form={itemForm as unknown as FormProxy<T>}
                  fieldWrapper={fieldWrapper}
                />
                {showRemove ? (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={remove}
                      data-testid={`array-item-${index}-remove`}
                      className="text-sm text-red-600 hover:text-red-700 hover:underline"
                    >
                      {removeButtonLabel}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          }}
        </FormArray.List>

        {atMaxItems ? null : (
          <div>
            <FormArray.AddButton
              initialValue={initialValue}
              data-testid="array-add"
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              {addButtonLabel}
            </FormArray.AddButton>
          </div>
        )}
      </FormArray.Root>
    </section>
  );
}

// Marker so RenderNodeComponent passes children + form as props rather than
// recursively rendering. This component owns the rendering of its children.
(RendererFormArraySection as any).__selfManagedChildren = true;
