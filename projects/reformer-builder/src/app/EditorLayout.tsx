/**
 * Оболочка редактора (спека §8): левая полоса-рейл + панель (Файлы/Палитра), центр
 * (таб-бар + canvas + raw-JSON), правый инспектор + рейл. На `@reformer/ui-kit` (компоненты +
 * токены). При первом монтировании открывает демо-схему (Mode A).
 *
 * @module reformer-builder/app/EditorLayout
 */

import { useEffect } from 'react';
import { useDefaultLayout } from 'react-resizable-panels';
import { TooltipProvider } from '@reformer/ui-kit';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@reformer/ui-kit/resizable';
import { Toaster } from '@reformer/ui-kit/sonner';
import { activeTab, editorActions, editorStore, useActiveTab, useUi } from '../store';
import { saveDialogActions } from '../store/save-dialog';
import { CanvasArea } from '../canvas/CanvasArea';
import { TabBar } from '../canvas/TabBar';
import { SaveDialog } from '../canvas/SaveDialog';
import { FilesPanel } from '../panels/FilesPanel';
import { PalettePanel } from '../panels/PalettePanel';
import { Inspector } from '../panels/Inspector';
import { AppToolbar } from './AppToolbar';
import { seedSchema } from './seed-schema';
import { triggerSave } from './save-actions';
import { cn } from '../lib/cn';

const railTab =
  'rounded-md px-1.5 py-2.5 text-[11.5px] font-medium [writing-mode:vertical-rl] rotate-180 cursor-pointer';

export function EditorLayout() {
  const ui = useUi();
  const tab = useActiveTab();

  // Persistence ширин сайдбаров в localStorage. panelIds перечисляет ВСЕ возможные панели
  // (в т.ч. свёрнутые рейлом), чтобы размеры восстанавливались при повторном открытии.
  const hLayout = useDefaultLayout({
    id: 'rb.layout.h',
    storage: localStorage,
    panelIds: ['left', 'center', 'right'],
  });

  // seed демо-схемы (Mode A) при первом запуске
  useEffect(() => {
    if (!editorStore.getState().activeTabId) {
      const name = 'credit-application.form.json';
      editorActions.openTab(name, { kind: 'new', name }, seedSchema());
    }
  }, []);

  // тёмная тема — на documentElement (покрывает порталы tooltip/toast)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', ui.theme === 'dark');
  }, [ui.theme]);

  // Cmd/Ctrl+S — сохранить (Mode B) / экспорт (Mode A); Esc — закрыть diff-модалку (спека §7.3, §11)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const tab = activeTab(editorStore.getState());
        if (tab) void triggerSave(tab);
      } else if (e.key === 'Escape') {
        saveDialogActions.close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-background text-[13px] text-foreground">
        <AppToolbar />
        <div className="flex min-h-0 flex-1">
          {/* левый рейл */}
          <div className="flex w-[38px] flex-none flex-col items-center gap-1 border-r border-border bg-sidebar py-1.5">
            <button
              onClick={() => editorActions.setLeftPanel(ui.leftPanel === 'files' ? null : 'files')}
              className={cn(railTab, ui.leftPanel === 'files' ? 'bg-muted' : 'text-muted-foreground hover:bg-muted')}
            >
              Файлы
            </button>
            <button
              onClick={() => editorActions.setLeftPanel(ui.leftPanel === 'palette' ? null : 'palette')}
              className={cn(railTab, ui.leftPanel === 'palette' ? 'bg-muted' : 'text-muted-foreground hover:bg-muted')}
            >
              Палитра
            </button>
          </div>

          {/* resizable-ряд: левый сайдбар · центр · инспектор (рейлы — вне группы).
              Размеры в px (в react-resizable-panels v4 число = пиксели, строка = проценты). */}
          <ResizablePanelGroup
            orientation="horizontal"
            className="min-w-0 flex-1"
            defaultLayout={hLayout.defaultLayout}
            onLayoutChanged={hLayout.onLayoutChanged}
          >
            {/* левая панель */}
            {ui.leftPanel && (
              <>
                <ResizablePanel
                  id="left"
                  defaultSize={250}
                  minSize={180}
                  maxSize={520}
                  className="flex flex-col bg-sidebar"
                >
                  <div className="flex h-[34px] flex-none items-center border-b border-border px-3 text-[11.5px] font-semibold text-muted-foreground">
                    {ui.leftPanel === 'files' ? 'Файлы проекта' : 'Палитра компонентов'}
                  </div>
                  {ui.leftPanel === 'files' ? <FilesPanel /> : <PalettePanel />}
                </ResizablePanel>
                <ResizableHandle withHandle />
              </>
            )}

            {/* центр */}
            <ResizablePanel id="center" minSize={360} className="flex flex-col">
              <TabBar />
              {tab ? (
                <CanvasArea tab={tab} />
              ) : (
                <div className="grid flex-1 place-items-center text-muted-foreground">Нет открытой схемы</div>
              )}
            </ResizablePanel>

            {/* правый инспектор */}
            {ui.rightOpen && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel
                  id="right"
                  defaultSize={300}
                  minSize={220}
                  maxSize={640}
                  className="flex flex-col bg-sidebar"
                >
                  <div className="flex h-[34px] flex-none items-center border-b border-border px-3 text-[11.5px] font-semibold text-muted-foreground">
                    Свойства
                  </div>
                  <Inspector />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>

          {/* правый рейл */}
          <div className="flex w-[34px] flex-none flex-col items-center border-l border-border bg-sidebar pt-2">
            <button onClick={editorActions.toggleRight} className={cn(railTab, 'text-muted-foreground hover:bg-muted')}>
              Свойства
            </button>
          </div>
        </div>
      </div>
      <SaveDialog />
      <Toaster />
    </TooltipProvider>
  );
}
