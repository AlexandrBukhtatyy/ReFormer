/**
 * Результат прогона схемы валидации: статус, сбор без формы, разнос по нодам, политика сбоя
 * async-правила и `pending` поля на время проверки.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createModel } from '../../../src/model/index';
import { createFormFromModel } from '../../../src/form/create-form';
import { required } from '../../../src/form/validators';
import {
  applyValidationResult,
  defineValidationSchema,
  runValidation,
  validate,
  validateAsync,
  validateModel,
  type ValidationResult,
} from '../../../src/form/validation';
import { buildValidation } from '../../../src/form/validation/config';
import { createFormValidation } from '../../../src/form/validation/strategy';
import enJson from '../../../src/i18n/en.json';
import ruJson from '../../../src/i18n/ru.json';
import { DEFAULT_LOCALE } from '../../../src/i18n/locale';
import { createI18n } from '../../../src/i18n/translator';
import { resolveValidationError } from '../../../src/i18n/validation-message';
import { ru as ruLocale } from '../../../src/locale/ru';

interface Account {
  name: string;
  login: string;
}

/** Отложенный ответ async-правила: тест сам решает, когда и чем оно завершится. */
function deferred<V>() {
  let resolve!: (value: V) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<V>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const nameRequired = defineValidationSchema<Account>(({ model }) => {
  validate(model.$.name, [required({ message: 'Имя обязательно' })]);
});

const build = (initial: Partial<Account> = {}) => {
  const model = createModel<Account>({ name: '', login: '', ...initial });
  return { model, form: createFormFromModel<Account>({ model }) };
};

const codesOf = (result: ValidationResult, handle: unknown): string[] =>
  (result.errors.get(handle as never) ?? []).map((error) => error.code);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runValidation — статус результата', () => {
  it('valid: блокирующих ошибок нет', async () => {
    const { model } = build({ name: 'Иван' });

    const result = await runValidation(model, nameRequired);

    expect(result.status).toBe('valid');
    expect(result.failures).toEqual([]);
    expect(codesOf(result, model.$.name)).toEqual([]);
  });

  it('invalid: есть блокирующая ошибка, ключ — ручка поля', async () => {
    const { model } = build();

    const result = await runValidation(model, nameRequired);

    expect(result.status).toBe('invalid');
    expect(codesOf(result, model.$.name)).toEqual(['required']);
    expect([...result.errors.keys()].map((handle) => handle.__path)).toEqual(['name']);
  });

  it('valid: предупреждение не блокирует', async () => {
    const { model } = build();
    const warnOnly = defineValidationSchema<Account>(({ model: scope }) => {
      validate(scope.$.name, [() => ({ code: 'weak', message: 'Слабо', severity: 'warning' })]);
    });

    const result = await runValidation(model, warnOnly);

    expect(result.status).toBe('valid');
    expect(codesOf(result, model.$.name)).toEqual(['weak']);
  });

  it('error: async-правило отклонилось — сбой записан, на поле блокирующая ошибка', async () => {
    const { model } = build({ login: 'ivan' });
    const failure = new Error('network');
    const loginFree = defineValidationSchema<Account>(({ model: scope }) => {
      validateAsync(scope.$.login, [
        async () => {
          throw failure;
        },
      ]);
    });

    const result = await runValidation(model, loginFree);

    expect(result.status).toBe('error');
    expect(result.failures).toEqual([{ handle: model.$.login, error: failure }]);
    expect(codesOf(result, model.$.login)).toEqual(['ruleFailed']);
  });

  it('error: правило бросило синхронно — тоже сбой, а не исключение прогона', async () => {
    const { model } = build();
    const failure = new Error('sync');
    const broken = defineValidationSchema<Account>(({ model: scope }) => {
      validateAsync(scope.$.login, [
        () => {
          throw failure;
        },
      ]);
    });

    const result = await runValidation(model, broken);

    expect(result.status).toBe('error');
    expect(result.failures).toEqual([{ handle: model.$.login, error: failure }]);
  });

  it('error важнее invalid: сбой одного правила при ошибке другого', async () => {
    const { model } = build();
    const both = defineValidationSchema<Account>(({ model: scope }) => {
      validate(scope.$.name, [required({ message: 'Имя обязательно' })]);
      validateAsync(scope.$.login, [() => Promise.reject(new Error('network'))]);
    });

    const result = await runValidation(model, both);

    expect(result.status).toBe('error');
    expect(codesOf(result, model.$.name)).toEqual(['required']);
    expect(codesOf(result, model.$.login)).toEqual(['ruleFailed']);
  });

  it('несколько сбоев одного поля дают одну ошибку `ruleFailed`', async () => {
    const { model } = build();
    const twice = defineValidationSchema<Account>(({ model: scope }) => {
      validateAsync(scope.$.login, [
        () => Promise.reject(new Error('first')),
        () => Promise.reject(new Error('second')),
      ]);
    });

    const result = await runValidation(model, twice);

    expect(result.failures).toHaveLength(2);
    expect(codesOf(result, model.$.login)).toEqual(['ruleFailed']);
  });

  it('cancelled: прогон устарел — следующий запуск той же пары отменил его', async () => {
    const { model } = build({ login: 'ivan' });
    const answers = [deferred<null>(), deferred<null>()];
    let call = 0;
    const slow = defineValidationSchema<Account>(({ model: scope }) => {
      validateAsync(scope.$.login, [() => answers[call++].promise]);
    });

    const first = runValidation(model, slow);
    const second = runValidation(model, slow);
    answers[1].resolve(null);

    expect((await first).status).toBe('cancelled');
    expect((await second).status).toBe('valid');
  });

  it('отмена — не сбой: отклонение отменённого правила в `failures` не попадает', async () => {
    const { model } = build({ login: 'ivan' });
    const answers = [deferred<null>(), deferred<null>()];
    let call = 0;
    const slow = defineValidationSchema<Account>(({ model: scope }) => {
      validateAsync(scope.$.login, [() => answers[call++].promise]);
    });

    const first = runValidation(model, slow);
    const second = runValidation(model, slow);
    answers[0].reject(new DOMException('Aborted', 'AbortError'));
    answers[1].resolve(null);

    const cancelled = await first;
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.failures).toEqual([]);
    expect((await second).status).toBe('valid');
  });
});

describe('runValidation и applyValidationResult — сбор отдельно от разноса', () => {
  it('сбор не трогает ноды формы', async () => {
    const { model, form } = build();

    const result = await runValidation(model, nameRequired);

    expect(result.status).toBe('invalid');
    expect(form.name.errors.value).toEqual([]);
    expect(form.name.touched.value).toBe(false);
    expect(form.valid.value).toBe(true);
  });

  it('сбор работает без формы', async () => {
    const model = createModel<Account>({ name: '', login: '' });

    const result = await runValidation(model, nameRequired);

    expect(result.status).toBe('invalid');
    expect(() => applyValidationResult(result, { touch: true })).not.toThrow();
  });

  it('разнос ставит ошибки и по `touch` помечает проверенные поля', async () => {
    const { model, form } = build();
    const result = await runValidation(model, nameRequired);

    applyValidationResult(result, { touch: true });

    expect(form.name.errors.value.map((error) => error.code)).toEqual(['required']);
    expect(form.name.touched.value).toBe(true);
    expect(form.login.touched.value).toBe(false); // схема поле не проверяла
  });

  it('разнос следующего прогона гасит поле, ставшее валидным', async () => {
    const { model, form } = build();
    applyValidationResult(await runValidation(model, nameRequired));
    expect(form.name.invalid.value).toBe(true);

    model.name = 'Иван';
    applyValidationResult(await runValidation(model, nameRequired));

    expect(form.name.errors.value).toEqual([]);
    expect(form.name.valid.value).toBe(true);
  });

  it('отменённый результат не разносится', async () => {
    const { model, form } = build({ login: 'ivan' });
    const answers = [deferred<null>(), deferred<{ code: string; message: string } | null>()];
    let call = 0;
    const slow = defineValidationSchema<Account>(({ model: scope }) => {
      validate(scope.$.name, [required({ message: 'Имя обязательно' })]);
      validateAsync(scope.$.login, [() => answers[call++].promise]);
    });

    const first = runValidation(model, slow);
    const second = runValidation(model, slow);
    answers[1].resolve(null);
    await second;

    applyValidationResult(await first, { touch: true });

    expect(form.name.errors.value).toEqual([]);
    expect(form.name.touched.value).toBe(false);
  });

  it('сбой правила виден на поле после разноса', async () => {
    const { model, form } = build({ login: 'ivan' });
    const loginFree = defineValidationSchema<Account>(({ model: scope }) => {
      validateAsync(scope.$.login, [() => Promise.reject(new Error('network'))]);
    });

    applyValidationResult(await runValidation(model, loginFree), { touch: true });

    expect(form.login.errors.value.map((error) => error.code)).toEqual(['ruleFailed']);
    expect(form.login.invalid.value).toBe(true);
    expect(form.login.shouldShowError.value).toBe(true);
  });
});

describe('validateModel — обёртка с boolean', () => {
  it('true только для статуса valid', async () => {
    const failing = defineValidationSchema<Account>(({ model: scope }) => {
      validateAsync(scope.$.login, [() => Promise.reject(new Error('network'))]);
    });

    await expect(validateModel(build({ name: 'Иван' }).model, nameRequired)).resolves.toBe(true);
    await expect(validateModel(build().model, nameRequired)).resolves.toBe(false);
    await expect(validateModel(build().model, failing)).resolves.toBe(false);
  });

  it('сбой правила блокирует отправку формы', async () => {
    const { model, form } = build({ name: 'Иван', login: 'ivan' });
    const loginFree = defineValidationSchema<Account>(({ model: scope }) => {
      validateAsync(scope.$.login, [() => Promise.reject(new Error('network'))]);
    });
    const onSubmit = vi.fn();

    await expect(validateModel(model, loginFree)).resolves.toBe(false);
    await expect(form.submit(onSubmit)).resolves.toBeNull();

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('повторный прогон после восстановления сети снимает ошибку сбоя', async () => {
    const { model, form } = build({ login: 'ivan' });
    let online = false;
    const loginFree = defineValidationSchema<Account>(({ model: scope }) => {
      validateAsync(scope.$.login, [
        () => (online ? Promise.resolve(null) : Promise.reject(new Error('network'))),
      ]);
    });

    await validateModel(model, loginFree);
    expect(form.login.errors.value.map((error) => error.code)).toEqual(['ruleFailed']);

    online = true;
    await expect(validateModel(model, loginFree)).resolves.toBe(true);
    expect(form.login.errors.value).toEqual([]);
  });
});

describe('pending поля на время async-правил', () => {
  const slowSchema = (answer: Promise<{ code: string; message: string } | null>) =>
    defineValidationSchema<Account>(({ model }) => {
      validate(model.$.name, [required({ message: 'Имя обязательно' })]);
      validateAsync(model.$.login, [() => answer]);
    });

  it('validateModel держит поле с async-правилом в pending до конца прогона', async () => {
    const { model, form } = build({ name: 'Иван', login: 'ivan' });
    const answer = deferred<null>();

    const run = validateModel(model, slowSchema(answer.promise));

    expect(form.login.pending.value).toBe(true);
    expect(form.login.status.value).toBe('pending');
    expect(form.name.pending.value).toBe(false); // у поля только синхронные правила
    expect(form.pending.value).toBe(true); // агрегат формы

    answer.resolve(null);
    await expect(run).resolves.toBe(true);

    expect(form.login.pending.value).toBe(false);
    expect(form.login.status.value).toBe('valid');
    expect(form.pending.value).toBe(false);
  });

  it('после прогона статус поля — по его ошибкам', async () => {
    const { model, form } = build({ name: 'Иван', login: 'taken' });
    const answer = deferred<{ code: string; message: string } | null>();

    const run = validateModel(model, slowSchema(answer.promise));
    answer.resolve({ code: 'taken', message: 'Занято' });
    await run;

    expect(form.login.pending.value).toBe(false);
    expect(form.login.status.value).toBe('invalid');
  });

  it('отменённый прогон снимает свой pending, пока идёт следующий — поле остаётся pending', async () => {
    const { model, form } = build({ name: 'Иван', login: 'ivan' });
    const answers = [deferred<null>(), deferred<null>()];
    let call = 0;
    const slow = defineValidationSchema<Account>(({ model: scope }) => {
      validateAsync(scope.$.login, [() => answers[call++].promise]);
    });

    const first = validateModel(model, slow);
    const second = validateModel(model, slow);
    await expect(first).resolves.toBe(false); // отменён

    expect(form.login.pending.value).toBe(true);

    answers[1].resolve(null);
    await expect(second).resolves.toBe(true);
    expect(form.login.pending.value).toBe(false);
  });

  it('сбор без разноса (runValidation) pending не включает', async () => {
    const { model, form } = build({ name: 'Иван', login: 'ivan' });
    const answer = deferred<null>();

    const run = runValidation(model, slowSchema(answer.promise));
    expect(form.login.pending.value).toBe(false);

    answer.resolve(null);
    await run;
  });

  it('отключённое поле в pending не переходит', async () => {
    const { model, form } = build({ name: 'Иван', login: 'ivan' });
    form.login.disable();
    const answer = deferred<null>();

    const run = validateModel(model, slowSchema(answer.promise));
    expect(form.login.status.value).toBe('disabled');

    answer.resolve(null);
    await run;
    expect(form.login.status.value).toBe('disabled');
  });
});

describe('сборка валидации формы — runAll, runStep, validating', () => {
  const stepOne = defineValidationSchema<Account>(({ model }) => {
    validate(model.$.name, [required({ message: 'Имя обязательно' })]);
  });

  it('runAll и runStep возвращают результат и разносят ошибки', async () => {
    const { model, form } = build();
    const validation = buildValidation(model, { steps: { profile: stepOne, access: null } })!;

    const stepResult = await validation.runStep('profile');
    expect(stepResult.status).toBe('invalid');
    expect(form.name.errors.value.map((error) => error.code)).toEqual(['required']);
    expect(form.name.touched.value).toBe(true);

    expect((await validation.runStep(2)).status).toBe('valid'); // шаг без правил
    expect((await validation.runAll()).status).toBe('invalid');
  });

  it('validate, validateAll и validateStep отвечают boolean', async () => {
    const { model } = build();
    const validation = buildValidation(model, { steps: { profile: stepOne } })!;

    await expect(validation.validateStep(1)).resolves.toBe(false);
    await expect(validation.validateAll()).resolves.toBe(false);
    model.name = 'Иван';
    await expect(validation.validateStep('profile')).resolves.toBe(true);
    await expect(validation.validate()).resolves.toBe(true);
  });

  it('сбой правила шага отличим от ошибки', async () => {
    const { model } = build({ login: 'ivan' });
    const access = defineValidationSchema<Account>(({ model: scope }) => {
      validateAsync(scope.$.login, [() => Promise.reject(new Error('network'))]);
    });
    const validation = buildValidation(model, { steps: { access } })!;

    const result = await validation.runStep('access');

    expect(result.status).toBe('error');
    expect(result.failures).toHaveLength(1);
    await expect(validation.validateStep('access')).resolves.toBe(false);
  });

  it('validating учитывает прогон шага и полный прогон', async () => {
    const { model } = build({ login: 'ivan' });
    const answers = [deferred<null>(), deferred<null>()];
    let call = 0;
    const access = defineValidationSchema<Account>(({ model: scope }) => {
      validateAsync(scope.$.login, [() => answers[call++].promise]);
    });
    const validation = buildValidation(model, { steps: { access } })!;
    expect(validation.validating.value).toBe(false);

    const stepRun = validation.runStep('access');
    expect(validation.validating.value).toBe(true);
    answers[0].resolve(null);
    await stepRun;
    expect(validation.validating.value).toBe(false);

    const fullRun = validation.runAll();
    expect(validation.validating.value).toBe(true);
    answers[1].resolve(null);
    await fullRun;
    expect(validation.validating.value).toBe(false);
  });
});

describe('живой прогон и исключение схемы', () => {
  it('исключение схемы не остаётся необработанным отклонением', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const { model } = build();
    const broken = defineValidationSchema<Account>(() => {
      throw new Error('schema bug');
    });
    const controller = createFormValidation(model, broken, { strategy: 'change' });
    const dispose = controller.start();

    model.name = 'Иван';
    await new Promise((resolve) => setTimeout(resolve, 0));
    dispose();
    process.off('unhandledRejection', unhandled);

    expect(unhandled).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    expect(controller.isValidating).toBe(false);
  });

  it('явный прогон исключение схемы пробрасывает', async () => {
    const { model } = build();
    const broken = defineValidationSchema<Account>(() => {
      throw new Error('schema bug');
    });

    await expect(validateModel(model, broken)).rejects.toThrow('schema bug');
  });
});

describe('текст ошибки сбоя правила', () => {
  it.each([
    ['en', DEFAULT_LOCALE, enJson],
    ['ru', ruLocale, ruJson],
  ])('локаль %s даёт текст для кода ruleFailed', async (_code, locale, dictionary) => {
    const { model } = build({ login: 'ivan' });
    const loginFree = defineValidationSchema<Account>(({ model: scope }) => {
      validateAsync(scope.$.login, [() => Promise.reject(new Error('network'))]);
    });
    const result = await runValidation(model, loginFree);
    const [error] = result.errors.get(model.$.login as never)!;

    const text = resolveValidationError(error, createI18n(locale));

    expect(text).toBe(dictionary['validation.ruleFailed']);
    expect(text.length).toBeGreaterThan(3);
  });
});
