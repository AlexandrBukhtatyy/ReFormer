/**
 * Тяжёлая Monaco-часть code-редактора (произвольный файл) — грузится ЛЕНИВО (`React.lazy` в
 * {@link CodeArea}), поэтому monaco + грамматики попадают в отдельный чанк вне стартового бандла.
 * Только виджет; логика вкладки (draft/сохранение) — в обёртке `CodeArea`.
 *
 * @module reformer-builder/canvas/CodeEditor
 */

import Editor, { type OnMount } from '@monaco-editor/react';
import type { Theme } from '../store';
import './monaco-setup';
import './monaco-languages';

export default function CodeEditor({
  value,
  language,
  theme,
  onChange,
  onMount,
}: {
  value: string;
  language: string;
  theme: Theme;
  onChange: (value: string) => void;
  /**
   * Доступ к инстансу редактора: нужен тем, кто подписывается на его скролл или регистрирует
   * собственные команды (markdown-режимы — см. {@link CodeArea}).
   */
  onMount?: OnMount;
}) {
  return (
    <Editor
      height="100%"
      language={language}
      theme={theme === 'dark' ? 'vs-dark' : 'light'}
      value={value}
      onChange={(v) => onChange(v ?? '')}
      onMount={onMount}
      options={{
        minimap: { enabled: false },
        fontSize: 12,
        lineNumbers: 'on',
        folding: true,
        scrollBeyondLastLine: false,
        tabSize: 2,
        wordWrap: 'off',
        automaticLayout: true,
        renderLineHighlight: 'line',
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        padding: { top: 8, bottom: 8 },
      }}
    />
  );
}
