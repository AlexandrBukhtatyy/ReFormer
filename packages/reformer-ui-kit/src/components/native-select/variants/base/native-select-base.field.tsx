import * as React from 'react';

import { withFormControl } from '@/fields/with-form-control';
import { nativeInputAdapter } from '@/fields/adapters';
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from './native-select-base';

/** Один пункт списка native select. Одинаковый `group` объединяется в `<optgroup>`. */
export interface NativeSelectOptionItem {
  value: string | number;
  label: string;
  group?: string;
}

/** Props враппера {@link NativeSelectWithOptions}: pure NativeSelect + декларативные `options`. */
export interface NativeSelectWithOptionsProps extends Omit<
  React.ComponentProps<typeof NativeSelect>,
  'children'
> {
  /** Опции списка. Строятся в `<option>` (сериализуемый источник для формы/DSL). */
  options?: NativeSelectOptionItem[];
  /** Подсказка-опция `value=""` в начале списка (пустой выбор → null через адаптер). */
  placeholder?: string;
}

/**
 * Строит `<option>` из декларативного `options` (в отличие от JSX-children pure NativeSelect):
 * form/renderer-json передают опции как сериализуемый `componentProps.options`. Опции с одинаковым
 * `group` объединяются в `<optgroup>` (порядок появления сохраняется).
 *
 * `data-testid`/`id`/`aria-*`/`value`/`onChange` уходят на `<select>` (Root примитива), НЕ на wrapper.
 */
function NativeSelectWithOptions({
  options = [],
  placeholder,
  ...props
}: NativeSelectWithOptionsProps) {
  const groups = new Map<string, NativeSelectOptionItem[]>();
  for (const opt of options) {
    const key = opt.group ?? '';
    const bucket = groups.get(key);
    if (bucket) bucket.push(opt);
    else groups.set(key, [opt]);
  }

  const renderOption = (opt: NativeSelectOptionItem) => (
    <NativeSelectOption key={String(opt.value)} value={String(opt.value)}>
      {opt.label}
    </NativeSelectOption>
  );

  return (
    <NativeSelect {...props}>
      {placeholder != null && <NativeSelectOption value="">{placeholder}</NativeSelectOption>}
      {[...groups.entries()].map(([group, opts]) =>
        group === '' ? (
          <React.Fragment key="__ungrouped">{opts.map(renderOption)}</React.Fragment>
        ) : (
          <NativeSelectOptGroup key={group} label={group}>
            {opts.map(renderOption)}
          </NativeSelectOptGroup>
        )
      )}
    </NativeSelect>
  );
}

NativeSelectWithOptions.displayName = 'NativeSelectWithOptions';

/**
 * Field-версия NativeSelect: `NativeSelectWithOptions` (options → `<option>`) + `nativeInputAdapter`
 * (`e.target.value || null`). Экспортируется как алиас `NativeSelectField`.
 */
export const NativeSelectBaseField = withFormControl(NativeSelectWithOptions, nativeInputAdapter);

export { NativeSelectWithOptions };
