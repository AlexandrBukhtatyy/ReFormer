/**
 * Ambient-сток схемы поведения и низкоуровневый набор авторинга
 * (`src/form/behaviors/context.ts`).
 *
 * Операторы кладут свои отписки в сток активной схемы; окно открывает `defineFormBehavior.__run`
 * на время `setup`. Пользовательские операторы пишутся на тех же дверях: `getScope`, `onDispose`,
 * `effect`, `defer`. Проверяется, что доступно вне схемы и внутри, что область восстанавливается
 * после вложенного прогона и после сбоя, как `effect` чистит за собой и как `defer` обращается
 * с ошибками и со снятием поведения.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createModel, type FormModel } from '../../src/model/index';
import { createFormFromModel } from '../../src/form/create-form';
import { createForm } from '../../src/form/form-bundle';
import {
  apply,
  applyEach,
  compute,
  defer,
  defineFormBehavior,
  effect,
  getScope,
  onDispose,
  type BehaviorScope,
} from '../../src/form/behaviors';
import { getController, getFlow } from '../../src/form/behaviors/context';
import type { FormFlow } from '../../src/form/flow/flow';
import { disposeForm } from '../test-utils/dispose-form';
import { tick } from '../test-utils/async';

interface Address {
  city: string;
}
interface Row {
  name: string;
}
interface Profile {
  a: number;
  b: number;
  address: Address;
  rows: Row[];
}

const createProfile = (): FormModel<Profile> =>
  createModel<Profile>({ a: 1, b: 0, address: { city: '' }, rows: [{ name: 'первая' }] });

const rowItem = (row: FormModel<Row>) => ({ children: [{ model: row.$.name }] });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('context — вне схемы поведения', () => {
  it('getScope и onDispose бросают понятную ошибку со своим именем', () => {
    expect(() => getScope()).toThrowError(/"getScope" вызван вне defineFormBehavior/);
    expect(() => onDispose(() => {})).toThrowError(/"onDispose" вызван вне defineFormBehavior/);
  });

  it('внутренние getController / getFlow называют вызвавший оператор', () => {
    expect(() => getController()).toThrowError(/"getController"/);
    expect(() => getController('applyEach')).toThrowError(/"applyEach"/);
    expect(() => getFlow()).toThrowError(/"getFlow"/);
  });

  it('effect вне схемы бросает ошибку', () => {
    const model = createProfile();

    expect(() => effect(() => void model.a)).toThrowError(/вне defineFormBehavior/);
  });

  it('effect вне схемы бросает до создания эффекта — колбэк не подписан [ReFormer-rdo0]', () => {
    const model = createProfile();
    const runs: number[] = [];
    try {
      effect(() => void runs.push(model.a));
    } catch {
      // ожидаемая ошибка «вне defineFormBehavior»
    }

    model.a = 2;

    expect(runs).toEqual([]);
  });

  it('defer не требует схемы: запись просто откладывается на микротаск', async () => {
    const model = createProfile();

    defer(() => {
      model.b = 7;
    });
    const synchronously = model.b;
    await tick();

    expect([synchronously, model.b]).toEqual([0, 7]);
  });
});

describe('context — область внутри схемы', () => {
  it('getScope отдаёт ту же область, что аргумент setup, вместе с потоком шагов', () => {
    let fromArgument: BehaviorScope<Profile> | undefined;
    let fromScope: BehaviorScope<Profile> | undefined;
    const bundle = createForm<Profile>({
      initial: { a: 1, b: 0, address: { city: '' }, rows: [] },
      flow: { steps: [{ id: 'first' }, { id: 'second' }] },
      behavior: defineFormBehavior<Profile>((scope) => {
        fromArgument = scope;
        fromScope = getScope<Profile>();
      }),
    });

    const sameAsBundle = (scope: BehaviorScope<Profile> | undefined) => ({
      model: scope?.model === bundle.model,
      form: scope?.form === bundle.form,
      // Схема поведения — обёртка над областью контроллера (ведёт учёт для отката), хранилище то же.
      schema:
        scope?.schema.__overrideMaps ===
        bundle.render.controller.scopeOf(bundle.model).__overrideMaps,
      flow: scope?.flow === bundle.flow && scope?.flow !== undefined,
    });

    const all = { model: true, form: true, schema: true, flow: true };
    expect([sameAsBundle(fromArgument), sameAsBundle(fromScope)]).toEqual([all, all]);
    expect(fromScope?.schema).toBe(fromArgument?.schema);
  });

  it('под-схема видит свою область, после неё снова родительская', () => {
    const model = createProfile();
    const seen: unknown[] = [];
    createFormFromModel<Profile>({
      model,
      behavior: defineFormBehavior<Profile>(({ model: root }) => {
        seen.push(getScope<Profile>().model === root);
        apply(
          root.$.address,
          defineFormBehavior<Address>(({ model: address }) => {
            seen.push(
              getScope<Address>().model === address,
              address.$.city === root.$.address.city
            );
          })
        );
        seen.push(getScope<Profile>().model === root);
      }),
    });

    expect(seen).toEqual([true, true, true, true]);
  });

  it('поток шагов сборки получают поведения подформы и строки массива', () => {
    const flows: Array<FormFlow | undefined> = [];
    const bundle = createForm<Profile>({
      initial: { a: 1, b: 0, address: { city: '' }, rows: [{ name: 'первая' }] },
      schema: (model) => ({ children: [{ model: model.$.rows, item: rowItem }] }),
      flow: { steps: [{ id: 'first' }] },
      behavior: defineFormBehavior<Profile>(({ model, flow }) => {
        flows.push(flow);
        apply(
          model.$.address,
          defineFormBehavior<Address>((scope) => void flows.push(scope.flow))
        );
        applyEach(
          model.$.rows,
          defineFormBehavior<Row>((scope) => void flows.push(scope.flow))
        );
      }),
    });

    expect(flows).toHaveLength(3);
    expect(flows.every((flow) => flow === bundle.flow && flow !== undefined)).toBe(true);
  });

  it('без потока шагов flow в области — undefined', () => {
    let flow: FormFlow | undefined | null = null;
    createFormFromModel<Profile>({
      model: createProfile(),
      behavior: defineFormBehavior<Profile>((scope) => {
        flow = scope.flow;
      }),
    });

    expect(flow).toBeUndefined();
  });
});

describe('context — onDispose и effect', () => {
  it('отписки зовутся при снятии поведения — по порядку регистрации и один раз', () => {
    const model = createProfile();
    const log: string[] = [];
    const form = createFormFromModel<Profile>({
      model,
      behavior: defineFormBehavior<Profile>(() => {
        onDispose(() => log.push('первая'));
        onDispose(() => log.push('вторая'));
      }),
    });

    const beforeDispose = [...log];
    disposeForm(form);
    disposeForm(form);

    expect({ beforeDispose, log }).toEqual({ beforeDispose: [], log: ['первая', 'вторая'] });
  });

  it('effect: очистка зовётся перед повтором и при снятии поведения, дальше эффект молчит', () => {
    const model = createProfile();
    const log: string[] = [];
    const form = createFormFromModel<Profile>({
      model,
      behavior: defineFormBehavior<Profile>(({ model: m }) => {
        effect(() => {
          const a = m.a;
          log.push(`run:${a}`);
          return () => log.push(`cleanup:${a}`);
        });
      }),
    });

    model.a = 2;
    disposeForm(form);
    model.a = 3;

    expect(log).toEqual(['run:1', 'cleanup:1', 'run:2', 'cleanup:2']);
  });

  it('сбой setup пробрасывается; окно схемы закрыто — двери снова бросают', () => {
    const model = createProfile();

    expect(() =>
      createFormFromModel<Profile>({
        model,
        behavior: defineFormBehavior<Profile>(() => {
          throw new Error('сбой setup');
        }),
      })
    ).toThrowError('сбой setup');
    expect(() => onDispose(() => {})).toThrowError(/вне defineFormBehavior/);
  });

  it('сбой setup снимает уже созданные эффекты поведения [ReFormer-q5kj]', () => {
    const model = createProfile();
    try {
      createFormFromModel<Profile>({
        model,
        behavior: defineFormBehavior<Profile>(({ model: m }) => {
          compute(m.$.b, () => m.a * 10);
          throw new Error('сбой setup');
        }),
      });
    } catch {
      // сборка упала — снять поведение некому
    }

    model.a = 5;

    expect(model.b).toBe(10);
  });
});

describe('context — defer', () => {
  it('в effect откладывает запись: читаемое поле можно писать без «Cycle detected»', async () => {
    const model = createProfile();
    createFormFromModel<Profile>({
      model,
      behavior: defineFormBehavior<Profile>(({ model: m }) => {
        effect(() => {
          void m.a; // подписка
          // Запись читает поле в момент записи: значение, замкнутое при прогоне effect, устарело
          // бы — две ожидающие записи старых значений гоняли бы поле по кругу бесконечно.
          defer(() => {
            if (m.a > 10) m.a = 10; // эффект читает и пишет одно поле
          });
        });
      }),
    });

    model.a = 50;
    const synchronously = model.a;
    await tick();

    expect([synchronously, model.a]).toEqual([50, 10]);
  });

  it('синхронный сбой отложенной записи уходит в console.error и не всплывает', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('сбой записи');

    defer(() => {
      throw failure;
    });
    await tick();

    expect(error).toHaveBeenCalledWith('[runOutsideEffect]', failure);
  });

  it('отклонённый промис отложенной записи тоже уходит в console.error', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('сбой async-записи');

    defer(async () => {
      throw failure;
    });
    await tick();

    expect(error).toHaveBeenCalledWith('[runOutsideEffect]', failure);
  });

  it('в production сбой отложенной записи проглатывается молча', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    defer(() => {
      throw new Error('сбой записи');
    });
    await tick();

    expect(error).not.toHaveBeenCalled();
  });

  it('снятие поведения отменяет defer, запланированный в том же тике [ReFormer-bcv4]', async () => {
    const model = createProfile();
    const form = createFormFromModel<Profile>({
      model,
      behavior: defineFormBehavior<Profile>(({ model: m }) => {
        effect(() => {
          const a = m.a;
          defer(() => {
            m.b = a * 10;
          });
        });
      }),
    });
    await tick();

    model.a = 5;
    disposeForm(form);
    await tick();

    expect(model.b).toBe(10);
  });
});
