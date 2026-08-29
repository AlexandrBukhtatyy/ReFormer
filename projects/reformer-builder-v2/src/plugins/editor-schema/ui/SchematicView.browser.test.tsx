/**
 * Схематичный вид в настоящем браузере.
 *
 * Правила («во что превратится бросок», «какая зона под курсором») проверены без DOM —
 * в [schematic-drop.test.ts](../schematic-drop.test.ts) и [schematic-zone.test.ts](../schematic-zone.test.ts).
 * Здесь остаётся то, чего без Chromium не существует:
 *
 * - **раскладка.** Весь смысл вида в том, что колонки стоят рядом. Проверить это можно только
 *   там, где есть движок раскладки: в jsdom `getBoundingClientRect` отдаёт нули, и «поле справа
 *   от поля» проверялось бы на нулях;
 * - **зона по координате.** «Левая четверть коробки» — это `clientX` поверх настоящей ширины;
 * - **механизм HTML5 drag-and-drop**: `dataTransfer`, защищённый режим на `dragover`,
 *   `preventDefault` как разрешение броска;
 * - **ближайшая коробка выигрывает.** Коробки вложены, и то, что событие останавливается
 *   на самой глубокой, видно только на настоящем всплытии.
 *
 * @module plugins/editor-schema/ui/SchematicView.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { useMemo, type ReactElement } from 'react';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { DEFAULT_COL_CLASS, DEFAULT_ROW_CLASS } from '@/lib/form-model/mutate';
import { getAt } from '@/lib/form-model/paths';
import type { CatalogEntry } from '@/lib/catalog/types';
import { renderReact } from '@/testing/render';
import { createCanvasPrefs } from '../canvas-prefs';
import { FLIP_COMMAND_ID, type CommandAccess } from '../commands';
import { createDragSession, DRAG_MIME, type DragSession } from '../drag-session';
import { indexNodes } from '../node-index';
import { createSessionRegistry, type SessionRegistry } from '../sessions';
import { createFakeSchemaHost } from '../testing';
import { Canvas } from './Canvas';
import { PalettePanel } from './PalettePanel';
import { SchematicView } from './SchematicView';
import { useActiveSession, useSessionState } from './useSession';

const DOCUMENT = 'fake:form.json';

const CATALOG: readonly CatalogEntry[] = [
  {
    name: 'Input',
    role: 'field',
    category: 'Поля ввода',
    propsSchema: { type: 'object', properties: {} },
    makeNode: () => ({ value: '$model(новое)', component: '$component(Input)' }),
  },
];

/** Корневой столбец: ряд из двух полей и поле под ним. */
function layoutSchema(): JsonFormSchema {
  return {
    version: '1.0',
    root: {
      component: '$html(div)',
      componentProps: { className: DEFAULT_COL_CLASS },
      children: [
        {
          component: '$html(div)',
          componentProps: { className: DEFAULT_ROW_CLASS },
          children: [
            { value: '$model(city)', component: '$component(Input)' },
            { value: '$model(zip)', component: '$component(Input)' },
          ],
        },
        { value: '$model(comment)', component: '$component(Input)' },
      ],
    },
  } as unknown as JsonFormSchema;
}

interface Fixture {
  readonly drag: DragSession;
  readonly model: () => JsonFormSchema;
  readonly selection: () => readonly string[];
  readonly idAt: (path: readonly (string | number)[]) => string;
  readonly undo: () => boolean;
  readonly run: ReturnType<typeof vi.fn>;
  readonly unmount: () => void;
}

function Harness({
  registry,
  drag,
  commands,
  withPalette,
  withToolbar,
}: {
  registry: SessionRegistry;
  drag: DragSession;
  commands: CommandAccess;
  withPalette: boolean;
  withToolbar: boolean;
}): ReactElement {
  const session = useActiveSession(registry);
  const state = useSessionState(registry, session);
  const host = useMemo(
    () => ({
      useTranslate: () => (key: string) => key,
      modelOf: () => null,
      catalog: () => CATALOG,
      onCatalogChange: () => ({ dispose: () => undefined }),
    }),
    []
  );
  // Предпочтения переживают перерисовку: иначе вид сбрасывался бы на дерево сам собой.
  const prefs = useMemo(() => createCanvasPrefs(), []);

  if (session === null || state === null) return <div>сеанса нет</div>;
  return (
    <div className="flex">
      {withPalette && (
        <div style={{ width: 220 }}>
          <PalettePanel host={host} registry={registry} drag={drag} />
        </div>
      )}
      <div style={{ width: 520 }}>
        {withToolbar ? (
          <Canvas
            session={session}
            state={state}
            t={(key) => key}
            commands={commands}
            drag={drag}
            prefs={prefs}
          />
        ) : (
          <SchematicView
            session={session}
            state={state}
            t={(key) => key}
            commands={commands}
            drag={drag}
          />
        )}
      </div>
    </div>
  );
}

/** Дать React закоммитить: следующее действие считает координаты по экрану. */
function flush(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

async function mount(
  options: { withPalette?: boolean; withToolbar?: boolean } = {}
): Promise<Fixture> {
  const host = createFakeSchemaHost({
    documentId: DOCUMENT,
    text: JSON.stringify(layoutSchema()),
    catalog: CATALOG,
  });
  const registry = createSessionRegistry({ host });
  const session = registry.open(DOCUMENT);
  if (session === null) throw new Error('сеанс не открылся');

  const drag = createDragSession();
  const run = vi.fn();
  const commands: CommandAccess = { has: () => true, run };
  const mounted = renderReact(
    <Harness
      registry={registry}
      drag={drag}
      commands={commands}
      withPalette={options.withPalette ?? false}
      withToolbar={options.withToolbar ?? false}
    />
  );

  await vi.waitFor(() => {
    if (mounted.container.querySelector('[data-node-id]') === null) {
      throw new Error('коробки ещё не отрисованы');
    }
  });

  const model = (): JsonFormSchema => session.get().model;
  return {
    drag,
    model,
    selection: () => session.get().selection,
    idAt: (path) => {
      const id = indexNodes(model()).idAt(path);
      if (id === undefined) throw new Error(`нет адреса по пути ${path.join('/')}`);
      return id;
    },
    undo: () => session.undo(),
    run,
    unmount: mounted.unmount,
  };
}

function box(id: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-node-id="${id}"]`);
  if (element === null) throw new Error(`коробки ${id} нет на экране`);
  return element;
}

function transfer(): DataTransfer {
  const data = new DataTransfer();
  data.setData(DRAG_MIME, 'груз');
  return data;
}

/**
 * Разослать событие в точку коробки по долям её ширины и высоты.
 *
 * Доли, а не пиксели: размеры коробки задаются содержимым и стилями кита, и число здесь
 * означало бы «столько, сколько было в день написания теста».
 */
function dispatchDrag(
  target: HTMLElement,
  type: 'dragover' | 'drop',
  at: { x: number; y: number },
  data: DataTransfer
): void {
  const rect = target.getBoundingClientRect();
  target.dispatchEvent(
    new DragEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + rect.width * at.x,
      clientY: rect.top + rect.height * at.y,
      dataTransfer: data,
    })
  );
}

async function manualDrag(
  source: HTMLElement,
  target: HTMLElement,
  at: { x: number; y: number }
): Promise<void> {
  const data = transfer();
  source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: data }));
  dispatchDrag(target, 'dragover', at, data);
  await flush();
  dispatchDrag(target, 'drop', at, data);
  source.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: data }));
  await flush();
}

const ROW = ['root', 'children', 0] as const;
const CITY = ['root', 'children', 0, 'children', 0] as const;
const ZIP = ['root', 'children', 0, 'children', 1] as const;
const COMMENT = ['root', 'children', 1] as const;

describe('схематичный вид рисует раскладку', () => {
  it('колонки ряда стоят рядом, а не друг под другом', async () => {
    const fixture = await mount();
    const city = box(fixture.idAt(CITY)).getBoundingClientRect();
    const zip = box(fixture.idAt(ZIP)).getBoundingClientRect();
    const comment = box(fixture.idAt(COMMENT)).getBoundingClientRect();

    expect(zip.left).toBeGreaterThan(city.left);
    expect(Math.abs(zip.top - city.top)).toBeLessThan(2);
    // А поле снаружи ряда — ниже него: корень остался столбцом.
    expect(comment.top).toBeGreaterThan(city.top);
    fixture.unmount();
  });

  it('щелчок выбирает коробку под курсором, а не её предков', async () => {
    const fixture = await mount();
    const id = fixture.idAt(CITY);
    await userEvent.click(box(id));
    await expect.poll(() => fixture.selection()).toEqual([id]);
    fixture.unmount();
  });
});

describe('перетаскивание в схематичном виде', () => {
  it('бросок на поперечный край подсвечивает обёрточную зону', async () => {
    const fixture = await mount();
    const target = box(fixture.idAt(COMMENT));
    const data = transfer();
    fixture.drag.begin({
      kind: 'new',
      node: { value: '$model(x)', component: '$component(Input)' },
    });

    dispatchDrag(target, 'dragover', { x: 0.05, y: 0.5 }, data);
    await expect.poll(() => box(fixture.idAt(COMMENT)).dataset.drop).toBe('beside-before');
    fixture.unmount();
  });

  it('бросок с палитры на левый край ставит компонент в ряд с целью', async () => {
    const fixture = await mount({ withPalette: true });
    const palette = document.querySelector<HTMLElement>('[draggable="true"]');
    if (palette === null) throw new Error('в палитре нет перетаскиваемой записи');

    await manualDrag(palette, box(fixture.idAt(COMMENT)), { x: 0.05, y: 0.5 });

    await expect
      .poll(() => {
        const node = getAt(fixture.model(), [...COMMENT]) as {
          componentProps?: { className?: string };
        };
        return node.componentProps?.className;
      })
      .toBe(DEFAULT_ROW_CLASS);
    // Новое поле встало ПЕРЕД целью: бросок был на левый край.
    const first = getAt(fixture.model(), [...COMMENT, 'children', 0]) as { value?: string };
    expect(first.value).toBe('$model(новое)');
    fixture.unmount();
  });

  it('составной бросок отменяется одним шагом', async () => {
    const fixture = await mount({ withPalette: true });
    const before = JSON.stringify(fixture.model());
    const palette = document.querySelector<HTMLElement>('[draggable="true"]');
    if (palette === null) throw new Error('в палитре нет перетаскиваемой записи');

    await manualDrag(palette, box(fixture.idAt(COMMENT)), { x: 0.05, y: 0.5 });
    await expect.poll(() => JSON.stringify(fixture.model())).not.toBe(before);

    fixture.undo();
    await expect.poll(() => JSON.stringify(fixture.model())).toBe(before);
    fixture.unmount();
  });

  it('перетаскивание колонки ряда на соседнюю переворачивает сам ряд', async () => {
    const fixture = await mount();
    const rowId = fixture.idAt(ROW);
    // Бросок на ВЕРХНИЙ край соседней колонки: в горизонтальном родителе это `stack-before`.
    await manualDrag(box(fixture.idAt(ZIP)), box(fixture.idAt(CITY)), { x: 0.5, y: 0.05 });

    await expect
      .poll(() => {
        const node = indexNodes(fixture.model()).find(rowId)?.node as
          | { componentProps?: { className?: string } }
          | undefined;
        return node?.componentProps?.className;
      })
      .toContain('flex-col');
    fixture.unmount();
  });
});

describe('панель инструментов и кнопки коробки', () => {
  it('переворот направления идёт командой и называет узел', async () => {
    const fixture = await mount();
    const rowId = fixture.idAt(ROW);
    const button = document.querySelector<HTMLElement>(`[data-flip="${rowId}"]`);
    if (button === null) throw new Error('у ряда нет кнопки переворота');

    await userEvent.click(button);
    expect(fixture.run).toHaveBeenCalledWith(FLIP_COMMAND_ID, { nodeId: rowId });
    // Выделение кнопка не трогает: работают над узлом, а не над кнопкой.
    expect(fixture.selection()).toEqual([]);
    fixture.unmount();
  });

  it('переключатель ведёт из дерева в схему и обратно', async () => {
    const fixture = await mount({ withToolbar: true });
    // Умолчание — дерево: у него есть треугольники сворачивания, а у схемы их нет.
    expect(document.querySelector('[data-view="schematic"]')).toBeNull();

    const toSchematic = document.querySelector<HTMLElement>('[aria-label="action.view.schematic"]');
    if (toSchematic === null) throw new Error('нет кнопки перехода в схему');
    await userEvent.click(toSchematic);
    await vi.waitFor(() => {
      if (document.querySelector('[data-view="schematic"]') === null) {
        throw new Error('схема не показалась');
      }
    });

    const toTree = document.querySelector<HTMLElement>('[aria-label="action.view.tree"]');
    if (toTree === null) throw new Error('нет кнопки возврата в дерево');
    await userEvent.click(toTree);
    await vi.waitFor(() => {
      if (document.querySelector('[data-view="schematic"]') !== null) {
        throw new Error('схема осталась на экране');
      }
    });
    fixture.unmount();
  });
});
