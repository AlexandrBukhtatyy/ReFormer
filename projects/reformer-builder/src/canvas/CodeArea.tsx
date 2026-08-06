/**
 * Центральная область для code-вкладки (произвольный файл, спека §7): на всю рабочую область —
 * полноэкранный Monaco-редактор. Имя файла и точка dirty не дублируются здесь — они уже во вкладке
 * ({@link module:reformer-builder/canvas/TabBar}). Правки идут в стор
 * (`setTabText`), сохранение — ⌘S (обработчик в EditorLayout → `saveCodeTab`, прямая запись в файл).
 * Тяжёлый Monaco ({@link CodeEditor}) грузится ЛЕНИВО.
 *
 * @module reformer-builder/canvas/CodeArea
 */

import { lazy, Suspense } from 'react';
import type { TabState } from '../store';
import { editorActions, useUi } from '../store';

const CodeEditor = lazy(() => import('./CodeEditor'));

export function CodeArea({ tab }: { tab: TabState }) {
  const { theme } = useUi();

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-background">
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
