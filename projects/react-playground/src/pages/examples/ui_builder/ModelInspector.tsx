/**
 * Инспектор модели: что форма насчитала и чем это поправить.
 *
 * Ровно та панель, что живёт в билдере (`plugins/preview/ui/ModelPanel`), но без его оболочки:
 * читает и пишет через `@builder-src/lib/form-inspect`, то есть той же цепочкой
 * `путь → signalAt → getNodeForSignal → узел`. Правка идёт ТЕМ ЖЕ вызовом, каким пишет
 * контрол, поэтому `compute` пересчитывается сам — это и есть главное, что демо показывает.
 *
 * @module pages/examples/ui_builder/ModelInspector
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  collectRows,
  readNodeState,
  resetNode,
  setNodeDisabled,
  snapshot,
  writeValue,
  type ModelRow,
  type NodeState,
} from '@builder-src/lib/form-inspect';

/** Модель как источник подписки: `model.$` — сигнал значений целиком. */
interface ObservableModel {
  readonly $?: { subscribe?(cb: (value: unknown) => void): () => void };
}

/**
 * Счётчик изменений модели.
 *
 * Подписка на корневой сигнал, а не на каждый путь: путей десятки, и заводить подписки пришлось
 * бы заново на каждую пересборку. Цена — перерисовка на каждое нажатие клавиши в форме.
 */
function useModelVersion(model: unknown): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const root = (model as ObservableModel | null)?.$;
    if (typeof root?.subscribe !== 'function') return;
    const off = root.subscribe(() => setVersion((value) => value + 1));
    return () => {
      off();
    };
  }, [model]);
  return version;
}

function Badges({ state }: { state: NodeState | null }): ReactNode {
  if (state === null) return null;
  const chips: { text: string; tone: string }[] = [];
  if (state.derived) chips.push({ text: 'compute', tone: 'bg-violet-100 text-violet-700' });
  if (state.disabled) chips.push({ text: 'disabled', tone: 'bg-gray-200 text-gray-600' });
  if (state.touched) chips.push({ text: 'touched', tone: 'bg-blue-100 text-blue-700' });
  for (const error of state.errors) {
    chips.push({ text: error, tone: 'bg-red-100 text-red-700' });
  }
  return (
    <span className="flex flex-wrap gap-1">
      {chips.map((chip) => (
        <span key={chip.text} className={`rounded px-1.5 py-0.5 text-[10px] ${chip.tone}`}>
          {chip.text}
        </span>
      ))}
    </span>
  );
}

/** Редактор значения по его ТИПУ: узла схемы у инспектора нет, а тип значения есть всегда. */
function ValueEditor({
  row,
  state,
  onWrite,
}: {
  row: ModelRow;
  state: NodeState | null;
  onWrite: (value: unknown) => void;
}): ReactNode {
  const locked = state?.derived === true;
  const common = 'w-full rounded border px-1.5 py-0.5 text-xs disabled:bg-gray-100';

  if (typeof row.value === 'boolean') {
    return (
      <input
        type="checkbox"
        data-testid={`inspect-${row.path}`}
        checked={row.value}
        disabled={locked}
        onChange={(event) => onWrite(event.currentTarget.checked)}
      />
    );
  }
  if (typeof row.value === 'number') {
    return (
      <input
        type="number"
        data-testid={`inspect-${row.path}`}
        className={common}
        disabled={locked}
        defaultValue={String(row.value)}
        key={`${row.path}:${String(row.value)}`}
        onBlur={(event) => {
          const text = event.currentTarget.value;
          // Пустая строка — это `null`, а не `NaN`: «поле очистили» и «в поле мусор» —
          // разные состояния, и первое встречается на порядок чаще.
          onWrite(text === '' ? null : Number(text));
        }}
      />
    );
  }
  if (row.kind === 'leaf') {
    return (
      <input
        data-testid={`inspect-${row.path}`}
        className={common}
        disabled={locked}
        defaultValue={row.value === null ? '' : String(row.value)}
        key={`${row.path}:${String(row.value)}`}
        onBlur={(event) => onWrite(event.currentTarget.value)}
      />
    );
  }
  // Массив правится JSON'ом целиком — это же покрывает добавление и удаление элементов.
  return (
    <input
      data-testid={`inspect-${row.path}`}
      className={`${common} font-mono`}
      disabled={locked || row.kind === 'group'}
      defaultValue={JSON.stringify(row.value)}
      key={`${row.path}:${JSON.stringify(row.value)}`}
      onBlur={(event) => {
        try {
          onWrite(JSON.parse(event.currentTarget.value));
        } catch {
          // Битый JSON — не повод писать мусор в модель.
        }
      }}
    />
  );
}

export interface ModelInspectorProps {
  readonly model: unknown;
}

export function ModelInspector({ model }: ModelInspectorProps): ReactNode {
  const [raw, setRaw] = useState(false);
  const version = useModelVersion(model);

  const rows = useMemo(() => {
    void version;
    return model === null ? [] : collectRows(snapshot(model));
  }, [model, version]);

  if (model === null) {
    return <p className="p-3 text-xs text-gray-500">Формы нет: соберётся — покажем значения.</p>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2 text-xs">
        <label className="flex items-center gap-1" title="без события изменения и без touched">
          <input
            type="checkbox"
            data-testid="inspect-raw"
            checked={raw}
            onChange={(event) => setRaw(event.currentTarget.checked)}
          />
          Сырая запись
        </label>
        <span className="text-gray-500">подать то, чего интерфейс не даст ввести</span>
        <button
          type="button"
          data-testid="inspect-copy"
          className="ml-auto rounded border px-2 py-0.5 hover:bg-gray-50"
          onClick={() => {
            void navigator.clipboard?.writeText(JSON.stringify(snapshot(model), null, 2));
          }}
        >
          Копировать модель
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-xs">
          <tbody>
            {rows.map((row) => {
              const state = readNodeState(model, row.path);
              return (
                <tr key={row.path} className="border-b last:border-0">
                  <td
                    className="py-1 pr-2 font-mono text-gray-700"
                    style={{ paddingLeft: 8 + row.depth * 12 }}
                  >
                    {row.path}
                  </td>
                  <td className="w-40 py-1 pr-2">
                    {row.kind === 'group' ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <ValueEditor
                        row={row}
                        state={state}
                        onWrite={(value) => writeValue(model, row.path, value, { raw })}
                      />
                    )}
                  </td>
                  <td className="py-1 pr-2">
                    <Badges state={state} />
                  </td>
                  <td className="w-24 py-1 pr-2 text-right whitespace-nowrap">
                    {state === null ? null : (
                      <>
                        <button
                          type="button"
                          className="rounded px-1 text-[10px] text-blue-600 hover:underline"
                          onClick={() => resetNode(model, row.path)}
                        >
                          сброс
                        </button>
                        <button
                          type="button"
                          className="rounded px-1 text-[10px] text-blue-600 hover:underline"
                          onClick={() => setNodeDisabled(model, row.path, !state.disabled)}
                        >
                          {state.disabled ? 'включить' : 'выключить'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
