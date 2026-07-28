/**
 * Редактор Options-пропа (Select/Combobox/NativeSelect/RadioGroup/ToggleGroup): раньше был
 * read-only. Теперь — выбор источника опций: инлайн-массив `{ value, label }` (мини-редактор строк)
 * либо привязка к именованному `$dataSource(NAME)`. Новый источник создаётся В МОК-ФАЙЛЕ
 * (вкладка «Модель»): спрашиваем имя → добавляем в `tab.mockText.dataSources` → привязываем →
 * открываем «Модель» для правки опций.
 *
 * @module reformer-builder/panels/OptionsField
 */

import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Input } from '@reformer/ui-kit';
import { parseOperator, type JsonNode } from '@reformer/renderer-json';
import { setComponentProp, type JsonPath } from '../model';
import type { InspectorProp } from '../catalog';
import { editorActions, useActiveTab, useUi } from '../store';
import { mockOptions } from '../preview-runtime';
import { effectiveMock, serializeMock } from '../canvas/mock-data';
import { cn } from '../lib/cn';

/** Инлайн-опция селекта. */
interface OptionItem {
  value: string | number;
  label: string;
  group?: string;
}

const SELECT_CLS =
  'h-[26px] min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-ring';

export function OptionsField({
  node,
  path,
  prop,
}: {
  node: JsonNode;
  path: JsonPath;
  prop: InspectorProp;
}) {
  const tab = useActiveTab();
  const { rawJsonOpen } = useUi();

  const props = (node as { componentProps?: Record<string, unknown> }).componentProps ?? {};
  const value = props[prop.key];
  const bound = parseOperator(value);
  const boundName = bound?.op === 'dataSource' ? bound.arg : null;
  const inline = Array.isArray(value) ? (value as OptionItem[]) : null;

  // Доступные для привязки источники: из мок-файла (option/scalar) + уже привязанный (на всякий).
  const sourceNames = useMemo(() => {
    const names = new Set<string>(
      tab ? Object.keys(effectiveMock(tab.schema, tab.mockText).dataSources) : []
    );
    if (boundName) names.add(boundName);
    return [...names].sort();
  }, [tab, boundName]);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const setValue = (v: unknown) =>
    editorActions.apply((s) => setComponentProp(s, path, prop.key, v), {
      coalesceKey: `${prop.key}@${path.join('.')}`,
    });
  const bindTo = (name: string) => setValue(`$dataSource(${name})`);

  const openModel = () => {
    editorActions.setBottomTab('model');
    if (!rawJsonOpen) editorActions.toggleRawJson();
  };

  const createSource = () => {
    const name = newName.trim();
    if (!name || !tab) return;
    const mock = effectiveMock(tab.schema, tab.mockText);
    if (!(name in mock.dataSources)) {
      mock.dataSources = { ...mock.dataSources, [name]: mockOptions(name) };
      editorActions.setMockText(tab.id, serializeMock(mock));
    }
    bindTo(name);
    setCreating(false);
    setNewName('');
    openModel();
  };

  const onSelect = (v: string) => {
    if (v === '__inline__') {
      setCreating(false);
      setValue(inline ?? []); // переключиться на инлайн (сохранив текущие, если были)
    } else if (v === '__new__') {
      setCreating(true);
    } else {
      setCreating(false);
      bindTo(v);
    }
  };

  const mode = creating ? '__new__' : (boundName ?? '__inline__');

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-6 items-center gap-1.5">
        <span className="flex-none text-xs" title={prop.description}>
          {prop.label}
        </span>
        {boundName && !creating && (
          <button
            onClick={openModel}
            title={`Опции источника «${boundName}» — во вкладке «Модель»`}
            className="flex-none rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" />
          </button>
        )}
        <select value={mode} onChange={(e) => onSelect(e.target.value)} className={SELECT_CLS}>
          <option value="__inline__">Инлайн-опции</option>
          {sourceNames.map((n) => (
            <option key={n} value={n}>
              $dataSource({n})
            </option>
          ))}
          <option value="__new__">＋ Новый источник…</option>
        </select>
      </div>

      {creating && (
        <div className="flex items-center gap-1.5">
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') createSource();
              if (e.key === 'Escape') {
                setCreating(false);
                setNewName('');
              }
            }}
            placeholder="ИМЯ_ИСТОЧНИКА"
            className="h-[26px] flex-1 bg-background text-xs"
          />
          <button
            onClick={createSource}
            disabled={!newName.trim()}
            className="flex-none rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground disabled:opacity-50"
          >
            Создать
          </button>
          <button
            onClick={() => {
              setCreating(false);
              setNewName('');
            }}
            className="flex-none rounded-md px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-muted"
          >
            ✕
          </button>
        </div>
      )}

      {!boundName && !creating && <InlineOptions value={inline ?? []} onChange={setValue} />}
    </div>
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
            className={cn(
              'flex-none rounded px-1 py-0.5 text-[11px] text-muted-foreground hover:bg-muted'
            )}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="self-start text-[11px] text-muted-foreground hover:text-foreground"
      >
        ＋ Опция
      </button>
    </div>
  );
}
