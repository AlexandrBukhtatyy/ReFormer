/**
 * Центральная область для code-вкладки (произвольный файл, спека §7): полноэкранный Monaco-редактор.
 * Имя файла и точка dirty не дублируются здесь — они уже во вкладке
 * ({@link module:reformer-builder/canvas/TabBar}). Правки идут в стор (`setTabText`), сохранение —
 * ⌘S (обработчик в EditorLayout → `saveCodeTab`, прямая запись в файл).
 *
 * У markdown-файлов сверху появляется полоса режимов (Код / Предпросмотр / Рядом), и рабочая
 * область показывает редактор, рендер либо оба со связанным скроллом. Прочие файлы выглядят как
 * раньше — только редактор. Тяжёлые части ({@link CodeEditor}, {@link MarkdownPreview}) грузятся
 * ЛЕНИВО.
 *
 * @module reformer-builder/canvas/CodeArea
 */

import { lazy, Suspense } from 'react';
import { useDefaultLayout } from 'react-resizable-panels';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@reformer/ui-kit/resizable';
import type { TabState } from '../store';
import { editorActions, useUi } from '../store';
import { MarkdownToolbar } from './MarkdownToolbar';
import { isMarkdownTab } from './markdown/is-markdown';
import { useSyncScroll } from './markdown/useSyncScroll';
import { applyMarkdownView, cycleMarkdownView } from './markdown/view-pref';

const CodeEditor = lazy(() => import('./CodeEditor'));
const MarkdownPreview = lazy(() => import('./MarkdownPreview'));

function Loading({ label }: { label: string }) {
  return (
    <div className="grid h-full place-items-center text-xs text-muted-foreground">{label}</div>
  );
}

export function CodeArea({ tab }: { tab: TabState }) {
  const { theme } = useUi();
  const markdown = isMarkdownTab(tab);
  const view = markdown ? (tab.mdView ?? 'code') : 'code';
  const text = tab.text ?? '';

  // Ширины «Рядом» переживают перезагрузку (в react-resizable-panels v4 число = пиксели).
  const layout = useDefaultLayout({
    id: 'rb.layout.md',
    storage: localStorage,
    panelIds: ['md-code', 'md-preview'],
  });

  const sync = useSyncScroll(markdown && view === 'split', text);

  const editor = (
    <Suspense fallback={<Loading label="Загрузка редактора…" />}>
      <CodeEditor
        value={text}
        language={tab.language ?? 'plaintext'}
        theme={theme}
        onChange={(v) => editorActions.setTabText(tab.id, v)}
        onMount={(instance, monaco) => {
          // Хоткеи регистрируем в самом Monaco: его keybinding-service гасит их до
          // window-обработчика в EditorLayout, поэтому из редактора они иначе не работают.
          // ⇧⌘K у Monaco по умолчанию — deleteLines, поэтому перехват обязателен, а не желателен.
          instance.addCommand(
            monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyK,
            () => editorActions.toggleRightPanelTo('agent')
          );
          if (!markdown) return;
          sync.onEditorMount(instance);
          instance.addCommand(
            monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyV,
            () => cycleMarkdownView(1)
          );
          instance.addCommand(
            monaco.KeyMod.chord(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, monaco.KeyCode.KeyV),
            () => applyMarkdownView(tab.id, 'split')
          );
        }}
      />
    </Suspense>
  );

  const preview = (
    <Suspense fallback={<Loading label="Загрузка предпросмотра…" />}>
      <MarkdownPreview
        text={text}
        docPath={tab.source.path}
        dark={theme === 'dark'}
        containerRef={sync.previewRef}
        contentRef={sync.contentRef}
      />
    </Suspense>
  );

  return (
    // min-h-0 + overflow-hidden обязательны: без них flex-колонка растягивается по высоте
    // предпросмотра (у него, в отличие от Monaco, естественная высота — весь документ), и
    // скроллиться начинает вся оболочка, а не область предпросмотра.
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      {markdown && <MarkdownToolbar tab={tab} />}
      <div className="min-h-0 flex-1">
        {view === 'code' && editor}
        {view === 'preview' && preview}
        {view === 'split' && (
          <ResizablePanelGroup
            orientation="horizontal"
            className="min-h-0 flex-1"
            defaultLayout={layout.defaultLayout}
            onLayoutChanged={layout.onLayoutChanged}
          >
            <ResizablePanel
              id="md-code"
              minSize={240}
              className="flex min-h-0 flex-col overflow-hidden"
            >
              {editor}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel
              id="md-preview"
              minSize={240}
              className="flex min-h-0 flex-col overflow-hidden"
            >
              {preview}
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
    </div>
  );
}
