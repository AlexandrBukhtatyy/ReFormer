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
import { FloatingActions } from './FloatingActions';
import { SchematicCanvas } from './SchematicCanvas';
import { RuntimePreview } from './RuntimePreview';
import { BottomPanel } from './BottomPanel';
import { SchemaCodeEditor } from './SchemaCodeEditor';
import { effectiveMock } from './mock-data';

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

  // Карточка формы (схематичный ⇄ runtime) + плавающие действия — общая для обеих раскладок.
  const canvasBody = (
    <>
      <FloatingActions />
      <div className="mx-auto w-full">
        <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
          {ui.preview === 'runtime' ? (
            <RuntimePreview
              schema={tab.schema}
              mock={mock}
              mode={ui.runtimeMode}
              selectionPath={tab.selectionPath}
              selectionPaths={tab.selectionPaths}
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
