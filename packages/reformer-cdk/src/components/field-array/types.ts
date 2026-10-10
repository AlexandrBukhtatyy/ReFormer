import type { ReactNode, ElementType } from 'react';
import type { FormArray, FormGroup, ValidationIssue } from '@reformer/core';

/**
 * Узел массива, принимаемый CDK-компонентами FieldArray, — {@link FormArray}: узел формы над
 * массивом модели (`push`/`insert`/`removeAt`/`move`/`swap`/`clear`/`at`/`map`/`length`/`value`/
 * `issues`/…).
 */
export type FieldArrayControl<T extends object> = FormArray<T>;

/**
 * Props for FieldArray.Root component
 */
export interface FieldArrayRootProps<T extends object> {
  /** The array control from the form */
  control: FieldArrayControl<T>;
  /** Child components */
  children: ReactNode;
}

/**
 * Props for FieldArray.List component
 */
export interface FieldArrayListProps<T extends object> {
  /** Render function for each item */
  children: (item: FieldArrayItemRenderProps<T>) => ReactNode;
  /** Optional className for the list container */
  className?: string;
  /** Optional element type for the container (default: 'div') */
  as?: ElementType;
}

/**
 * Props passed to the render function in FieldArray.List
 */
export interface FieldArrayItemRenderProps<T extends object> {
  /** The form control for this item */
  control: FormGroup<T>;
  /** Zero-based index of the item */
  index: number;
  /** Unique identifier for React key */
  id: string;
  /** Remove this item from the array */
  remove: () => void;
  /** Move this item one position up (no-op when first) */
  moveUp: () => void;
  /** Move this item one position down (no-op when last) */
  moveDown: () => void;
  /** Whether this item can move up (index > 0) */
  canMoveUp: boolean;
  /** Whether this item can move down (index < length - 1) */
  canMoveDown: boolean;
}

/**
 * Props for FieldArray.AddButton component
 *
 * Generic `T` — тип элемента массива. По умолчанию `Record<string, unknown>` (широкий) —
 * для совместимости. Для type-safe initialValue передавайте generic явно
 * (`<FieldArray.AddButton<PropertyItem> ...>`) либо проксируйте через
 * `FieldArraySection<T>` из `@reformer/ui-kit`.
 */
export interface FieldArrayAddButtonProps<T extends object = Record<string, unknown>> extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick'
> {
  /**
   * Значение нового элемента (передаётся в `add()` → `ArrayNode.push`). Запасной путь: без него
   * элемент берётся из шаблона массива модели — `arrayOf(blank)` из `@reformer/core`.
   */
  initialValue?: Partial<T>;
  /** Рендерить как дочерний элемент через Slot (props мержатся в children вместо `<button>`) */
  asChild?: boolean;
}

/**
 * Props for FieldArray.RemoveButton component
 */
export interface FieldArrayRemoveButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick'
> {
  /** Рендерить как дочерний элемент через Slot (props мержатся в children вместо `<button>`) */
  asChild?: boolean;
}

/**
 * Props for FieldArray.Empty component
 */
export interface FieldArrayEmptyProps {
  /** Content to show when array is empty */
  children: ReactNode;
}

/**
 * Props for FieldArray.Count component
 */
export interface FieldArrayCountProps {
  /** Custom render function for the count */
  render?: (count: number) => ReactNode;
}

/**
 * Props for FieldArray.ItemIndex component
 */
export interface FieldArrayItemIndexProps {
  /** Custom render function for the index (receives 0-based index) */
  render?: (index: number) => ReactNode;
}

/**
 * Props for FieldArray.Error component — рендерит ошибки уровня массива
 * (например `minItems` / «At least one phone required») из `control.issues`.
 *
 * Паритет с `FormField.Error`: `multi` рендерит все ошибки, `render` — кастомный рендер на ошибку,
 * `children` переопределяет содержимое. Ничего не рендерит, когда ошибок нет.
 */
export interface FieldArrayErrorProps extends Omit<
  React.HTMLAttributes<HTMLParagraphElement>,
  'role'
> {
  /** Рендерить как дочерний элемент через Slot (props мержатся в children). */
  asChild?: boolean;
  /**
   * Рендерить все ошибки массива вместо только первой.
   * @default false
   */
  multi?: boolean;
  /** Кастомный рендер на каждую ошибку. Когда задан — `multi` подразумевается. */
  render?: (error: ValidationIssue, index: number) => ReactNode;
  /** Переопределить содержимое (по умолчанию — текст `issues[0]` от резолвера сообщений). */
  children?: ReactNode;
}
