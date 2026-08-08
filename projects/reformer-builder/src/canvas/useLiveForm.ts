/**
 * Компиляция и пересборка схем формы для Renderer-превью.
 *
 * Хук владеет асинхронной частью (чтение каталога → транспиляция → исполнение) и публикует
 * результат в {@link module:reformer-builder/preview-runtime/live-state}, откуда его читают и превью,
 * и нижняя панель. Сам `live/`-слой грузится динамическим `import()`: пока тумблер выключен, ни
 * компилятор, ни его чанк в память не попадают.
 *
 * Пересборка — на смену identity схемы, на правку текста соседних `code`-вкладок (с задержкой) и по
 * явному запросу. Ввод в поля превью пересборку НЕ вызывает: он не меняет ни схему, ни исходники,
 * а пересоздание бандла обнулило бы введённые значения.
 *
 * @module reformer-builder/canvas/useLiveForm
 */

import { useEffect, useRef, useState } from 'react';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { editorStore, type TabState } from '../store';
import { splitPath } from '../io/fs-ops';
import { resetLiveState, setLiveState } from '../preview-runtime/live-state';
import type { LiveBundle } from '../preview-runtime/live';

/** Задержка пересборки после правки соседнего `.ts` в Monaco — чтобы не компилировать на каждый символ. */
const REBUILD_DEBOUNCE_MS = 400;

/** Подпись исходников каталога: меняется ⇒ пора пересобирать. */
function editorSignature(formPath: string | undefined): string {
  if (!formPath) return '';
  const dir = splitPath(formPath).dirPath;
  const parts: string[] = [];
  for (const tab of Object.values(editorStore.getState().tabs)) {
    const path = tab.source.path;
    if (tab.kind !== 'code' || typeof tab.text !== 'string' || !path) continue;
    if (splitPath(path).dirPath !== dir) continue;
    parts.push(`${path}:${tab.text.length}:${hash(tab.text)}`);
  }
  return parts.sort().join('|');
}

/** Дешёвый хэш строки (FNV-1a) — нужен только для сравнения «изменилось ли». */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface UseLiveFormArgs {
  tab: TabState;
  /** Схема с класс-токенами — та же, что уйдёт в рендерер. */
  annotated: JsonFormSchema;
  /** Значения `$dataSource` для базового реестра. */
  dataSources: Record<string, unknown>;
  /** Явные правки модели из панели «Засев» (иначе `undefined`). */
  modelOverride?: Record<string, unknown>;
  /** Тумблер «Схемы формы». */
  enabled: boolean;
}

/** Live-бандл для превью либо `null`, если схемы не исполняются. */
export function useLiveForm({
  tab,
  annotated,
  dataSources,
  modelOverride,
  enabled,
}: UseLiveFormArgs): LiveBundle | null {
  const [bundle, setBundle] = useState<LiveBundle | null>(null);
  // Счётчик ручных пересборок и подпись правок в Monaco — оба входят в зависимости эффекта.
  const [reloadNonce, setReloadNonce] = useState(0);
  const formPath = tab.source.kind === 'file' ? tab.source.path : undefined;
  const [signature, setSignature] = useState(() => editorSignature(formPath));
  const disposeRef = useRef<(() => void) | null>(null);

  // Правки соседних файлов в Monaco: следим за подписью, а не за каждым рендером стора.
  useEffect(() => {
    if (!enabled || !formPath) return;
    let timer = 0;
    const unsubscribe = editorStore.subscribe(() => {
      const next = editorSignature(formPath);
      window.clearTimeout(timer);
      timer = window.setTimeout(
        () => setSignature((prev) => (prev === next ? prev : next)),
        REBUILD_DEBOUNCE_MS
      );
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [enabled, formPath]);

  useEffect(() => {
    if (!enabled || !formPath) {
      setBundle(null);
      setLiveState({
        status: enabled ? 'unavailable' : 'off',
        bundle: null,
        errors: [],
        applied: [],
        files: [],
        fromEditor: [],
      });
      return;
    }

    let cancelled = false;
    setLiveState({
      status: 'loading',
      bundle: null,
      errors: [],
      applied: [],
      files: [],
      fromEditor: [],
    });

    void (async () => {
      try {
        const live = await import('../preview-runtime/live');
        const sources = await live.readFormSources(formPath);
        const compiled = await live.compileForm(sources);
        if (cancelled) return;

        const next = live.buildLivePreview({
          schema: annotated,
          compiled,
          dataSources,
          modelOverride,
        });
        // Реактивные стратегии валидации арминуются здесь и снимаются при следующей пересборке.
        disposeRef.current = next.validation?.start() ?? null;
        setBundle(next);
        setLiveState({
          status: 'ready',
          bundle: next,
          errors: next.errors,
          applied: next.applied,
          files: Object.keys(sources.files),
          fromEditor: sources.fromEditor,
        });
      } catch (e) {
        if (cancelled) return;
        setBundle(null);
        setLiveState({
          status: 'error',
          bundle: null,
          errors: [
            { file: '', phase: 'evaluate', message: e instanceof Error ? e.message : String(e) },
          ],
          applied: [],
          files: [],
          fromEditor: [],
        });
      }
    })();

    return () => {
      cancelled = true;
      disposeRef.current?.();
      disposeRef.current = null;
    };
  }, [enabled, formPath, annotated, dataSources, modelOverride, signature, reloadNonce]);

  // Размонтирование превью — состояние панели не должно «залипать» на прошлой форме.
  useEffect(() => resetLiveState, []);

  useEffect(() => {
    liveReload = () => setReloadNonce((n) => n + 1);
    return () => {
      liveReload = null;
    };
  }, []);

  return bundle;
}

/** Ссылка на «пересобрать» текущего превью — кнопка в панели действий живёт вне дерева хука. */
let liveReload: (() => void) | null = null;

/** Запросить пересборку схем (кнопка «Перезагрузить схемы»). */
export function reloadLiveForm(): void {
  liveReload?.();
}
