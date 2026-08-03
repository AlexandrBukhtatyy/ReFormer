/**
 * Тяжёлая Monaco-часть raw-JSON — грузится ЛЕНИВО (`React.lazy` в `RawJson`), поэтому monaco и
 * `monaco-setup` попадают в отдельный чанк вне стартового бандла. Только виджет редактора; вся
 * логика (draft/парс/коммит) — в лёгкой обёртке `RawJson`.
 *
 * @module reformer-builder/canvas/RawJsonEditor
 */

import { useEffect, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { Theme } from '../store';
import './monaco-setup';

// Типы инстанса редактора и API monaco — из сигнатуры OnMount, без прямого импорта monaco-типов.
type MonacoEditor = Parameters<OnMount>[0];
type MonacoApi = Parameters<OnMount>[1];

export default function RawJsonEditor({
  value,
  theme,
  onChange,
  onFocusChange,
  revealLine,
  revealNonce,
}: {
  value: string;
  theme: Theme;
  onChange: (value: string) => void;
  onFocusChange: (focused: boolean) => void;
  /** Строка (1-based) для перехода; `null` — активного запроса нет. */
  revealLine?: number | null;
  /** Счётчик запросов reveal — при изменении выполняем переход даже на ту же строку. */
  revealNonce?: number;
}) {
  const editorRef = useRef<MonacoEditor | null>(null);
  const monacoRef = useRef<MonacoApi | null>(null);
  const [ready, setReady] = useState(false);

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.onDidFocusEditorText(() => onFocusChange(true));
    editor.onDidBlurEditorText(() => onFocusChange(false));
    setReady(true);
  };

  // Reveal строки по запросу из стора (клик по пути ошибки в тосте). `ready` в зависимостях —
  // чтобы отработал и первый запрос, поставленный до монтирования редактора (панель открылась вместе с ним).
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!ready || !editor || !monaco || !revealLine) return;
    const model = editor.getModel();
    if (!model) return;
    const line = Math.min(Math.max(revealLine, 1), model.getLineCount());
    editor.revealLineInCenter(line);
    editor.setSelection(new monaco.Range(line, 1, line, model.getLineMaxColumn(line)));
    editor.focus();
  }, [revealNonce, ready, revealLine]);

  return (
    <Editor
      height="100%"
      language="json"
      theme={theme === 'dark' ? 'vs-dark' : 'light'}
      value={value}
      onChange={(v) => onChange(v ?? '')}
      onMount={onMount}
      options={{
        minimap: { enabled: false },
        fontSize: 11,
        lineNumbers: 'on',
        folding: true,
        scrollBeyondLastLine: false,
        tabSize: 2,
        wordWrap: 'off',
        automaticLayout: true,
        renderLineHighlight: 'line',
        overviewRulerLanes: 0,
        scrollbar: { verticalScrollbarSize: 9, horizontalScrollbarSize: 9 },
        padding: { top: 8, bottom: 8 },
      }}
    />
  );
}
