/**
 * Центральная область для code-вкладки (произвольный файл, спека §7): на всю рабочую область —
 * полноэкранный Monaco-редактор с шапкой (имя файла, точка dirty, язык). Правки идут в стор
 * (`setTabText`), сохранение — ⌘S (обработчик в EditorLayout → `saveCodeTab`, прямая запись в файл).
 * Тяжёлый Monaco ({@link CodeEditor}) грузится ЛЕНИВО.
 *
 * @module reformer-builder/canvas/CodeArea
 */

import { lazy, Suspense } from 'react';
import type { TabState } from '../store';
import { editorActions, isDirty, useUi } from '../store';

const CodeEditor = lazy(() => import('./CodeEditor'));

export function CodeArea({ tab }: { tab: TabState }) {
  const { theme } = useUi();
  const dirty = isDirty(tab);

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-background">
      <div className="flex h-[30px] flex-none items-center gap-2 border-b border-border px-3 text-[11.5px] text-muted-foreground">
        <span className="truncate font-mono">{tab.source.name}</span>
        {dirty && <span className="h-1.5 w-1.5 flex-none rounded-full bg-amber-500" />}
        <span className="flex-1" />
        <span className="flex-none">{tab.language ?? 'plaintext'} · Monaco</span>
      </div>
      <div className="min-h-0 flex-1">
        <Suspense
          fallback={
            <div className="grid h-full place-items-center text-xs text-muted-foreground">
              Загрузка редактора…
            </div>
          }
        >
          <CodeEditor
            value={tab.text ?? ''}
            language={tab.language ?? 'plaintext'}
            theme={theme}
            onChange={(v) => editorActions.setTabText(tab.id, v)}
          />
        </Suspense>
      </div>
    </div>
  );
}
