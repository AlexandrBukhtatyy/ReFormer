/**
 * Перетаскивание в настоящем браузере.
 *
 * Файл существует потому, что перетаскивание — тот случай, где обычный прогон почти ничего
 * не доказывает. Правила («куда встанет», «что при этом свернётся») проверены без DOM
 * в [drag.test.ts](../drag.test.ts); здесь остаётся ровно то, что без Chromium невыразимо:
 *
 * - **геометрия.** Зона броска считается по `getBoundingClientRect`, а у jsdom нет движка
 *   раскладки — там любая высота `0px`, и «верхняя четверть строки» проверялась бы на нуле;
 * - **сам механизм HTML5 drag-and-drop.** `dataTransfer`, защищённый режим на `dragover`,
 *   `preventDefault` как разрешение броска — всего этого в jsdom нет вовсе, и подделка
 *   проверяла бы подделку;
 * - **шов между двумя панелями.** Палитра и канвас не видят друг друга и общаются через сеанс
 *   перетаскивания. Работает ли этот шов, видно только когда груз действительно едет мышью
 *   из одного поддерева React в другое;
 * - **один Ctrl+Z на один бросок.** Составная операция обязана отменяться одним шагом, и это
 *   свойство живого документа, а не чистой функции.
 *
 * ## Два способа довести событие, и оба нужны
 *
 * `userEvent.dragAndDrop` идёт через playwright, то есть через настоящий драг браузера, — но
 * бросает В ЦЕНТР цели и координату задать не даёт. Поэтому им проверяется то, что от координаты
 * не зависит (доехал ли груз вообще), а зоны строки — рассылкой `DragEvent` с явным `clientY`
 * поверх НАСТОЯЩЕЙ раскладки. Второй способ слабее по достоверности события и сильнее по
 * точности; вместе они закрывают и то и другое.
 *
 * ## Утверждения повторяющиеся, а не «сделал — проверил»
 *
 * React коммитит вне цикла теста, поэтому ожидания пишутся через `expect.poll`/`vi.waitFor`
 * (то же правило, что в `testing/render`). Там, где следующее ДЕЙСТВИЕ зависит от раскладки
 * после предыдущего, стоит {@link flush}: координата броска считается по экрану, и считать
 * её по несовершённой перерисовке значило бы целиться в прошлое.
 *
 * @module plugins/editor-schema/ui/Canvas.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { useMemo, type ReactElement } from 'react';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { sampleSchema } from '@/lib/form-model/__fixtures__/sample-schema';
import type { CatalogEntry } from '@/lib/catalog/types';
import { renderReact } from '@/testing/render';
import type { CommandAccess } from '../editing/commands';
import { createDragSession, DRAG_MIME, type DragSession } from '../session/drag-session';
import { indexNodes } from '../model/node-index';
import { applyEditOp, groupOp } from '../model/ops';
import { createSessionRegistry, type SessionRegistry } from '../session/sessions';
import { createFakeSchemaHost } from '../testing';
import { createCollapseRegistry, type CollapseRegistry } from '../session/view-state';
import { Canvas } from './Canvas';
import { PalettePanel } from './PalettePanel';
import { useActiveSession, useSessionState } from './useSession';

const DOCUMENT = 'fake:form.json';

/** Реестр команд, которого перетаскиванию не нужно: кнопок исправлений в этих тестах нет. */
const NO_COMMANDS: CommandAccess = { has: () => false, run: () => undefined };

const STEP_0 = ['root', 'componentProps', 'steps', 0] as const;
const STEP_1 = ['root', 'componentProps', 'steps', 1] as const;

const CATALOG: readonly CatalogEntry[] = [
  {
    name: 'Input',
    role: 'field',
    category: 'Поля ввода',
    propsSchema: { type: 'object', properties: {} },
    makeNode: () => ({ value: '$model(новое)', component: '$component(Input)' }),
  },
];

interface Fixture {
  readonly registry: SessionRegistry;
  readonly drag: DragSession;
  readonly viewStates: CollapseRegistry;
  readonly model: () => JsonFormSchema;
  readonly idAt: (path: readonly (string | number)[]) => string;
  readonly undo: () => boolean;
  readonly unmount: () => void;
}

/** Тело редактора в объёме, нужном перетаскиванию: канвас и палитра над одним сеансом. */
function Harness({
  registry,
  drag,
  viewStates,
  withPalette,
}: {
  registry: SessionRegistry;
  drag: DragSession;
  viewStates: CollapseRegistry;
  withPalette: boolean;
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

  if (session === null || state === null) return <div>сеанса нет</div>;
  return (
    <div className="flex">
      {withPalette && (
        <div style={{ width: 220 }}>
          <PalettePanel host={host} registry={registry} drag={drag} />
        </div>
      )}
      <div style={{ width: 420 }}>
        <Canvas
          session={session}
          state={state}
          t={(key) => key}
          commands={NO_COMMANDS}
          drag={drag}
          viewStates={viewStates}
        />
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

async function mount(options: { text?: string; withPalette?: boolean } = {}): Promise<Fixture> {
  const text = options.text ?? JSON.stringify(sampleSchema());
  const host = createFakeSchemaHost({ documentId: DOCUMENT, text, catalog: CATALOG });
  const registry = createSessionRegistry({ host });
  const session = registry.open(DOCUMENT);
  if (session === null) throw new Error('сеанс не открылся');

  const drag = createDragSession();
  const viewStates = createCollapseRegistry();
  const mounted = renderReact(
    <Harness
      registry={registry}
      drag={drag}
      viewStates={viewStates}
      withPalette={options.withPalette ?? false}
    />
  );

  await vi.waitFor(() => {
    if (mounted.container.querySelector('[data-node-id]') === null) {
      throw new Error('дерево ещё не отрисовано');
    }
  });

  const model = (): JsonFormSchema => session.get().model;
  return {
    registry,
    drag,
    viewStates,
    model,
    idAt: (path) => {
      const id = indexNodes(model()).idAt(path);
      if (id === undefined) throw new Error(`нет адреса по пути ${path.join('/')}`);
      return id;
    },
    undo: () => session.undo(),
    unmount: mounted.unmount,
  };
}

function row(id: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-node-id="${id}"]`);
  if (element === null) throw new Error(`строки ${id} нет на экране`);
  return element;
}

/** Груз для рассылки вручную: типы читаются на `dragover`, значение — только на `drop`. */
function transfer(): DataTransfer {
  const data = new DataTransfer();
  data.setData(DRAG_MIME, 'груз');
  return data;
}

/**
 * Разослать событие перетаскивания в точку строки по доле её высоты.
 *
 * Доля, а не пиксели: высота строки задана стилями кита, и число здесь означало бы «столько,
 * сколько было в день написания теста».
 */
function dispatchDrag(
  target: HTMLElement,
  type: 'dragover' | 'drop',
  fraction: number,
  data: DataTransfer
): void {
  const rect = target.getBoundingClientRect();
  target.dispatchEvent(
    new DragEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height * fraction,
      dataTransfer: data,
    })
  );
}

/** Полный ручной бросок: начало на источнике, наведение и отпускание в долю высоты цели. */
async function manualDrag(
  source: HTMLElement,
  target: HTMLElement,
  fraction: number
): Promise<void> {
  const data = transfer();
  source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: data }));
  dispatchDrag(target, 'dragover', fraction, data);
  await flush();
  dispatchDrag(target, 'drop', fraction, data);
  source.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: data }));
  await flush();
}

/** Адреса строк дерева сверху вниз — то, что человек видит. */
function shownRows(): (string | undefined)[] {
  return [...document.querySelectorAll<HTMLElement>('[data-node-id]')].map(
    (element) => element.dataset.nodeId
  );
}

describe('перетаскивание на канвасе', () => {
  it('строки объявлены перетаскиваемыми — иначе браузер драг не начнёт вовсе', async () => {
    const fixture = await mount();
    expect(row(fixture.idAt([...STEP_0, 'children', 0])).getAttribute('draggable')).toBe('true');
    fixture.unmount();
  });

  it('настоящий драг мышью переносит узел внутрь контейнера', async () => {
    const fixture = await mount();
    const field = fixture.idAt([...STEP_0, 'children', 0]);
    const step1 = fixture.idAt(STEP_1);

    await userEvent.dragAndDrop(row(field), row(step1));

    // Центр строки-контейнера — зона «внутрь»: узел стал последним ребёнком второго шага.
    await expect
      .poll(() => indexNodes(fixture.model()).idAt([...STEP_1, 'children', 1]))
      .toBe(field);
    fixture.unmount();
  });

  it('верхняя четверть строки означает «перед», нижняя — «после»', async () => {
    const fixture = await mount();
    const first = fixture.idAt([...STEP_0, 'children', 0]);
    const second = fixture.idAt([...STEP_0, 'children', 1]);

    // Считается по НАСТОЯЩЕЙ высоте строки — тому, чего в jsdom нет.
    expect(row(second).getBoundingClientRect().height).toBeGreaterThan(0);

    await manualDrag(row(second), row(first), 0.1);
    expect(indexNodes(fixture.model()).idAt([...STEP_0, 'children', 0])).toBe(second);

    await manualDrag(row(second), row(first), 0.9);
    expect(indexNodes(fixture.model()).idAt([...STEP_0, 'children', 1])).toBe(second);
    fixture.unmount();
  });

  it('подсветка появляется на `dragover` и показывает выбранное место', async () => {
    const fixture = await mount();
    const first = fixture.idAt([...STEP_0, 'children', 0]);
    const second = fixture.idAt([...STEP_0, 'children', 1]);
    const data = transfer();

    row(second).dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: data }));
    dispatchDrag(row(first), 'dragover', 0.1, data);

    await expect.poll(() => row(first).getAttribute('data-drop')).toBe('before');
    fixture.unmount();
  });

  it('запрещённый бросок не подсвечивается и ничего не делает', async () => {
    const fixture = await mount();
    const array = fixture.idAt([...STEP_1, 'children', 0]);
    const template = fixture.idAt([...STEP_1, 'children', 0, 'item', '$template']);
    const before = fixture.model();
    const data = transfer();

    row(array).dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: data }));
    dispatchDrag(row(template), 'dragover', 0.5, data);
    await flush();
    expect(row(template).getAttribute('data-drop')).toBeNull();

    dispatchDrag(row(template), 'drop', 0.5, data);
    await flush();
    // Та же модель ПО ССЫЛКЕ: не «похожая», а не тронутая.
    expect(fixture.model()).toBe(before);
    fixture.unmount();
  });

  it('чужой груз канвас не принимает: файл из проводника не станет узлом', async () => {
    const fixture = await mount();
    const first = fixture.idAt([...STEP_0, 'children', 0]);
    const before = fixture.model();
    const foreign = new DataTransfer();
    foreign.setData('text/plain', 'что-то своё');

    dispatchDrag(row(first), 'dragover', 0.1, foreign);
    await flush();
    expect(row(first).getAttribute('data-drop')).toBeNull();

    dispatchDrag(row(first), 'drop', 0.1, foreign);
    await flush();
    expect(fixture.model()).toBe(before);
    fixture.unmount();
  });
});

describe('перетаскивание с палитры', () => {
  it('груз доезжает из панели палитры в канвас и становится узлом', async () => {
    const fixture = await mount({ withPalette: true });
    const step1 = fixture.idAt(STEP_1);
    const item = page.getByRole('button', { name: 'palette.add' });

    await userEvent.dragAndDrop(item.element(), row(step1));

    await expect
      .poll(
        () =>
          (fixture.model() as unknown as StepsShape).root.componentProps.steps[1].children.length
      )
      .toBe(2);
    fixture.unmount();
  });
});

/** Форма фикстуры, к которой обращаются проверки «сколько детей у шага». */
interface StepsShape {
  root: { componentProps: { steps: { children: unknown[] }[] } };
}

describe('сворачивание вырожденной обёртки', () => {
  /** Схема, где два поля первого шага завёрнуты в flex-ряд. */
  function withRow(): string {
    const host = createFakeSchemaHost({
      documentId: 'fake:seed.json',
      text: JSON.stringify(sampleSchema()),
    });
    const registry = createSessionRegistry({ host });
    const session = registry.open('fake:seed.json');
    if (session === null) throw new Error('сеанс не открылся');
    const model = session.get().model;
    const index = indexNodes(model);
    const first = index.idAt([...STEP_0, 'children', 0]);
    const second = index.idAt([...STEP_0, 'children', 1]);
    if (first === undefined || second === undefined) throw new Error('нет адресов полей');
    return JSON.stringify(
      applyEditOp(model, groupOp([first, second], { className: 'flex gap-4' })).model
    );
  }

  it('вынос колонки убирает ряд, а ОДИН откат возвращает и узел, и ряд с прежним адресом', async () => {
    const fixture = await mount({ text: withRow() });
    const before = fixture.model();
    const rowId = fixture.idAt([...STEP_0, 'children', 0]);
    const column = fixture.idAt([...STEP_0, 'children', 0, 'children', 1]);
    const step1 = fixture.idAt(STEP_1);

    await manualDrag(row(column), row(step1), 0.5);

    // Ряд исчез: на его месте стоит оставшаяся колонка.
    expect(indexNodes(fixture.model()).find(rowId)).toBeUndefined();
    expect(indexNodes(fixture.model()).idAt([...STEP_1, 'children', 1])).toBe(column);

    // ОДИН откат, а не два: перемещение и сворачивание — один шаг.
    expect(fixture.undo()).toBe(true);
    expect(fixture.model()).toEqual(before);
    expect(fixture.idAt([...STEP_0, 'children', 0])).toBe(rowId);
    fixture.unmount();
  });
});

describe('состояние вида', () => {
  it('свёрнутая ветка переживает размонтирование тела редактора', async () => {
    const first = await mount();
    const step0 = first.idAt(STEP_0);
    const field = first.idAt([...STEP_0, 'children', 0]);
    expect(shownRows()).toContain(field);

    const toggle = row(step0).querySelector('button');
    if (toggle === null) throw new Error('у строки-контейнера нет треугольника');
    await userEvent.click(toggle);
    await expect.poll(() => shownRows().includes(field)).toBe(false);

    // Так выглядит уход на другую вкладку и возврат: тело пересоздаётся, реестры остаются.
    first.unmount();
    const again = renderReact(
      <Harness
        registry={first.registry}
        drag={first.drag}
        viewStates={first.viewStates}
        withPalette={false}
      />
    );

    await expect.poll(() => shownRows().includes(step0)).toBe(true);
    // Ветка осталась свёрнутой: снимок вида пережил размонтирование, а не собрался заново.
    expect(shownRows()).not.toContain(field);
    again.unmount();
  });
});
