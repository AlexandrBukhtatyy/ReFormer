/**
 * Уровень формы в бандле `createForm`: `validate`, `validateStep` и поток шагов.
 *
 * Здесь — `validateStep` без потока, сигнал `validating`, отмена перехода шага, если модель
 * изменилась, пока шла проверка, проверка в одном тике с правкой (правила ждут отложенных записей
 * поведения) и согласие статуса проверки с агрегатом `valid` формы (выключенные поля, строки
 * массива). Отправка — в `submission.test.ts`.
 */

import { describe, it, expect, vi } from 'vitest';
import { deferred, tick, type Deferred } from '../../test-utils/async';
import { issueCodes } from '../../test-utils/issues';
import { InputStub } from '../../test-utils/stubs';
import { createForm } from '../../../src/form/form-bundle';
import { defineFormBehavior, enableWhen, onChange } from '../../../src/form/behaviors';
import {
  applyEach,
  defineValidation,
  validate,
  validateAsync,
  validateModel,
} from '../../../src/form/validation';
import { required } from '../../../src/form/validators';
import type { FormModel } from '../../../src/model/types';
import type { ValidationIssue } from '../../../src/form/types/contracts';
import {
  contactsRules,
  controlledAmountRules,
  createShape,
  loanRules,
  type Shape,
} from './shape-form.fixture';

describe('createForm — поток шагов', () => {
  it('поток из конфига: шаги по порядку, переход проверяет правила шага', async () => {
    const bundle = createShape();

    expect(bundle.flow?.steps).toEqual(['loan', 'contacts', 'confirm']);
    expect(await bundle.flow!.next()).toMatchObject({ status: 'stayed', reason: 'invalid' });
    expect(bundle.form.amount.issues.value).toEqual([{ code: 'required' }]);

    bundle.model.amount = '100';
    expect(await bundle.flow!.next()).toEqual({ status: 'moved', from: 'loan', to: 'contacts' });
  });

  it('без `flow` потока нет', () => {
    expect(createForm<Shape>({ initial: { amount: '', phone: '' } }).flow).toBeUndefined();
  });

  it('поведение получает поток', () => {
    const seen: unknown[] = [];
    const bundle = createForm<Shape>({
      initial: { amount: '', phone: '' },
      flow: { steps: [{ id: 'a' }, { id: 'b' }] },
      behavior: defineFormBehavior<Shape>(({ flow }) => {
        seen.push(flow);
      }),
    });

    expect(seen).toEqual([bundle.flow]);
  });

  it('повтор шага в потоке — исключение', () => {
    expect(() =>
      createForm<Shape>({
        initial: { amount: '', phone: '' },
        flow: { steps: [{ id: 'a' }, { id: 'a' }] },
      })
    ).toThrow('шаг потока «a» повторяется');
  });
});

describe('createForm — validate и validateStep', () => {
  it('validate прогоняет правила всех шагов и extras', async () => {
    const extras = defineValidation<Shape>(({ model, cross }) => {
      cross(model.$.phone, (shape) => (shape.phone === shape.amount ? { code: 'same' } : null));
    });
    const bundle = createForm<Shape>({
      initial: { amount: '1', phone: '1' },
      flow: { steps: [{ id: 'loan', rules: loanRules }] },
      validation: { extras },
    });

    const result = await bundle.validate();

    expect(result.status).toBe('invalid');
    expect(bundle.form.phone.issues.value).toEqual([{ code: 'same' }]);
  });

  it('validate без правил — valid', async () => {
    const bundle = createForm<Shape>({ initial: { amount: '', phone: '' } });

    expect((await bundle.validate()).status).toBe('valid');
  });

  it('validateStep — правила одного шага; шаг без правил — valid', async () => {
    const bundle = createShape();

    expect((await bundle.validateStep('contacts')).status).toBe('invalid');
    expect(bundle.form.amount.issues.value).toEqual([]);
    expect((await bundle.validateStep('confirm')).status).toBe('valid');
  });

  it('неизвестный шаг — исключение', async () => {
    const bundle = createShape();

    await expect(bundle.validateStep('missing')).rejects.toThrow('шага «missing» нет в потоке');
  });

  it('validation.rules — полный набор вместо правил шагов', async () => {
    const bundle = createForm<Shape>({
      initial: { amount: '', phone: '' },
      flow: { steps: [{ id: 'loan', rules: loanRules }] },
      validation: { rules: contactsRules },
    });

    await bundle.validate();

    expect(bundle.form.phone.issues.value).toEqual([{ code: 'required' }]);
    expect(bundle.form.amount.issues.value).toEqual([]);
  });
});

describe('createForm — выключенные поля в проверке формы', () => {
  // `enableWhen` переключает доступность вне эффекта — на следующем микротаске: тесты ждут `tick()`.

  /** Телефон обязателен, но выключен поведением, пока сумма пуста. */
  const createWithDisabledPhone = (initial: Shape = { amount: '', phone: '' }) =>
    createForm<Shape>({
      initial,
      behavior: defineFormBehavior<Shape>(({ model }) => {
        enableWhen(model.$.phone, () => model.amount !== '');
      }),
      validation: contactsRules,
    });

  it('submit: правило выключенного поля не делает форму invalid', async () => {
    const bundle = createWithDisabledPhone();
    const handler = vi.fn(() => 'ok');
    await tick();

    expect(bundle.form.phone.disabled.value).toBe(true);
    expect(await bundle.submission.submit(handler)).toEqual({ status: 'submitted', result: 'ok' });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(bundle.form.phone.issues.value).toEqual([]);
  });

  it('статус прогона совпадает с агрегатом valid формы', async () => {
    const bundle = createWithDisabledPhone();
    await tick();

    const result = await bundle.validate();

    expect(result.status).toBe('valid');
    expect(bundle.form.valid.value).toBe(true);
  });

  it('включённое снова поле проверяется', async () => {
    const bundle = createWithDisabledPhone();
    await tick();
    await bundle.validate();

    bundle.model.amount = '100';
    await tick();
    expect(bundle.form.phone.disabled.value).toBe(false);

    expect((await bundle.validate()).status).toBe('invalid');
    expect(bundle.form.phone.issues.value).toEqual([{ code: 'required' }]);
  });

  it('замечание, выставленное до выключения, гасится следующим прогоном', async () => {
    const bundle = createWithDisabledPhone({ amount: '100', phone: '' });
    await tick();
    expect((await bundle.validate()).status).toBe('invalid');

    bundle.model.amount = '';
    await tick();
    expect((await bundle.validate()).status).toBe('valid');
    expect(bundle.form.phone.issues.value).toEqual([]);
  });

  it('validateStep: выключенное поле шага не держит переход', async () => {
    const bundle = createForm<Shape>({
      initial: { amount: '', phone: '' },
      behavior: defineFormBehavior<Shape>(({ model }) => {
        enableWhen(model.$.phone, () => model.amount !== '');
      }),
      flow: { steps: [{ id: 'contacts', rules: contactsRules }, { id: 'confirm' }] },
    });
    await tick();

    expect((await bundle.validateStep('contacts')).status).toBe('valid');
    expect(await bundle.flow!.next()).toEqual({ status: 'moved', from: 'contacts', to: 'confirm' });
  });

  describe('поле внутри выключенной группы', () => {
    interface Order {
      delivery: { needed: boolean; address: string };
      comment: string;
    }

    /** Адрес обязателен; поведение включает его по флажку, не глядя на состояние группы. */
    const createOrder = () =>
      createForm<Order>({
        initial: { delivery: { needed: false, address: '' }, comment: '' },
        behavior: defineFormBehavior<Order>(({ model }) => {
          enableWhen(model.$.delivery.address, () => model.delivery.needed);
        }),
        validation: defineValidation<Order>(({ model }) => {
          validate(model.$.delivery.address, [required()]);
        }),
      });

    // Группу выключили вручную (режим просмотра), затем условие включило поле внутри неё. Агрегат
    // `valid` выключенную группу пропускает целиком. Раньше проверка смотрела только на ноду самого
    // поля: статус `invalid` при `form.valid === true`, отправка отказывала «валидной» форме.
    it('включённое поведением поле в проверке не участвует — статус совпадает с valid [ReFormer-kowh]', async () => {
      const bundle = createOrder();
      await tick();
      bundle.form.delivery.disable();
      bundle.model.delivery.needed = true;
      await tick();

      const result = await bundle.validate();

      expect({
        fieldDisabled: bundle.form.delivery.address.disabled.value,
        status: result.status,
        valid: bundle.form.valid.value,
        issues: issueCodes(bundle.form.delivery.address),
      }).toEqual({ fieldDisabled: false, status: 'valid', valid: true, issues: [] });
    });

    it('группу включили обратно — поле снова проверяется', async () => {
      const bundle = createOrder();
      await tick();
      bundle.form.delivery.disable();
      bundle.model.delivery.needed = true;
      await tick();
      await bundle.validate();

      bundle.form.delivery.enable();
      const result = await bundle.validate();

      expect({ status: result.status, valid: bundle.form.valid.value }).toEqual({
        status: 'invalid',
        valid: false,
      });
    });

    it('сбой async-правила такого поля не даёт error [ReFormer-kowh]', async () => {
      const bundle = createForm<Order>({
        initial: { delivery: { needed: true, address: 'ул. Ленина' }, comment: '' },
        validation: defineValidation<Order>(({ model }) => {
          validateAsync(model.$.delivery.address, [() => Promise.reject(new Error('сеть'))]);
        }),
      });
      bundle.form.delivery.disable();
      bundle.form.delivery.address.enable();

      expect((await bundle.validate()).status).toBe('valid');
    });
  });

  it('сбой async-правила выключенного поля не даёт error', async () => {
    const failing = defineValidation<Shape>(({ model }) => {
      validateAsync(model.$.phone, [() => Promise.reject(new Error('сеть'))]);
    });
    const bundle = createForm<Shape>({
      initial: { amount: '', phone: '1' },
      behavior: defineFormBehavior<Shape>(({ model }) => {
        enableWhen(model.$.phone, () => model.amount !== '');
      }),
      validation: failing,
    });
    await tick();

    expect((await bundle.validate()).status).toBe('valid');
  });

  it('независимый раннер validateModel доступность не учитывает', async () => {
    const bundle = createWithDisabledPhone();
    await tick();

    expect(await validateModel(bundle.model, contactsRules)).toBe(false);
  });
});

describe('createForm — validateStep без потока и сигнал validating', () => {
  it('validateStep без потока — исключение «поток не задан»', async () => {
    const bundle = createForm<Shape>({ initial: { amount: '', phone: '' }, validation: loanRules });

    await expect(bundle.validateStep('loan')).rejects.toThrow(
      'шага «loan» нет в потоке. Поток не задан: `flow`.'
    );
  });

  it('без правил validating всегда false, validate — valid', async () => {
    const bundle = createForm<Shape>({
      initial: { amount: '', phone: '' },
      flow: { steps: [{ id: 'loan' }, { id: 'confirm' }] },
    });

    expect(bundle.validation).toBeUndefined();
    expect(bundle.validating.value).toBe(false);
    expect((await bundle.validate()).status).toBe('valid');
    expect((await bundle.validateStep('loan')).status).toBe('valid');
    expect(bundle.validating.value).toBe(false);
  });

  it('validating — true, пока идёт validateStep, и false после', async () => {
    const { answers, rules } = controlledAmountRules();
    const bundle = createForm<Shape>({
      initial: { amount: '1', phone: '' },
      flow: { steps: [{ id: 'loan', rules }, { id: 'confirm' }] },
    });

    const step = bundle.validateStep('loan');
    expect(bundle.validating.value).toBe(true);
    answers[0].resolve(null);

    expect((await step).status).toBe('valid');
    expect(bundle.validating.value).toBe(false);
  });

  it('next() потока: validating и у потока, и у формы', async () => {
    const { answers, rules } = controlledAmountRules();
    const bundle = createForm<Shape>({
      initial: { amount: '1', phone: '' },
      flow: { steps: [{ id: 'loan', rules }, { id: 'confirm' }] },
    });

    const next = bundle.flow!.next();
    expect(bundle.flow!.validating.value).toBe(true);
    expect(bundle.validating.value).toBe(true);
    answers[0].resolve(null);

    expect(await next).toEqual({ status: 'moved', from: 'loan', to: 'confirm' });
    expect(bundle.flow!.validating.value).toBe(false);
    expect(bundle.validating.value).toBe(false);
  });

  it('validateStep помечает тронутыми только поля шага', async () => {
    const bundle = createShape();

    await bundle.validateStep('loan');

    expect(bundle.form.amount.touched.value).toBe(true);
    expect(bundle.form.phone.touched.value).toBe(false);
  });
});

describe('createForm — проверка в одном тике с правкой [ReFormer-jvst]', () => {
  interface Order {
    amount: number;
    /** Скидка — колбэк `onChange` суммы: запись отложена на микротаск. */
    discount: number;
    /** Итог — колбэк `onChange` скидки: второе звено отложенной цепочки. */
    total: number;
  }

  /** Значения заказа с суммой `amount`, когда отработали все записи поведения. */
  const settledOrder = (amount: number): Order => {
    const discount = amount >= 1000 ? 100 : 0;
    return { amount, discount, total: amount - discount };
  };

  /** Заказ, правило которого сверяет итог с суммой и скидкой и запоминает, что увидело. */
  function createOrder() {
    const seen: Order[] = [];
    const orderRules = defineValidation<Order>(({ model }) => {
      seen.push(model.get());
      validate(model.$.total, [
        (total) => (total === model.amount - model.discount ? null : { code: 'total.stale' }),
      ]);
    });
    const bundle = createForm<Order>({
      initial: { amount: 500, discount: 0, total: 0 },
      behavior: defineFormBehavior<Order>(({ model }) => {
        onChange(
          model.$.amount,
          (amount) => {
            model.discount = amount >= 1000 ? 100 : 0;
          },
          { immediate: true }
        );
        onChange(
          model.$.discount,
          (discount) => {
            model.total = model.amount - discount;
          },
          { immediate: true }
        );
      }),
      flow: { steps: [{ id: 'order', rules: orderRules }, { id: 'confirm' }] },
    });
    return { bundle, seen };
  }

  it('validate() сразу после правки: правила читают модель после записей поведения', async () => {
    const { bundle, seen } = createOrder();
    await tick();
    seen.length = 0;

    bundle.form.amount.setValue(2000);
    const result = await bundle.validate();

    // Было: правило исполнялось в момент вызова и видело прежний итог — статус invalid.
    expect({ status: result.status, seen }).toEqual({
      status: 'valid',
      seen: [settledOrder(2000)],
    });
  });

  it('validate() сразу после сборки: первые записи поведения уже в модели', async () => {
    const { bundle, seen } = createOrder();

    const result = await bundle.validate(); // без ожидания после сборки

    expect({ status: result.status, seen }).toEqual({ status: 'valid', seen: [settledOrder(500)] });
  });

  it('validateStep() сразу после правки — то же', async () => {
    const { bundle, seen } = createOrder();
    await tick();
    seen.length = 0;

    bundle.form.amount.setValue(2000);
    const result = await bundle.validateStep('order');

    expect({ status: result.status, seen }).toEqual({
      status: 'valid',
      seen: [settledOrder(2000)],
    });
  });

  it('flow.next() сразу после правки: шаг проверен по новым значениям и пройден', async () => {
    const { bundle, seen } = createOrder();
    await tick();
    seen.length = 0;

    bundle.form.amount.setValue(2000);
    const moved = await bundle.flow!.next();

    expect({ moved, seen }).toEqual({
      moved: { status: 'moved', from: 'order', to: 'confirm' },
      seen: [settledOrder(2000)],
    });
  });

  it('submit() сразу после правки: обработчик получает то же, что видели правила', async () => {
    const { bundle, seen } = createOrder();
    await tick();
    seen.length = 0;
    const handler = vi.fn((values: Order) => values);

    bundle.form.amount.setValue(2000);
    const result = await bundle.submission.submit(handler);

    expect(result).toEqual({ status: 'submitted', result: settledOrder(2000) });
    expect(seen).toEqual([settledOrder(2000)]);
  });

  it('validating поднят сразу, хотя правила ждут записей поведения', async () => {
    const { bundle, seen } = createOrder();
    await tick();
    seen.length = 0;

    bundle.form.amount.setValue(2000);
    const run = bundle.validate();
    const atCall = { validating: bundle.validating.value, runs: seen.length };
    await run;

    expect({ atCall, after: { validating: bundle.validating.value, runs: seen.length } }).toEqual({
      atCall: { validating: true, runs: 0 },
      after: { validating: false, runs: 1 },
    });
  });

  it('отложенных записей нет — правила исполняются синхронно в момент вызова', async () => {
    const { bundle, seen } = createOrder();
    await tick();
    seen.length = 0;

    const run = bundle.validate();
    const runsAtCall = seen.length;
    await run;

    expect(runsAtCall).toBe(1);
  });

  it('независимый раннер validateModel записей поведения не ждёт', async () => {
    const { bundle, seen } = createOrder();
    await tick();
    seen.length = 0;

    bundle.form.amount.setValue(2000);
    const ok = await validateModel(bundle.model, bundle.validation!.rules);

    // Раннер headless: исполняет правила в момент вызова — итог ещё прежний.
    expect({ ok, total: seen[0].total }).toEqual({ ok: false, total: 500 });
  });
});

describe('createForm — переход шага: модель изменилась, пока шла проверка [ReFormer-ffxb]', () => {
  /** Поток «вступление → кредит → подтверждение»; у шага «кредит» async-правило суммы. */
  function createSteps() {
    const { answers, rules } = controlledAmountRules();
    const bundle = createForm<Shape>({
      initial: { amount: '1', phone: '+7' },
      flow: { steps: [{ id: 'intro' }, { id: 'loan', rules }, { id: 'confirm' }] },
    });
    return { answers, bundle, flow: bundle.flow! };
  }

  /** Поток на шаге «кредит» и идущий переход, который ждёт ответа async-правила. */
  async function pendingNext() {
    const created = createSteps();
    await created.flow.next();
    return { ...created, moving: created.flow.next() };
  }

  it('правка поля во время проверки шага: поток остаётся, шаг не пройден', async () => {
    const { answers, bundle, flow, moving } = await pendingNext();

    bundle.form.phone.setValue('+7 900');
    answers[0].resolve(null);

    // Было: moved — шаг считался пройденным по значениям, которых в модели уже нет.
    expect(await moving).toMatchObject({
      status: 'stayed',
      step: 'loan',
      reason: 'cancelled',
      validation: { status: 'cancelled', failures: [] },
    });
    expect({ current: flow.current.value, completed: [...flow.completed.value] }).toEqual({
      current: 'loan',
      completed: ['intro'],
    });
    expect(flow.validating.value).toBe(false);
  });

  it('повторный переход проверяет уже новые значения и выполняется', async () => {
    const { answers, bundle, flow, moving } = await pendingNext();
    bundle.form.phone.setValue('+7 900');
    answers[0].resolve(null);
    await moving;

    const again = flow.next();
    answers[1].resolve(null);

    expect(await again).toEqual({ status: 'moved', from: 'loan', to: 'confirm' });
    expect([...flow.completed.value]).toEqual(['intro', 'loan']);
  });

  it('значение изменили и вернули: модель та же, что видели правила, — переход выполняется', async () => {
    const { answers, bundle, moving } = await pendingNext();

    bundle.form.phone.setValue('+7 900');
    bundle.form.phone.setValue('+7');
    answers[0].resolve(null);

    expect(await moving).toEqual({ status: 'moved', from: 'loan', to: 'confirm' });
  });

  it('шаг не прошёл проверку: причина — invalid, а не cancelled, даже если модель правили', async () => {
    const { answers, bundle, moving } = await pendingNext();

    bundle.form.phone.setValue('+7 900');
    answers[0].resolve({ code: 'amount.low' });

    expect(await moving).toMatchObject({ status: 'stayed', step: 'loan', reason: 'invalid' });
    expect(issueCodes(bundle.form.amount)).toEqual(['amount.low']);
  });

  it('шаг без правил сверять не с чем: правка в том же тике переходу не мешает', async () => {
    const { bundle, flow } = createSteps();

    const moving = flow.next();
    bundle.form.phone.setValue('+7 900');

    expect(await moving).toEqual({ status: 'moved', from: 'intro', to: 'loan' });
  });

  it('последний шаг: правка во время проверки — шаг не пройден', async () => {
    const { answers, rules } = controlledAmountRules();
    const bundle = createForm<Shape>({
      initial: { amount: '1', phone: '+7' },
      flow: { steps: [{ id: 'loan', rules }] },
    });
    const flow = bundle.flow!;

    const stale = flow.next();
    bundle.form.phone.setValue('+7 900');
    answers[0].resolve(null);
    const stayed = await stale;
    const fresh = flow.next();
    answers[1].resolve(null);

    expect({
      stayed: stayed.status === 'stayed' && stayed.reason,
      fresh: await fresh,
    }).toMatchObject({
      stayed: 'cancelled',
      fresh: { status: 'stayed', step: 'loan', reason: 'edge' },
    });
    expect([...flow.completed.value]).toEqual(['loan']);
  });

  it('validateStep() — отчёт, а не действие: его статус о модели не судит', async () => {
    const { answers, bundle } = createSteps();

    const checking = bundle.validateStep('loan');
    bundle.form.phone.setValue('+7 900');
    answers[0].resolve(null);

    // Как `validate()`: статус проверки совпадает с состоянием нод; сверяет модель тот, кто
    // действует по результату, — `flow.next()` и `submit()`.
    expect((await checking).status).toBe('valid');
  });
});

describe('createForm — статус проверки и агрегат valid формы', () => {
  /** Телефон обязателен, но выключен поведением, пока сумма пуста. */
  const createWithDisabledPhone = () =>
    createForm<Shape>({
      initial: { amount: '', phone: '' },
      behavior: defineFormBehavior<Shape>(({ model }) => {
        enableWhen(model.$.phone, () => model.amount !== ''); // запись — на микротаске
      }),
      validation: contactsRules,
    });

  // ЗОНД плана: отправка сразу после сборки, до отложенной записи `enableWhen`.
  it('submit сразу после createForm не считает правила поля, которое выключает enableWhen [ReFormer-136o]', async () => {
    const bundle = createWithDisabledPhone();

    const result = await bundle.submission.submit(() => 'ok'); // без await tick() после сборки

    expect(result.status).toBe('submitted');
  });

  it('после такой отправки на выключенном поле не остаётся замечаний [ReFormer-136o]', async () => {
    const bundle = createWithDisabledPhone();

    await bundle.submission.submit(() => 'ok');
    await tick();

    // Было: поле выключено (form.valid === true), но держало `required` от прогона.
    expect(bundle.form.phone.issues.value).toEqual([]);
  });

  it('после отложенной записи enableWhen отправка проходит', async () => {
    const bundle = createWithDisabledPhone();
    await tick();

    expect((await bundle.submission.submit(() => 'ok')).status).toBe('submitted');
  });

  interface Row {
    label: string;
  }
  interface Rows {
    rows: Row[];
  }

  /** Форма строк с async-правилом строки: ответ — по значению label, его выдаёт тест. */
  function createRows(labels: string[]) {
    const answers = new Map<string, Deferred<ValidationIssue | null>>();
    const rowRules = defineValidation<Row>(({ model }) => {
      validateAsync(model.$.label, [
        (label) => {
          const answer = deferred<ValidationIssue | null>();
          answers.set(label, answer);
          return answer.promise;
        },
      ]);
    });
    const bundle = createForm<Rows>({
      initial: { rows: labels.map((label) => ({ label })) },
      schema: (model) => ({
        children: [
          {
            model: model.$.rows,
            item: (row: FormModel<Row>) => ({
              children: [{ model: row.$.label, component: InputStub }],
            }),
          },
        ],
      }),
      validation: defineValidation<Rows>(({ model }) => applyEach(model.$.rows, rowRules)),
    });
    return { bundle, answers };
  }

  it('строка удалена во время async-правила, оставшаяся с замечанием — invalid, как form.valid', async () => {
    const { bundle, answers } = createRows(['a', 'b']);

    const run = bundle.validate();
    bundle.model.rows.removeAt(1);
    answers.get('a')!.resolve({ code: 'taken' });
    answers.get('b')!.resolve(null);
    const result = await run;

    expect(result.status).toBe('invalid');
    expect(bundle.form.valid.value).toBe(false);
    expect(issueCodes(bundle.form.rows.at(0)!.label)).toEqual(['taken']);
  });

  // ЗОНД плана: расхождение статуса прогона и `form.valid`, когда строку удалили во время async.
  it('строка с замечанием удалена во время async-правила: статус valid, как form.valid [ReFormer-9utp]', async () => {
    const { bundle, answers } = createRows(['a', 'b']);

    const run = bundle.validate();
    bundle.model.rows.removeAt(1);
    answers.get('a')!.resolve(null);
    answers.get('b')!.resolve({ code: 'taken' });
    const result = await run;

    // Было: invalid по замечанию удалённой строки при form.valid === true и без видимых замечаний.
    expect(result.status).toBe('valid');
  });

  it('поле вложенной группы удалённой строки тоже не в счёт: по её пути пусто [ReFormer-9utp]', async () => {
    interface Contact {
      address: { city: string };
    }
    interface Book {
      contacts: Contact[];
    }
    const answer = deferred<ValidationIssue | null>();
    const contactRules = defineValidation<Contact>(({ model }) => {
      validateAsync(model.$.address.city, [() => answer.promise]);
    });
    const bundle = createForm<Book>({
      initial: { contacts: [{ address: { city: 'Казань' } }] },
      schema: (model) => ({
        children: [
          {
            model: model.$.contacts,
            item: (row: FormModel<Contact>) => ({
              children: [{ model: row.$.address.city, component: InputStub }],
            }),
          },
        ],
      }),
      validation: defineValidation<Book>(({ model }) => applyEach(model.$.contacts, contactRules)),
    });

    const run = bundle.validate();
    // Строка была единственной: по пути `contacts.0` теперь пусто, до `address.city` не дойти.
    bundle.model.contacts.removeAt(0);
    answer.resolve({ code: 'taken' });

    expect((await run).status).toBe('valid');
  });

  it('поведение под вопросом [ReFormer-jefl]: правило на поле без ноды — invalid, хотя form.valid === true', async () => {
    // Массив примитивов без узла в схеме ноды не получает: замечание некуда показать, агрегат его
    // не видит, а статус прогона — видит. Возможно, это ошибка конфигурации (правило на поле вне
    // формы), но согласие статуса с form.valid нарушено так же, как в ReFormer-9utp.
    interface Tagged {
      name: string;
      tags: string[];
    }
    const bundle = createForm<Tagged>({
      initial: { name: 'x', tags: [] },
      validation: defineValidation<Tagged>(({ model }) => validate(model.$.tags, [required()])),
    });

    expect((await bundle.validate()).status).toBe('invalid');
    expect(bundle.form.valid.value).toBe(true);
  });
});

describe('createForm — прогоны шага и формы над одним полем', () => {
  it('поведение под вопросом [ReFormer-jefl]: прогон шага заменяет замечание поля от правил формы', async () => {
    // Замечания ноды не разделены по источнику: прогон шага ставит полю свой список целиком и
    // стирает замечание extras того же поля — форма снова valid, поток идёт дальше, хотя полная
    // проверка его не пропустит. Док `validateModel` обещает, что прогоны шага и формы «не мешают
    // друг другу», — это верно для гашения диффом, но не для общего поля.
    const extras = defineValidation<Shape>(({ model, cross }) => {
      cross(model.$.amount, (shape) => (shape.amount === shape.phone ? { code: 'same' } : null));
    });
    const bundle = createForm<Shape>({
      initial: { amount: '1', phone: '1' },
      flow: { steps: [{ id: 'loan', rules: loanRules }, { id: 'confirm' }] },
      validation: { extras },
    });

    expect((await bundle.validate()).status).toBe('invalid');
    expect(issueCodes(bundle.form.amount)).toEqual(['same']);

    expect((await bundle.validateStep('loan')).status).toBe('valid');
    expect(issueCodes(bundle.form.amount)).toEqual([]);
    expect(bundle.form.valid.value).toBe(true);
    expect((await bundle.validate()).status).toBe('invalid');
  });
});
