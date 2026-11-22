/**
 * Поля выбора: выпадающие списки, деревья, радио, группы чекбоксов и кнопок.
 *
 * Имена записей — как у `@reformer/ui-kit` (`Select`, `SelectMulti`, `Combobox`, `ComboboxMulti`,
 * `ComboboxTree`, `ComboboxTreeMulti`, `RadioGroup`, `CheckboxGroup`, `ToggleGroup`,
 * `ToggleGroupMulti`), плюс своё у HexaUI — `ToggleButtonGroup`. На именах держится одна схема
 * формы на два кита, поэтому и пропсы, которые пишут схемы ui-kit, здесь понимаются:
 * `clearable` → `allowClear`, `emptyText` → `notFoundContent`, `options` у групп кнопок → `items`,
 * `nodes` у дерева → `treeData`.
 *
 * Значения модели: один выбор — `string | null`, мультивыбор — `string[] | null` (пустой
 * выбор → `null`, см. `./adapters`).
 *
 * @module reformer/kit-hexa-ui/fields/choice
 */

import { useMemo, type ReactNode } from 'react';
import type {
  CheckboxGroupProps as HexaCheckboxGroupProps,
  RadioOption,
  RadioProps,
  SegmentedButtonProps,
  SelectProps as HexaSelectProps,
  ToggleButtonGroupProps as HexaToggleButtonGroupProps,
  ToggleButtonProps as HexaToggleButtonProps,
  TreeSelectProps,
} from '@kaspersky/hexa-ui';
// Значения HexaUI — с подпутей: модуль входит в пространство имён билдера (см. `../palette`).
import { CheckboxGroup as HexaCheckboxGroup } from '@kaspersky/hexa-ui/checkbox';
import { Radio } from '@kaspersky/hexa-ui/radio';
import { SegmentedButton } from '@kaspersky/hexa-ui/segmented-button';
import { Select as HexaSelect } from '@kaspersky/hexa-ui/select';
import { ToggleButtonGroup as HexaToggleButtonGroup } from '@kaspersky/hexa-ui/toggle-button';
import { TreeSelect } from '@kaspersky/hexa-ui/tree-select';
import { useKitPopupContainer } from '../popup-container';
import { choiceAdapter, multiValueAdapter, radioAdapter, selectAdapter } from './adapters';
import { fieldControl } from './control';
import { treeDataOf, type HexaTreeNode, type TreeSelectable } from './convert';

// ---------------------------------------------------------------------------------------------
// Выпадающие списки
// ---------------------------------------------------------------------------------------------

/** Пропсы, которые пишут схемы ui-kit у выпадающих списков. */
interface ListParityProps {
  /** Кнопка очистки выбора (у HexaUI — `allowClear`, он главнее). */
  clearable?: boolean;
  /** Что показать, когда вариантов нет (у HexaUI — `notFoundContent`, он главнее). */
  emptyText?: ReactNode;
}

/** Пропсы {@link Select}: пропсы HexaUI `Select` без режима — он у записи свой. */
export type SelectProps = Omit<HexaSelectProps, 'mode'> & ListParityProps;

/**
 * Общая отрисовка списков: пропсы схем ui-kit → пропсы HexaUI, список открывается в контейнере
 * всплывающих окон кита (явный `getPopupContainer` главнее).
 */
function ListField({
  clearable,
  emptyText,
  allowClear,
  notFoundContent,
  multiple,
  ...rest
}: SelectProps & { multiple: boolean }) {
  const popupContainer = useKitPopupContainer();
  return (
    <HexaSelect
      getPopupContainer={popupContainer}
      {...rest}
      mode={multiple ? 'multiple' : undefined}
      allowClear={allowClear ?? clearable}
      notFoundContent={notFoundContent ?? emptyText}
    />
  );
}

/** Выпадающий список с одним значением: HexaUI `Select` (`onChange(value, option)`). */
export function Select(props: SelectProps) {
  return <ListField {...props} multiple={false} />;
}
Select.reformerAdapter = selectAdapter;

/** Пропсы {@link SelectMulti} — те же, что у {@link Select}. */
export type SelectMultiProps = SelectProps;

/** Мультивыбор: HexaUI `Select` в режиме `multiple`. */
export function SelectMulti(props: SelectMultiProps) {
  return <ListField {...props} multiple />;
}
SelectMulti.reformerAdapter = multiValueAdapter;

/** Пропсы {@link Combobox}: список с поиском — поиск у записи включён всегда. */
export type ComboboxProps = Omit<SelectProps, 'showSearch'>;

/** Список с поиском по подписи: HexaUI `Select` с `showSearch`. */
export function Combobox(props: ComboboxProps) {
  return <Select {...props} showSearch />;
}
Combobox.reformerAdapter = selectAdapter;

/** Пропсы {@link ComboboxMulti} — те же, что у {@link Combobox}. */
export type ComboboxMultiProps = ComboboxProps;

/** Мультивыбор с поиском: HexaUI `Select` в режиме `multiple` с `showSearch`. */
export function ComboboxMulti(props: ComboboxMultiProps) {
  return <SelectMulti {...props} showSearch />;
}
ComboboxMulti.reformerAdapter = multiValueAdapter;

// ---------------------------------------------------------------------------------------------
// Дерево вариантов
// ---------------------------------------------------------------------------------------------

/** Пропсы {@link ComboboxTree}: пропсы HexaUI `TreeSelect`, варианты — `nodes` в форме ui-kit. */
export type ComboboxTreeProps = Omit<
  TreeSelectProps,
  'treeData' | 'multiple' | 'treeCheckable' | 'labelInValue'
> &
  ListParityProps & {
    /** Дерево вариантов; значение поля — `id` выбранного узла. */
    nodes?: HexaTreeNode[];
    /** Что можно выбрать: `leaf` — только листья (умолчание), `all` — и ветки. */
    selectable?: TreeSelectable;
  };

/** Пропсы {@link ComboboxTreeMulti} — те же, что у {@link ComboboxTree}. */
export type ComboboxTreeMultiProps = ComboboxTreeProps;

/** Общая отрисовка дерева: одиночный и множественный выбор отличаются только `multiple`. */
function TreeField({
  nodes,
  selectable = 'leaf',
  clearable,
  emptyText,
  allowClear,
  notFoundContent,
  multiple,
  ...rest
}: ComboboxTreeProps & { multiple: boolean }) {
  const treeData = useMemo(() => treeDataOf(nodes ?? [], selectable), [nodes, selectable]);
  const popupContainer = useKitPopupContainer();
  return (
    <TreeSelect
      showSearch
      treeNodeFilterProp="title"
      getPopupContainer={popupContainer}
      {...rest}
      treeData={treeData}
      multiple={multiple}
      allowClear={allowClear ?? clearable}
      notFoundContent={notFoundContent ?? emptyText}
    />
  );
}

/** Выбор узла дерева: HexaUI `TreeSelect` (`onChange(value, labels, extra)`). */
export function ComboboxTree(props: ComboboxTreeProps) {
  return <TreeField {...props} multiple={false} />;
}
ComboboxTree.reformerAdapter = selectAdapter;

/** Выбор нескольких узлов дерева: HexaUI `TreeSelect` с `multiple`. */
export function ComboboxTreeMulti(props: ComboboxTreeMultiProps) {
  return <TreeField {...props} multiple />;
}
ComboboxTreeMulti.reformerAdapter = multiValueAdapter;

// ---------------------------------------------------------------------------------------------
// Радио и чекбоксы
// ---------------------------------------------------------------------------------------------

/** Пропсы {@link RadioGroup}: пропсы HexaUI `Radio`; варианты необязательны (пусто — нет вариантов). */
export type RadioGroupProps = Omit<RadioProps, 'options'> & {
  /** Варианты: подпись, значение, подсказка. */
  options?: RadioOption[];
};

/**
 * Радиогруппа: HexaUI `Radio` — это antd `Radio.Group` с вариантами `options` и событием в
 * `onChange(e)`. Без вариантов HexaUI падает на `options.map`, поэтому пустой список — умолчание.
 */
export function RadioGroup({ options, ...rest }: RadioGroupProps) {
  return <Radio {...rest} options={options ?? []} />;
}
RadioGroup.reformerAdapter = radioAdapter;

/** Пропсы {@link CheckboxGroup} — пропсы HexaUI `CheckboxGroup` (`options` — `{ label, value }`). */
export type CheckboxGroupProps = HexaCheckboxGroupProps;

/** Группа чекбоксов: HexaUI `CheckboxGroup`, `onChange(values)`. */
export const CheckboxGroup = fieldControl<CheckboxGroupProps>(HexaCheckboxGroup, 'CheckboxGroup', {
  reformerAdapter: multiValueAdapter,
});

// ---------------------------------------------------------------------------------------------
// Группы кнопок
// ---------------------------------------------------------------------------------------------

/** Вариант группы кнопок — форма `options` ui-kit. */
export interface ToggleGroupOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
  tooltip?: string;
}

/** Общие пропсы групп на HexaUI `SegmentedButton`: варианты — `options` в форме ui-kit. */
type SegmentedProps = Omit<SegmentedButtonProps, 'items' | 'value' | 'onChange' | 'type'> & {
  options?: ToggleGroupOption[];
};

/** `options` ui-kit → `items` HexaUI `SegmentedButton`. */
function useSegmentedItems(options: ToggleGroupOption[] | undefined) {
  return useMemo(
    () =>
      (options ?? []).map(({ value, label, disabled, tooltip }) => ({
        value,
        text: label,
        disabled,
        tooltip,
      })),
    [options]
  );
}

/** Пропсы {@link ToggleGroup}: один выбор. */
export type ToggleGroupProps = SegmentedProps & {
  value?: string | null;
  onChange?: (value: string | null) => void;
};

/** Один выбор кнопками: HexaUI `SegmentedButton` в режиме `radio` (значение — массив из одного). */
export function ToggleGroup({ options, value, onChange, ...rest }: ToggleGroupProps) {
  const items = useSegmentedItems(options);
  return (
    <SegmentedButton
      {...rest}
      type="radio"
      items={items}
      value={value === null || value === undefined ? [] : [value]}
      onChange={(next) => onChange?.(next[next.length - 1] ?? null)}
    />
  );
}
ToggleGroup.reformerAdapter = choiceAdapter;

/** Пропсы {@link ToggleGroupMulti}: несколько выборов. */
export type ToggleGroupMultiProps = SegmentedProps & {
  value?: string[] | null;
  onChange?: (value: string[]) => void;
};

/** Несколько выборов кнопками: HexaUI `SegmentedButton` в режиме `checkbox`. */
export function ToggleGroupMulti({ options, value, onChange, ...rest }: ToggleGroupMultiProps) {
  const items = useSegmentedItems(options);
  return (
    <SegmentedButton
      {...rest}
      type="checkbox"
      items={items}
      value={value ?? []}
      onChange={(next) => onChange?.(next)}
    />
  );
}
ToggleGroupMulti.reformerAdapter = multiValueAdapter;

/** Пропсы {@link ToggleButtonGroup}: пропсы HexaUI `ToggleButtonGroup`, кнопки и значение необязательны. */
export type ToggleButtonGroupProps = Omit<
  HexaToggleButtonGroupProps,
  'items' | 'value' | 'onChange'
> & {
  /** Кнопки группы: значение, текст, иконка, цвет. */
  items?: HexaToggleButtonProps[];
  value?: string[] | null;
  onChange?: (value: string[]) => void;
};

/** Несколько выборов кнопками-переключателями: HexaUI `ToggleButtonGroup`. */
export function ToggleButtonGroup({ items, value, onChange, ...rest }: ToggleButtonGroupProps) {
  return (
    <HexaToggleButtonGroup
      {...rest}
      items={items ?? []}
      value={value ?? []}
      onChange={(next) => onChange?.(next)}
    />
  );
}
ToggleButtonGroup.reformerAdapter = multiValueAdapter;
