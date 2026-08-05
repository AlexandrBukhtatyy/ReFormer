/**
 * Тело редактора одной секции мок-данных (без заголовка/вкладки — chrome в {@link BottomPanel}).
 * Monaco-редактор JSON: `model` (вкладка «Модель») либо `dataSources` (вкладка «Registry») —
 * ими наполняется форма в runtime/live-превью. Стартует с синтеза из схемы ({@link synthMock});
 * валидные правки debounce-коммитятся в `tab.mock[section]`. Сброс — через remount по `key`
 * из {@link BottomPanel} (после `resetMock` стартовый текст снова = синтез).
 *
 * @module reformer-builder/canvas/MockDataEditor
 */

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { MockSection, TabState } from '../store';
import { editorActions, useUi } from '../store';
import { synthMock } from '../preview-runtime';
import { serializeSection } from './mock-data';

const RawJsonEditor = lazy(() => import('./RawJsonEditor'));

export function MockDataEditor({ tab, section }: { tab: TabState; section: MockSection }) {
  const { theme } = useUi();
  const synthDoc = useMemo(
    () => serializeSection(synthMock(tab.schema), section),
    [tab.schema, section]
  );
  const text = tab.mock?.[section];
  const [draft, setDraft] = useState(text ?? synthDoc);
  const focusedRef = useRef(false);

  // Синхронизация с внешним источником (смена схемы / сброс) — во время рендера, а не в эффекте
  // (react-hooks/set-state-in-effect). Трек прошлых значений; при их смене и вне фокуса пересеиваем.
  const [synced, setSynced] = useState<{ text: string | undefined; synthDoc: string }>({
    text,
    synthDoc,
  });
  if (!focusedRef.current && (synced.text !== text || synced.synthDoc !== synthDoc)) {
    setSynced({ text, synthDoc });
    setDraft(text ?? synthDoc);
  }

  // Debounce-коммит валидного JSON в стор (ошибки Monaco подсветит сам).
  useEffect(() => {
    if (!focusedRef.current) return;
    const t = setTimeout(() => {
      try {
        JSON.parse(draft);
        editorActions.setMockText(tab.id, section, draft);
      } catch {
        /* невалидный JSON — не коммитим */
      }
    }, 500);
    return () => clearTimeout(t);
  }, [draft, tab.id, section]);

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
