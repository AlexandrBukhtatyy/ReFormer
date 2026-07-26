/**
 * Тяжёлая Monaco-часть raw-JSON — грузится ЛЕНИВО (`React.lazy` в `RawJson`), поэтому monaco и
 * `monaco-setup` попадают в отдельный чанк вне стартового бандла. Только виджет редактора; вся
 * логика (draft/парс/коммит) — в лёгкой обёртке `RawJson`.
 *
 * @module reformer-builder/canvas/RawJsonEditor
 */

import Editor, { type OnMount } from '@monaco-editor/react';
import type { Theme } from '../store';
import './monaco-setup';

export default function RawJsonEditor({
  value,
  theme,
  onChange,
  onFocusChange,
}: {
  value: string;
  theme: Theme;
  onChange: (value: string) => void;
  onFocusChange: (focused: boolean) => void;
}) {
  const onMount: OnMount = (editor) => {
    editor.onDidFocusEditorText(() => onFocusChange(true));
    editor.onDidBlurEditorText(() => onFocusChange(false));
  };

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
