/**
 * Центральная область canvas: плавающие действия + карточка формы (схематичный ⇄ Runtime) +
 * нижняя raw-JSON панель. Переключение режима — из UI-стора (спека §9).
 *
 * @module reformer-builder/canvas/CanvasArea
 */

import { useDefaultLayout } from 'react-resizable-panels';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@reformer/ui-kit/resizable';
import type { TabState } from '../store';
import { useUi } from '../store';
import { FloatingActions } from './FloatingActions';
import { SchematicCanvas } from './SchematicCanvas';
import { RuntimePreview } from './RuntimePreview';
import { RawJson } from './RawJson';

export function CanvasArea({ tab }: { tab: TabState }) {
  const ui = useUi();

  // Persistence высоты raw-JSON панели в localStorage (число = пиксели в v4).
  const vLayout = useDefaultLayout({
    id: 'rb.layout.v',
    storage: localStorage,
    panelIds: ['canvas', 'raw'],
  });

  // Карточка формы (схематичный ⇄ runtime) + плавающие действия — общая для обеих раскладок.
  const canvasBody = (
    <>
      <FloatingActions />
      <div className="mx-auto w-full">
        <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
          {ui.preview === 'runtime' ? (
            <RuntimePreview schema={tab.schema} />
          ) : (
            <SchematicCanvas schema={tab.schema} selectionPath={tab.selectionPath} />
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
            <RawJson schema={tab.schema} name={tab.source.name} />
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        // raw-JSON свёрнут: canvas на всю высоту + свёрнутая полоса-заголовок снизу.
        <>
          <div className="relative flex-1 overflow-auto p-14">{canvasBody}</div>
          <RawJson schema={tab.schema} name={tab.source.name} />
        </>
      )}
    </div>
  );
}
