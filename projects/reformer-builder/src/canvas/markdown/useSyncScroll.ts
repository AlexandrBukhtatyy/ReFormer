/**
 * Синхроскролл «редактор ⇄ предпросмотр» для режима «Рядом».
 *
 * Связка держится на якорях `data-line` в предпросмотре: позиция считается интерполяцией между
 * ними ({@link module:reformer-builder/canvas/markdown/scroll-sync}), поэтому строка кода и её
 * рендер не расходятся даже там, где высоты сильно разные (таблицы, картинки).
 *
 * Эхо гасится «лидер-локом»: сторона, которую прокрутил пользователь, на 150 мс становится
 * ведущей, и ответные события ведомой стороны игнорируются. Булева флага здесь мало —
 * инерционный скролл продолжает сыпать событиями и после программного сдвига.
 *
 * @module reformer-builder/canvas/markdown/useSyncScroll
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { editor } from 'monaco-editor/editor/editor.api';
import { collectAnchors, lineToOffset, offsetToLine, type SourceAnchor } from './scroll-sync';

/** Сколько миллисекунд сторона остаётся ведущей после своего скролла. */
const LEAD_MS = 150;

type Side = 'editor' | 'preview';

export interface SyncScroll {
  /** Передаётся в `CodeEditor.onMount` — без инстанса редактора подписаться не на что. */
  onEditorMount: (instance: editor.IStandaloneCodeEditor) => void;
  previewRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
}

/**
 * @param enabled — связка активна (режим «Рядом»); в остальных режимах подписки не создаются.
 * @param text — текст документа: его смена означает, что якоря надо собрать заново.
 */
export function useSyncScroll(enabled: boolean, text: string): SyncScroll {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const anchorsRef = useRef<SourceAnchor[]>([]);
  const leadRef = useRef<{ who: Side; until: number } | null>(null);
  // Инстанс редактора — через state: он приходит после монтирования, и эффект подписки должен
  // перезапуститься именно тогда.
  const [instance, setInstance] = useState<editor.IStandaloneCodeEditor | null>(null);

  const onEditorMount = useCallback((ed: editor.IStandaloneCodeEditor) => setInstance(ed), []);

  useEffect(() => {
    const preview = previewRef.current;
    if (!enabled || !instance || !preview) return;

    /** Захватить роль ведущего; `false` — сейчас ведёт другая сторона, событие игнорируем. */
    const claim = (who: Side): boolean => {
      const now = performance.now();
      const lead = leadRef.current;
      if (lead && lead.who !== who && now < lead.until) return false;
      leadRef.current = { who, until: now + LEAD_MS };
      return true;
    };

    const readAnchors = () => {
      anchorsRef.current = collectAnchors(preview, contentRef.current ?? undefined);
    };

    /** Верхняя видимая строка редактора с дробной частью — иначе следование идёт рывками по строкам. */
    const editorLine = (): number => {
      const first = instance.getVisibleRanges()[0]?.startLineNumber ?? 1;
      const top = instance.getTopForLineNumber(first);
      const bottom = instance.getBottomForLineNumber(first);
      const within = bottom > top ? (instance.getScrollTop() - top) / (bottom - top) : 0;
      return first + Math.min(1, Math.max(0, within));
    };

    let frame = 0;
    const schedule = (fn: () => void) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fn);
    };

    const fromEditor = () => {
      if (!claim('editor')) return;
      schedule(() => {
        preview.scrollTop = lineToOffset(anchorsRef.current, editorLine());
      });
    };

    const fromPreview = () => {
      if (!claim('preview')) return;
      schedule(() => {
        const line = offsetToLine(anchorsRef.current, preview.scrollTop);
        const whole = Math.max(1, Math.floor(line));
        const top = instance.getTopForLineNumber(whole);
        const bottom = instance.getBottomForLineNumber(whole);
        instance.setScrollTop(top + (line - whole) * (bottom - top));
      });
    };

    readAnchors();
    // При входе в режим «Рядом» подтягиваем предпросмотр к тому, что видно в редакторе.
    preview.scrollTop = lineToOffset(anchorsRef.current, editorLine());

    const editorScroll = instance.onDidScrollChange(fromEditor);
    preview.addEventListener('scroll', fromPreview, { passive: true });
    // Высота содержимого меняется от дозагрузки картинок и подмены подсвеченных блоков — якоря
    // после этого другие.
    const resize = new ResizeObserver(readAnchors);
    if (contentRef.current) resize.observe(contentRef.current);

    return () => {
      cancelAnimationFrame(frame);
      editorScroll.dispose();
      preview.removeEventListener('scroll', fromPreview);
      resize.disconnect();
    };
  }, [enabled, instance, text]);

  return { onEditorMount, previewRef, contentRef };
}
