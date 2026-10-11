/**
 * Стратегии живой проверки — утечки (`src/form/validation/strategy.ts`).
 *
 * Контроллер стратегии до `start()` чист, после — держит один effect (подписка на значения или на
 * `touched` полей) и, с `debounce`, таймер. Поведение стратегий проверено в
 * `form-validation-strategy.test.ts`; здесь — что от контроллера после `dispose()` ничего не
 * остаётся, по каждой стратегии (`change`, `change` + `debounce`, `blur`, `afterFirstSubmit` во
 * всех режимах живой фазы):
 * - счёт effect'ов: `start()` и повторный `start()`, `dispose()` и повторный `dispose()`;
 * - живые срабатывания effect'ы не пересоздают, ожидающий таймер снят, после снятия ни правка, ни
 *   уход из поля прогон не запускают;
 * - строки массива, добавленные после `start()`, новых effect'ов не требуют;
 * - 20 циклов `start()` → `dispose()` (StrictMode, перемонтирование) не копят ни effect'ы, ни
 *   таймеры;
 * - прогон, идущий в момент снятия.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { advance, deferred, flushMicrotasks, useFakeClock } from '../../test-utils/async';
import { createdEffects, liveEffects } from '../../test-utils/effect-tracker';
import { disposeForm } from '../../test-utils/dispose-form';
import { arrayOf, createModel, type FormModel } from '../../../src/model/index';
import { createFormFromModel } from '../../../src/form/create-form';
import { required } from '../../../src/form/validators';
import {
  applyEach,
  defineValidation,
  validate,
  validateAsync,
  type ValidationDefinition,
} from '../../../src/form/validation';
import {
  createFormValidation,
  type ValidationStrategyOptions,
} from '../../../src/form/validation/strategy';
import type { FormGroup } from '../../../src/form/types/nodes';
import type { ValidationIssue } from '../../../src/form/types/contracts';

vi.mock('@preact/signals-core', async (importOriginal) =>
  (await import('../../test-utils/effect-tracker')).trackEffects(await importOriginal())
);

interface Row {
  label: string;
}
interface Profile {
  name: string;
  email: string;
  rows: Row[];
}

/** Формы текущего теста: после теста их effect'ы массивов снимаются. */
const forms: object[] = [];

afterEach(() => {
  for (const form of forms.splice(0)) disposeForm(form);
  vi.useRealTimers();
});

function createProfile(): { model: FormModel<Profile>; form: FormGroup<Profile> } {
  const model = createModel<Profile>({
    name: '',
    email: '',
    rows: arrayOf((): Row => ({ label: '' }), [{ label: '' }]),
  });
  const form = createFormFromModel<Profile>({
    model,
    schema: {
      children: [
        { model: model.$.name },
        { model: model.$.email },
        { model: model.$.rows, item: (row: FormModel<Row>) => ({ model: row.$.label }) },
      ],
    },
  });
  forms.push(form);
  return { model, form };
}

const rowRules = defineValidation<Row>(({ model }) => {
  validate(model.$.label, [required()]);
});

/** Правила профиля со счётчиком прогонов; на каждый тест — своя ссылка. */
function countedRules(): { runs: ReturnType<typeof vi.fn>; rules: ValidationDefinition<Profile> } {
  const runs = vi.fn();
  const rules = defineValidation<Profile>(({ model }) => {
    runs();
    validate(model.$.name, [required()]);
    applyEach(model.$.rows, rowRules);
  });
  return { runs, rules };
}

/** Стратегия в таблице: опции контроллера и сколько effect'ов держит армированная стратегия. */
interface Strategy {
  readonly name: string;
  readonly options: ValidationStrategyOptions;
  readonly effects: number;
}

const DEBOUNCE = 300;

const strategies: Strategy[] = [
  { name: 'submit', options: {}, effects: 0 },
  { name: 'change', options: { strategy: 'change' }, effects: 1 },
  { name: 'change + debounce', options: { strategy: 'change', debounce: DEBOUNCE }, effects: 1 },
  { name: 'blur', options: { strategy: 'blur' }, effects: 1 },
  { name: 'afterFirstSubmit', options: { strategy: 'afterFirstSubmit' }, effects: 1 },
  {
    name: 'afterFirstSubmit + debounce',
    options: { strategy: 'afterFirstSubmit', debounce: DEBOUNCE },
    effects: 1,
  },
  {
    name: 'afterFirstSubmit + blur',
    options: { strategy: 'afterFirstSubmit', liveAfterSubmit: 'blur' },
    effects: 1,
  },
];

const liveStrategies = strategies.filter((strategy) => strategy.effects > 0);

/** Режим живой фазы: правка значения либо уход из поля. */
const liveModeOf = ({ strategy, liveAfterSubmit }: ValidationStrategyOptions): 'change' | 'blur' =>
  strategy === 'blur' || (strategy === 'afterFirstSubmit' && liveAfterSubmit === 'blur')
    ? 'blur'
    : 'change';

/** Действие пользователя, на которое стратегия отвечает живым прогоном. */
function userAction(
  options: ValidationStrategyOptions,
  { model, form }: { model: FormModel<Profile>; form: FormGroup<Profile> },
  step: number
): void {
  if (liveModeOf(options) === 'change') {
    model.name = `имя ${step}`;
  } else {
    // Стратегия `blur` следит за уходами из поля: каждый `markAsTouched()` — уход, и повторный тоже.
    form.name.markAsTouched();
  }
}

describe("form-validation-strategy — счёт effect'ов", () => {
  for (const { name, options, effects } of strategies) {
    it(`${name}: до start() чисто, start() держит effect'ов — ${effects}, dispose() возвращает к базе`, () => {
      const { model } = createProfile();
      const { rules } = countedRules();
      const base = liveEffects();
      const createdBefore = createdEffects();

      const controller = createFormValidation(model, rules, options);
      const idle = liveEffects() - base;
      controller.start();
      controller.start();
      const armed = { live: liveEffects() - base, created: createdEffects() - createdBefore };
      controller.dispose();
      const disposed = liveEffects() - base;
      controller.dispose();

      expect({ idle, armed, disposed, again: liveEffects() - base }).toEqual({
        idle: 0,
        armed: { live: effects, created: effects },
        disposed: 0,
        again: 0,
      });
    });
  }

  it('dispose() из start() и dispose() контроллера — одно и то же снятие', () => {
    const { model } = createProfile();
    const { rules } = countedRules();
    const controller = createFormValidation(model, rules, { strategy: 'blur' });
    const base = liveEffects();

    const stop = controller.start();
    stop();
    const afterStop = liveEffects() - base;
    controller.dispose();
    stop();

    expect({ afterStop, again: liveEffects() - base }).toEqual({ afterStop: 0, again: 0 });
  });
});

describe('form-validation-strategy — живая фаза и снятие', () => {
  for (const { name, options } of liveStrategies) {
    it(`${name}: 20 срабатываний effect'ы не пересоздают; снятие снимает таймер, дальше — тишина`, async () => {
      useFakeClock();
      const subject = createProfile();
      const { runs, rules } = countedRules();
      const controller = createFormValidation(subject.model, rules, options);
      controller.start();
      if (options.strategy === 'afterFirstSubmit') await controller.validate();
      runs.mockClear();
      const createdBefore = createdEffects();

      for (let step = 0; step < 20; step++) {
        userAction(options, subject, step);
        await advance(options.debounce ?? 0);
      }
      const live = runs.mock.calls.length;
      // Ещё одно действие — и сразу снятие: у стратегии с задержкой таймер в этот момент ждёт.
      userAction(options, subject, 20);
      const pending = vi.getTimerCount();
      controller.dispose();
      const timers = vi.getTimerCount();
      runs.mockClear();
      for (let step = 21; step < 41; step++) userAction(options, subject, step);
      await advance(DEBOUNCE * 2);

      expect({
        live,
        created: createdEffects() - createdBefore,
        pending,
        timers,
        afterDispose: runs.mock.calls.length,
      }).toEqual({
        live: 20,
        created: 0,
        pending: options.debounce ? 1 : 0,
        timers: 0,
        afterDispose: 0,
      });
    });
  }

  for (const { name, options } of liveStrategies) {
    it(`${name}: строки, добавленные и удалённые после start(), новых effect'ов не требуют`, async () => {
      useFakeClock();
      const { model } = createProfile();
      const { rules } = countedRules();
      const controller = createFormValidation(model, rules, options);
      const base = liveEffects();
      controller.start();
      const createdBefore = createdEffects();

      for (let index = 0; index < 5; index++) model.rows.push({ label: `строка ${index}` });
      model.rows.removeAt(0);
      model.rows.move(0, 2);
      await advance(DEBOUNCE);
      const withRows = { live: liveEffects() - base, created: createdEffects() - createdBefore };
      controller.dispose();

      expect({ withRows, disposed: liveEffects() - base, timers: vi.getTimerCount() }).toEqual({
        withRows: { live: 1, created: 0 },
        disposed: 0,
        timers: 0,
      });
    });
  }

  for (const { name, options } of liveStrategies) {
    it(`${name}: 20 циклов start() → dispose() не копят effect'ы и таймеры`, async () => {
      useFakeClock();
      const subject = createProfile();
      const { rules } = countedRules();
      const controller = createFormValidation(subject.model, rules, options);
      if (options.strategy === 'afterFirstSubmit') await controller.validate();
      const base = liveEffects();
      const createdBefore = createdEffects();
      const drift = new Set<string>();

      for (let cycle = 0; cycle < 20; cycle++) {
        controller.start();
        userAction(options, subject, cycle);
        controller.dispose();
        drift.add(`${liveEffects() - base}/${vi.getTimerCount()}`);
      }
      await advance(DEBOUNCE * 2);

      // Один effect на каждый start() — и ни одного после dispose().
      expect({ drift: [...drift], created: createdEffects() - createdBefore }).toEqual({
        drift: ['0/0'],
        created: 20,
      });
    });
  }
});

describe('form-validation-strategy — прогон, идущий в момент снятия', () => {
  // Было: `dispose()` снимал подписку и таймер, но не живой прогон — его `AbortController`
  // принадлежит паре «модель + схема» и срабатывал только от следующего прогона. Запрос
  // async-правила оставался висеть, поле — в `pending`, а пришедший ответ разносился по нодам.
  it('dispose() отменяет идущий живой прогон — signal async-правила прерван [ReFormer-4xy9]', async () => {
    const { model } = createProfile();
    const answer = deferred<ValidationIssue | null>();
    const signals: AbortSignal[] = [];
    const rules = defineValidation<Profile>(({ model: profile }) => {
      validateAsync(profile.$.email, [
        (_value, { signal }) => {
          signals.push(signal);
          return answer.promise;
        },
      ]);
    });
    const controller = createFormValidation(model, rules, { strategy: 'change' });
    controller.start();
    model.email = 'anna@example.ru';
    await flushMicrotasks();

    controller.dispose();

    try {
      expect(signals.map((signal) => signal.aborted)).toEqual([true]);
    } finally {
      answer.resolve(null);
    }
  });
});
