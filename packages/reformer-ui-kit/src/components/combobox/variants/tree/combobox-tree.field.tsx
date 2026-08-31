import { withFormControl } from '@/fields/with-form-control';
import type { TreeNode } from '@/components/tree';
import { comboboxAdapter } from '../base/combobox-base.field';
import { ComboboxTree } from './combobox-tree';

/**
 * Value-based контракт field-версии ComboboxTree. Значение — `string | null` (адрес узла);
 * форма резолвит `value`/`onChange`/`onBlur`/`disabled`, автор задаёт остальное в
 * `componentProps`. Служит типом для стража props-схемы.
 */
export interface ComboboxTreeFieldProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
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
  maxRows?: number;
  className?: string;
}

/**
 * `exposesHandle: true` — ComboboxTree сам реализует {@link ComboboxTreeHandle}
 * (`useImperativeHandle`), поэтому HOC форвардит ref потребителя прямо в композит
 * (passthrough), без своего baseline-handle. Привязка — общий с одиночным вариантом
 * {@link comboboxAdapter}: контракт значения у них один и тот же.
 */
export const ComboboxTreeField = withFormControl(ComboboxTree, comboboxAdapter, {
  exposesHandle: true,
});
