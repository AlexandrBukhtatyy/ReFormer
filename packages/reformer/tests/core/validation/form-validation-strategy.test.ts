/**
 * Unit-тесты единого выбора стратегии валидации — `createFormValidation` + `eachLeafSignal`.
 *
 * Покрывает: submit (реактивно молчит, validate() метит touched), change (прогон по вводу, touch:false),
 * blur (прогон по touched), afterFirstSubmit (тихо до submit → live) с живой фазой change и blur,
 * debounce (сброс таймера новым вводом, снятие таймера в dispose), dispose и повторный start,
 * пересекающиеся прогоны (поздний ответ старого не перетирает новый, `validating` до последнего),
 * строки массива, добавленные после start(), isValidating, обход листьев (вложенные группы +
 * массивы).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { signal } from '@preact/signals-core';
import { InputStub as C } from '../../test-utils/stubs';
import {
  advance,
  deferred,
  flushMicrotasks,
  tick,
  useFakeClock,
  type Deferred,
} from '../../test-utils/async';
import { issueCodes } from '../../test-utils/issues';
import { createModel } from '../../../src/model/index';
import type { FormModel } from '../../../src/model/types';
import { createFormFromModel } from '../../../src/form/create-form';
import { required, minLength } from '../../../src/form/validators';
import {
  validate,
  validateAsync,
  validateWhen,
  applyEach,
  defineValidation,
} from '../../../src/form/validation';
import {
  createFormValidation,
  type ValidationStrategyKind,
} from '../../../src/form/validation/strategy';
import { eachLeafSignal } from '../../../src/model/create-model';
import type { ValidationIssue } from '../../../src/form/types/contracts';

interface F {
  name: string;
  age: number;
  items: { label: string }[];
  profile: { city: string };
}

const INITIAL: F = { name: '', age: 0, items: [{ label: '' }], profile: { city: '' } };

function makeForm(over: Partial<F> = {}) {
  const model = createModel<F>({ ...INITIAL, ...over });
  const schema = {
    component: C,
    children: [
      { model: model.$.name, component: C },
      { model: model.$.age, component: C },
      { model: model.$.profile.city, component: C },
    ],
  };
  const form = createFormFromModel<F>({ model, schema });
  return { model, form };
}

/** Схема: name обязателен и ≥2 символов. Стабильная ссылка (важно для дедупа раннера). */
const nameRequired = defineValidation<F>(({ model }) => {
  validate(model.$.name, [required(), minLength(2)]);
});

describe('createFormValidation — стратегии запуска', () => {
  it('submit: реактивно молчит; validate() прогоняет и метит touched', async () => {
    const { model, form } = makeForm();
    const ctrl = createFormValidation(model, nameRequired, { strategy: 'submit' });
    const dispose = ctrl.start();

    model.name = 'x'; // изменение НЕ должно прогонять при submit-стратегии
    await flushMicrotasks(2);
    expect(form.name.issues.value).toEqual([]);
    expect(form.name.touched.value).toBe(false);

    const ok = await ctrl.validate();
    expect(ok).toBe(false); // 'x' короче 2
    expect(form.name.issues.value.map((e) => e.code)).toContain('minLength');
    expect(form.name.touched.value).toBe(true); // touch:true раскрыл ошибку

    dispose();
  });

  it('change: изменение значения прогоняет схему (touch:false, initial пропущен)', async () => {
    const { model, form } = makeForm();
    const ctrl = createFormValidation(model, nameRequired, { strategy: 'change' });
    ctrl.start();

    expect(form.name.issues.value).toEqual([]); // инициализирующий прогон пропущен

    model.name = 'x'; // невалидно (minLength)
    await flushMicrotasks(2);
    expect(form.name.issues.value.map((e) => e.code)).toContain('minLength');
    expect(form.name.touched.value).toBe(false); // change НЕ метит touched

    model.name = 'Иван'; // валидно
    await flushMicrotasks(2);
    expect(form.name.issues.value).toEqual([]);

    ctrl.dispose();
  });

  it('blur: пометка touched прогоняет схему', async () => {
    const { model, form } = makeForm();
    const ctrl = createFormValidation(model, nameRequired, { strategy: 'blur' });
    ctrl.start();

    expect(form.name.issues.value).toEqual([]);
    form.name.markAsTouched(); // blur
    await flushMicrotasks(2);
    expect(form.name.issues.value.map((e) => e.code)).toContain('required');

    ctrl.dispose();
  });

  // Раньше стратегия была подписана на саму метку `touched`: у тронутого поля она при новом уходе
  // не меняется, и исправленное поле держало ошибку до ухода из другого, ещё не тронутого поля.
  it('blur: повторный уход из тронутого поля перепроверяет его [ReFormer-t6qm]', async () => {
    const { model, form } = makeForm();
    const ctrl = createFormValidation(model, nameRequired, { strategy: 'blur' });
    ctrl.start();

    form.name.markAsTouched(); // первый уход: поле пустое
    await flushMicrotasks(2);
    model.name = 'Иван'; // исправили; ввод стратегия blur не проверяет
    await flushMicrotasks(2);
    const afterInput = issueCodes(form.name);

    form.name.markAsTouched(); // повторный уход: метка touched уже стоит и не меняется
    await flushMicrotasks(2);

    expect({ afterInput, afterSecondBlur: issueCodes(form.name) }).toEqual({
      afterInput: ['required'],
      afterSecondBlur: [],
    });
    ctrl.dispose();
  });

  it('blur: снятие метки touched и сброс поля уходом не считаются [ReFormer-t6qm]', async () => {
    const runs = vi.fn();
    const schema = defineValidation<F>(({ model: scope }) => {
      runs();
      validate(scope.$.name, [required()]);
    });
    const { model, form } = makeForm();
    const ctrl = createFormValidation(model, schema, { strategy: 'blur' });
    ctrl.start();

    form.name.markAsTouched();
    await flushMicrotasks(2);
    const afterBlur = runs.mock.calls.length;
    form.name.markAsUntouched();
    await flushMicrotasks(2);
    form.name.markAsTouched();
    await flushMicrotasks(2);
    const afterReturn = runs.mock.calls.length;
    form.name.reset();
    await flushMicrotasks(2);

    expect({ afterBlur, afterReturn, afterReset: runs.mock.calls.length }).toEqual({
      afterBlur: 1,
      afterReturn: 2,
      afterReset: 2,
    });
    ctrl.dispose();
  });

  it('afterFirstSubmit: тихо до validate(), затем live', async () => {
    const { model, form } = makeForm();
    const ctrl = createFormValidation(model, nameRequired, {
      strategy: 'afterFirstSubmit',
      liveAfterSubmit: 'change',
    });
    ctrl.start();

    model.name = 'x';
    await flushMicrotasks(2);
    expect(form.name.issues.value).toEqual([]); // тихо до первого submit

    await ctrl.validate();
    expect(form.name.issues.value.map((e) => e.code)).toContain('minLength');

    model.name = 'Иван'; // теперь live
    await flushMicrotasks(2);
    expect(form.name.issues.value).toEqual([]);

    ctrl.dispose();
  });

  it('change + debounce: прогон откладывается на debounce мс', async () => {
    vi.useFakeTimers();
    try {
      const { model, form } = makeForm();
      const ctrl = createFormValidation(model, nameRequired, { strategy: 'change', debounce: 300 });
      ctrl.start();

      model.name = 'x';
      await Promise.resolve();
      expect(form.name.issues.value).toEqual([]); // ещё не прогнали — таймер не сработал

      vi.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
      expect(form.name.issues.value.map((e) => e.code)).toContain('minLength');

      ctrl.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('dispose: снимает подписки — изменения больше не прогоняют', async () => {
    const { model, form } = makeForm();
    const ctrl = createFormValidation(model, nameRequired, { strategy: 'change' });
    ctrl.start();
    ctrl.dispose();

    model.name = 'x';
    await flushMicrotasks(2);
    expect(form.name.issues.value).toEqual([]); // после dispose прогонов нет
  });

  it('start после dispose армирует стратегию заново (StrictMode / remount)', async () => {
    const { model, form } = makeForm();
    const ctrl = createFormValidation(model, nameRequired, { strategy: 'change' });

    // Цикл, который React в StrictMode выполняет при монтировании: эффект → cleanup → эффект.
    ctrl.start();
    ctrl.dispose();
    ctrl.start();

    model.name = 'x';
    await flushMicrotasks(2);
    expect(form.name.issues.value.map((e) => e.code)).toContain('minLength');

    ctrl.dispose();
  });

  it('повторный start без dispose не дублирует подписки', async () => {
    const { model } = makeForm();
    const schema = vi.fn(({ model: m }: { model: typeof model }) => {
      validate(m.$.name, [required()]);
    });
    const ctrl = createFormValidation(model, schema, { strategy: 'change' });
    ctrl.start();
    ctrl.start(); // идемпотентно

    schema.mockClear();
    model.name = 'ab';
    await flushMicrotasks(2);
    expect(schema).toHaveBeenCalledTimes(1); // один прогон, а не два

    ctrl.dispose();
  });

  it('isValidating отражает in-flight прогон', async () => {
    const { model } = makeForm();
    const ctrl = createFormValidation(model, nameRequired, { strategy: 'submit' });

    const p = ctrl.validate();
    expect(ctrl.isValidating).toBe(true);
    await p;
    expect(ctrl.isValidating).toBe(false);
  });
});

describe('eachLeafSignal — обход листьев модели', () => {
  it('обходит листья вложенных групп и элементов массива', () => {
    const model = createModel<F>({
      name: 'a',
      age: 1,
      items: [{ label: 'x' }, { label: 'y' }],
      profile: { city: 'c' },
    });
    const paths: string[] = [];
    eachLeafSignal(model, (sig) => paths.push((sig as unknown as { __path: string }).__path));

    expect(paths.sort()).toEqual(
      ['age', 'items.0.label', 'items.1.label', 'name', 'profile.city'].sort()
    );
  });
});

/** Схема «name обязателен и ≥2 символов» и счётчик её прогонов — на каждый тест своя. */
function countedNameRules() {
  const runs = vi.fn();
  const schema = defineValidation<F>(({ model }) => {
    runs();
    validate(model.$.name, [required(), minLength(2)]);
  });
  return { runs, schema };
}

/** Схема с async-правилом name: ответы правила тест выдаёт сам, по порядку вызовов. */
function controlledNameRules() {
  const answers: Deferred<ValidationIssue | null>[] = [];
  const schema = defineValidation<F>(({ model }) => {
    validateAsync(model.$.name, [
      () => {
        const answer = deferred<ValidationIssue | null>();
        answers.push(answer);
        return answer.promise;
      },
    ]);
  });
  return { answers, schema };
}

describe('createFormValidation — что запускает живой прогон', () => {
  it.each<[ValidationStrategyKind, number, number]>([
    ['submit', 0, 0],
    ['change', 1, 0],
    ['blur', 0, 1],
    ['afterFirstSubmit', 0, 0],
  ])('%s: ввод — прогонов %i, blur — %i', async (strategy, onInput, onBlur) => {
    const { model, form } = makeForm();
    const { runs, schema } = countedNameRules();
    const ctrl = createFormValidation(model, schema, { strategy });
    ctrl.start();

    model.name = 'x';
    await tick();
    expect(runs).toHaveBeenCalledTimes(onInput);

    runs.mockClear();
    form.age.markAsTouched();
    await tick();
    expect(runs).toHaveBeenCalledTimes(onBlur);

    ctrl.dispose();
  });

  it('afterFirstSubmit + liveAfterSubmit blur: до validate() тихо, после — прогон по blur, а не по вводу', async () => {
    const { model, form } = makeForm();
    const { runs, schema } = countedNameRules();
    const ctrl = createFormValidation(model, schema, {
      strategy: 'afterFirstSubmit',
      liveAfterSubmit: 'blur',
    });
    ctrl.start();

    form.age.markAsTouched();
    await tick();
    expect(runs).not.toHaveBeenCalled();

    await ctrl.validate();
    await tick();
    runs.mockClear();

    model.name = 'Иван';
    await tick();
    expect(runs).not.toHaveBeenCalled();

    form.profile.city.markAsTouched();
    await tick();
    expect(runs).toHaveBeenCalledTimes(1);
    expect(issueCodes(form.name)).toEqual([]);

    ctrl.dispose();
  });

  it('живой прогон не метит touched, явный run() — метит', async () => {
    const { model, form } = makeForm();
    const ctrl = createFormValidation(model, nameRequired, { strategy: 'change' });
    ctrl.start();

    model.name = 'x';
    await tick();
    expect(form.name.touched.value).toBe(false);
    expect(issueCodes(form.name)).toEqual(['minLength']);

    expect((await ctrl.run()).status).toBe('invalid');
    expect(form.name.touched.value).toBe(true);

    ctrl.dispose();
  });
});

describe('createFormValidation — пересекающиеся прогоны', () => {
  it('поздний ответ старого прогона не перетирает результат нового', async () => {
    const { model, form } = makeForm();
    const { answers, schema } = controlledNameRules();
    const ctrl = createFormValidation(model, schema, { strategy: 'change' });
    ctrl.start();

    model.name = 'a';
    model.name = 'ab';
    expect(answers).toHaveLength(2);
    answers[1].resolve(null);
    await tick();
    answers[0].resolve({ code: 'taken' });
    await tick();

    expect(issueCodes(form.name)).toEqual([]);
    expect(form.name.pending.value).toBe(false);
    ctrl.dispose();
  });

  it('ответ старого прогона раньше нового тоже не появляется: поле ждёт новый', async () => {
    const { model, form } = makeForm();
    const { answers, schema } = controlledNameRules();
    const ctrl = createFormValidation(model, schema, { strategy: 'change' });
    ctrl.start();

    model.name = 'a';
    model.name = 'ab';
    answers[0].resolve({ code: 'taken' });
    await tick();
    expect(issueCodes(form.name)).toEqual([]);
    expect(form.name.pending.value).toBe(true);

    answers[1].resolve(null);
    await tick();
    expect(form.name.pending.value).toBe(false);
    expect(issueCodes(form.name)).toEqual([]);
    ctrl.dispose();
  });

  it('validating держится, пока не завершится последний из пересекающихся прогонов', async () => {
    const { model } = makeForm();
    const { answers, schema } = controlledNameRules();
    const ctrl = createFormValidation(model, schema);

    const first = ctrl.run();
    const second = ctrl.run();

    expect((await first).status).toBe('cancelled');
    expect(ctrl.validating.value).toBe(true);
    answers[1].resolve(null);
    expect((await second).status).toBe('valid');
    expect(ctrl.validating.value).toBe(false);
  });

  it('явный validate() во время живого прогона отменяет живой; итог — у validate()', async () => {
    const { model, form } = makeForm();
    const { answers, schema } = controlledNameRules();
    const ctrl = createFormValidation(model, schema, { strategy: 'change' });
    ctrl.start();

    model.name = 'a'; // живой прогон
    const submit = ctrl.validate();
    answers[0].resolve({ code: 'taken' });
    answers[1].resolve(null);

    expect(await submit).toBe(true);
    await tick();
    expect(issueCodes(form.name)).toEqual([]);
    expect(form.name.touched.value).toBe(true);
    ctrl.dispose();
  });
});

describe('createFormValidation — debounce', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('новый ввод до срабатывания таймера сбрасывает debounce: один прогон после последнего', async () => {
    useFakeClock();
    const { model, form } = makeForm();
    const { runs, schema } = countedNameRules();
    const ctrl = createFormValidation(model, schema, { strategy: 'change', debounce: 300 });
    ctrl.start();

    model.name = 'Иван';
    await advance(200);
    model.name = 'И';
    await advance(200); // первый таймер сработал бы на 300 мс — его сбросил второй ввод
    expect(runs).not.toHaveBeenCalled();

    await advance(100);
    await flushMicrotasks(5);
    expect(runs).toHaveBeenCalledTimes(1);
    expect(issueCodes(form.name)).toEqual(['minLength']); // прогон видел последнее значение

    ctrl.dispose();
  });

  it('dispose снимает ожидающий таймер — прогона не будет', async () => {
    useFakeClock();
    const { model } = makeForm();
    const { runs, schema } = countedNameRules();
    const ctrl = createFormValidation(model, schema, { strategy: 'change', debounce: 300 });
    ctrl.start();

    model.name = 'x';
    ctrl.dispose();

    expect(vi.getTimerCount()).toBe(0);
    await advance(1000);
    expect(runs).not.toHaveBeenCalled();
  });

  it('start после dispose снова откладывает прогон на debounce', async () => {
    useFakeClock();
    const { model } = makeForm();
    const { runs, schema } = countedNameRules();
    const ctrl = createFormValidation(model, schema, { strategy: 'change', debounce: 300 });
    ctrl.start();
    ctrl.dispose();
    ctrl.start();

    model.name = 'x';
    await advance(299);
    expect(runs).not.toHaveBeenCalled();
    await advance(1);
    expect(runs).toHaveBeenCalledTimes(1);

    ctrl.dispose();
  });
});

describe('createFormValidation — start и dispose', () => {
  it('submit: start() подписок не заводит и отдаёт dispose; validate() работает', async () => {
    const { model, form } = makeForm();
    const { runs, schema } = countedNameRules();
    const ctrl = createFormValidation(model, schema);

    const stop = ctrl.start();
    model.name = 'x';
    form.name.markAsTouched();
    await tick();
    expect(runs).not.toHaveBeenCalled();

    expect(await ctrl.validate()).toBe(false);
    expect(runs).toHaveBeenCalledTimes(1);
    expect(() => stop()).not.toThrow();
  });

  it('dispose из start() снимает подписки blur; повторный start армирует заново', async () => {
    const { model, form } = makeForm();
    const { runs, schema } = countedNameRules();
    const ctrl = createFormValidation(model, schema, { strategy: 'blur' });

    const stop = ctrl.start();
    stop();
    form.name.markAsTouched();
    await tick();
    expect(runs).not.toHaveBeenCalled();

    ctrl.start();
    form.age.markAsTouched();
    await tick();
    expect(runs).toHaveBeenCalledTimes(1);

    ctrl.dispose();
    ctrl.dispose(); // идемпотентно
  });

  it('повторный start() без dispose отдаёт рабочий dispose', async () => {
    const { model } = makeForm();
    const { runs, schema } = countedNameRules();
    const ctrl = createFormValidation(model, schema, { strategy: 'change' });
    ctrl.start();

    const stop = ctrl.start(); // уже армирован — подписки не дублируются
    stop();
    model.name = 'x';
    await tick();

    expect(runs).not.toHaveBeenCalled();
  });
});

describe('createFormValidation — blur и массивы', () => {
  interface Row {
    label: string;
  }
  interface Rows {
    title: string;
    tags: string[];
    rows: Row[];
  }

  const rowRules = defineValidation<Row>(({ model }) => {
    validate(model.$.label, [required()]);
  });

  function makeRowsForm(rows: Row[] = []) {
    const model = createModel<Rows>({ title: '', tags: [], rows });
    const form = createFormFromModel<Rows>({
      model,
      schema: {
        component: C,
        children: [
          { model: model.$.title, component: C },
          { model: model.$.tags, component: C },
          {
            model: model.$.rows,
            item: (row: FormModel<Row>) => ({
              component: C,
              children: [{ model: row.$.label, component: C }],
            }),
          },
        ],
      },
    });
    return { model, form };
  }

  /** Схема строк со счётчиком прогонов. */
  function countedRowsRules() {
    const runs = vi.fn();
    const rules = defineValidation<Rows>(({ model }) => {
      runs();
      applyEach(model.$.rows, rowRules);
    });
    return { runs, rules };
  }

  // ЗОНД плана: стратегия `blur` подписывается на `touched` нод в момент прогона effect'а. Если
  // effect стратегии отработает раньше, чем массив построит форму новой строки, нод строки в
  // реестре ещё нет и её blur не увидят. Не подтвердился: effect массива старше и идёт первым.
  it('blur на поле строки, добавленной после start(), запускает прогон', async () => {
    const { model, form } = makeRowsForm();
    const { runs, rules } = countedRowsRules();
    const ctrl = createFormValidation(model, rules, { strategy: 'blur' });
    ctrl.start();

    model.rows.push({ label: '' });
    await tick();
    runs.mockClear();
    const row = form.rows.at(0)!;
    row.label.setIssues([]);

    row.label.markAsTouched();
    await tick();

    expect(runs).toHaveBeenCalledTimes(1);
    expect(issueCodes(row.label)).toEqual(['required']);
    ctrl.dispose();
  });

  it('blur на строке, вставленной через форму массива, тоже виден', async () => {
    const { model, form } = makeRowsForm([{ label: 'a' }]);
    const { runs, rules } = countedRowsRules();
    const ctrl = createFormValidation(model, rules, { strategy: 'blur' });
    ctrl.start();

    form.rows.insert(0, { label: '' });
    await tick();
    runs.mockClear();

    form.rows.at(0)!.label.markAsTouched();
    await tick();

    expect(runs).toHaveBeenCalledTimes(1);
    expect(issueCodes(form.rows.at(0)!.label)).toEqual(['required']);
    ctrl.dispose();
  });

  it('поведение под вопросом [ReFormer-jefl]: при стратегии blur добавление строки само запускает прогон', async () => {
    // Effect стратегии подписан на состав массива (иначе не увидел бы blur новых строк), и любой
    // его перезапуск — живой прогон, хотя blur не было.
    const { model } = makeRowsForm();
    const { runs, rules } = countedRowsRules();
    const ctrl = createFormValidation(model, rules, { strategy: 'blur' });
    ctrl.start();

    model.rows.push({ label: '' });
    await tick();

    expect(runs).toHaveBeenCalledTimes(1);
    ctrl.dispose();
  });

  it('blur поля-массива целиком (мультивыбор) запускает прогон', async () => {
    const { model, form } = makeRowsForm();
    const rules = defineValidation<Rows>(({ model: scope }) => {
      validate(scope.$.tags, [required()]);
    });
    const ctrl = createFormValidation(model, rules, { strategy: 'blur' });
    ctrl.start();

    form.tags.markAsTouched();
    await tick();

    expect(issueCodes(form.tags)).toEqual(['required']);
    ctrl.dispose();
  });
});

describe('createFormValidation — лишние живые прогоны (дефекты)', () => {
  it('blur: validate() — один прогон схемы, своё касание полей живой не запускает [ReFormer-lzhc]', async () => {
    const { model } = makeForm({ name: 'Иван' });
    const { runs, schema } = countedNameRules();
    const ctrl = createFormValidation(model, schema, { strategy: 'blur' });
    ctrl.start();
    try {
      await ctrl.validate();
      await tick();

      expect(runs).toHaveBeenCalledTimes(1);
    } finally {
      ctrl.dispose();
    }
  });

  it('blur: смена значения, прочитанного условием validateWhen, без blur не прогоняет [ReFormer-om5k]', async () => {
    const { model, form } = makeForm();
    const runs = vi.fn();
    const schema = defineValidation<F>(({ model: scope }) => {
      runs();
      validateWhen(
        () => scope.age > 0,
        () => validate(scope.$.name, [required()])
      );
    });
    const ctrl = createFormValidation(model, schema, { strategy: 'blur' });
    ctrl.start();
    try {
      form.profile.city.markAsTouched(); // первый живой прогон: схема читает age внутри effect'а
      await tick();
      runs.mockClear();

      model.age = 18; // ввод без blur
      await tick();

      expect(runs).not.toHaveBeenCalled();
    } finally {
      ctrl.dispose();
    }
  });

  it('change: сигнал вне модели, прочитанный правилом, прогон не запускает [ReFormer-om5k]', async () => {
    const { model } = makeForm();
    const blocked = signal(false);
    const runs = vi.fn();
    const schema = defineValidation<F>(({ model: scope }) => {
      runs();
      validate(scope.$.name, [() => (blocked.value ? { code: 'blocked' } : null)]);
    });
    const ctrl = createFormValidation(model, schema, { strategy: 'change' });
    ctrl.start();
    try {
      model.name = 'Иван'; // первый живой прогон: правило читает сигнал внутри effect'а
      await tick();
      runs.mockClear();

      blocked.value = true; // не ввод в форму
      await tick();

      expect(runs).not.toHaveBeenCalled();
    } finally {
      ctrl.dispose();
    }
  });
});
