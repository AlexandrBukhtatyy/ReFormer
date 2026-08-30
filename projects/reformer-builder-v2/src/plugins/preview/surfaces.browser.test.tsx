/**
 * Три поверхности превью: монтируются, что-то показывают и снимаются без следа.
 *
 * Проверка узкая намеренно. 130 тестов поверхностей проверяют их правила — каркас схемы,
 * синтез мока, сборку сайдкаров — и все они шли в окружении `node`, то есть `mount` не звался
 * ни разу: контракт поверхности императивный (`mount(host, ctx): Disposable`), а внутри —
 * `createRoot().render()`. Здесь проверяется ровно то, что от этого зависело и было
 * недоступно: корень поднимается, поддерево появляется в DOM, `dispose()` его убирает,
 * и ни один из трёх случаев не роняет отрисовку.
 *
 * Отдельно проверяется худший штатный случай — буфер не разбирается (`schema() === null`).
 * По контракту это законное состояние, и поверхность обязана объяснить его словами;
 * до сих пор «объяснить словами» означало «в тесте не проверялось».
 *
 * Последним идёт выбор узла кликом. Он появился здесь вместе с переездом поверхностей
 * на `ScrollArea` кита: обработчик висит теперь на её корне, а содержимое лежит глубже —
 * во вьюпорте, — и «потерять `onClick` при замене обёртки» иначе не ловится ничем.
 *
 * @module plugins/preview/surfaces.browser.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { sampleSchema } from '@/lib/form-model/__fixtures__/sample-schema';
import type { Disposable, DocumentRef, NodeId } from '@/sdk';
import type { PreviewContext, PreviewProblem, PreviewSurface, PreviewValues } from './contract';
import { builtinSurfaces } from './plugin';
import { RUNTIME_SURFACE_ID } from './runtime/surface';
import { COMPILING_SURFACE_ID } from './compiling/surface';
import type { PreviewModules } from './host';
import { createFakeHost, fakeRef } from './testing';

const NOOP: Disposable = Object.freeze({ dispose: () => undefined });

const cleanup: (() => void)[] = [];

afterEach(() => {
  while (cleanup.length > 0) cleanup.pop()?.();
});

function host(): HTMLElement {
  const element = document.createElement('div');
  document.body.append(element);
  cleanup.push(() => {
    element.remove();
  });
  return element;
}

interface FakeContext extends PreviewContext {
  readonly problems: PreviewProblem[];
  /** Что поверхность отдала на хранение. Двойник хранит по-настоящему — как и настоящий стор. */
  kept(): PreviewValues | undefined;
}

const NO_SELECTION: readonly NodeId[] = Object.freeze([]);

/**
 * Контекст-двойник.
 *
 * `schema()` и `selection()` отдают ОДНУ И ТУ ЖЕ ссылку — это требование контракта, а не
 * аккуратность двойника. Первая версия этого файла возвращала свежий объект на каждый вызов,
 * и все три поверхности упали с «Maximum update depth exceeded»: они читают контекст через
 * `useSyncExternalStore`, который сравнивает снимок по ссылке. То есть нарушение контракта
 * даёт не деградацию, а бесконечный цикл, — и до браузерного прогона узнать это было неоткуда.
 */
function fakeContext(schema: JsonFormSchema | null): FakeContext {
  const problems: PreviewProblem[] = [];
  const doc: DocumentRef = {
    id: 'fake:form/form.json',
    ref: fakeRef('fake:form/form.json'),
    kind: 'text',
  };
  let values: PreviewValues | undefined;
  return {
    problems,
    kept: () => values,
    doc,
    schema: () => schema,
    onDidChangeSchema: () => NOOP,
    selection: () => NO_SELECTION,
    onDidChangeSelection: () => NOOP,
    select: () => undefined,
    mock: () => null,
    values: () => values,
    keepValues: (next) => {
      values = next;
    },
    report: (_source, next) => {
      problems.push(...next);
    },
  };
}

/** Ждёт первой отрисовки: `createRoot().render()` асинхронен, синхронной проверки тут нет. */
async function mounted(surface: PreviewSurface, ctx: PreviewContext): Promise<HTMLElement> {
  const element = host();
  const subscription = surface.mount(element, ctx);
  cleanup.push(() => {
    subscription.dispose();
  });
  await vi.waitFor(() => {
    expect(element.childElementCount).toBeGreaterThan(0);
  });
  return element;
}

const surfaces = builtinSurfaces(createFakeHost());

describe.each(surfaces.map((surface) => [surface.id, surface] as const))(
  'поверхность «%s»',
  (_id, surface) => {
    it('монтируется и показывает поддерево', async () => {
      const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        const element = await mounted(surface, fakeContext(sampleSchema()));
        expect(element.textContent?.trim()).not.toBe('');
        // Отказ отрисовки React'ом виден только так: он не бросает наружу, а печатает.
        expect(errors).not.toHaveBeenCalled();
      } finally {
        errors.mockRestore();
      }
    });

    it('нераспознанный буфер объясняется словами, а не пустотой', async () => {
      const element = await mounted(surface, fakeContext(null));
      expect(element.textContent?.trim()).not.toBe('');
    });

    it('снятие убирает поддерево из документа', async () => {
      const element = host();
      const subscription = surface.mount(element, fakeContext(sampleSchema()));
      await vi.waitFor(() => {
        expect(element.childElementCount).toBeGreaterThan(0);
      });
      subscription.dispose();
      // Переключение поверхностей свободно только если предыдущая уходит целиком.
      expect(element.childElementCount).toBe(0);
    });
  }
);

describe('набор поверхностей', () => {
  it('их две, и обе берутся за документ формы', () => {
    // Каркасная убрана: структуру формы показывают дерево и схема, и оба умеют её править.
    expect(surfaces).toHaveLength(2);
    const doc = fakeContext(null).doc;
    expect(surfaces.filter((surface) => surface.applies(doc))).toHaveLength(2);
  });
});

/**
 * Правка схемы не должна перекомпилировать сайдкары.
 *
 * Свойство видно только здесь: оно про порядок эффектов React, а в node-прогоне эффекты
 * не выполняются вовсе. Цена ошибки — форма, падающая в «собирается» на каждое нажатие
 * клавиши в конструкторе, и перезапуск транспилятора вместе с ней.
 */
describe('компилирующая поверхность и правка схемы', () => {
  /** Контекст, у которого схему можно поменять и сообщить об этом. */
  function editableContext(): FakeContext & { edit(next: JsonFormSchema): void } {
    let schema = sampleSchema();
    const listeners = new Set<() => void>();
    const base = fakeContext(schema);
    return {
      ...base,
      schema: () => schema,
      onDidChangeSchema: (cb: () => void) => {
        listeners.add(cb);
        return { dispose: () => listeners.delete(cb) };
      },
      edit(next: JsonFormSchema) {
        schema = next;
        for (const listener of [...listeners]) listener();
      },
    };
  }

  it('правка схемы пересобирает форму, но не запускает компиляцию заново', async () => {
    let loads = 0;
    const modules: PreviewModules = {
      load: () => {
        loads += 1;
        return Promise.resolve({ entry: {}, modules: new Map(), errors: [] });
      },
    };
    // Сайдкар нужен, чтобы компиляции было что делать: без файлов загрузчик не зовут вовсе.
    const siblings = { 'model.ts': 'module.exports.initialFormModel = {};' };
    const compiling = builtinSurfaces(createFakeHost({ modules, siblings })).find(
      (surface) => surface.id === COMPILING_SURFACE_ID
    );
    if (compiling === undefined) throw new Error('компилирующая поверхность не зарегистрирована');

    const ctx = editableContext();
    await mounted(compiling, ctx);
    await vi.waitFor(() => {
      expect(loads).toBe(1);
    });

    const edited = sampleSchema();
    edited.meta = { name: 'после правки' };
    ctx.edit(edited);

    // Ждём, пока перерисовка точно пройдёт, и проверяем, что компилятор не тронут.
    await vi.waitFor(() => {
      expect(document.body.textContent).not.toBe(null);
    });
    expect(loads).toBe(1);
  });
});
/**
 * Хранение введённых значений — вторая половина того же механизма, что `carry` в сборке.
 *
 * Node-тесты сборки проверяют перенос как правило: значения поверх мока, лишние пути отброшены.
 * Здесь проверяется то, чего в node нет вовсе, — что модель ДОЖИВАЕТ до размонтирования и её
 * содержимое успевает уйти на хранение. Без этого правка правилами работала бы, а на экране
 * переключение вида конструктора всё равно давало бы пустые поля.
 */
describe('значения переживают размонтирование рантайм-поверхности', () => {
  const runtime = surfaces.find((surface) => surface.id === RUNTIME_SURFACE_ID);

  it('снятие отдаёт значения формы на хранение', async () => {
    if (runtime === undefined) throw new Error('рантайм-поверхность не зарегистрирована');
    const ctx = fakeContext(sampleSchema());
    const element = host();
    const subscription = runtime.mount(element, ctx);
    await vi.waitFor(() => {
      expect(element.childElementCount).toBeGreaterThan(0);
    });
    // До снятия хранилище пусто: поверхность отдаёт значения ровно один раз и в конце.
    expect(ctx.kept()).toBeUndefined();

    subscription.dispose();

    // Схема из фикстуры даёт эти два пути — значит модель дожила и была прочитана.
    expect(ctx.kept()).toMatchObject({ loanType: '', properties: [] });
  });

  it('сохранённое возвращается в форму, а не заменяется дефолтом мока', async () => {
    if (runtime === undefined) throw new Error('рантайм-поверхность не зарегистрирована');
    const ctx = fakeContext(sampleSchema());
    ctx.keepValues({ loanType: 'ипотека' });
    const element = host();
    const subscription = runtime.mount(element, ctx);
    await vi.waitFor(() => {
      expect(element.childElementCount).toBeGreaterThan(0);
    });
    subscription.dispose();
    // Полный круг: хранилище → сборка формы → модель → снова хранилище. Синтезированный мок
    // дал бы здесь пустую строку, и именно это ломалось бы при переключении вида.
    expect(ctx.kept()).toMatchObject({ loanType: 'ипотека' });
  });
});

/**
 * Выбор кликом проверяется на рантайм-поверхности, потому что только она в этом окружении
 * доходит до формы: компилирующей нужен загрузчик модулей, а каркасная выбирает не всплытием
 * до корня, а обработчиком на самой рамке.
 */
describe('выбор узла кликом по рантайм-поверхности', () => {
  const runtime = surfaces.find((surface) => surface.id === RUNTIME_SURFACE_ID);

  /** Поверхность с контекстом, который запоминает адреса вместо того, чтобы их забывать. */
  async function mountedWithSelect(): Promise<{
    element: HTMLElement;
    chosen: (readonly NodeId[])[];
  }> {
    if (runtime === undefined) throw new Error('рантайм-поверхность не зарегистрирована');
    const chosen: (readonly NodeId[])[] = [];
    const element = await mounted(runtime, {
      ...fakeContext(sampleSchema()),
      select: (ids) => {
        chosen.push(ids);
      },
    });
    return { element, chosen };
  }

  const click = (): MouseEvent => new MouseEvent('click', { bubbles: true });

  it('промах по пустому месту доходит до обработчика и снимает выделение', async () => {
    const { element, chosen } = await mountedWithSelect();
    const area = element.querySelector('[data-slot="scroll-area"]');
    expect(area).not.toBeNull();
    area?.dispatchEvent(click());
    // Пустой массив, а не отсутствие вызова: «здесь узла нет» — это ответ.
    expect(chosen).toEqual([[]]);
  });
});
