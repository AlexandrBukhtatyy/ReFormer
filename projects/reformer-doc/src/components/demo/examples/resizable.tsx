import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@reformer/ui-kit/resizable';
import type { ComponentDocConfig } from '../types';

/**
 * Resizable — не form-control: compound поверх react-resizable-panels
 * (ResizablePanelGroup / ResizablePanel / ResizableHandle). Тяжёлая внешняя
 * зависимость — external в бандле ui-kit, у потребителя ставится как optional peer.
 * Таб Variants показывает ориентацию (horizontal / vertical), вложенность и вариант
 * разделителя (withHandle), Examples — прикладные раскладки, props — таблица.
 */
export const resizableDocConfig: ComponentDocConfig = {
  name: 'Resizable',
  importFrom: '@reformer/ui-kit',
  description:
    'Изменяемые размеры панелей на shadcn / react-resizable-panels. Compound-набор: ResizablePanelGroup / ResizablePanel / ResizableHandle. Ориентация задаётся пропом orientation ("horizontal" | "vertical") на группе, стартовые размеры — defaultSize на панелях.',
  variants: [
    {
      id: 'horizontal',
      title: 'Горизонтально (orientation="horizontal")',
      description:
        'Две панели рядом; разделитель тянется мышью или клавиатурой. defaultSize задаёт стартовое соотношение.',
      render: () => (
        <div style={{ height: 200, width: '100%', maxWidth: 480 }}>
          <ResizablePanelGroup orientation="horizontal" className="rounded-lg border">
            <ResizablePanel defaultSize={50}>
              <div className="flex h-full items-center justify-center p-4">Левая</div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={50}>
              <div className="flex h-full items-center justify-center p-4">Правая</div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      ),
      code: `<ResizablePanelGroup orientation="horizontal" className="rounded-lg border">
  <ResizablePanel defaultSize={50}>Левая</ResizablePanel>
  <ResizableHandle />
  <ResizablePanel defaultSize={50}>Правая</ResizablePanel>
</ResizablePanelGroup>`,
    },
    {
      id: 'vertical',
      title: 'Вертикально (orientation="vertical")',
      description: 'Панели друг над другом; разделитель тянется по вертикали.',
      render: () => (
        <div style={{ height: 240, width: '100%', maxWidth: 480 }}>
          <ResizablePanelGroup orientation="vertical" className="rounded-lg border">
            <ResizablePanel defaultSize={40}>
              <div className="flex h-full items-center justify-center p-4">Верх</div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={60}>
              <div className="flex h-full items-center justify-center p-4">Низ</div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      ),
      code: `<ResizablePanelGroup orientation="vertical" className="rounded-lg border">
  <ResizablePanel defaultSize={40}>Верх</ResizablePanel>
  <ResizableHandle />
  <ResizablePanel defaultSize={60}>Низ</ResizablePanel>
</ResizablePanelGroup>`,
    },
    {
      id: 'with-handle',
      title: 'Разделитель с «хватом» (withHandle)',
      description:
        'withHandle рисует видимую рукоятку (GripVerticalIcon) — подсказывает, что границу можно тянуть.',
      render: () => (
        <div style={{ height: 200, width: '100%', maxWidth: 480 }}>
          <ResizablePanelGroup orientation="horizontal" className="rounded-lg border">
            <ResizablePanel defaultSize={35}>
              <div className="flex h-full items-center justify-center p-4">Меню</div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={65}>
              <div className="flex h-full items-center justify-center p-4">Контент</div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      ),
      code: `<ResizablePanelGroup orientation="horizontal">
  <ResizablePanel defaultSize={35}>Меню</ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel defaultSize={65}>Контент</ResizablePanel>
</ResizablePanelGroup>`,
    },
  ],
  examples: [
    {
      id: 'ide-layout',
      title: 'Раскладка редактора (вложенные группы)',
      description:
        'Группы можно вкладывать: горизонтальный сплит боковой панели и рабочей области, внутри которой — вертикальный сплит на редактор и терминал.',
      render: () => (
        <div style={{ height: 280, width: '100%', maxWidth: 560 }}>
          <ResizablePanelGroup orientation="horizontal" className="rounded-lg border">
            <ResizablePanel defaultSize={30}>
              <div className="flex h-full items-center justify-center p-4">Проводник</div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={70}>
              <ResizablePanelGroup orientation="vertical">
                <ResizablePanel defaultSize={70}>
                  <div className="flex h-full items-center justify-center p-4">Редактор</div>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={30}>
                  <div className="flex h-full items-center justify-center p-4">Терминал</div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      ),
      code: `<ResizablePanelGroup orientation="horizontal">
  <ResizablePanel defaultSize={30}>Проводник</ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel defaultSize={70}>
    <ResizablePanelGroup orientation="vertical">
      <ResizablePanel defaultSize={70}>Редактор</ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={30}>Терминал</ResizablePanel>
    </ResizablePanelGroup>
  </ResizablePanel>
</ResizablePanelGroup>`,
    },
    {
      id: 'constrained',
      title: 'Ограничения размера (minSize / maxSize / collapsible)',
      description:
        'Панель можно ограничить по размеру (minSize / maxSize) и сделать сворачиваемой (collapsible) — удобно для боковых панелей.',
      render: () => (
        <div style={{ height: 200, width: '100%', maxWidth: 480 }}>
          <ResizablePanelGroup orientation="horizontal" className="rounded-lg border">
            <ResizablePanel defaultSize={25} minSize={15} maxSize={40} collapsible>
              <div className="flex h-full items-center justify-center p-4">Боковая</div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={75}>
              <div className="flex h-full items-center justify-center p-4">Основная</div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      ),
      code: `<ResizablePanelGroup orientation="horizontal">
  <ResizablePanel defaultSize={25} minSize={15} maxSize={40} collapsible>
    Боковая
  </ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel defaultSize={75}>Основная</ResizablePanel>
</ResizablePanelGroup>`,
    },
  ],
  props: [
    {
      name: 'orientation (ResizablePanelGroup)',
      type: "'horizontal' | 'vertical'",
      default: 'horizontal',
      description: 'Направление раскладки панелей и оси изменения размера.',
    },
    {
      name: 'defaultSize (ResizablePanel)',
      type: 'number',
      description: 'Стартовый размер панели (в процентах группы).',
    },
    {
      name: 'minSize / maxSize (ResizablePanel)',
      type: 'number',
      description: 'Нижняя и верхняя граница размера панели (в процентах).',
    },
    {
      name: 'collapsible (ResizablePanel)',
      type: 'boolean',
      default: 'false',
      description: 'Разрешает свернуть панель до collapsedSize.',
    },
    {
      name: 'withHandle (ResizableHandle)',
      type: 'boolean',
      default: 'false',
      description: 'Рисует видимую рукоятку (GripVerticalIcon) на разделителе.',
    },
    {
      name: 'onLayoutChange (ResizablePanelGroup)',
      type: '(layout: number[]) => void',
      description: 'Колбэк изменения раскладки — для сохранения размеров.',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Доп. классы (tailwind-merge — класс вызывающего перекрывает).',
    },
  ],
};
