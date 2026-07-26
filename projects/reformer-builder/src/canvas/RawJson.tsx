/**
 * Нижняя панель raw-JSON (спека §8: split-view «визуальный ⇄ raw-JSON», двусторонний). Лёгкая
 * обёртка: заголовок + вся логика (draft, debounce-парс → коммит валидного `JsonFormSchema`,
 * синхронизация с внешними правами). Тяжёлый Monaco-редактор ({@link RawJsonEditor}) грузится
 * ЛЕНИВО (`React.lazy`) — вне стартового бандла, при открытии панели.
 *
 * @module reformer-builder/canvas/RawJson
 */

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { isFormSchema } from '../model';
import { editorActions, useUi } from '../store';
import { serializeSchema } from '../io/export';

const RawJsonEditor = lazy(() => import('./RawJsonEditor'));

export function RawJson({ schema, name }: { schema: JsonFormSchema; name: string }) {
  const { rawJsonOpen, theme, revealLine, revealNonce } = useUi();
  const [draft, setDraft] = useState(() => serializeSchema(schema));
  const focusedRef = useRef(false);
  const schemaRef = useRef(schema);
  schemaRef.current = schema;

  const lines = useMemo(() => draft.split('\n').length, [draft]);

  // Внешние правки обновляют текст, только если пользователь не редактирует.
  useEffect(() => {
    if (!focusedRef.current) setDraft(serializeSchema(schema));
  }, [schema]);

  // Debounce-парс во время редактирования: валидный JsonFormSchema → коммит (ошибки Monaco рисует сам).
  useEffect(() => {
    if (!focusedRef.current) return;
    const t = setTimeout(() => {
      try {
        const parsed: unknown = JSON.parse(draft);
        if (isFormSchema(parsed)) editorActions.replaceSchema(parsed);
      } catch {
        /* невалидный JSON — Monaco подсветит, не коммитим */
      }
    }, 500);
    return () => clearTimeout(t);
  }, [draft]);

  const onFocusChange = (focused: boolean) => {
    focusedRef.current = focused;
    if (!focused) setDraft(serializeSchema(schemaRef.current)); // реформат к канону на blur
  };

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
          <Suspense
            fallback={
              <div className="grid h-full place-items-center text-xs text-muted-foreground">
                Загрузка редактора…
              </div>
            }
          >
            <RawJsonEditor
              value={draft}
              theme={theme}
              onChange={setDraft}
              onFocusChange={onFocusChange}
              revealLine={revealLine}
              revealNonce={revealNonce}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
