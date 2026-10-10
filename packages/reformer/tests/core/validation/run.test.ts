/**
 * Раннер схемы валидации — `form/validation/run`: сбор результата, отмена устаревшего прогона и
 * разнос замечаний по нодам.
 *
 * Отмена ключится парой «модель + схема»: следующий прогон той же пары обрывает предыдущий через
 * `AbortSignal`, и устаревший прогон не ждёт своих медленных правил. Разнос гасит поля диффом
 * только для результата, собранного раннером; результат, собранный вручную (не раннером),
 * разносится как есть. Замечание правила — `code`, `params`, `severity` — доходит до результата и
 * до ноды без изменений.
 */

import { describe, it, expect, vi } from 'vitest';
import { deferred, tick, type Deferred } from '../../test-utils/async';
import { issueCodes, resultCodes } from '../../test-utils/issues';
import { createModel } from '../../../src/model/index';
import type { PathAwareSignal } from '../../../src/model/types';
import { createForm } from '../../../src/form/form-bundle';
import { defineFormBehavior, enableWhen } from '../../../src/form/behaviors';
import {
  applyValidationResult,
  defineValidation,
  runValidation,
  validate,
  validateAsync,
  validateModel,
} from '../../../src/form/validation';
import { runAndApply } from '../../../src/form/validation/run';
import { required } from '../../../src/form/validators';
import type { ValidationIssue } from '../../../src/form/types/contracts';
import type { ValidationDefinition, ValidationResult } from '../../../src/form/validation/types';

interface Login {
  login: string;
  note: string;
}

const issue = (code: string): ValidationIssue => ({ code });

/** Результат, собранный вручную, — не раннером. */
const handMade = (
  status: ValidationResult['status'],
  entries: Array<[PathAwareSignal<unknown>, ValidationIssue[]]>
): ValidationResult => ({ status, issues: new Map(entries), failures: [] });

describe('validation/run — defineValidation', () => {
  it('возвращает схему как есть', () => {
    const schema: ValidationDefinition<Login> = ({ model }) => validate(model.$.note, [required()]);

    expect(defineValidation(schema)).toBe(schema);
  });
});

describe('validation/run — отмена устаревшего прогона', () => {
  /** Схема с async-правилом, ответы которого тест выдаёт сам; сигналы правил — в `signals`. */
  function controlledLogin() {
    const model = createModel<Login>({ login: 'anna', note: '' });
    const gates: Deferred<ValidationIssue | null>[] = [];
    const signals: AbortSignal[] = [];
    const rules = defineValidation<Login>(({ model: scope }) => {
      validateAsync(scope.$.login, [
        (_login, { signal }) => {
          signals.push(signal);
          const gate = deferred<ValidationIssue | null>();
          gates.push(gate);
          return gate.promise;
        },
      ]);
    });
    return { model, rules, gates, signals };
  }

  it('сигнал правила отменяется, когда стартует следующий прогон той же пары', async () => {
    const { model, rules, gates, signals } = controlledLogin();

    const first = runValidation(model, rules);
    expect(signals[0].aborted).toBe(false);
    const second = runValidation(model, rules);

    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
    gates[1].resolve(null);
    expect((await second).status).toBe('valid');
    expect((await first).status).toBe('cancelled');
  });

  it('устаревший прогон завершается cancelled, не дожидаясь своего медленного правила', async () => {
    const { model, rules, gates } = controlledLogin();

    const first = runValidation(model, rules);
    void runValidation(model, rules);

    // Правило первого прогона так и не ответило: ожидание размыкает отмена.
    const result = await first;
    expect(result.status).toBe('cancelled');
    expect(result.failures).toEqual([]);
    gates[1].resolve(null);
  });

  it('поздний ответ отменённого прогона в его результат не попадает', async () => {
    const { model, rules, gates } = controlledLogin();

    const first = runValidation(model, rules);
    const second = runValidation(model, rules);
    gates[1].resolve(null);
    await second;
    gates[0].resolve(issue('taken'));
    const stale = await first;

    expect(stale.status).toBe('cancelled');
    expect(resultCodes(stale, model.$.login)).toEqual([]);
  });

  it('отменён ещё до ожидания async-правил (вложенный прогон той же пары) — сразу cancelled', async () => {
    const model = createModel<Login>({ login: 'anna', note: '' });
    const never = deferred<ValidationIssue | null>();
    let nested = false;
    let inner: Promise<ValidationResult> | undefined;
    const rules = defineValidation<Login>(({ model: scope }) => {
      // Внешний прогон ждал бы это правило вечно — его ожидание размыкает уже сработавшая отмена.
      validateAsync(scope.$.login, [() => (nested ? Promise.resolve(null) : never.promise)]);
      validate(scope.$.note, [
        () => {
          if (!nested) {
            nested = true;
            inner = runValidation(model, rules);
          }
          return null;
        },
      ]);
    });

    const outer = await runValidation(model, rules);

    expect(outer.status).toBe('cancelled');
    expect((await inner!).status).toBe('valid');
  });

  it('отмена ключится парой: другая модель или другая схема прогон не отменяют', async () => {
    const first = controlledLogin();
    const otherModel = createModel<Login>({ login: 'boris', note: '' });
    const otherRules = defineValidation<Login>(({ model }) => validate(model.$.note, [required()]));

    const pending = runValidation(first.model, first.rules);
    const sameSchemaOtherModel = runValidation(otherModel, first.rules);
    const otherSchemaSameModel = runValidation(first.model, otherRules);

    expect(first.signals[0].aborted).toBe(false);
    first.gates.forEach((gate) => gate.resolve(null));
    expect((await pending).status).toBe('valid');
    expect((await sameSchemaOtherModel).status).toBe('valid');
    expect((await otherSchemaSameModel).status).toBe('invalid');
  });

  it('cancelled приоритетнее error: сбой правила отменённого прогона сбоем не считается', async () => {
    const { model, rules, gates } = controlledLogin();

    const first = runValidation(model, rules);
    const second = runValidation(model, rules);
    gates[0].reject(new Error('сеть'));
    gates[1].resolve(null);

    expect((await first).status).toBe('cancelled');
    expect((await first).failures).toEqual([]);
    expect((await second).status).toBe('valid');
  });

  it('error приоритетнее invalid, invalid — valid; warning не блокирует', async () => {
    const model = createModel<Login>({ login: '', note: '' });
    const failing = defineValidation<Login>(({ model: scope }) => {
      validate(scope.$.note, [required()]);
      validateAsync(scope.$.login, [() => Promise.reject(new Error('сеть'))]);
    });
    const blocking = defineValidation<Login>(({ model: scope }) => {
      validate(scope.$.note, [required()]);
      validate(scope.$.login, [() => ({ code: 'weak', severity: 'warning' })]);
    });
    const warnings = defineValidation<Login>(({ model: scope }) => {
      validate(scope.$.login, [() => ({ code: 'weak', severity: 'warning' })]);
    });

    expect((await runValidation(model, failing)).status).toBe('error');
    expect((await runValidation(model, blocking)).status).toBe('invalid');
    expect((await runValidation(model, warnings)).status).toBe('valid');
  });
});

describe('validation/run — разнос результата', () => {
  const createLogin = (initial: Login = { login: '', note: '' }) => createForm<Login>({ initial });

  it('результат не от раннера разносится как есть', () => {
    const { model, form } = createLogin();

    applyValidationResult(handMade('invalid', [[model.$.login, [issue('taken')]]]));

    expect(issueCodes(form.login)).toEqual(['taken']);
    expect(form.login.touched.value).toBe(false);
  });

  it('у результата не от раннера нет прошлого прогона: поля прежних результатов не гасятся', () => {
    const { model, form } = createLogin();

    applyValidationResult(handMade('invalid', [[model.$.login, [issue('taken')]]]));
    applyValidationResult(handMade('invalid', [[model.$.note, [issue('empty')]]]));

    expect(issueCodes(form.login)).toEqual(['taken']);
    expect(issueCodes(form.note)).toEqual(['empty']);
  });

  it('результат не от раннера с touch метит только свои поля', () => {
    const { model, form } = createLogin();

    applyValidationResult(handMade('valid', [[model.$.note, []]]), { touch: true });

    expect(form.note.touched.value).toBe(true);
    expect(form.login.touched.value).toBe(false);
  });

  it('результат не от раннера со статусом cancelled не разносится', () => {
    const { model, form } = createLogin();

    applyValidationResult(handMade('cancelled', [[model.$.login, [issue('taken')]]]), {
      touch: true,
    });

    expect(issueCodes(form.login)).toEqual([]);
    expect(form.login.touched.value).toBe(false);
  });

  it('ручка без ноды формы пропускается без ошибки', () => {
    const model = createModel<Login>({ login: '', note: '' });

    expect(() =>
      applyValidationResult(handMade('invalid', [[model.$.login, [issue('taken')]]]))
    ).not.toThrow();
  });

  it('ручной результат не сбивает гашение пары раннера', async () => {
    const { model, form } = createLogin();
    const loginRules = defineValidation<Login>(({ model: scope }) => {
      validate(scope.$.login, [required()]);
    });
    await validateModel(model, loginRules);
    applyValidationResult(handMade('invalid', [[model.$.note, [issue('server')]]]));

    model.login = 'anna';
    await validateModel(model, loginRules);

    // Раннер гасит только поля своей пары: замечание сервера на note остаётся.
    expect(issueCodes(form.login)).toEqual([]);
    expect(issueCodes(form.note)).toEqual(['server']);
  });

  it('поле, которое пара перестала проверять, гасится следующим прогоном', async () => {
    const { model, form } = createLogin();
    let checkNote = true;
    const rules = defineValidation<Login>(({ model: scope }) => {
      validate(scope.$.login, [required()]);
      if (checkNote) validate(scope.$.note, [required()]);
    });
    await validateModel(model, rules);
    expect(issueCodes(form.note)).toEqual(['required']);

    checkNote = false;
    await validateModel(model, rules);

    expect(issueCodes(form.note)).toEqual([]);
    expect(issueCodes(form.login)).toEqual(['required']);
  });
});

describe('validation/run — runAndApply', () => {
  it('держит поле с async-правилом в pending до разноса и снимает после', async () => {
    const { model, form } = createForm<Login>({ initial: { login: 'anna', note: '' } });
    const gate = deferred<ValidationIssue | null>();
    const rules = defineValidation<Login>(({ model: scope }) => {
      validateAsync(scope.$.login, [() => gate.promise]);
    });

    const run = runAndApply(model, rules);
    expect(form.login.pending.value).toBe(true);
    gate.resolve(issue('taken'));
    const result = await run;

    expect(result.status).toBe('invalid');
    expect(form.login.pending.value).toBe(false);
    expect(issueCodes(form.login)).toEqual(['taken']);
  });

  it('модель без формы: async-поле без ноды в pending не переводится, прогон идёт', async () => {
    const model = createModel<Login>({ login: 'anna', note: '' });
    const rules = defineValidation<Login>(({ model: scope }) => {
      validateAsync(scope.$.login, [async () => issue('taken')]);
    });

    const result = await runAndApply(model, rules);

    expect(result.status).toBe('invalid');
    expect(resultCodes(result, model.$.login)).toEqual(['taken']);
  });

  it('skipDisabled: замечания и сбои выключенного поля не учитываются', async () => {
    const bundle = createForm<Login>({
      initial: { login: '', note: '' },
      behavior: defineFormBehavior<Login>(({ model }) => {
        enableWhen(model.$.note, () => model.login !== '');
      }),
    });
    await tick(); // отложенная запись enableWhen
    const rules = defineValidation<Login>(({ model: scope }) => {
      validate(scope.$.note, [required()]);
      validateAsync(scope.$.note, [() => Promise.reject(new Error('сеть'))]);
    });

    const plain = await runAndApply(bundle.model, rules);
    const skipping = await runAndApply(bundle.model, rules, { skipDisabled: true });

    expect(plain.status).toBe('error');
    expect(skipping).toMatchObject({ status: 'valid', failures: [] });
    expect(resultCodes(skipping, bundle.model.$.note)).toEqual([]);
  });
});

describe('validation/run — замечание правила доходит без изменений', () => {
  const tooSmall: ValidationIssue = {
    code: 'amount.min',
    params: { min: 50_000, actual: 10, currency: 'RUB' },
  };
  const hint: ValidationIssue = {
    code: 'amount.round',
    params: { step: 1000 },
    severity: 'warning',
  };

  it('code и params синхронного правила — в результате и на ноде как есть', async () => {
    const { model, form } = createForm<{ amount: number }>({ initial: { amount: 10 } });
    const rules = defineValidation<{ amount: number }>(({ model: scope }) => {
      validate(scope.$.amount, [() => tooSmall, () => hint]);
    });

    const result = await runAndApply(model, rules);

    expect(result.issues.get(model.$.amount)).toStrictEqual([tooSmall, hint]);
    expect(form.amount.issues.value).toStrictEqual([tooSmall, hint]);
  });

  it('code и params async-правила — тоже без изменений', async () => {
    const { model, form } = createForm<{ amount: number }>({ initial: { amount: 10 } });
    const rules = defineValidation<{ amount: number }>(({ model: scope }) => {
      validateAsync(scope.$.amount, [async () => tooSmall]);
    });

    await runAndApply(model, rules);

    expect(form.amount.issues.value).toStrictEqual([tooSmall]);
  });

  it('warning: статус valid, замечание на ноде есть, нода валидна', async () => {
    const { model, form } = createForm<{ amount: number }>({ initial: { amount: 10 } });
    const rules = defineValidation<{ amount: number }>(({ model: scope }) => {
      validate(scope.$.amount, [() => hint]);
    });

    const result = await runAndApply(model, rules);

    expect(result.status).toBe('valid');
    expect(form.amount.issues.value).toStrictEqual([hint]);
    expect(form.amount.valid.value).toBe(true);
    expect(form.valid.value).toBe(true);
  });

  it('validateModel: true только для valid', async () => {
    const model = createModel<Login>({ login: '', note: '' });
    const spy = vi.fn(() => hint);
    const rules = defineValidation<Login>(({ model: scope }) => {
      validate(scope.$.login, [spy]);
    });

    expect(await validateModel(model, rules)).toBe(true);
    expect(spy).toHaveBeenCalledWith('');
  });
});
