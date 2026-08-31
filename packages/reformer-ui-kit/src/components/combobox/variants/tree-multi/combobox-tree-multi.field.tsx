import { withFormControl } from '@/fields/with-form-control';
import { multiValueAdapter } from '@/fields/adapters';
import type { TreeNode } from '@/components/tree';
import { ComboboxTreeMulti } from './combobox-tree-multi';

/**
 * Value-based контракт field-версии ComboboxTreeMulti. Значение — `string[] | null` (адреса
 * узлов); форма резолвит `value`/`onChange`/`onBlur`/`disabled`, автор задаёт остальное
 * в `componentProps`. Служит типом для стража props-схемы.
 */
export interface ComboboxTreeMultiFieldProps {
  value?: string[] | null;
  onChange?: (value: string[] | null) => void;
  onBlur?: () => void;
  disabled?: boolean;
  nodes?: readonly TreeNode[];
  loadChildren?: (node: TreeNode | null) => Promise<readonly TreeNode[]>;
  defaultExpandedIds?: readonly string[];
  selectable?: 'all' | 'leaf';
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  clearable?: boolean;
  maxItems?: number;
  summaryThreshold?: number;
  maxRows?: number;
  className?: string;
}

/**
 * `exposesHandle: true` — ComboboxTreeMulti сам реализует {@link ComboboxTreeMultiHandle}
 * (`useImperativeHandle`), поэтому HOC форвардит ref потребителя прямо в композит
 * (passthrough), без своего baseline-handle. Привязка — общий для кита
 * {@link multiValueAdapter}: он же разворачивает `null` в `[]` на входе и сворачивает
 * пустой выбор обратно в `null` на выходе.
 */
export const ComboboxTreeMultiField = withFormControl(ComboboxTreeMulti, multiValueAdapter, {
  exposesHandle: true,
});
