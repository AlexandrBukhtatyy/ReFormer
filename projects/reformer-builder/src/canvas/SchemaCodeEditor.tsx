/**
 * Редактор схемы формы как JSON-кода (Monaco). Инкапсулирует двусторонний биндинг:
 * draft-текст ⇄ `JsonFormSchema` (debounce-парс валидного → `replaceSchema`; внешние правки
 * обновляют текст, только когда пользователь не редактирует; blur — реформат к канону).
 * Переиспользуется нижней raw-панелью ({@link RawJson}) и центральным режимом «Код»
 * ({@link module:reformer-builder/canvas/CanvasArea}). Тяжёлый Monaco ({@link RawJsonEditor})
 * грузится ЛЕНИВО (`React.lazy`) — вне стартового бандла.
 *
 * @module reformer-builder/canvas/SchemaCodeEditor
 */

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { isFormSchema } from '../model';
import { editorActions, useUi } from '../store';
import { serializeSchema } from '../io/export';

const RawJsonEditor = lazy(() => import('./RawJsonEditor'));

export function SchemaCodeEditor({ schema }: { schema: JsonFormSchema }) {
  const { theme, revealLine, revealNonce } = useUi();
  const [draft, setDraft] = useState(() => serializeSchema(schema));
  const focusedRef = useRef(false);
  const schemaRef = useRef(schema);
  schemaRef.current = schema;

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

  return (
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
  );
}
