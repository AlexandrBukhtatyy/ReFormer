/**
 * Тело редактора мок-данных (без заголовка/вкладки — chrome в {@link BottomPanel}). Monaco-редактор
 * JSON `{ model, dataSources }`, которым наполняется форма в runtime/live-превью. Стартует с синтеза
 * из схемы ({@link synthMock}); валидные правки debounce-коммитятся в `tab.mockText`. Сброс — через
 * remount по `key` из {@link BottomPanel} (после `resetMock` стартовый текст снова = синтез).
 *
 * @module reformer-builder/canvas/MockDataEditor
 */

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { TabState } from '../store';
import { editorActions, useUi } from '../store';
import { synthMock } from '../preview-runtime';
import { serializeMock } from './mock-data';

const RawJsonEditor = lazy(() => import('./RawJsonEditor'));

export function MockDataEditor({ tab }: { tab: TabState }) {
  const { theme } = useUi();
  const synthDoc = useMemo(() => serializeMock(synthMock(tab.schema)), [tab.schema]);
  const [draft, setDraft] = useState(tab.mockText ?? synthDoc);
  const focusedRef = useRef(false);

  // Синхронизация с внешним источником (смена схемы / сброс) — во время рендера, а не в эффекте
  // (react-hooks/set-state-in-effect). Трек прошлых значений; при их смене и вне фокуса пересеиваем.
  const [synced, setSynced] = useState<{ mockText: string | undefined; synthDoc: string }>({
    mockText: tab.mockText,
    synthDoc,
  });
  if (!focusedRef.current && (synced.mockText !== tab.mockText || synced.synthDoc !== synthDoc)) {
    setSynced({ mockText: tab.mockText, synthDoc });
    setDraft(tab.mockText ?? synthDoc);
  }

  // Debounce-коммит валидного JSON в стор (ошибки Monaco подсветит сам).
  useEffect(() => {
    if (!focusedRef.current) return;
    const t = setTimeout(() => {
      try {
        JSON.parse(draft);
        editorActions.setMockText(tab.id, draft);
      } catch {
        /* невалидный JSON — не коммитим */
      }
    }, 500);
    return () => clearTimeout(t);
  }, [draft, tab.id]);

  const onFocusChange = (focused: boolean) => {
    focusedRef.current = focused;
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
      />
    </Suspense>
  );
}
