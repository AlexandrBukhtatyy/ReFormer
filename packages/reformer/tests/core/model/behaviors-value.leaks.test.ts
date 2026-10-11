/**
 * Value-операции модели — утечки (`src/model/behaviors-value.ts`).
 *
 * Что cleanup останавливает реакцию и отменяет ожидающую запись, проверено в
 * `behaviors-value-dispose.test.ts`. Здесь — что от операции после cleanup не остаётся подписки:
 * - счёт effect'ов: сколько держит каждая операция, пока жива, и что cleanup (и повторный cleanup)
 *   возвращает счётчик к базе; записи в модель effect'ы не пересоздают;
 * - сборщик мусора: пока операция жива, сигнал-источник держит её колбэк (и всё, что тот
 *   замкнул), а после cleanup — отпускает, хотя модель жива.
 * Таблица операций сверена со списком экспортов модуля.
 */

import { describe, expect, it, vi } from 'vitest';
import { tick } from '../../test-utils/async';
import { createdEffects, liveEffects } from '../../test-utils/effect-tracker';
import { collectGarbage, collectUntilReleased } from '../../test-utils/gc';
import { createModel, type FormModel } from '../../../src/model/index';
import * as valueOperations from '../../../src/model/behaviors-value';
import type { BehaviorCleanup } from '../../../src/model/behaviors-value';

vi.mock('@preact/signals-core', async (importOriginal) =>
  (await import('../../test-utils/effect-tracker')).trackEffects(await importOriginal())
);

const { computeFrom, copyFrom, resetWhen, revalidateWhen, syncFields, transformValue, watchField } =
  valueOperations;

interface Sample {
  source: string;
  target: string;
  count: number;
  total: number;
  on: boolean;
}

const createSample = (): FormModel<Sample> =>
  createModel<Sample>({ source: '', target: '', count: 1, total: 0, on: false });

/** Операция модели: сколько effect'ов держит и как её запустить с колбэком `touch` внутри. */
interface Operation {
  readonly name: keyof typeof valueOperations;
  readonly effects: number;
  /** Запустить операцию; `touch` вызывается из её колбэка — так колбэк замыкает объект теста. */
  readonly start: (model: FormModel<Sample>, touch: () => void) => BehaviorCleanup;
  /** Правка модели, на которую операция реагирует. */
  readonly poke: (model: FormModel<Sample>, step: number) => void;
}

const operations: Operation[] = [
  {
    name: 'computeFrom',
    effects: 1,
    start: (model, touch) =>
      computeFrom([model.$.count], model.$.total, (count: number) => {
        touch();
        return count * 2;
      }),
    poke: (model, step) => {
      model.count = step + 2;
    },
  },
  {
    name: 'copyFrom',
    effects: 1,
    start: (model, touch) =>
      copyFrom(model.$.source, model.$.target, {
        transform: (value) => {
          touch();
          return value;
        },
      }),
    poke: (model, step) => {
      model.source = `копия ${step}`;
    },
  },
  {
    name: 'watchField',
    effects: 1,
    start: (model, touch) => watchField(model.$.source, touch),
    poke: (model, step) => {
      model.source = `значение ${step}`;
    },
  },
  {
    name: 'transformValue',
    effects: 1,
    start: (model, touch) =>
      transformValue(model.$.source, (value) => {
        touch();
        return value.trim();
      }),
    poke: (model, step) => {
      model.source = ` текст ${step} `;
    },
  },
  {
    name: 'resetWhen',
    effects: 1,
    start: (model, touch) =>
      resetWhen(
        model.$.target,
        () => {
          touch();
          return model.on;
        },
        { resetValue: '' }
      ),
    poke: (model, step) => {
      model.on = step % 2 === 0;
    },
  },
  {
    name: 'syncFields',
    effects: 2,
    start: (model, touch) =>
      syncFields(model.$.source, model.$.target, {
        transform: (value) => {
          touch();
          return value;
        },
      }),
    poke: (model, step) => {
      model.source = `связь ${step}`;
    },
  },
  {
    name: 'revalidateWhen',
    effects: 1,
    start: (model, touch) => revalidateWhen([model.$.count], touch),
    poke: (model, step) => {
      model.count = step + 2;
    },
  },
];

describe("behaviors-value — счёт effect'ов", () => {
  it('таблица покрывает все value-операции модуля', () => {
    const exported = Object.keys(valueOperations).filter(
      (name) => typeof valueOperations[name as keyof typeof valueOperations] === 'function'
    );

    expect(operations.map((operation) => operation.name).sort()).toEqual(exported.sort());
  });

  for (const { name, effects, start } of operations) {
    it(`${name}: держит effect'ов — ${effects}; cleanup возвращает к базе, повторный ничего не меняет`, async () => {
      const model = createSample();
      const base = liveEffects();
      const createdBefore = createdEffects();

      const stop = start(model, () => {});
      await tick();
      const held = liveEffects() - base;
      stop();
      const afterCleanup = liveEffects() - base;
      stop();

      expect({
        held,
        created: createdEffects() - createdBefore,
        afterCleanup,
        again: liveEffects() - base,
      }).toEqual({ held: effects, created: effects, afterCleanup: 0, again: 0 });
    });
  }

  for (const { name, start, poke } of operations) {
    it(`${name}: 20 записей в модель effect'ы не пересоздают`, async () => {
      const model = createSample();
      const calls = vi.fn();
      const stop = start(model, calls);
      await tick();
      const createdBefore = createdEffects();
      const callsBefore = calls.mock.calls.length;

      for (let step = 0; step < 20; step++) {
        poke(model, step);
        await Promise.resolve();
      }
      await tick();
      const reacted = calls.mock.calls.length > callsBefore;
      stop();

      expect({ reacted, created: createdEffects() - createdBefore }).toEqual({
        reacted: true,
        created: 0,
      });
    });
  }
});

describe('behaviors-value — подписка после cleanup', () => {
  /**
   * Запустить операцию, колбэк которой замыкает отдельный объект, и отдать на него слабую ссылку.
   * Сам cleanup наружу не выходит: функция снятия держит effect, а тот — колбэк.
   */
  function subscribe(
    model: FormModel<Sample>,
    operation: Operation,
    cleanup: boolean
  ): WeakRef<object> {
    const payload = { held: `замкнут колбэком ${operation.name}` };
    const stop = operation.start(model, () => void payload.held);
    if (cleanup) stop();
    return new WeakRef(payload);
  }

  for (const operation of operations) {
    it(`${operation.name}: без cleanup источник держит колбэк, после cleanup — отпускает`, async () => {
      const model = createSample();
      const released = subscribe(model, operation, true);
      const kept = subscribe(model, operation, false);

      await collectUntilReleased([released]);
      // Контроль честный: сборка мусора прошла только что — колбэк без cleanup её пережил.
      await tick();
      collectGarbage();

      expect({
        released: released.deref() === undefined,
        kept: kept.deref() === undefined,
        // Модель жива: колбэк отпустила операция, а не сборщик вместе с моделью.
        alive: model.count,
      }).toEqual({ released: true, kept: false, alive: 1 });
    });
  }
});
