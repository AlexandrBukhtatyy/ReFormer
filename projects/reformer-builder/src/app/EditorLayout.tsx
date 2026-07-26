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
import type { NavDir } from '../model';
import { saveDialogActions } from '../store/save-dialog';
import { CanvasArea } from '../canvas/CanvasArea';
import { TabBar } from '../canvas/TabBar';
import { SaveDialog } from '../canvas/SaveDialog';
import { QuickAddDialog } from '../canvas/QuickAddDialog';
import { FilesPanel } from '../panels/FilesPanel';
import { PalettePanel } from '../panels/PalettePanel';
import { Inspector } from '../panels/Inspector';
import { AppToolbar } from './AppToolbar';
import { seedSchema } from './seed-schema';
import { triggerSave } from './save-actions';
import { cn } from '../lib/cn';

const railTab =
  'rounded-md px-1.5 py-2.5 text-[11.5px] font-medium [writing-mode:vertical-rl] rotate-180 cursor-pointer';

/** Фокус в поле ввода / Monaco — там горячие клавиши canvas не перехватываем. */
function isEditableTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return typeof el.closest === 'function' && el.closest('.monaco-editor') != null;
}

/** Стрелка → направление навигации. */
function arrowDir(key: string): NavDir | null {
  switch (key) {
    case 'ArrowUp':
      return 'up';
    case 'ArrowDown':
      return 'down';
    case 'ArrowLeft':
      return 'left';
    case 'ArrowRight':
      return 'right';
    default:
      return null;
  }
}

/** Перевести фокус в панель свойств — на первое поле выделенного узла (Space). */
function focusProperties(): void {
  const panel = document.getElementById('rb-properties');
  const el =
    panel?.querySelector<HTMLElement>('input, textarea, select') ??
    panel?.querySelector<HTMLElement>('button, [tabindex]');
  el?.focus();
}

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

  // Горячие клавиши. Глобально: ⌘/Ctrl+S (сохранить/экспорт), Esc (закрыть diff-модалку).
  // В схематике (вне полей ввода): навигация ↑↓←→, Shift-расширение выделения, ⌘/Ctrl+стрелки —
  // перемещение, Delete/Backspace — удаление, ⌘D — дублировать, ⌘Z/⇧⌘Z — undo/redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const t = activeTab(editorStore.getState());
        if (t) void triggerSave(t);
        return;
      }

      // В полях ввода / Monaco не перехватываем (Esc — закрыть модалку + вернуть фокус из поля на canvas).
      if (isEditableTarget(e.target)) {
        if (e.key === 'Escape') {
          saveDialogActions.close();
          const el = e.target as HTMLElement;
          if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') el.blur();
        }
        return;
      }

      const st = editorStore.getState();
      const inWire = st.ui.preview === 'wire' && activeTab(st) != null;

      if (e.key === 'Escape') {
        saveDialogActions.close();
        if (inWire) editorActions.collapseSelection();
        return;
      }
      if (!inWire) return;

      // Space — увести фокус в панель свойств выделенного узла (не перехватываем на кнопках/ссылках).
      if (e.key === ' ') {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'BUTTON' || t.closest?.('button, a, [role="button"]'))) return;
        if (!activeTab(st)?.selectionPath) return;
        e.preventDefault();
        if (!st.ui.rightOpen) {
          editorActions.toggleRight();
          requestAnimationFrame(focusProperties);
        } else {
          focusProperties();
        }
        return;
      }

      // Enter — открыть модалку быстрого добавления компонента.
      if (e.key === 'Enter') {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'BUTTON' || t.closest?.('button, a, [role="button"]'))) return;
        e.preventDefault();
        editorActions.openQuickAdd();
        return;
      }

      const dir = arrowDir(e.key);
      if (dir) {
        e.preventDefault();
        if (mod) editorActions.moveSelection(dir);
        else editorActions.navigate(dir, e.shiftKey);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        editorActions.deleteSelection();
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        editorActions.duplicateSelection();
        return;
      }
      if (mod && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey) editorActions.ungroupSelection();
        else editorActions.groupSelection();
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        editorActions.flipSelection();
        return;
      }
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) editorActions.redo();
        else editorActions.undo();
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
      <QuickAddDialog />
      <Toaster />
    </TooltipProvider>
  );
}
