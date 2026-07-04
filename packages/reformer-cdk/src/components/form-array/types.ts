import type { ReactNode, ElementType } from 'react';
import type { ArrayNode, ModelArrayNode, FormProxy, ValidationError } from '@reformer/core';

/**
 * Узел массива, принимаемый CDK-компонентами FormArray.
 *
 * Legacy {@link ArrayNode} (владеет элементами сам) ИЛИ M1 {@link ModelArrayNode} (делегирует
 * массиву модели). Оба структурно реализуют используемый CDK контракт
 * (`push`/`insert`/`removeAt`/`move`/`swap`/`clear`/`at`/`map`/`length`/`value`/`errors`/…), но
 * ModelArrayNode расширяет `FormNode<T[]>`, а не `ArrayNode`, поэтому нужен явный union — иначе
 * консументы M1 (у которых `form.<field>` материализуется как ModelArrayNode) вынуждены кастовать.
 */
export type FormArrayControl<T extends object> = ArrayNode<T> | ModelArrayNode<T>;

/**
 * Props for FormArray.Root component
 */
export interface FormArrayRootProps<T extends object> {
  /** The array control from the form — legacy ArrayNode или M1 ModelArrayNode */
  control: FormArrayControl<T>;
  /** Child components */
  children: ReactNode;
}

/**
 * Props for FormArray.List component
 */
export interface FormArrayListProps<T extends object> {
  /** Render function for each item */
  children: (item: FormArrayItemRenderProps<T>) => ReactNode;
  /** Optional className for the list container */
  className?: string;
  /** Optional element type for the container (default: 'div') */
  as?: ElementType;
}

/**
 * Props passed to the render function in FormArray.List
 */
export interface FormArrayItemRenderProps<T extends object> {
  /** The form control for this item */
  control: FormProxy<T>;
  /** Zero-based index of the item */
  index: number;
  /** Unique identifier for React key */
  id: string | number;
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
 * Props for FormArray.AddButton component
 *
 * Generic `T` — тип элемента массива. По умолчанию `Record<string, unknown>` (широкий) —
 * для совместимости. Для type-safe initialValue передавайте generic явно
 * (`<FormArray.AddButton<PropertyItem> ...>`) либо проксируйте через
 * `FormArraySection<T>` из `@reformer/ui-kit`.
 */
export interface FormArrayAddButtonProps<T extends object = Record<string, unknown>> extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick'
> {
  /** Начальное значение нового элемента (передаётся в `add()` → `ArrayNode.push`) */
  initialValue?: Partial<T>;
  /** Рендерить как дочерний элемент через Slot (props мержатся в children вместо `<button>`) */
  asChild?: boolean;
}

/**
 * Props for FormArray.RemoveButton component
 */
export interface FormArrayRemoveButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick'
> {
  /** Рендерить как дочерний элемент через Slot (props мержатся в children вместо `<button>`) */
  asChild?: boolean;
}

/**
 * Props for FormArray.Empty component
 */
export interface FormArrayEmptyProps {
  /** Content to show when array is empty */
  children: ReactNode;
}

/**
 * Props for FormArray.Count component
 */
export interface FormArrayCountProps {
  /** Custom render function for the count */
  render?: (count: number) => ReactNode;
}

/**
 * Props for FormArray.ItemIndex component
 */
export interface FormArrayItemIndexProps {
  /** Custom render function for the index (receives 0-based index) */
  render?: (index: number) => ReactNode;
}

/**
 * Props for FormArray.Error component — рендерит ошибки уровня массива
 * (например `minItems` / «At least one phone required») из `control.errors`.
 *
 * Паритет с `FormField.Error`: `multi` рендерит все ошибки, `render` — кастомный рендер на ошибку,
 * `children` переопределяет содержимое. Ничего не рендерит, когда ошибок нет.
 */
export interface FormArrayErrorProps extends Omit<
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
  render?: (error: ValidationError, index: number) => ReactNode;
  /** Переопределить содержимое (по умолчанию `errors[0].message` через резолвер). */
  children?: ReactNode;
}
