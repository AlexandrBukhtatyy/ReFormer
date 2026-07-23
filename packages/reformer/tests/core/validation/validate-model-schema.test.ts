/**
 * Unit-тесты нового контракта валидации — `@reformer/core/validation` (validateModel + операторы).
 *
 * Покрывает: boolean-результат, warning-неблокирование, validateWhen-гейтинг + гашение, validateAsync,
 * cross (снапшот), apply-композицию, each-массивы, роутинг ошибок в ноды + очистку, owned на пару
 * (model, schema), defineValidationSchema (identity), вызов оператора вне прогона.
 */

import { describe, it, expect } from 'vitest';
import { createModel } from '../../../src/state/index';
import { createForm } from '../../../src/form/create-form';
import { required, min, minLength, email, pattern } from '../../../src/form/validators';
import {
  validate,
  validateAsync,
  validateWhen,
  cross,
  each,
  apply,
  defineValidationSchema,
  validateModel,
  type ValidationSchema,
} from '../../../src/form/validation-schema';

const C = () => null;

interface F {
  name: string;
  age: number;
  loanType: 'a' | 'b';
  extra: string;
  ratio: number;
  optionalEmail: string | null; // nullable-строка — проверка расширенных string-валидаторов
  items: { email: string; amount: number }[];
}

const INITIAL: F = {
  name: '',
  age: 0,
  loanType: 'a',
  extra: '',
  ratio: 0,
  optionalEmail: null,
  items: [],
};

/** Модель без формы — для проверки boolean-результата (роутинг no-op). */
const makeModel = (over: Partial<F> = {}) => createModel<F>({ ...INITIAL, ...over });

/** Модель + форма (ноды зарегистрированы) — для проверки роутинга/очистки. */
function makeForm(over: Partial<F> = {}) {
  const model = createModel<F>({ ...INITIAL, ...over });
  const schema = {
    component: C,
    children: [
      { value: model.$.name, component: C },
      { value: model.$.age, component: C },
      { value: model.$.loanType, component: C },
      { value: model.$.extra, component: C },
      { value: model.$.ratio, component: C },
    ],
  };
  const form = createForm<F>({ model, schema });
  return { model, form };
}

describe('@reformer/core/validation — validateModel + операторы', () => {
  it('boolean: валидная модель → true, невалидная → false', async () => {
    const schema: ValidationSchema<F> = ({ model }) => {
      validate(model.$.name, [required({ message: 'req' }), minLength(2, { message: 'min2' })]);
    };
    expect(await validateModel(makeModel({ name: '' }), schema)).toBe(false);
    expect(await validateModel(makeModel({ name: 'x' }), schema)).toBe(false); // minLength
    expect(await validateModel(makeModel({ name: 'Иван' }), schema)).toBe(true);
  });

  it('warning не блокирует submit (severity:"warning" → valid)', async () => {
    const schema: ValidationSchema<F> = ({ model }) => {
      cross(model.$.ratio, (f: F) =>
        f.ratio > 40 ? { code: 'warn', message: 'высокая нагрузка', severity: 'warning' } : null
      );
    };
    expect(await validateModel(makeModel({ ratio: 50 }), schema)).toBe(true); // warning, но valid
  });

  it('validateWhen: правило в выключенной ветке не срабатывает; во включённой — блокирует', async () => {
    const schema: ValidationSchema<F> = ({ model }) => {
      validateWhen(
        () => model.loanType === 'b',
        () => validate(model.$.extra, [required({ message: 'нужно extra' })])
      );
    };
    expect(await validateModel(makeModel({ loanType: 'a', extra: '' }), schema)).toBe(true);
    expect(await validateModel(makeModel({ loanType: 'b', extra: '' }), schema)).toBe(false);
    expect(await validateModel(makeModel({ loanType: 'b', extra: 'ok' }), schema)).toBe(true);
  });

  it('validateAsync: async-ошибка блокирует; async-успех — нет', async () => {
    const asyncFail: ValidationSchema<F> = ({ model }) => {
      validateAsync(model.$.name, [
        async (v) => {
          await Promise.resolve();
          return v === 'taken' ? { code: 'taken', message: 'занято' } : null;
        },
      ]);
    };
    expect(await validateModel(makeModel({ name: 'taken' }), asyncFail)).toBe(false);
    expect(await validateModel(makeModel({ name: 'free' }), asyncFail)).toBe(true);
  });

  it('validateAsync: сбой правила (throw) НЕ блокирует', async () => {
    const schema: ValidationSchema<F> = ({ model }) => {
      validateAsync(model.$.name, [
        async () => {
          throw new Error('network');
        },
      ]);
    };
    expect(await validateModel(makeModel({ name: 'x' }), schema)).toBe(true);
  });

  it('each: per-item валидация массива', async () => {
    const schema: ValidationSchema<F> = ({ model }) => {
      each(model.items, (im) => {
        validate(im.$.email, [required({ message: 'email' }), email({ message: 'bad' })]);
        validate(im.$.amount, [min(100, { message: 'min100' })]);
      });
    };
    expect(await validateModel(makeModel({ items: [] }), schema)).toBe(true); // пустой массив
    expect(
      await validateModel(makeModel({ items: [{ email: 'a@b.c', amount: 200 }] }), schema)
    ).toBe(true);
    expect(await validateModel(makeModel({ items: [{ email: '', amount: 200 }] }), schema)).toBe(
      false
    );
    expect(await validateModel(makeModel({ items: [{ email: 'a@b.c', amount: 5 }] }), schema)).toBe(
      false
    );
  });

  it('apply: композиция под-схем валидирует все', async () => {
    const s1 = defineValidationSchema<F>(({ model }) =>
      validate(model.$.name, [required({ message: 'name' })])
    );
    const s2 = defineValidationSchema<F>(({ model }) =>
      validate(model.$.age, [min(18, { message: 'age' })])
    );
    const form = defineValidationSchema<F>(({ model: _m }) => apply(s1, s2));
    expect(await validateModel(makeModel({ name: 'Иван', age: 20 }), form)).toBe(true);
    expect(await validateModel(makeModel({ name: '', age: 20 }), form)).toBe(false);
    expect(await validateModel(makeModel({ name: 'Иван', age: 5 }), form)).toBe(false);
  });

  it('роутинг: ошибки доезжают до нод; поле, ставшее валидным, гасится', async () => {
    const { model, form } = makeForm({ name: '' });
    const schema: ValidationSchema<F> = ({ model }) =>
      validate(model.$.name, [required({ message: 'req' })]);

    await validateModel(model, schema);
    expect(form.name.errors.value.map((e) => e.message)).toEqual(['req']);

    form.name.setValue('Иван'); // поле стало валидным
    await validateModel(model, schema);
    expect(form.name.errors.value).toEqual([]); // очищено через owned
  });

  it('validateWhen гасит ошибки полей при выключении ветки', async () => {
    const { model, form } = makeForm({ loanType: 'b', extra: '' });
    const schema: ValidationSchema<F> = ({ model }) =>
      validateWhen(
        () => model.loanType === 'b',
        () => validate(model.$.extra, [required({ message: 'нужно' })])
      );

    await validateModel(model, schema);
    expect(form.extra.errors.value.map((e) => e.message)).toEqual(['нужно']);

    form.loanType.setValue('a'); // ветка выключилась
    await validateModel(model, schema);
    expect(form.extra.errors.value).toEqual([]); // touch без gate → setErrors([])
  });

  it('owned на пару (model, schema): валидация одной схемы не гасит ошибки другой', async () => {
    const { model, form } = makeForm({ name: '', age: 0 });
    const sName = defineValidationSchema<F>(({ model }) =>
      validate(model.$.name, [required({ message: 'name' })])
    );
    const sAge = defineValidationSchema<F>(({ model }) =>
      validate(model.$.age, [min(18, { message: 'age' })])
    );

    await validateModel(model, sName);
    expect(form.name.errors.value).toHaveLength(1);

    await validateModel(model, sAge); // другая схема — НЕ должна гасить name
    expect(form.age.errors.value).toHaveLength(1);
    expect(form.name.errors.value).toHaveLength(1); // ошибка name сохранилась
  });

  it('cross: снапшот модели читается через fn', async () => {
    const { model, form } = makeForm({ age: 10 });
    const schema: ValidationSchema<F> = ({ model }) =>
      cross(model.$.age, (f: F) => (f.age < 18 ? { code: 'minor', message: 'меньше 18' } : null));
    await validateModel(model, schema);
    expect(form.age.errors.value.map((e) => e.message)).toEqual(['меньше 18']);
  });

  it('nullable-строковое поле (string|null) принимает встроенные string-валидаторы', async () => {
    // Тип-проверка (контракт): email()/pattern() должны присваиваться в validate() на поле string|null.
    const schema: ValidationSchema<F> = ({ model }) => {
      validate(model.$.optionalEmail, [
        email({ message: 'bad' }),
        pattern(/^\S+$/, { message: 'p' }),
      ]);
    };
    expect(await validateModel(makeModel({ optionalEmail: null }), schema)).toBe(true); // null пропускается
    expect(await validateModel(makeModel({ optionalEmail: 'a@b.c' }), schema)).toBe(true);
    expect(await validateModel(makeModel({ optionalEmail: 'not-email' }), schema)).toBe(false);
  });

  it('оператор вне validateModel бросает понятную ошибку', () => {
    const model = makeModel();
    expect(() => validate(model.$.name, [required({ message: 'x' })])).toThrow(
      /вне схемы валидации/
    );
  });

  it('устаревший (отменённый) прогон fail-closed: не рапортует «валидно»', async () => {
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const model = makeModel({ name: 'taken' });
    // async-правило: занятое имя → ошибка; при отмене возвращает null (skip)
    const schema = defineValidationSchema<F>(({ model }) => {
      validateAsync(model.$.name, [
        async (_v, { signal }) => {
          await delay(20);
          return signal.aborted ? null : { code: 'taken', message: 'занято' };
        },
      ]);
    });
    const p1 = validateModel(model, schema); // устаревает (p2 его аортит)
    const p2 = validateModel(model, schema); // побеждает
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(false); // без fail-closed фикса вернулось бы true (async-ошибка скипнута отменой)
    expect(r2).toBe(false); // честный: name='taken' занято
  });
});
