import * as React from 'react';

import { defineFieldControl } from '@/fields/field-control';
import { nativeInputAdapter } from '@/fields/adapters';
import { withFieldTooltip, INSIDE_NATIVE_SELECT } from '@/fields/field-tooltip';
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from './native-select-base';

/** Один пункт списка native select. Одинаковый `group` объединяется в `<optgroup>`. */
export interface NativeSelectOptionItem {
  value: string | number;
  label: string;
  group?: string;
}

/** Props {@link NativeSelectWithOptions}: pure NativeSelect + декларативные `options`. */
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
function NativeSelectWithOptionsBase({
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

/**
 * Нативный select из декларативных `options` — компонент для формы (`component:
 * NativeSelectWithOptions`, registry `NativeSelect`): `e.target.value || null` через
 * {@link nativeInputAdapter} (статика) + проп `tooltip`.
 */
const NativeSelectWithOptions = defineFieldControl(
  withFieldTooltip(NativeSelectWithOptionsBase, INSIDE_NATIVE_SELECT),
  { adapter: nativeInputAdapter }
);
NativeSelectWithOptions.displayName = 'NativeSelectWithOptions';

export { NativeSelectWithOptions };
