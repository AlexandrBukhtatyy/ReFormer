import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './index';

// Resizable — inline compound на react-resizable-panels (тяжёлая внешняя зависимость,
// external в vite.config). Panel/Group/Separator рендерятся в SSR как <div>-ы,
// поэтому проверяем статику: data-slot каждой части, merge className, passthrough props,
// опциональный «хват» (GripVerticalIcon) при withHandle.
function renderGroup(props?: { withHandle?: boolean; orientation?: 'horizontal' | 'vertical' }) {
  return renderToStaticMarkup(
    <ResizablePanelGroup orientation={props?.orientation}>
      <ResizablePanel defaultSize={50}>Левая</ResizablePanel>
      <ResizableHandle withHandle={props?.withHandle} />
      <ResizablePanel defaultSize={50}>Правая</ResizablePanel>
    </ResizablePanelGroup>
  );
}

describe('Resizable (base, compound)', () => {
  it('каждая часть несёт собственный data-slot', () => {
    const html = renderGroup();
    expect(html).toContain('data-slot="resizable-panel-group"');
    expect(html).toContain('data-slot="resizable-panel"');
    expect(html).toContain('data-slot="resizable-handle"');
  });

  it('содержимое панелей рендерится', () => {
    const html = renderGroup();
    expect(html).toContain('Левая');
    expect(html).toContain('Правая');
  });

  it('withHandle рисует «хват» (GripVerticalIcon)', () => {
    const html = renderGroup({ withHandle: true });
    expect(html).toContain('lucide-grip-vertical');
    expect(html).toContain('<svg');
  });

  it('без withHandle «хват» не рендерится', () => {
    const html = renderGroup({ withHandle: false });
    expect(html).not.toContain('lucide-grip-vertical');
  });

  it('orientation прокидывается: handle получает перпендикулярный aria-orientation', () => {
    // Group сама aria-orientation не несёт — её несёт разделитель (перпендикулярно
    // направлению группы). horizontal-группа → вертикальный handle, и наоборот.
    const horizontal = renderGroup({ orientation: 'horizontal' });
    expect(horizontal).toContain('aria-orientation="vertical"');
    const vertical = renderGroup({ orientation: 'vertical' });
    expect(vertical).toContain('aria-orientation="horizontal"');
  });

  it('className мёржится на Group (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(
      <ResizablePanelGroup className="rounded-lg border">
        <ResizablePanel defaultSize={100}>X</ResizablePanel>
      </ResizablePanelGroup>
    );
    expect(html).toContain('rounded-lg');
    expect(html).toContain('border');
  });

  it('прокидывает произвольные props на handle (data-testid либа переопределяет своим id)', () => {
    // Внимание: react-resizable-panels проставляет собственный data-testid (из id),
    // поэтому пользовательский data-testid не «переживает». Прочие data-* проходят
    // через ...rest.
    const html = renderToStaticMarkup(
      <ResizablePanelGroup>
        <ResizablePanel defaultSize={50}>A</ResizablePanel>
        <ResizableHandle data-custom="probe" />
        <ResizablePanel defaultSize={50}>B</ResizablePanel>
      </ResizablePanelGroup>
    );
    expect(html).toContain('data-custom="probe"');
  });
});
