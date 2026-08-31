/**
 * Редактор Options-пропа (Select/Combobox/NativeSelect/RadioGroup/ToggleGroup): раньше был
 * read-only. Теперь — выбор источника опций: инлайн-массив `{ value, label }` (мини-редактор строк)
 * либо привязка к именованному `$dataSource(NAME)`. Выбор источника и создание нового живут в
 * общем {@link DataSourceBinding}; здесь остаётся только инлайн-редактор плоского списка.
 *
 * @module reformer-builder/panels/OptionsField
 */

import { Plus, X } from 'lucide-react';
import { Input } from '@reformer/ui-kit';
import { type JsonNode } from '@reformer/renderer-json';
import type { JsonPath } from '../model';
import type { InspectorProp } from '../catalog';
import { mockOptions } from '../preview-runtime';
import { cn } from '../lib/cn';
import { DataSourceBinding } from './DataSourceBinding';

/** Инлайн-опция селекта. */
interface OptionItem {
  value: string | number;
  label: string;
  group?: string;
}

export function OptionsField({
  node,
  path,
  prop,
}: {
  node: JsonNode;
  path: JsonPath;
  prop: InspectorProp;
}) {
  return (
    <DataSourceBinding
      node={node}
      path={path}
      prop={prop}
      inlineLabel="Инлайн-опции"
      seed={mockOptions}
      renderInline={(value, onChange) => (
        <InlineOptions
          value={Array.isArray(value) ? (value as OptionItem[]) : []}
          onChange={onChange}
        />
      )}
    />
  );
}

/** Мини-редактор инлайн-опций `{ value, label }`. */
function InlineOptions({
  value,
  onChange,
}: {
  value: OptionItem[];
  onChange: (next: OptionItem[]) => void;
}) {
  const update = (i: number, patch: Partial<OptionItem>) =>
    onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const add = () =>
    onChange([
      ...value,
      { value: `option${value.length + 1}`, label: `Вариант ${value.length + 1}` },
    ]);
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));

  return (
    <div className="flex flex-col gap-1.5">
      {value.map((r, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input
            value={r.value == null ? '' : String(r.value)}
            onChange={(e) => update(i, { value: e.target.value })}
            placeholder="value"
            className="h-[24px] w-[64px] flex-none bg-background text-[11px]"
          />
          <Input
            value={r.label ?? ''}
            onChange={(e) => update(i, { label: e.target.value })}
            placeholder="label"
            className="h-[24px] min-w-0 flex-1 bg-background text-[11px]"
          />
          <button
            onClick={() => remove(i)}
            title="Удалить опцию"
            className={cn('flex-none rounded px-1 py-0.5 text-muted-foreground hover:bg-muted')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="inline-flex items-center gap-1 self-start text-[11px] text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-3 w-3" /> Опция
      </button>
    </div>
  );
}
