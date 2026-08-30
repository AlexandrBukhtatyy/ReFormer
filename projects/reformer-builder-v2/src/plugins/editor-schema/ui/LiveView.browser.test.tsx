/**
 * Живой вид конструктора в настоящем браузере.
 *
 * Проверяется здесь то, чего в node-прогоне нет вовсе: жизненный цикл монтирования чужой
 * поверхности внутри React-дерева редактора. Правила выбора поверхности проверены портом
 * ([live-surface.test.ts](../../../app/live-surface.test.ts)), правила моста — его собственным
 * тестом; сюда остаётся один, но несущий вопрос.
 *
 * ## Инвариант, ради которого файл и написан
 *
 * **Правка модели не перемонтирует поверхность.** Перемонтирование теряет фокус в поле,
 * прокрутку и введённые значения, а схему в конструкторе правят непрерывно — то есть ошибка
 * здесь означала бы форму, которая моргает на каждое нажатие. Никаким способом, кроме
 * настоящего React в настоящем браузере, это не проверяется: в node `useEffect` не выполняется
 * вовсе, и счётчик монтирований остался бы нулём при любой реализации.
 *
 * @module plugins/editor-schema/ui/LiveView.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { useMemo, type ReactElement } from 'react';
import { sampleSchema } from '@/lib/form-model/__fixtures__/sample-schema';
import { NODE_CLASS_PREFIX } from '@/lib/form-model/node-token';
import { renderReact } from '@/testing/render';
import { createCanvasPrefs, type CanvasPrefs } from '../canvas-prefs';
import type { CommandAccess } from '../commands';
import { indexNodes } from '../node-index';
import { setPropOp } from '../ops';
import { createDragSession, DRAG_MIME, type DragSession } from '../drag-session';
import { createSessionRegistry, type SessionRegistry } from '../sessions';
import { createFakeLivePort, createFakeSchemaHost, type FakeLivePort } from '../testing';
import { Canvas } from './Canvas';
import { useActiveSession, useSessionState } from './useSession';

const DOCUMENT = 'fake:form.json';

/** Реестр команд, которого живому виду не нужно: кнопок исправлений здесь нет. */
const NO_COMMANDS: CommandAccess = { has: () => false, run: () => undefined };

interface Fixture {
  readonly registry: SessionRegistry;
  readonly live: FakeLivePort;
  readonly drag: DragSession;
  readonly prefs: CanvasPrefs;
  readonly idAt: (path: readonly (string | number)[]) => string;
  readonly apply: (op: ReturnType<typeof setPropOp>) => void;
  readonly unmount: () => void;
}

function Harness({
  registry,
  prefs,
  live,
  drag,
}: {
  registry: SessionRegistry;
  prefs: CanvasPrefs;
  live: FakeLivePort | null;
  drag: DragSession;
}): ReactElement {
  const session = useActiveSession(registry);
  const state = useSessionState(registry, session);
  const t = useMemo(() => (key: string) => key, []);

  if (session === null || state === null) return <div>сеанса нет</div>;
  return (
    <div style={{ width: 420, height: 300 }}>
      <Canvas
        session={session}
        state={state}
        t={t}
        commands={NO_COMMANDS}
        prefs={prefs}
        live={live}
        drag={drag}
      />
    </div>
  );
}

function mount(options: { live?: FakeLivePort | null; view?: 'live' | 'tree' } = {}): Fixture {
  const host = createFakeSchemaHost({
    documentId: DOCUMENT,
    text: JSON.stringify(sampleSchema(), null, 2),
  });
  const registry = createSessionRegistry({ host });
  registry.open(DOCUMENT);

  const prefs = createCanvasPrefs();
  prefs.setView(options.view ?? 'live');
  const live = options.live === undefined ? createFakeLivePort() : options.live;

  const drag = createDragSession();
  const rendered = renderReact(
    <Harness registry={registry} prefs={prefs} live={live} drag={drag} />
  );

  const model = () => registry.get(DOCUMENT)?.get().model ?? sampleSchema();
  return {
    registry,
    live: live ?? createFakeLivePort({ empty: true }),
    drag,
    prefs,
    idAt: (path) => {
      const id = indexNodes(model()).idAt(path);
      if (id === undefined) throw new Error(`нет узла по пути ${path.join('/')}`);
      return id;
    },
    apply: (op) => {
      registry.get(DOCUMENT)?.apply(op);
    },
    unmount: rendered.unmount,
  };
}

describe('живой вид', () => {
  it('правка модели не перемонтирует поверхность', async () => {
    const fixture = mount();
    try {
      await vi.waitFor(() => {
        expect(fixture.live.mounts()).toBe(1);
      });

      const target = fixture.idAt(['root']);
      for (let index = 0; index < 10; index += 1) {
        fixture.apply(setPropOp(target, 'className', `bg-white p-${index}`));
      }

      // Десять правок — по-прежнему одно монтирование: схема доходит до формы подпиской,
      // а не пересозданием поверхности.
      await vi.waitFor(() => {
        expect(fixture.live.mounts()).toBe(1);
      });
    } finally {
      fixture.unmount();
    }
  });

  it('правка модели доходит до поверхности: она перерисовывает форму', async () => {
    const fixture = mount();
    try {
      const boxes = (): number =>
        document.querySelectorAll(`[class*="${NODE_CLASS_PREFIX}"]`).length;
      await vi.waitFor(() => {
        expect(boxes()).toBeGreaterThan(0);
      });
      const before = boxes();

      // Поверхность рисует узел на каждый адрес: удаление узла обязано убрать и его коробку.
      const step = fixture.idAt(['root', 'componentProps', 'steps', 1]);
      fixture.registry.get(DOCUMENT)?.apply({ type: 'remove', target: step });

      await vi.waitFor(() => {
        expect(boxes()).toBeLessThan(before);
      });
    } finally {
      fixture.unmount();
    }
  });

  it('поверхность названа вслух: от неё зависит, работает ли валидация формы', async () => {
    const fixture = mount({ live: createFakeLivePort({ notice: 'источник запретил исполнение' }) });
    try {
      await vi.waitFor(() => {
        expect(document.body.textContent).toContain('live.surface');
        expect(document.body.textContent).toContain('источник запретил исполнение');
      });
    } finally {
      fixture.unmount();
    }
  });

  it('поверхность без хит-теста честно говорит, что узлы не выделяются', async () => {
    const fixture = mount({ live: createFakeLivePort({ hitTest: false }) });
    try {
      await vi.waitFor(() => {
        expect(document.body.textContent).toContain('live.no-hit-test');
      });
    } finally {
      fixture.unmount();
    }
  });

  it('без применимой поверхности живой вид объясняет пустоту словами', async () => {
    const fixture = mount({ live: createFakeLivePort({ empty: true }) });
    try {
      await vi.waitFor(() => {
        expect(document.body.textContent).toContain('live.no-surface');
      });
      expect(fixture.live.mounts()).toBe(0);
    } finally {
      fixture.unmount();
    }
  });

  it('без порта вовсе показывается дерево, а не пустое место', async () => {
    const fixture = mount({ live: null });
    try {
      // Предпочтение «форма» могло приехать из сборки, где плагин превью был включён.
      await vi.waitFor(() => {
        expect(document.querySelector('[role="tree"]')).not.toBeNull();
      });
    } finally {
      fixture.unmount();
    }
  });

  /** Элемент узла в смонтированной форме. */
  function boxOf(id: string): HTMLElement {
    const found = document.querySelector(`.${NODE_CLASS_PREFIX}${id}`);
    if (!(found instanceof HTMLElement)) throw new Error(`нет коробки узла ${id}`);
    return found;
  }

  const click = (altKey: boolean): MouseEvent => new MouseEvent('click', { bubbles: true, altKey });

  it('Alt+клик выбирает узел, по которому попали', async () => {
    const fixture = mount();
    try {
      await vi.waitFor(() => {
        expect(fixture.live.mounts()).toBe(1);
      });
      const target = fixture.idAt(['root', 'componentProps', 'steps', 0]);

      boxOf(target).dispatchEvent(click(true));

      await expect.poll(() => fixture.registry.get(DOCUMENT)?.get().selection).toEqual([target]);
    } finally {
      fixture.unmount();
    }
  });

  it('щелчок без модификатора уходит в форму и выделение не двигает', async () => {
    const fixture = mount();
    try {
      await vi.waitFor(() => {
        expect(fixture.live.mounts()).toBe(1);
      });
      const target = fixture.idAt(['root']);

      boxOf(target).dispatchEvent(click(false));

      expect(fixture.registry.get(DOCUMENT)?.get().selection).toEqual([]);
    } finally {
      fixture.unmount();
    }
  });

  it('Alt+клик мимо узлов снимает выделение: «здесь узла нет» — это ответ', async () => {
    const fixture = mount();
    try {
      await vi.waitFor(() => {
        expect(fixture.live.mounts()).toBe(1);
      });
      const target = fixture.idAt(['root']);
      boxOf(target).dispatchEvent(click(true));
      await expect.poll(() => fixture.registry.get(DOCUMENT)?.get().selection).toEqual([target]);

      const empty = document.querySelector('[data-rb-live]');
      expect(empty).not.toBeNull();
      empty?.dispatchEvent(click(true));

      await expect.poll(() => fixture.registry.get(DOCUMENT)?.get().selection).toEqual([]);
    } finally {
      fixture.unmount();
    }
  });

  it('выделенный узел подсвечен, соседний — нет', async () => {
    const fixture = mount();
    try {
      await vi.waitFor(() => {
        expect(fixture.live.mounts()).toBe(1);
      });
      const first = fixture.idAt(['root', 'componentProps', 'steps', 0]);
      const second = fixture.idAt(['root', 'componentProps', 'steps', 1]);

      boxOf(first).dispatchEvent(click(true));

      // Каскад, а не атрибут: подсветка — правило CSS по классу-токену, и проверять её
      // можно только вычисленным стилем в настоящем браузере.
      await expect.poll(() => getComputedStyle(boxOf(first)).outlineWidth).not.toBe('0px');
      expect(getComputedStyle(boxOf(second)).outlineWidth).toBe('0px');
    } finally {
      fixture.unmount();
    }
  });

  it('поверхность без хит-теста узлы не выделяет вовсе', async () => {
    const fixture = mount({ live: createFakeLivePort({ hitTest: false }) });
    try {
      await vi.waitFor(() => {
        expect(fixture.live.mounts()).toBe(1);
      });
      const target = fixture.idAt(['root']);

      boxOf(target).dispatchEvent(click(true));

      // Слушателей нет вовсе: читать чужой realm нечем, и полоса об этом уже сказала.
      expect(fixture.registry.get(DOCUMENT)?.get().selection).toEqual([]);
    } finally {
      fixture.unmount();
    }
  });

  it('обычный клик по форме выделение не меняет: форма настоящая', async () => {
    const fixture = mount();
    try {
      await vi.waitFor(() => {
        expect(fixture.live.mounts()).toBe(1);
      });
      const target = fixture.idAt(['root']);

      // Так поверхность сообщает о клике по своему хит-тесту.
      fixture.live.ctx()?.select([target]);

      expect(fixture.registry.get(DOCUMENT)?.get().selection).toEqual([]);
    } finally {
      fixture.unmount();
    }
  });
});

describe('перетаскивание в живой форме', () => {
  /** Элемент узла в смонтированной форме. */
  function boxOf(id: string): HTMLElement {
    const found = document.querySelector(`.${NODE_CLASS_PREFIX}${id}`);
    if (!(found instanceof HTMLElement)) throw new Error(`нет коробки узла ${id}`);
    return found;
  }

  /** Груз с палитры: браузер отдаёт на `dragover` только типы, сам груз живёт в сеансе. */
  function transfer(): DataTransfer {
    const data = new DataTransfer();
    data.setData(DRAG_MIME, 'полезная нагрузка лежит в сеансе');
    return data;
  }

  function dragEvent(type: string, element: HTMLElement, at: 'middle' | 'left'): DragEvent {
    const rect = element.getBoundingClientRect();
    return new DragEvent(type, {
      bubbles: true,
      cancelable: true,
      dataTransfer: transfer(),
      clientX: at === 'left' ? rect.left + rect.width * 0.05 : rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    });
  }

  /** Видимый указатель броска в оверлее. */
  function indicatorShown(): boolean {
    const overlay = document.querySelector('[data-rb-live] .absolute.inset-0');
    if (overlay === null) return false;
    return [...overlay.children].some((child) => child instanceof HTMLElement && !child.hidden);
  }

  const NEW_NODE = { value: '$model(новое)', component: '$component(Input)' } as const;

  it('бросок с палитры добавляет узел в модель', async () => {
    const fixture = mount();
    try {
      await vi.waitFor(() => {
        expect(fixture.live.mounts()).toBe(1);
      });
      const before = JSON.stringify(fixture.registry.get(DOCUMENT)?.get().model).length;
      const step = fixture.idAt(['root', 'componentProps', 'steps', 0]);
      fixture.drag.begin({ kind: 'new', node: NEW_NODE });

      const element = boxOf(step);
      element.dispatchEvent(dragEvent('dragover', element, 'middle'));
      element.dispatchEvent(dragEvent('drop', element, 'middle'));

      await expect
        .poll(() => JSON.stringify(fixture.registry.get(DOCUMENT)?.get().model).length)
        .toBeGreaterThan(before);
    } finally {
      fixture.unmount();
    }
  });

  it('один Ctrl+Z отменяет бросок целиком', async () => {
    const fixture = mount();
    try {
      await vi.waitFor(() => {
        expect(fixture.live.mounts()).toBe(1);
      });
      const model = () => JSON.stringify(fixture.registry.get(DOCUMENT)?.get().model);
      const before = model();
      const step = fixture.idAt(['root', 'componentProps', 'steps', 0]);
      fixture.drag.begin({ kind: 'new', node: NEW_NODE });

      const element = boxOf(step);
      element.dispatchEvent(dragEvent('dragover', element, 'middle'));
      element.dispatchEvent(dragEvent('drop', element, 'middle'));
      await expect.poll(model).not.toBe(before);

      expect(fixture.registry.get(DOCUMENT)?.undo()).toBe(true);

      // Составная операция — одна запись истории: обёрточный бросок собирается из нескольких
      // правок, но отменяться обязан одним движением.
      await expect.poll(model).toBe(before);
    } finally {
      fixture.unmount();
    }
  });

  it('указатель броска показывается, а уход за пределы формы его гасит', async () => {
    const fixture = mount();
    try {
      await vi.waitFor(() => {
        expect(fixture.live.mounts()).toBe(1);
      });
      const step = fixture.idAt(['root', 'componentProps', 'steps', 0]);
      fixture.drag.begin({ kind: 'new', node: NEW_NODE });

      const element = boxOf(step);
      element.dispatchEvent(dragEvent('dragover', element, 'middle'));
      await expect.poll(indicatorShown).toBe(true);

      // Уход НАРУЖУ, а не между вложенными элементами: второе прилетает постоянно.
      element.dispatchEvent(
        new DragEvent('dragleave', { bubbles: true, dataTransfer: transfer(), relatedTarget: null })
      );
      await expect.poll(indicatorShown).toBe(false);
    } finally {
      fixture.unmount();
    }
  });

  it('без груза в сеансе бросок не принимается: тащат не наше', async () => {
    const fixture = mount();
    try {
      await vi.waitFor(() => {
        expect(fixture.live.mounts()).toBe(1);
      });
      const before = JSON.stringify(fixture.registry.get(DOCUMENT)?.get().model);
      const step = fixture.idAt(['root', 'componentProps', 'steps', 0]);

      const element = boxOf(step);
      element.dispatchEvent(dragEvent('dragover', element, 'middle'));
      element.dispatchEvent(dragEvent('drop', element, 'middle'));

      expect(indicatorShown()).toBe(false);
      expect(JSON.stringify(fixture.registry.get(DOCUMENT)?.get().model)).toBe(before);
    } finally {
      fixture.unmount();
    }
  });

  it('ручка появляется у выделенного узла и кладёт его в сеанс перетаскивания', async () => {
    const fixture = mount();
    try {
      await vi.waitFor(() => {
        expect(fixture.live.mounts()).toBe(1);
      });
      const target = fixture.idAt(['root', 'componentProps', 'steps', 0]);
      fixture.registry.get(DOCUMENT)?.setSelection([target]);

      const grip = await vi.waitFor(() => {
        const found = document.querySelector('[data-rb-live] button[draggable="true"]');
        if (!(found instanceof HTMLElement) || found.hidden) throw new Error('ручки нет');
        return found;
      });

      grip.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer() })
      );

      // Груз читается ИЗ СЕАНСА: на `dragover` браузер данные не отдаёт, только типы.
      expect(fixture.drag.payload()).toEqual({ kind: 'node', id: target });
    } finally {
      fixture.unmount();
    }
  });

  it('у невыделенного узла ручки нет: она не бегает за курсором', async () => {
    const fixture = mount();
    try {
      await vi.waitFor(() => {
        expect(fixture.live.mounts()).toBe(1);
      });
      const grip = document.querySelector('[data-rb-live] button[draggable="true"]');
      expect(grip instanceof HTMLElement && grip.hidden).toBe(true);
    } finally {
      fixture.unmount();
    }
  });
});
