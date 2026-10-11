/**
 * Уровень формы в бандле `createForm`: `validate`, `validateStep`, `submit` и поток шагов.
 *
 * Отправка — один прогон всех правил; результат — объект со статусом, по которому различают
 * замечания, сбой правила, отмену и исключение обработчика. Здесь же — `validateStep` без потока,
 * сигнал `validating`, две отправки подряд (`cancelled`), снимок значений для обработчика и
 * согласие статуса проверки с агрегатом `valid` формы (выключенные поля, строки массива).
 */

import { describe, it, expect, vi } from 'vitest';
import { deferred, tick, type Deferred } from '../../test-utils/async';
import { issueCodes } from '../../test-utils/issues';
import { InputStub } from '../../test-utils/stubs';
import { createForm } from '../../../src/form/form-bundle';
import { defineFormBehavior, enableWhen } from '../../../src/form/behaviors';
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
import type { SubmitResult } from '../../../src/form/form-level';

interface Shape {
  amount: string;
  phone: string;
}

const loanRules = defineValidation<Shape>(({ model }) => {
  validate(model.$.amount, [required()]);
});
const contactsRules = defineValidation<Shape>(({ model }) => {
  validate(model.$.phone, [required()]);
});

const createShape = (initial: Shape = { amount: '', phone: '' }) =>
  createForm<Shape>({
    initial,
    flow: {
      steps: [
        { id: 'loan', rules: loanRules },
        { id: 'contacts', rules: contactsRules },
        { id: 'confirm' },
      ],
    },
  });

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

describe('createForm — submit', () => {
  it('submitted: обработчик получает значения модели, результат — его ответ', async () => {
    const bundle = createShape({ amount: '100', phone: '+7' });
    const handler = vi.fn(async (values: Shape) => `заявка ${values.amount}`);

    const result = await bundle.submit(handler);

    expect(result).toEqual({ status: 'submitted', result: 'заявка 100' });
    expect(handler).toHaveBeenCalledWith({ amount: '100', phone: '+7' });
  });

  it('invalid: обработчик не вызывается, поля помечены тронутыми', async () => {
    const bundle = createShape();
    const handler = vi.fn();

    const result = await bundle.submit(handler);

    expect(result).toMatchObject({ status: 'invalid', validation: { status: 'invalid' } });
    expect(handler).not.toHaveBeenCalled();
    expect(bundle.form.amount.touched.value).toBe(true);
    expect(bundle.form.amount.shouldShowError.value).toBe(true);
  });

  it('error: правило не вернуло результат — обработчик не вызывается', async () => {
    const failing = defineValidation<Shape>(({ model }) => {
      validateAsync(model.$.amount, [() => Promise.reject(new Error('сеть'))]);
    });
    const bundle = createForm<Shape>({ initial: { amount: '1', phone: '' }, validation: failing });
    const handler = vi.fn();

    expect((await bundle.submit(handler)).status).toBe('error');
    expect(handler).not.toHaveBeenCalled();
  });

  it('failed: исключение обработчика — в результате, а не наружу', async () => {
    const bundle = createShape({ amount: '1', phone: '1' });
    const error = new Error('500');

    expect(
      await bundle.submit(() => {
        throw error;
      })
    ).toEqual({ status: 'failed', error });
    expect(bundle.submitting.value).toBe(false);
  });

  it('ровно один прогон правил на отправку', async () => {
    const rule = vi.fn(() => null);
    const counted = defineValidation<Shape>(({ model }) => {
      validate(model.$.amount, [rule]);
    });
    const bundle = createForm<Shape>({ initial: { amount: '1', phone: '' }, validation: counted });

    await bundle.submit(() => 'ok');

    expect(rule).toHaveBeenCalledTimes(1);
  });

  it('submitting — пока работает обработчик', async () => {
    const bundle = createShape({ amount: '1', phone: '1' });
    let during = false;

    await bundle.submit(() => {
      during = bundle.submitting.value;
    });

    expect(during).toBe(true);
    expect(bundle.submitting.value).toBe(false);
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
    expect(await bundle.submit(handler)).toEqual({ status: 'submitted', result: 'ok' });
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

/** Правила суммы с async-правилом: ответы тест выдаёт сам, по порядку вызовов. */
function controlledAmountRules() {
  const answers: Deferred<ValidationIssue | null>[] = [];
  const rules = defineValidation<Shape>(({ model }) => {
    validateAsync(model.$.amount, [
      () => {
        const answer = deferred<ValidationIssue | null>();
        answers.push(answer);
        return answer.promise;
      },
    ]);
  });
  return { answers, rules };
}

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

describe('createForm — submit: статусы и значения', () => {
  it('cancelled: две отправки подряд — первая отменена второй, обработчик вызван один раз', async () => {
    const { answers, rules } = controlledAmountRules();
    const bundle = createForm<Shape>({ initial: { amount: '1', phone: '' }, validation: rules });
    const handler = vi.fn(() => 'ok');

    const first = bundle.submit(handler);
    const second = bundle.submit(handler);
    answers[1].resolve(null);

    expect(await first).toMatchObject({ status: 'cancelled', validation: { status: 'cancelled' } });
    expect(await second).toEqual({ status: 'submitted', result: 'ok' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it.each<[SubmitResult<string>['status'], () => Promise<SubmitResult<string>>]>([
    ['submitted', () => createShape({ amount: '1', phone: '1' }).submit(() => 'ok')],
    ['invalid', () => createShape().submit(() => 'ok')],
    [
      'error',
      () =>
        createForm<Shape>({
          initial: { amount: '1', phone: '' },
          validation: defineValidation<Shape>(({ model }) => {
            validateAsync(model.$.amount, [() => Promise.reject(new Error('сеть'))]);
          }),
        }).submit(() => 'ok'),
    ],
    [
      'cancelled',
      async () => {
        const { answers, rules } = controlledAmountRules();
        const bundle = createForm<Shape>({
          initial: { amount: '1', phone: '' },
          validation: rules,
        });
        const first = bundle.submit(() => 'ok');
        void bundle.submit(() => 'ok');
        answers[1].resolve(null);
        return first;
      },
    ],
    [
      'failed',
      () =>
        createShape({ amount: '1', phone: '1' }).submit(() => {
          throw new Error('500');
        }),
    ],
  ])('статус %s', async (status, send) => {
    expect((await send()).status).toBe(status);
  });

  it('обработчик получает снимок model.get(): правка модели в обработчике снимок не меняет', async () => {
    const bundle = createShape({ amount: '100', phone: '+7' });
    let received: Shape | undefined;

    await bundle.submit((values) => {
      received = values;
      bundle.model.amount = '200';
    });

    expect(received).toEqual({ amount: '100', phone: '+7' });
    expect(Object.getPrototypeOf(received)).toBe(Object.prototype);
    expect(bundle.model.amount).toBe('200');
  });

  it('значения выключенного поля в снимке есть: его правила не считаются, но данные — модели', async () => {
    const bundle = createForm<Shape>({
      initial: { amount: '', phone: '+7' },
      behavior: defineFormBehavior<Shape>(({ model }) => {
        enableWhen(model.$.phone, () => model.amount !== '');
      }),
      validation: contactsRules,
    });
    await tick();
    const handler = vi.fn((values: Shape) => values.phone);

    expect(bundle.form.phone.disabled.value).toBe(true);
    expect(await bundle.submit(handler)).toEqual({ status: 'submitted', result: '+7' });
    expect(handler).toHaveBeenCalledWith(bundle.model.get());
  });

  it('ровно один прогон правил на отправку: правила шагов и extras — по разу', async () => {
    const loanRule = vi.fn(() => null);
    const contactsRule = vi.fn(() => null);
    const extrasRule = vi.fn(() => null);
    const bundle = createForm<Shape>({
      initial: { amount: '1', phone: '1' },
      flow: {
        steps: [
          {
            id: 'loan',
            rules: defineValidation<Shape>(({ model }) => validate(model.$.amount, [loanRule])),
          },
          {
            id: 'contacts',
            rules: defineValidation<Shape>(({ model }) => validate(model.$.phone, [contactsRule])),
          },
        ],
      },
      validation: {
        extras: defineValidation<Shape>(({ model }) => validate(model.$.amount, [extrasRule])),
      },
    });

    expect((await bundle.submit(() => 'ok')).status).toBe('submitted');
    expect(loanRule).toHaveBeenCalledTimes(1);
    expect(contactsRule).toHaveBeenCalledTimes(1);
    expect(extrasRule).toHaveBeenCalledTimes(1);
  });

  it('стратегия blur: отправка — ровно один прогон правил [ReFormer-lzhc]', async () => {
    const loginFree = vi.fn(async () => null);
    const bundle = createForm<Shape>({
      initial: { amount: '1', phone: '1' },
      validation: {
        rules: defineValidation<Shape>(({ model }) => validateAsync(model.$.amount, [loginFree])),
        strategy: 'blur',
      },
    });
    const stop = bundle.validation!.controller.start();
    try {
      await bundle.submit(() => 'ok');
      await tick();

      // Было 2: касание полей самой отправкой (`touch: true`) будило живой прогон blur.
      expect(loginFree).toHaveBeenCalledTimes(1);
    } finally {
      stop();
    }
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

    const result = await bundle.submit(() => 'ok'); // без await tick() после сборки

    expect(result.status).toBe('submitted');
  });

  it('после такой отправки на выключенном поле не остаётся замечаний [ReFormer-136o]', async () => {
    const bundle = createWithDisabledPhone();

    await bundle.submit(() => 'ok');
    await tick();

    // Было: поле выключено (form.valid === true), но держало `required` от прогона.
    expect(bundle.form.phone.issues.value).toEqual([]);
  });

  it('после отложенной записи enableWhen отправка проходит', async () => {
    const bundle = createWithDisabledPhone();
    await tick();

    expect((await bundle.submit(() => 'ok')).status).toBe('submitted');
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
