/**
 * Нижняя панель со вкладками: **JSON** (raw-исходник схемы, двусторонний — {@link SchemaCodeEditor}),
 * **Модель** (значения модели формы) и **Registry** (значения `$dataSource` реестра) — обе последние
 * наполняют runtime/live-превью и правятся в {@link MockDataEditor}. Сворачивается общим флагом
 * `rawJsonOpen`. Клик по вкладке разворачивает панель. Для «Модель»/«Registry» — кнопка «Сбросить»
 * (к синтезу из схемы; сбрасывается только активная секция).
 *
 * @module reformer-builder/canvas/BottomPanel
 */

import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { BottomTab, MockSection, TabState } from '../store';
import { editorActions, useUi } from '../store';
import { serializeSchema } from '../io/export';
import { synthMock } from '../preview-runtime';
import { SchemaCodeEditor } from './SchemaCodeEditor';
import { MockDataEditor } from './MockDataEditor';
import { serializeSection } from './mock-data';
import { cn } from '../lib/cn';

/** Секция мок-данных, которую правит вкладка (у `raw` секции нет). */
const SECTION: Record<BottomTab, MockSection | null> = {
  raw: null,
  model: 'model',
  registry: 'dataSources',
};

export function BottomPanel({ tab }: { tab: TabState }) {
  const { rawJsonOpen, bottomTab: active } = useUi();
  const [resetKey, setResetKey] = useState(0);
  const section = SECTION[active];

  // Число строк активной вкладки (для правого счётчика в заголовке).
  const lines = useMemo(() => {
    const text =
      section == null
        ? serializeSchema(tab.schema)
        : (tab.mock?.[section] ?? serializeSection(synthMock(tab.schema), section));
    return text.split('\n').length;
  }, [section, tab.schema, tab.mock]);

  // Клик по вкладке переключает (в сторе — переживает remount при разворачивании) и разворачивает.
  const select = (t: BottomTab) => {
    editorActions.setBottomTab(t);
    if (!rawJsonOpen) editorActions.toggleRawJson();
  };
  const onReset = () => {
    if (section == null) return;
    editorActions.resetMock(tab.id, section);
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
        <button
          onClick={() => select('model')}
          title="Значения модели формы в превью"
          className={tabCls('model')}
        >
          Модель
        </button>
        <button
          onClick={() => select('registry')}
          title="Значения источников $dataSource в превью"
          className={tabCls('registry')}
        >
          Registry
        </button>
        <span className="flex-1" />
        {section != null && rawJsonOpen && (
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
          {section == null ? (
            <SchemaCodeEditor schema={tab.schema} />
          ) : (
            <MockDataEditor key={`${section}:${resetKey}`} tab={tab} section={section} />
          )}
        </div>
      )}
    </div>
  );
}
