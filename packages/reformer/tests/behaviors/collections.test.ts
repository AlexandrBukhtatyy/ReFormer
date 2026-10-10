/**
 * Операторы над массивами и под-моделями (`src/form/behaviors/collections.ts`).
 *
 * `applyEach` держит поведения строк в своём реестре: удаление строки снимает её поведение, снятие
 * поведения формы — поведения всех строк. `apply` кладёт отписку под-схемы в сток родителя. Цель
 * оператора — ручка или фасад модели; ручка не того вида пропускается молча. `exclusiveFlag` и
 * `aggregateInto` пишут в соседние строки отложенно — здесь их сходимость, расходимость и
 * поведение на записях в одном тике.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createModel, type FormModel } from '../../src/model/index';
import { createFormFromModel } from '../../src/form/create-form';
import { registerSignalNode } from '../../src/form/signal-node-registry';
import {
  aggregateInto,
  apply,
  applyEach,
  compute,
  defineFormBehavior,
  exclusiveFlag,
  onChange,
  type FormBehavior,
} from '../../src/form/behaviors';
import type { FormGroup } from '../../src/form/types/index';
import { disposeForm } from '../test-utils/dispose-form';
import { liveEffects } from '../test-utils/effect-tracker';
import { tick } from '../test-utils/async';

vi.mock('@preact/signals-core', async (importOriginal) =>
  (await import('../test-utils/effect-tracker')).trackEffects(await importOriginal())
);

interface Line {
  qty: number;
  price: number;
  total: number;
  primary: boolean;
}
interface Invoice {
  title: string;
  address: { city: string };
  lines: Line[];
}

const line = (qty: number, primary = false): Line => ({ qty, price: 10, total: 0, primary });

const createInvoice = (lines: Line[] = [line(1), line(2)]): FormModel<Invoice> =>
  createModel<Invoice>({ title: '', address: { city: '' }, lines });

const invoiceSchema = (model: FormModel<Invoice>) => ({
  children: [
    {
      model: model.$.lines,
      item: (row: FormModel<Line>) => ({
        children: [{ model: row.$.qty }, { model: row.$.price }, { model: row.$.total }],
      }),
    },
  ],
});

const build = (model: FormModel<Invoice>, behavior: FormBehavior<Invoice>): FormGroup<Invoice> =>
  createFormFromModel<Invoice>({ model, schema: invoiceSchema(model), behavior });

/** Поведение строки: итог строки и журнал реакций на количество. */
const lineBehavior = (log: number[] = []) =>
  defineFormBehavior<Line>(({ model: row }) => {
    compute(row.$.total, () => row.qty * row.price);
    onChange(row.$.qty, (qty) => void log.push(qty));
  });

const flags = (model: FormModel<Invoice>): boolean[] => model.get().lines.map((l) => l.primary);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('collections — applyEach', () => {
  it('вне схемы — понятная ошибка с именем оператора', () => {
    const model = createInvoice();

    expect(() => applyEach(model.$.lines, lineBehavior())).toThrowError(
      /"applyEach" вызван вне defineFormBehavior/
    );
  });

  it('ручка не массива — молча пропускается', () => {
    // поведение под вопросом [ReFormer-nm2x]: ни ошибки, ни предупреждения в dev — опечатка в ручке незаметна.
    const model = createInvoice();
    const rowRuns = vi.fn();
    build(
      model,
      defineFormBehavior<Invoice>(({ model: m }) => {
        applyEach(m.$.address, defineFormBehavior<never>(rowRuns));
        applyEach(m.$.title, defineFormBehavior<never>(rowRuns));
      })
    );

    expect(rowRuns).not.toHaveBeenCalled();
  });

  it('фасад массива (model.lines) принимается наравне с ручкой', () => {
    const model = createInvoice();
    build(
      model,
      defineFormBehavior<Invoice>(({ model: m }) => {
        applyEach(m.lines, lineBehavior());
      })
    );

    expect(model.get().lines.map((l) => l.total)).toEqual([10, 20]);
  });

  it('удалённая строка: её поведение снято, правка её модели ничего не запускает', async () => {
    const model = createInvoice();
    const log: number[] = [];
    build(
      model,
      defineFormBehavior<Invoice>(({ model: m }) => {
        applyEach(m.$.lines, lineBehavior(log));
      })
    );
    const removed = model.lines.at(0);

    model.lines.removeAt(0);
    removed.qty = 99;
    model.lines.at(0).qty = 3;
    await tick();

    expect({ removedTotal: removed.total, keptTotal: model.lines.at(0).total, log }).toEqual({
      removedTotal: 10,
      keptTotal: 30,
      log: [3],
    });
  });

  it('снятие поведения формы снимает поведения всех строк', async () => {
    const model = createInvoice();
    const log: number[] = [];
    const form = build(
      model,
      defineFormBehavior<Invoice>(({ model: m }) => {
        applyEach(m.$.lines, lineBehavior(log));
      })
    );

    disposeForm(form);
    model.lines.at(0).qty = 5;
    model.lines.at(1).qty = 6;
    await tick();

    expect({ totals: model.get().lines.map((l) => l.total), log }).toEqual({
      totals: [10, 20],
      log: [],
    });
  });

  it("после снятия формы с поведениями строк живых effect'ов столько же, сколько до сборки", () => {
    const model = createInvoice();
    const baseline = liveEffects();
    const form = build(
      model,
      defineFormBehavior<Invoice>(({ model: m }) => {
        applyEach(m.$.lines, lineBehavior());
      })
    );
    model.lines.push(line(3));
    model.lines.removeAt(0);
    const whileBuilt = liveEffects();

    disposeForm(form);

    expect({ grew: whileBuilt > baseline, after: liveEffects() }).toEqual({
      grew: true,
      after: baseline,
    });
  });

  it('нематериализованный массив: форма строки отвечает на служебные ключи и бросает на поле', () => {
    const model = createInvoice([line(1)]);
    const seen: unknown[] = [];
    createFormFromModel<Invoice>({
      model, // без схемы: у массива нет формы строк
      behavior: defineFormBehavior<Invoice>(({ model: m }) => {
        applyEach(
          m.$.lines,
          defineFormBehavior<Line>(({ form }) => {
            seen.push((form as unknown as { then?: unknown }).then);
            seen.push(Object.prototype.toString.call(form)); // читает Symbol.toStringTag
            try {
              void form.qty;
            } catch (error) {
              seen.push((error as Error).message);
            }
          })
        );
      }),
    });

    expect(seen.slice(0, 2)).toEqual([undefined, '[object Object]']);
    expect(seen[2]).toMatch(/форма строки массива "lines" недоступна \(form\.qty\)/);
  });

  it('нода массива из чужой сборки: строки без формы и без под-модели пропускаются', () => {
    // Ручка указывает на ноду другой сборки (`registerSignalNode` — публичный API). Нода без
    // длины даёт ноль строк; нода длиннее модели — индексы без под-модели пропускаются.
    const withoutLength = createInvoice([line(1)]);
    const longer = createInvoice([line(1)]);
    const rowForm = createFormFromModel<Line>({ model: createModel<Line>(line(0)) });
    const runs: string[] = [];
    const behaviorFor = (label: string) =>
      defineFormBehavior<Invoice>(({ model: m }) => {
        applyEach(
          m.$.lines,
          defineFormBehavior<Line>(() => void runs.push(label))
        );
      });

    registerSignalNode(withoutLength.$.lines, { at: () => rowForm } as never);
    registerSignalNode(longer.$.lines, { at: () => rowForm, length: 3 } as never);
    createFormFromModel<Invoice>({ model: withoutLength, behavior: behaviorFor('без длины') });
    createFormFromModel<Invoice>({ model: longer, behavior: behaviorFor('длиннее') });

    expect(runs).toEqual(['длиннее']);
  });
});

describe('collections — apply', () => {
  it('вне схемы — понятная ошибка с именем оператора', () => {
    const model = createInvoice();

    expect(() =>
      apply(
        model.$.address,
        defineFormBehavior(() => {})
      )
    ).toThrowError(/"apply" вызван вне defineFormBehavior/);
  });

  it('цели не-группы (массив, лист) пропускаются молча, группа из того же списка подключается', () => {
    // поведение под вопросом [ReFormer-nm2x]: как и у applyEach — без ошибки и без предупреждения в dev.
    const model = createInvoice();
    const runs: unknown[] = [];
    build(
      model,
      defineFormBehavior<Invoice>(({ model: m }) => {
        apply(
          [m.$.lines, m.$.title, m.$.address],
          defineFormBehavior<{ city: string }>(({ model: sub }) => void runs.push(sub.get()))
        );
      })
    );

    expect(runs).toEqual([{ city: '' }]);
  });

  it('фасад группы (model.address) принимается наравне с ручкой', () => {
    const model = createInvoice();
    build(
      model,
      defineFormBehavior<Invoice>(({ model: m }) => {
        apply(
          m.address,
          defineFormBehavior<{ city: string }>(({ model: sub }) => {
            compute(sub.$.city, () => (sub.city === '' ? 'Казань' : sub.city));
          })
        );
      })
    );

    expect(model.address.city).toBe('Казань');
  });

  it('группа без ноды формы: под-схема получает модель, form — undefined', () => {
    const model = createInvoice();
    const foreign = createInvoice(); // формы над этой моделью нет
    const seen: unknown[] = [];
    build(
      model,
      defineFormBehavior<Invoice>(() => {
        apply(
          foreign.$.address,
          defineFormBehavior<{ city: string }>(({ model: sub, form }) => {
            seen.push(form, sub.$.city === foreign.$.address.city);
          })
        );
      })
    );

    expect(seen).toEqual([undefined, true]);
  });

  it('отписка под-схемы снимается вместе с родительским поведением', () => {
    const model = createInvoice();
    const form = build(
      model,
      defineFormBehavior<Invoice>(({ model: m }) => {
        apply(
          m.$.address,
          defineFormBehavior<{ city: string }>(({ model: sub }) => {
            compute(sub.$.city, () => sub.city.trim());
          })
        );
      })
    );

    disposeForm(form);
    model.address.city = '  Самара  ';

    expect(model.address.city).toBe('  Самара  ');
  });
});

describe('collections — exclusiveFlag', () => {
  const exclusive = defineFormBehavior<Invoice>(({ model: m }) => {
    exclusiveFlag<Line>(m.$.lines, (row) => row.$.primary);
  });

  it('вне схемы — понятная ошибка до побочных эффектов', () => {
    const model = createInvoice();

    expect(() => exclusiveFlag<Line>(model.$.lines, (row) => row.$.primary)).toThrowError(
      /"exclusiveFlag" вызван вне defineFormBehavior/
    );
  });

  it('ручка не массива — молча пропускается', () => {
    const model = createInvoice();
    const getFlag = vi.fn();
    build(
      model,
      defineFormBehavior<Invoice>(({ model: m }) => {
        exclusiveFlag(m.$.address, getFlag);
      })
    );

    expect(getFlag).not.toHaveBeenCalled();
  });

  it('выбор строки снимает флаг у остальных; снятие выбора соседей не трогает', async () => {
    const model = createInvoice([line(1, true), line(2), line(3)]);
    build(model, exclusive);
    await tick();

    model.lines.at(2).primary = true;
    await tick();
    const afterSelect = flags(model);
    model.lines.at(2).primary = false;
    await tick();

    expect([afterSelect, flags(model)]).toEqual([
      [false, false, true],
      [false, false, false],
    ]);
  });

  it('новая строка с флагом false исключения не запускает', async () => {
    const model = createInvoice([line(1, true)]);
    build(model, exclusive);

    model.lines.push(line(2));
    await tick();

    expect(flags(model)).toEqual([true, false]);
  });

  it('строка, добавленная с флагом true, прежний выбор не снимает', async () => {
    // поведение под вопросом [ReFormer-nm2x]: исключение срабатывает на СМЕНУ флага, а новая строка с true его не
    // меняет — в массиве два основных. То же с начальными данными, где флаг стоит у двух строк.
    const model = createInvoice([line(1, true)]);
    build(model, exclusive);

    model.lines.push(line(2, true));
    await tick();

    expect(flags(model)).toEqual([true, true]);
  });

  it('удалённая строка в исключении больше не участвует', async () => {
    const model = createInvoice([line(1), line(2), line(3)]);
    build(model, exclusive);
    const removed = model.lines.at(0);
    model.lines.removeAt(0);

    model.lines.at(1).primary = true;
    removed.primary = true; // строки в массиве нет — соседей она не трогает
    await tick();

    expect(flags(model)).toEqual([false, true]);
  });

  it('два выбора в одном тике оставляют ровно одну выбранную строку [ReFormer-qh2c]', async () => {
    const model = createInvoice([line(1), line(2), line(3)]);
    build(model, exclusive);
    await tick();

    model.lines.at(1).primary = true;
    model.lines.at(2).primary = true;
    await tick();

    expect(flags(model).filter(Boolean)).toHaveLength(1);
  });

  it('выбор и отмена выбора в одном тике не снимают прежний выбор [ReFormer-qh2c]', async () => {
    const model = createInvoice([line(1, true), line(2), line(3)]);
    build(model, exclusive);
    await tick();

    model.lines.at(2).primary = true;
    model.lines.at(2).primary = false;
    await tick();

    expect(model.lines.at(0).primary).toBe(true);
  });
});

describe('collections — aggregateInto', () => {
  /** Последняя строка добирает количество до 100. */
  const toHundred = (rows: Line[]) => {
    if (rows.length === 0) return [];
    const others = rows.slice(0, -1).reduce((sum, row) => sum + row.qty, 0);
    return [{ index: rows.length - 1, patch: { qty: 100 - others } }];
  };

  it('вне схемы — понятная ошибка с именем оператора', () => {
    const model = createInvoice();

    expect(() => aggregateInto<Line>(model.$.lines, toHundred)).toThrowError(
      /"aggregateInto" вызван вне defineFormBehavior/
    );
  });

  it('ручка не массива — молча пропускается', async () => {
    const model = createInvoice();
    const derive = vi.fn(() => []);
    build(
      model,
      defineFormBehavior<Invoice>(({ model: m }) => {
        aggregateInto(m.$.address, derive);
      })
    );
    await tick();

    expect(derive).not.toHaveBeenCalled();
  });

  it('сходимость: серия синхронных правок — проход по финальному состоянию и проверочный', async () => {
    const model = createInvoice([line(10)]);
    const derive = vi.fn(toHundred);
    build(
      model,
      defineFormBehavior<Invoice>(({ model: m }) => {
        aggregateInto<Line>(m.$.lines, derive);
      })
    );
    await tick();
    derive.mockClear();

    for (let i = 0; i < 5; i++) model.lines.push(line(5));
    model.lines.at(0).qty = 20;
    await tick();

    expect({
      passes: derive.mock.calls.map(([rows]) => rows.length),
      qty: model.get().lines.map((l) => l.qty),
    }).toEqual({ passes: [6, 6], qty: [20, 5, 5, 5, 5, 60] });
  });

  it('индекс за пределами массива пропускается без ошибки', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const model = createInvoice();
    build(
      model,
      defineFormBehavior<Invoice>(({ model: m }) => {
        aggregateInto<Line>(m.$.lines, () => [
          { index: 5, patch: { qty: 0 } },
          { index: 1, patch: { price: 1 } },
        ]);
      })
    );
    await tick();

    expect({ prices: model.get().lines.map((l) => l.price), errors: error.mock.calls }).toEqual({
      prices: [10, 1],
      errors: [],
    });
  });

  it('снятие поведения останавливает агрегатную запись', async () => {
    const model = createInvoice([line(10), line(0)]);
    const form = build(
      model,
      defineFormBehavior<Invoice>(({ model: m }) => {
        aggregateInto<Line>(m.$.lines, toHundred);
      })
    );
    await tick();
    const settled = model.lines.at(1).qty;

    disposeForm(form);
    model.lines.at(0).qty = 40;
    await tick();

    expect([settled, model.lines.at(1).qty]).toEqual([90, 90]);
  });

  /** Расходящаяся derive с предохранителем: после `fuse` вызовов сходится сама. */
  const divergent = (fuse: number) => {
    const derive = vi.fn((rows: Line[]) =>
      derive.mock.calls.length > fuse ? [] : [{ index: 0, patch: { qty: rows[0].qty + 1 } }]
    );
    return derive;
  };

  it('расходимость: после 50 проходов ошибка уходит в console.error', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const model = createInvoice([line(0)]);
    build(
      model,
      defineFormBehavior<Invoice>(({ model: m }) => {
        aggregateInto<Line>(m.$.lines, divergent(120));
      })
    );
    await tick();

    expect(error).toHaveBeenCalledWith(
      '[runOutsideEffect]',
      expect.objectContaining({
        message: expect.stringMatching(
          /aggregateInto\("lines"\): запись не сходится \(>50 проходов\)/
        ),
      })
    );
  });

  it('после ошибки расхождения проходы прекращаются [ReFormer-qarz]', async () => {
    // Без предохранителя derive текущая реализация гоняла бы микротаски бесконечно — тест не
    // дождался бы даже своего таймаута.
    const derive = divergent(300);
    let callsAtError: number | undefined;
    vi.spyOn(console, 'error').mockImplementation(() => {
      callsAtError ??= derive.mock.calls.length;
    });
    const model = createInvoice([line(0)]);
    build(
      model,
      defineFormBehavior<Invoice>(({ model: m }) => {
        aggregateInto<Line>(m.$.lines, derive);
      })
    );
    await tick();

    expect(derive.mock.calls.length).toBe(callsAtError);
  });
});
