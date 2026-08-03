/**
 * Нижняя панель со вкладками: **JSON** (raw-исходник схемы, двусторонний — {@link SchemaCodeEditor})
 * и **Модель** (мок-данные `{ model, dataSources }`, наполняющие runtime/live-превью —
 * {@link MockDataEditor}). Сворачивается общим флагом `rawJsonOpen`. Клик по вкладке разворачивает
 * панель. Для вкладки «Модель» — кнопка «Сбросить» (к синтезу из схемы).
 *
 * @module reformer-builder/canvas/BottomPanel
 */

import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { BottomTab, TabState } from '../store';
import { editorActions, useUi } from '../store';
import { serializeSchema } from '../io/export';
import { synthMock } from '../preview-runtime';
import { SchemaCodeEditor } from './SchemaCodeEditor';
import { MockDataEditor } from './MockDataEditor';
import { serializeMock } from './mock-data';
import { cn } from '../lib/cn';

export function BottomPanel({ tab }: { tab: TabState }) {
  const { rawJsonOpen, bottomTab: active } = useUi();
  const [resetKey, setResetKey] = useState(0);

  // Число строк активной вкладки (для правого счётчика в заголовке).
  const lines = useMemo(() => {
    const text =
      active === 'raw'
        ? serializeSchema(tab.schema)
        : (tab.mockText ?? serializeMock(synthMock(tab.schema)));
    return text.split('\n').length;
  }, [active, tab.schema, tab.mockText]);

  // Клик по вкладке переключает (в сторе — переживает remount при разворачивании) и разворачивает.
  const select = (t: BottomTab) => {
    editorActions.setBottomTab(t);
    if (!rawJsonOpen) editorActions.toggleRawJson();
  };
  const onReset = () => {
    editorActions.resetMock(tab.id);
    setResetKey((k) => k + 1); // remount редактора → стартовый текст снова из синтеза
  };

  const tabCls = (t: BottomTab) =>
    cn(
      'h-full rounded px-2.5 text-[11.5px]',
      active === t ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted'
    );

  return (
    <div
      className={
        rawJsonOpen
          ? 'flex min-h-0 flex-1 flex-col bg-sidebar'
          : 'flex-none border-t border-border bg-sidebar'
      }
    >
      <div className="flex h-[30px] w-full flex-none items-center gap-1 px-1.5 text-[11.5px] text-muted-foreground">
        <button
          onClick={editorActions.toggleRawJson}
          title={rawJsonOpen ? 'Свернуть' : 'Развернуть'}
          className="grid h-full w-5 flex-none place-items-center rounded hover:bg-muted"
        >
          <ChevronRight
            className={cn('h-3.5 w-3.5 transition-transform', rawJsonOpen && 'rotate-90')}
          />
        </button>
        <button onClick={() => select('raw')} className={tabCls('raw')}>
          JSON
        </button>
        <button onClick={() => select('model')} className={tabCls('model')}>
          Модель
        </button>
        <span className="flex-1" />
        {active === 'model' && rawJsonOpen && (
          <button
            onClick={onReset}
            title="Сбросить к синтезу из схемы"
            className="flex-none rounded px-2 py-0.5 hover:bg-muted hover:text-foreground"
          >
            Сбросить
          </button>
        )}
        <span className="flex-none pr-1.5">{lines} строк</span>
      </div>
      {rawJsonOpen && (
        <div className="min-h-0 flex-1 border-t border-border">
          {active === 'raw' ? (
            <SchemaCodeEditor schema={tab.schema} />
          ) : (
            <MockDataEditor key={resetKey} tab={tab} />
          )}
        </div>
      )}
    </div>
  );
}
