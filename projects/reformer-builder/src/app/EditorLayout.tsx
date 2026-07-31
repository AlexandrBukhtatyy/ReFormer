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
import type { LeftPanelKind, PreviewMode, UiState } from '../store';
import { emptySchema, type NavDir } from '../model';
import { getRuntimeConfig } from '../config/state';
import { saveDialogActions } from '../store/save-dialog';
import { CanvasArea } from '../canvas/CanvasArea';
import { CodeArea } from '../canvas/CodeArea';
import { TabBar } from '../canvas/TabBar';
import { SaveDialog } from '../canvas/SaveDialog';
import { QuickAddDialog } from '../canvas/QuickAddDialog';
import { FilesPanel } from '../panels/FilesPanel';
import { PalettePanel } from '../panels/PalettePanel';
import { Inspector, SelectedTypeBadge } from '../panels/Inspector';
import { AppToolbar } from './AppToolbar';
import { seedSchema } from './seed-schema';
import { saveCodeTab, triggerSave } from './save-actions';
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

// ── навигация фокуса между областями (F6/⇧F6, как «Focus Next/Previous Part» в VSCode) ──

/** Зоны оболочки слева направо; размечены атрибутом `data-rb-zone` на панелях. */
type Zone = 'left' | 'center' | 'right';
const ZONE_ATTR = 'data-rb-zone';

/** Видимые зоны в порядке обхода: свёрнутые сайдбары пропускаются. */
function visibleZones(ui: UiState): Zone[] {
  const zones: Zone[] = [];
  if (ui.leftPanel) zones.push('left');
  zones.push('center');
  if (ui.rightOpen) zones.push('right');
  return zones;
}

/** Зона, в которой сейчас фокус (по ближайшему предку с `data-rb-zone`), либо `null`. */
function currentZone(): Zone | null {
  const active = document.activeElement as HTMLElement | null;
  const z = active?.closest?.(`[${ZONE_ATTR}]`)?.getAttribute(ZONE_ATTR);
  return z === 'left' || z === 'center' || z === 'right' ? z : null;
}

/** Перевести фокус в зону: на первый интерактивный элемент, иначе на сам контейнер (tabIndex=-1). */
function focusZone(zone: Zone): void {
  const el = document.querySelector<HTMLElement>(`[${ZONE_ATTR}="${zone}"]`);
  if (!el) return;
  // Центр — фокусируем контейнер canvas (стрелочная навигация слушает window), не таб-бар.
  if (zone === 'center') {
    el.focus();
    return;
  }
  const focusable = el.querySelector<HTMLElement>(
    'input, textarea, select, button, a[href], [tabindex]:not([tabindex="-1"])'
  );
  (focusable ?? el).focus();
}

/** Циклически сдвинуть фокус по видимым зонам (F6 → +1, ⇧F6 → -1). */
function cycleZone(ui: UiState, delta: 1 | -1): void {
  const zones = visibleZones(ui);
  if (!zones.length) return;
  const i = zones.indexOf(currentZone() ?? ('' as Zone));
  // Фокус вне зон (тулбар/рейл) — заходим с края по направлению обхода.
  if (i === -1) {
    focusZone(delta === 1 ? zones[0] : zones[zones.length - 1]);
    return;
  }
  focusZone(zones[(i + delta + zones.length) % zones.length]);
}

/** Переключить левый сайдбар на панель `kind` (или свернуть, если она уже открыта) + фокус. */
function toggleLeftTo(kind: LeftPanelKind): void {
  const open = editorStore.getState().ui.leftPanel === kind;
  editorActions.setLeftPanel(open ? null : kind);
  if (!open) requestAnimationFrame(() => focusZone('left'));
}

// ── переключение режима отображения схемы (⌘⌥V цикл, ⌘⌥1/2/3 прямой) ──

/** Порядок режимов для циклического переключения (совпадает с сегментами переключателя). */
const PREVIEW_ORDER: PreviewMode[] = ['wire', 'runtime', 'code'];

/** Сдвинуть режим отображения по кругу (⌘⌥V → +1, ⇧⌘⌥V → -1). */
function cyclePreview(delta: 1 | -1): void {
  const cur = editorStore.getState().ui.preview;
  const i = PREVIEW_ORDER.indexOf(cur);
  const next = PREVIEW_ORDER[(i + delta + PREVIEW_ORDER.length) % PREVIEW_ORDER.length];
  editorActions.setPreview(next);
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

  // seed стартовой схемы (Mode A) при первом запуске. Клиентский конфиг `project.seedSchema`:
  // объект → кастомный seed; `null` → пустая форма; поле отсутствует → встроенная демо-схема.
  useEffect(() => {
    if (!editorStore.getState().activeTabId) {
      const seed = getRuntimeConfig().project?.seedSchema;
      const schema = seed === undefined ? seedSchema() : (seed ?? emptySchema());
      const name = seed === undefined ? 'credit-application.form.json' : 'untitled.form.json';
      editorActions.openTab(name, { kind: 'new', name }, schema);
    }
  }, []);

  // тёмная тема — на documentElement (покрывает порталы tooltip/toast)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', ui.theme === 'dark');
  }, [ui.theme]);

  // Горячие клавиши. Глобально: ⌘/Ctrl+S (сохранить/экспорт), Esc (закрыть diff-модалку).
  // Навигация по областям (в стиле VSCode, работает и из полей): ⌘B — левый сайдбар,
  // ⌘⌥B — правый инспектор, ⌘⇧E — Файлы, ⌘⇧B — Палитра, F6/⇧F6 — цикл фокуса по зонам.
  // Режим отображения: ⌘⌥V — цикл (⇧ — назад), ⌘⌥1/2/3 — Схематичный/Renderer/Код.
  // В схематике (вне полей ввода): навигация ↑↓←→, Shift-расширение выделения, ⌘/Ctrl+стрелки —
  // перемещение, ⇧⌥↑/↓ — дублировать вверх/вниз (Copy Line), Delete/Backspace — удаление,
  // ⌘D — дублировать, ⌘Z/⇧⌘Z — undo/redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const t = activeTab(editorStore.getState());
        if (t) void (t.kind === 'code' ? saveCodeTab(t) : triggerSave(t));
        return;
      }

      // ── Навигация по областям (в стиле VSCode) — работают глобально, в т.ч. из полей ввода ──
      const k = e.key.toLowerCase();
      // ⌘/Ctrl+B — тоггл левого сайдбара; ⌘⌥B — тоггл правого инспектора.
      if (mod && k === 'b') {
        e.preventDefault();
        if (e.altKey) editorActions.toggleRight();
        else if (e.shiftKey) toggleLeftTo('palette');
        else editorActions.toggleLeftPanel();
        return;
      }
      // ⌘⇧E — левый сайдбар → Файлы (как «Explorer» в VSCode).
      if (mod && e.shiftKey && k === 'e') {
        e.preventDefault();
        toggleLeftTo('files');
        return;
      }
      // F6 / ⇧F6 — циклический фокус по видимым зонам.
      if (e.key === 'F6') {
        e.preventDefault();
        cycleZone(editorStore.getState().ui, e.shiftKey ? -1 : 1);
        return;
      }

      // ── Режим отображения схемы (глобально) — по e.code: Alt на macOS искажает e.key (Option+V=√). ──
      // ⌘⌥V — следующий режим по кругу; ⇧⌘⌥V — предыдущий.
      if (mod && e.altKey && e.code === 'KeyV') {
        e.preventDefault();
        cyclePreview(e.shiftKey ? -1 : 1);
        return;
      }
      // ⌘⌥1/2/3 — прямой переход: Схематичный / Renderer / Код.
      if (mod && e.altKey && (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3')) {
        e.preventDefault();
        const byDigit: Record<string, PreviewMode> = {
          Digit1: 'wire',
          Digit2: 'runtime',
          Digit3: 'code',
        };
        editorActions.setPreview(byDigit[e.code]);
        return;
      }

      // В полях ввода / Monaco не перехватываем (Esc — закрыть модалку + вернуть фокус из поля на canvas).
      if (isEditableTarget(e.target)) {
        if (e.key === 'Escape') {
          saveDialogActions.close();
          const el = e.target as HTMLElement;
          if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')
            el.blur();
        }
        return;
      }

      const st = editorStore.getState();
      // code-вкладка: canvas-хоткеи не применяем (Monaco обрабатывает ввод сам; ⌘S — выше).
      if (activeTab(st)?.kind === 'code') return;
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

      // ⇧⌥↓ / ⇧⌥↑ — дублировать выделение вниз/вверх («Copy Line Down/Up» из VSCode).
      if (e.altKey && e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        editorActions.duplicateSelection(e.key === 'ArrowDown' ? 'down' : 'up');
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
              className={cn(
                railTab,
                ui.leftPanel === 'files' ? 'bg-muted' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              Файлы
            </button>
            <button
              onClick={() =>
                editorActions.setLeftPanel(ui.leftPanel === 'palette' ? null : 'palette')
              }
              className={cn(
                railTab,
                ui.leftPanel === 'palette' ? 'bg-muted' : 'text-muted-foreground hover:bg-muted'
              )}
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
                  data-rb-zone="left"
                  tabIndex={-1}
                  defaultSize={250}
                  minSize={180}
                  maxSize={520}
                  className="flex flex-col bg-sidebar outline-none"
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
            <ResizablePanel
              id="center"
              data-rb-zone="center"
              tabIndex={-1}
              minSize={360}
              className="flex flex-col outline-none"
            >
              <TabBar />
              {tab ? (
                tab.kind === 'code' ? (
                  <CodeArea tab={tab} />
                ) : (
                  <CanvasArea tab={tab} />
                )
              ) : (
                <div className="grid flex-1 place-items-center text-muted-foreground">
                  Нет открытой схемы
                </div>
              )}
            </ResizablePanel>

            {/* правый инспектор */}
            {ui.rightOpen && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel
                  id="right"
                  data-rb-zone="right"
                  tabIndex={-1}
                  defaultSize={300}
                  minSize={220}
                  maxSize={640}
                  className="flex flex-col bg-sidebar outline-none"
                >
                  <div className="flex h-[34px] flex-none items-center justify-between border-b border-border px-3 text-[11.5px] font-semibold text-muted-foreground">
                    <span>Свойства</span>
                    <SelectedTypeBadge />
                  </div>
                  <Inspector />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>

          {/* правый рейл */}
          <div className="flex w-[34px] flex-none flex-col items-center border-l border-border bg-sidebar pt-2">
            <button
              onClick={editorActions.toggleRight}
              className={cn(railTab, 'text-muted-foreground hover:bg-muted')}
            >
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
