/**
 * Нижняя панель raw-JSON (спека §8: split-view «визуальный ⇄ raw-JSON», двусторонний). Лёгкая
 * обёртка: сворачиваемый заголовок + сам редактор схемы ({@link SchemaCodeEditor}, где живёт
 * вся логика draft/парс/коммит). Тот же редактор используется центральным режимом «Код».
 *
 * @module reformer-builder/canvas/RawJson
 */

import { useMemo } from 'react';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { editorActions, useUi } from '../store';
import { serializeSchema } from '../io/export';
import { SchemaCodeEditor } from './SchemaCodeEditor';

export function RawJson({ schema, name }: { schema: JsonFormSchema; name: string }) {
  const { rawJsonOpen } = useUi();
  const lines = useMemo(() => serializeSchema(schema).split('\n').length, [schema]);

  // Открыт — блок заполняет вертикальную resizable-панель (header + flex-1 редактор); свёрнут —
  // это тонкая полоса-заголовок снизу центральной колонки (граница сверху рисуется здесь).
  return (
    <div
      className={
        rawJsonOpen
          ? 'flex min-h-0 flex-1 flex-col bg-sidebar'
          : 'flex-none border-t border-border bg-sidebar'
      }
    >
      <button
        onClick={editorActions.toggleRawJson}
        className="flex h-[30px] w-full flex-none items-center gap-2 px-3 text-[11.5px] text-muted-foreground hover:bg-muted"
      >
        <span className="w-2.5 flex-none text-center">{rawJsonOpen ? '▾' : '▸'}</span>
        <span className="truncate font-mono">{name}</span>
        <span className="flex-none">· raw · Monaco</span>
        <span className="flex-1" />
        <span className="flex-none">{lines} строк</span>
      </button>
      {rawJsonOpen && (
        <div className="min-h-0 flex-1 border-t border-border">
          <SchemaCodeEditor schema={schema} />
        </div>
      )}
    </div>
  );
}
