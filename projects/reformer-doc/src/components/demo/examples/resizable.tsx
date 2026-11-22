import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@reformer/ui-kit/resizable';
import type { ComponentDocConfig } from '../types';

/**
 * Resizable — не поле формы: compound поверх react-resizable-panels v4 (ResizablePanelGroup /
 * ResizablePanel / ResizableHandle). Размеры: число — пиксели, строка — проценты ("50%").
 * Variants — ориентация и вид разделителя, Examples — прикладные раскладки, API — таблица props.
 * Обёртка `<div style>` в render — рамка демо (группе нужна высота), в `code` её нет.
 */
export const resizableDocConfig: ComponentDocConfig = {
  name: 'Resizable',
  importFrom: '@reformer/ui-kit/resizable',
  description:
    'Панели, размер которых меняют перетаскиванием разделителя или с клавиатуры. Ориентация — orientation на группе, стартовые размеры — defaultSize на панелях.',
  variants: [
    {
      id: 'horizontal',
      title: 'Панели рядом (orientation="horizontal")',
      description:
        'Разделитель тянется мышью или стрелками ←/→. defaultSize="50%" — половина группы: строка с % — проценты, число — пиксели.',
      render: () => (
        <div style={{ height: 200, width: '100%', maxWidth: 480 }}>
          <ResizablePanelGroup orientation="horizontal" className="rounded-lg border">
            <ResizablePanel defaultSize="50%">
              <div className="flex h-full items-center justify-center p-4">Левая</div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize="50%">
              <div className="flex h-full items-center justify-center p-4">Правая</div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      ),
      code: `<ResizablePanelGroup orientation="horizontal" className="rounded-lg border">
  <ResizablePanel defaultSize="50%">
    <div className="flex h-full items-center justify-center p-4">Левая</div>
  </ResizablePanel>
  <ResizableHandle />
  <ResizablePanel defaultSize="50%">
    <div className="flex h-full items-center justify-center p-4">Правая</div>
  </ResizablePanel>
</ResizablePanelGroup>`,
    },
    {
      id: 'vertical',
      title: 'Панели друг над другом (orientation="vertical")',
      description:
        'Разделитель горизонтальный, тянется вверх и вниз, с клавиатуры — стрелками ↑/↓.',
      render: () => (
        <div style={{ height: 240, width: '100%', maxWidth: 480 }}>
          <ResizablePanelGroup orientation="vertical" className="rounded-lg border">
            <ResizablePanel defaultSize="40%">
              <div className="flex h-full items-center justify-center p-4">Верх</div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize="60%">
              <div className="flex h-full items-center justify-center p-4">Низ</div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      ),
      code: `<ResizablePanelGroup orientation="vertical" className="rounded-lg border">
  <ResizablePanel defaultSize="40%">
    <div className="flex h-full items-center justify-center p-4">Верх</div>
  </ResizablePanel>
  <ResizableHandle />
  <ResizablePanel defaultSize="60%">
    <div className="flex h-full items-center justify-center p-4">Низ</div>
  </ResizablePanel>
</ResizablePanelGroup>`,
    },
    {
      id: 'with-handle',
      title: 'Видимый «хват» (withHandle)',
      description:
        'withHandle рисует на разделителе значок-рукоятку — подсказку, что границу можно тянуть.',
      render: () => (
        <div style={{ height: 200, width: '100%', maxWidth: 480 }}>
          <ResizablePanelGroup orientation="horizontal" className="rounded-lg border">
            <ResizablePanel defaultSize="35%">
              <div className="flex h-full items-center justify-center p-4">Меню</div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="65%">
              <div className="flex h-full items-center justify-center p-4">Содержимое</div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      ),
      code: `<ResizablePanelGroup orientation="horizontal" className="rounded-lg border">
  <ResizablePanel defaultSize="35%">
    <div className="flex h-full items-center justify-center p-4">Меню</div>
  </ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel defaultSize="65%">
    <div className="flex h-full items-center justify-center p-4">Содержимое</div>
  </ResizablePanel>
</ResizablePanelGroup>`,
    },
  ],
  examples: [
    {
      id: 'editor-layout',
      title: 'Раскладка редактора (вложенные группы)',
      description:
        'Группы вкладываются: слева проводник, справа рабочая область, разделённая по вертикали на редактор и терминал.',
      render: () => (
        <div style={{ height: 280, width: '100%', maxWidth: 560 }}>
          <ResizablePanelGroup orientation="horizontal" className="rounded-lg border">
            <ResizablePanel defaultSize="30%">
              <div className="flex h-full items-center justify-center p-4">Проводник</div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="70%">
              <ResizablePanelGroup orientation="vertical">
                <ResizablePanel defaultSize="70%">
                  <div className="flex h-full items-center justify-center p-4">Редактор</div>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize="30%">
                  <div className="flex h-full items-center justify-center p-4">Терминал</div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      ),
      code: `<ResizablePanelGroup orientation="horizontal" className="rounded-lg border">
  <ResizablePanel defaultSize="30%">
    <div className="flex h-full items-center justify-center p-4">Проводник</div>
  </ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel defaultSize="70%">
    <ResizablePanelGroup orientation="vertical">
      <ResizablePanel defaultSize="70%">
        <div className="flex h-full items-center justify-center p-4">Редактор</div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="30%">
        <div className="flex h-full items-center justify-center p-4">Терминал</div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </ResizablePanel>
</ResizablePanelGroup>`,
    },
    {
      id: 'constrained',
      title: 'Границы размера и сворачивание',
      description:
        'Боковая панель: от 15% до 40% группы. collapsible — если потянуть её меньше minSize, она свернётся до collapsedSize (0 по умолчанию). Enter на разделителе сворачивает и разворачивает её.',
      render: () => (
        <div style={{ height: 200, width: '100%', maxWidth: 480 }}>
          <ResizablePanelGroup orientation="horizontal" className="rounded-lg border">
            <ResizablePanel defaultSize="25%" minSize="15%" maxSize="40%" collapsible>
              <div className="flex h-full items-center justify-center p-4">Боковая</div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="75%">
              <div className="flex h-full items-center justify-center p-4">Основная</div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      ),
      code: `<ResizablePanelGroup orientation="horizontal" className="rounded-lg border">
  <ResizablePanel defaultSize="25%" minSize="15%" maxSize="40%" collapsible>
    <div className="flex h-full items-center justify-center p-4">Боковая</div>
  </ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel defaultSize="75%">
    <div className="flex h-full items-center justify-center p-4">Основная</div>
  </ResizablePanel>
</ResizablePanelGroup>`,
    },
  ],
  props: [
    {
      name: 'ResizablePanelGroup.orientation',
      type: "'horizontal' | 'vertical'",
      default: "'horizontal'",
      description: 'horizontal — панели рядом, vertical — друг над другом.',
    },
    {
      name: 'ResizablePanelGroup.defaultLayout',
      type: 'Layout',
      description:
        'Стартовая раскладка { [id панели]: размер }. Обычно приходит из useDefaultLayout — для сохранения между перезагрузками.',
    },
    {
      name: 'ResizablePanelGroup.onLayoutChanged',
      type: '(layout: Layout, meta: { isUserInteraction: boolean }) => void',
      description:
        'Вызывается, когда раскладка изменилась: при перетаскивании — после отпускания. Подходит для сохранения.',
    },
    {
      name: 'ResizablePanelGroup.onLayoutChange',
      type: '(layout: Layout) => void',
      description:
        'Вызывается на каждом шаге перетаскивания. Для сохранения берите onLayoutChanged.',
    },
    {
      name: 'ResizablePanelGroup.disabled',
      type: 'boolean',
      default: 'false',
      description: 'Запретить менять размеры во всей группе.',
    },
    {
      name: 'ResizablePanelGroup.id',
      type: 'string | number',
      description: 'Идентификатор группы. Он же попадает в атрибуты id и data-testid.',
    },
    {
      name: 'ResizablePanel.defaultSize',
      type: 'number | string',
      description:
        'Стартовый размер. Число — пиксели (200), строка без единиц или с % — проценты ("50", "50%"). Без него размеры делятся поровну.',
    },
    {
      name: 'ResizablePanel.minSize',
      type: 'number | string',
      default: '"0%"',
      description: 'Нижняя граница размера. Единицы — как у defaultSize.',
    },
    {
      name: 'ResizablePanel.maxSize',
      type: 'number | string',
      default: '"100%"',
      description: 'Верхняя граница размера. Единицы — как у defaultSize.',
    },
    {
      name: 'ResizablePanel.collapsible',
      type: 'boolean',
      default: 'false',
      description: 'Панель сворачивается до collapsedSize, если её потянуть меньше minSize.',
    },
    {
      name: 'ResizablePanel.collapsedSize',
      type: 'number | string',
      default: '"0%"',
      description: 'Размер свёрнутой панели.',
    },
    {
      name: 'ResizablePanel.id',
      type: 'string | number',
      description:
        'Идентификатор панели. Нужен, чтобы сохранённая раскладка нашла свою панель после перезагрузки.',
    },
    {
      name: 'ResizablePanel.panelRef',
      type: 'Ref<PanelImperativeHandle>',
      description:
        'Управление из кода: collapse(), expand(), resize(size), getSize(), isCollapsed(). Хук usePanelRef — из react-resizable-panels.',
    },
    {
      name: 'ResizableHandle.withHandle',
      type: 'boolean',
      default: 'false',
      description: 'Нарисовать на разделителе значок-рукоятку.',
    },
    {
      name: 'ResizableHandle.disabled',
      type: 'boolean',
      default: 'false',
      description:
        'Разделитель не тянется и не получает фокус. Соседние панели всё ещё могут меняться от других разделителей.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Доп. классы части. У ResizablePanel класс ложится на внутренний div, а не на элемент панели.',
    },
  ],
};
