/**
 * Центральная область canvas: плавающие действия + карточка формы (схематичный ⇄ Runtime) +
 * нижняя raw-JSON панель. Переключение режима — из UI-стора (спека §9).
 *
 * @module reformer-builder/canvas/CanvasArea
 */

import { useMemo } from 'react';
import { useDefaultLayout } from 'react-resizable-panels';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@reformer/ui-kit/resizable';
import type { TabState } from '../store';
import { useUi } from '../store';
import { annotateSchema } from '../preview-runtime';
import { FloatingActions } from './FloatingActions';
import { SchematicCanvas } from './SchematicCanvas';
import { RuntimePreview } from './RuntimePreview';
import { BottomPanel } from './BottomPanel';
import { SchemaCodeEditor } from './SchemaCodeEditor';
import { effectiveMock } from './mock-data';
import { useLiveForm } from './useLiveForm';

/** Правки модели из панели «Засев»: объект либо `undefined`, если текста нет или он битый. */
function parseModelDraft(text: string | undefined): Record<string, unknown> | undefined {
  if (text == null) return undefined;
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

export function CanvasArea({ tab }: { tab: TabState }) {
  const ui = useUi();

  // Persistence высоты нижней панели в localStorage (число = пиксели в v4).
  const vLayout = useDefaultLayout({
    id: 'rb.layout.v',
    storage: localStorage,
    panelIds: ['canvas', 'raw'],
  });

  // Эффективный мок для runtime-превью (правки панели ⊕ синтез). Стабильная ссылка по [schema, mock].
  const mock = useMemo(() => effectiveMock(tab.schema, tab.mock), [tab.schema, tab.mock]);

  // Схема с класс-токенами: одна и та же и для рендера, и для сборки live-бандла (иначе
  // convertJsonToM1Tree отработал бы по другому дереву, чем то, что смонтировано).
  const annotated = useMemo(() => annotateSchema(tab.schema), [tab.schema]);

  // Явные правки модели из панели «Засев». Синтез сюда НЕ подмешиваем: в live-пути базой служит
  // `initialFormModel` формы, а представительный мок скрыл бы работу `required`.
  const modelOverride = useMemo(() => parseModelDraft(tab.mock?.model), [tab.mock?.model]);

  const live = useLiveForm({
    tab,
    annotated,
    dataSources: mock.dataSources,
    modelOverride,
    enabled: ui.preview === 'runtime' && ui.liveSchemas,
  });

  // Нижняя панель со вкладками: JSON (raw схемы) + Модель + Registry (мок-данные).
  const bottomPanel = <BottomPanel tab={tab} />;

  // Режим «Код»: схема как JSON-редактор на всю центральную область. Нижняя raw-панель здесь
  // избыточна (дублировала бы тот же JSON) — не рендерим. Переключатель (FloatingActions) поверх.
  if (ui.preview === 'code') {
    return (
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-muted/40">
        <FloatingActions />
        <div className="min-h-0 flex-1">
          <SchemaCodeEditor schema={tab.schema} />
        </div>
      </div>
    );
  }

  // Карточка формы (схематичный ⇄ runtime) — общая для обеих раскладок. Панель действий здесь
  // не рендерим: она живёт вне скролл-области (см. ниже), иначе уезжала бы вверх при скролле.
  const canvasBody = (
    <>
      <div className="mx-auto w-full">
        <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
          {ui.preview === 'runtime' ? (
            <RuntimePreview
              schema={tab.schema}
              annotated={annotated}
              mock={mock}
              mode={ui.runtimeMode}
              selectionPath={tab.selectionPath}
              selectionPaths={tab.selectionPaths}
              live={live}
            />
          ) : (
            <SchematicCanvas
              schema={tab.schema}
              selectionPath={tab.selectionPath}
              selectionPaths={tab.selectionPaths}
            />
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-muted/40">
      {/* Sticky-панель действий: сестра скролл-области, а не её содержимое — остаётся на месте
          при любом скролле холста (в т.ч. горизонтальном) и при resize нижней панели. */}
      <FloatingActions />
      {ui.rawJsonOpen ? (
        // raw-JSON открыт: canvas и редактор делят высоту через вертикальный разделитель.
        <ResizablePanelGroup
          orientation="vertical"
          className="min-h-0 flex-1"
          defaultLayout={vLayout.defaultLayout}
          onLayoutChanged={vLayout.onLayoutChanged}
        >
          <ResizablePanel id="canvas" minSize={200} className="relative p-14">
            {canvasBody}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel
            id="raw"
            defaultSize={216}
            minSize={120}
            maxSize={560}
            className="flex flex-col"
          >
            {bottomPanel}
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        // нижняя панель свёрнута: canvas на всю высоту + свёрнутая полоса-заголовок снизу.
        <>
          <div className="relative flex-1 overflow-auto p-14">{canvasBody}</div>
          {bottomPanel}
        </>
      )}
    </div>
  );
}
