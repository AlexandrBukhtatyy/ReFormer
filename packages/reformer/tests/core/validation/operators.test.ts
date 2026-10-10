/**
 * Операторы схемы валидации — `form/validation/operators`: `validate`, `validateAsync`,
 * `validateWhen`, `cross` области, `apply`, `applyEach`.
 *
 * Оператор пишет замечания в сток текущего прогона и ничего не возвращает. Проверяется, что
 * правила получают значение поля и вызываются все по порядку, что `validateWhen` выключает и
 * синхронные, и async-правила (поле при этом «тронуто» пустой корзиной и гасится), что сбой и
 * исключение async-правила — это `failures` и одна блокирующая `ruleFailed`, что `cross` получает
 * снимок своей области — корня или строки, и что вне прогона каждый оператор бросает ошибку со
 * своим именем.
 */

import { describe, it, expect, vi } from 'vitest';
import { issueCodes, resultCodes } from '../../test-utils/issues';
import { InputStub } from '../../test-utils/stubs';
import { createModel } from '../../../src/model/index';
import type { FormModel } from '../../../src/model/types';
import { createForm } from '../../../src/form/form-bundle';
import {
  apply,
  applyEach,
  defineValidation,
  runValidation,
  validate,
  validateAsync,
  validateModel,
  validateWhen,
} from '../../../src/form/validation';
import { runAndApply } from '../../../src/form/validation/run';
import { required } from '../../../src/form/validators';
import type { ValidationIssue } from '../../../src/form/types/contracts';
import type { ValidationScope } from '../../../src/form/validation/types';

interface Item {
  kind: string;
  title: string;
  price: number;
  limit: number;
}
interface Shape {
  name: string;
  email: string;
  agree: boolean;
  items: Item[];
}

const item = (over: Partial<Item> = {}): Item => ({
  kind: 'a',
  title: '',
  price: 0,
  limit: 100,
  ...over,
});

const createShape = (over: Partial<Shape> = {}) =>
  createForm<Shape>({
    initial: { name: '', email: '', agree: false, items: [], ...over },
    schema: (model) => ({
      children: [
        {
          model: model.$.items,
          item: (row: FormModel<Item>) => ({
            children: [
              { model: row.$.kind, component: InputStub },
              { model: row.$.title, component: InputStub },
              { model: row.$.price, component: InputStub },
            ],
          }),
        },
      ],
    }),
  });

const issue = (code: string, over: Partial<ValidationIssue> = {}): ValidationIssue => ({
  code,
  ...over,
});

describe('validation/operators — вне прогона', () => {
  it('каждый оператор бросает ошибку со своим именем', () => {
    const model = createModel<Shape>({ name: '', email: '', agree: false, items: [] });

    expect(() => validate(model.$.name, [])).toThrow('"validate" вызван вне схемы валидации');
    expect(() => validateAsync(model.$.name, [])).toThrow('"validateAsync" вызван вне схемы');
    expect(() =>
      validateWhen(
        () => true,
        () => {}
      )
    ).toThrow('"validateWhen" вызван вне схемы');
    expect(() => apply(defineValidation<Shape>(() => {}))).toThrow('"apply" вызван вне схемы');
    expect(() => applyEach(model.$.items, () => {})).toThrow('"applyEach" вызван вне схемы');
  });

  it('cross области, вызванный после прогона, — тоже ошибка', async () => {
    const model = createModel<Shape>({ name: '', email: '', agree: false, items: [] });
    let scope: ValidationScope<Shape> | undefined;
    await runValidation(
      model,
      defineValidation<Shape>((current) => {
        scope = current;
      })
    );

    expect(() => scope!.cross(model.$.name, () => null)).toThrow('"cross" вызван вне схемы');
  });
});

describe('validation/operators — validate', () => {
  it('все правила вызываются по порядку со значением поля; замечания копятся', async () => {
    const { model, form } = createShape({ name: 'Ан' });
    const calls: string[] = [];
    const recorded =
      (label: string, result: ValidationIssue | null) =>
      (value: string): ValidationIssue | null => {
        calls.push(`${label}:${value}`);
        return result;
      };
    const rules = defineValidation<Shape>(({ model: scope }) => {
      validate(scope.$.name, [
        recorded('first', issue('short')),
        recorded('second', null),
        recorded('third', issue('latin')),
      ]);
    });

    await runAndApply(model, rules);

    expect(calls).toEqual(['first:Ан', 'second:Ан', 'third:Ан']);
    expect(issueCodes(form.name)).toEqual(['short', 'latin']);
  });

  it('пустой список правил поле «трогает»: его прежние замечания гасятся', async () => {
    const { model, form } = createShape();
    form.name.setIssues([issue('server')]);

    const result = await runAndApply(
      model,
      defineValidation<Shape>(({ model: scope }) => validate(scope.$.name, []))
    );

    expect(result.issues.get(model.$.name)).toEqual([]);
    expect(issueCodes(form.name)).toEqual([]);
  });
});

describe('validation/operators — validateWhen', () => {
  it('выключенная ветка: правила не вызываются, поля гасятся', async () => {
    const { model, form } = createShape({ agree: false });
    const rule = vi.fn(() => issue('required'));
    form.email.setIssues([issue('required')]);
    const rules = defineValidation<Shape>(({ model: scope }) => {
      validateWhen(
        () => scope.agree,
        () => validate(scope.$.email, [rule])
      );
    });

    const result = await runAndApply(model, rules);

    expect(rule).not.toHaveBeenCalled();
    expect(result.status).toBe('valid');
    expect(issueCodes(form.email)).toEqual([]);
  });

  it('вложенные условия: правило активно, только если истинны все', async () => {
    const model = createModel<Shape>({ name: 'x', email: '', agree: true, items: [] });
    const rules = defineValidation<Shape>(({ model: scope }) => {
      validateWhen(
        () => scope.agree,
        () => {
          validate(scope.$.email, [required()]);
          validateWhen(
            () => scope.name === '',
            () => validate(scope.$.name, [() => issue('never')])
          );
        }
      );
    });

    const result = await runValidation(model, rules);

    expect(resultCodes(result, model.$.email)).toEqual(['required']);
    expect(resultCodes(result, model.$.name)).toEqual([]);
  });

  it('условие читается в момент каждого оператора, а не при входе в ветку', async () => {
    const model = createModel<Shape>({ name: '', email: '', agree: true, items: [] });
    let open = true;
    const rules = defineValidation<Shape>(({ model: scope }) => {
      validateWhen(
        () => open,
        () => {
          validate(scope.$.name, [required()]);
          open = false;
          validate(scope.$.email, [required()]);
        }
      );
    });

    const result = await runValidation(model, rules);

    expect(resultCodes(result, model.$.name)).toEqual(['required']);
    expect(resultCodes(result, model.$.email)).toEqual([]);
  });

  it('исключение в ветке снимает её условие со стека', async () => {
    const model = createModel<Shape>({ name: '', email: '', agree: false, items: [] });
    const rules = defineValidation<Shape>(({ model: scope }) => {
      try {
        validateWhen(
          () => false,
          () => {
            throw new Error('сбой ветки');
          }
        );
      } catch {
        // Схема сама обработала сбой: следующие правила живут вне выключенной ветки.
      }
      validate(scope.$.name, [required()]);
    });

    const result = await runValidation(model, rules);

    expect(resultCodes(result, model.$.name)).toEqual(['required']);
  });

  it('условие на строку в applyEach: проверяются только подходящие строки', async () => {
    const { model, form } = createShape({ items: [item({ kind: 'a' }), item({ kind: 'b' })] });
    const rowRules = defineValidation<Item>(({ model: row }) => {
      validateWhen(
        () => row.kind === 'b',
        () => validate(row.$.title, [required()])
      );
    });

    await runAndApply(
      model,
      defineValidation<Shape>(({ model: scope }) => applyEach(scope.$.items, rowRules))
    );

    expect(issueCodes(form.items.at(0)!.title)).toEqual([]);
    expect(issueCodes(form.items.at(1)!.title)).toEqual(['required']);
  });
});

describe('validation/operators — validateAsync', () => {
  it('в выключенной ветке правило не вызывается, поле не ждёт и гасится', async () => {
    const { model, form } = createShape({ email: 'a@b.c', agree: false });
    const rule = vi.fn(async () => issue('taken'));
    form.email.setIssues([issue('taken')]);
    const rules = defineValidation<Shape>(({ model: scope }) => {
      validateWhen(
        () => scope.agree,
        () => validateAsync(scope.$.email, [rule])
      );
    });

    const run = runAndApply(model, rules);
    expect(form.email.pending.value).toBe(false);
    const result = await run;

    expect(rule).not.toHaveBeenCalled();
    expect(result.status).toBe('valid');
    expect(issueCodes(form.email)).toEqual([]);
  });

  it('правило получает значение поля и сигнал прогона', async () => {
    const model = createModel<Shape>({ name: '', email: 'a@b.c', agree: false, items: [] });
    const rule = vi.fn(async (_value: string, _ctx: { signal: AbortSignal }) => null);
    const rules = defineValidation<Shape>(({ model: scope }) => {
      validateAsync(scope.$.email, [rule]);
    });

    await runValidation(model, rules);

    expect(rule).toHaveBeenCalledTimes(1);
    expect(rule.mock.calls[0][0]).toBe('a@b.c');
    expect(rule.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('отказ и исключение правил — два сбоя и одна ruleFailed рядом с обычным замечанием', async () => {
    const network = new Error('сеть');
    const crash = new Error('исключение правила');
    const model = createModel<Shape>({ name: '', email: 'a@b.c', agree: false, items: [] });
    const rules = defineValidation<Shape>(({ model: scope }) => {
      validateAsync(scope.$.email, [
        () => Promise.reject(network),
        () => {
          throw crash;
        },
        async () => issue('taken'),
      ]);
    });

    const result = await runValidation(model, rules);

    expect(result.status).toBe('error');
    expect(result.failures).toHaveLength(2);
    expect(result.failures.map((failure) => failure.error)).toEqual(
      expect.arrayContaining([network, crash])
    );
    expect(result.failures.every((failure) => failure.handle === model.$.email)).toBe(true);
    expect(resultCodes(result, model.$.email).sort()).toEqual(['ruleFailed', 'taken']);
  });

  it('warning async-правила: статус valid, замечание на поле есть', async () => {
    const { model, form } = createShape({ email: 'a@b.c' });
    const rules = defineValidation<Shape>(({ model: scope }) => {
      validateAsync(scope.$.email, [async () => issue('disposable', { severity: 'warning' })]);
    });

    const result = await runAndApply(model, rules);

    expect(result.status).toBe('valid');
    expect(form.email.issues.value).toEqual([{ code: 'disposable', severity: 'warning' }]);
  });
});

describe('validation/operators — cross', () => {
  it('в корне снимок — значения всей модели', async () => {
    const { model, form } = createShape({ name: 'Анна', email: 'anna', items: [item()] });
    const check = vi.fn((shape: Shape) => (shape.email === 'anna' ? issue('same') : null));
    const rules = defineValidation<Shape>(({ model: scope, cross }) => {
      cross(scope.$.email, check);
    });

    await runAndApply(model, rules);

    expect(check).toHaveBeenCalledWith(model.get());
    expect(issueCodes(form.email)).toEqual(['same']);
  });

  it('в строке снимок — значения строки, замечание — на поле строки', async () => {
    const { model, form } = createShape({
      items: [item({ price: 10 }), item({ price: 500 })],
    });
    const snapshots: Item[] = [];
    const rowRules = defineValidation<Item>(({ model: row, cross }) => {
      cross(row.$.price, (snapshot) => {
        snapshots.push(snapshot);
        return snapshot.price > snapshot.limit
          ? issue('overLimit', { params: { limit: snapshot.limit } })
          : null;
      });
    });

    await runAndApply(
      model,
      defineValidation<Shape>(({ model: scope }) => applyEach(scope.$.items, rowRules))
    );

    expect(snapshots).toEqual([item({ price: 10 }), item({ price: 500 })]);
    expect(issueCodes(form.items.at(0)!.price)).toEqual([]);
    expect(form.items.at(1)!.price.issues.value).toStrictEqual([
      { code: 'overLimit', params: { limit: 100 } },
    ]);
  });

  it('в выключенной ветке проверка не вызывается, поле гасится', async () => {
    const { model, form } = createShape();
    const check = vi.fn(() => issue('same'));
    form.email.setIssues([issue('same')]);
    const rules = defineValidation<Shape>(({ model: scope, cross }) => {
      validateWhen(
        () => false,
        () => cross(scope.$.email, check)
      );
    });

    await runAndApply(model, rules);

    expect(check).not.toHaveBeenCalled();
    expect(issueCodes(form.email)).toEqual([]);
  });
});

describe('validation/operators — apply и applyEach', () => {
  it('apply(...схемы) — композиция по порядку над той же областью', async () => {
    const model = createModel<Shape>({ name: '', email: '', agree: false, items: [] });
    const order: Array<[string, unknown]> = [];
    const first = defineValidation<Shape>(({ model: scope }) => {
      order.push(['first', scope]);
      validate(scope.$.name, [required()]);
    });
    const second = defineValidation<Shape>(({ model: scope }) => {
      order.push(['second', scope]);
      validate(scope.$.email, [required()]);
    });

    const result = await runValidation(
      model,
      defineValidation<Shape>(() => apply(first, second))
    );

    expect(order.map(([name]) => name)).toEqual(['first', 'second']);
    expect(order[0][1]).toBe(model);
    expect(order[1][1]).toBe(model);
    expect(resultCodes(result, model.$.name)).toEqual(['required']);
    expect(resultCodes(result, model.$.email)).toEqual(['required']);
  });

  it('applyEach над пустым массивом схему не вызывает', async () => {
    const model = createModel<Shape>({ name: 'x', email: 'x', agree: false, items: [] });
    const rowRules = vi.fn();

    const ok = await validateModel(
      model,
      defineValidation<Shape>(({ model: scope }) => applyEach(scope.$.items, rowRules))
    );

    expect(ok).toBe(true);
    expect(rowRules).not.toHaveBeenCalled();
  });
});
