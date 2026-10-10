/**
 * Ambient-сток прогона схемы валидации — `form/validation/context`.
 *
 * Операторы пишут замечания не в переданный коллектор, а в контекст «текущего прогона», который
 * открывает раннер через `runWithContext`. Здесь проверяется само окно: что оно восстанавливает
 * предыдущий контекст (вложенный прогон, исключение внутри окна), что вне окна операторы
 * бросают понятную ошибку, и что вложенные области `apply` / `applyEach` пишут в общий сток
 * своего прогона, а после выхода возвращают область родителя.
 */

import { describe, it, expect, vi } from 'vitest';
import { issueCodes } from '../../test-utils/issues';
import { InputStub } from '../../test-utils/stubs';
import {
  gated,
  requireCtx,
  runWithContext,
  touch,
  type VContext,
} from '../../../src/form/validation/context';
import { createModel } from '../../../src/model/index';
import type { FormModel, PathAwareSignal } from '../../../src/model/types';
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
import { required } from '../../../src/form/validators';
import type { ValidationIssue } from '../../../src/form/types/contracts';
import type { ValidationResult } from '../../../src/form/validation/types';

/** Пустой контекст прогона над моделью. */
function contextOf(model: object = createModel({ a: '' })): VContext {
  return {
    model: model as FormModel<unknown>,
    issues: new Map(),
    pending: [],
    asyncFields: new Set(),
    failures: [],
    whenStack: [],
    signal: new AbortController().signal,
  };
}

const issue = (code: string): ValidationIssue => ({ code });

describe('validation/context — окно прогона', () => {
  it('вне окна requireCtx бросает ошибку с именем оператора', () => {
    expect(() => requireCtx('validate')).toThrow(
      '[@reformer/core/validation] "validate" вызван вне схемы валидации'
    );
  });

  it('runWithContext открывает окно на время fn и отдаёт её результат', () => {
    const ctx = contextOf();

    const seen = runWithContext(ctx, () => requireCtx('validate'));

    expect(seen).toBe(ctx);
    expect(() => requireCtx('validate')).toThrow('вне схемы валидации');
  });

  it('вложенное окно восстанавливает внешний контекст при выходе', () => {
    const outer = contextOf();
    const inner = contextOf();
    const seen: VContext[] = [];

    runWithContext(outer, () => {
      seen.push(requireCtx('apply'));
      runWithContext(inner, () => seen.push(requireCtx('apply')));
      seen.push(requireCtx('apply'));
    });

    expect(seen).toEqual([outer, inner, outer]);
    expect(seen[1]).toBe(inner);
    expect(seen[2]).toBe(outer);
  });

  it('исключение внутри окна не оставляет контекст открытым', () => {
    const outer = contextOf();
    let afterThrow: VContext | undefined;

    runWithContext(outer, () => {
      expect(() =>
        runWithContext(contextOf(), () => {
          throw new Error('сбой схемы');
        })
      ).toThrow('сбой схемы');
      afterThrow = requireCtx('validate');
    });

    expect(afterThrow).toBe(outer);
    expect(() => requireCtx('validate')).toThrow('вне схемы валидации');
  });

  it('touch заводит корзину сигнала один раз и отдаёт её же', () => {
    const model = createModel({ a: '' });
    const ctx = contextOf(model);
    const sig = model.$.a as PathAwareSignal<unknown>;

    const first = touch(ctx, sig);
    first.push(issue('x'));
    const second = touch(ctx, sig);

    expect(second).toBe(first);
    expect(ctx.issues.get(sig)).toEqual([issue('x')]);
    expect(ctx.issues.size).toBe(1);
  });

  it('gated: пустой стек — ветка активна; ложное условие в стеке её выключает', () => {
    const ctx = contextOf();
    let open = true;

    expect(gated(ctx)).toBe(true);
    ctx.whenStack.push(
      () => true,
      () => open
    );
    expect(gated(ctx)).toBe(true);

    open = false; // условие читается в момент проверки, а не при добавлении в стек
    expect(gated(ctx)).toBe(false);
  });
});

describe('validation/context — вложенные области операторов', () => {
  interface Geo {
    lat: string;
    lng: string;
  }
  interface Address {
    city: string;
    geo: Geo;
  }
  interface Job {
    title: string;
  }
  interface Employment {
    company: string;
    jobs: Job[];
  }
  interface Shape {
    name: string;
    address: Address;
    employment: Employment;
  }

  const INITIAL: Shape = {
    name: 'Анна',
    address: { city: '', geo: { lat: '', lng: '1' } },
    employment: { company: '', jobs: [{ title: '' }, { title: 'инженер' }] },
  };

  const createShape = (initial: Shape = INITIAL) =>
    createForm<Shape>({
      initial: structuredClone(initial),
      schema: (model) => ({
        children: [
          {
            model: model.$.employment.jobs,
            item: (job: FormModel<Job>) => ({
              children: [{ model: job.$.title, component: InputStub }],
            }),
          },
        ],
      }),
    });

  it('apply внутри apply: замечания доходят до нод вложенной группы', async () => {
    const geoRules = defineValidation<Geo>(({ model }) => {
      validate(model.$.lat, [required()]);
      validate(model.$.lng, [required()]);
    });
    const addressRules = defineValidation<Address>(({ model }) => {
      validate(model.$.city, [required()]);
      apply(model.$.geo, geoRules);
    });
    const rules = defineValidation<Shape>(({ model }) => {
      apply(model.$.address, addressRules);
    });
    const { model, form } = createShape();

    expect(await validateModel(model, rules)).toBe(false);
    expect(issueCodes(form.address.city)).toEqual(['required']);
    expect(issueCodes(form.address.geo.lat)).toEqual(['required']);
    expect(issueCodes(form.address.geo.lng)).toEqual([]);
  });

  it('cross каждой области получает снимок своей модели, после вложенной — снова свой', async () => {
    const snapshots: unknown[] = [];
    const seen =
      (label: string) =>
      (snapshot: unknown): null => {
        snapshots.push([label, snapshot]);
        return null;
      };
    const geoRules = defineValidation<Geo>(({ model, cross }) => {
      cross(model.$.lat, seen('geo'));
    });
    const addressRules = defineValidation<Address>(({ model, cross }) => {
      cross(model.$.city, seen('address'));
      apply(model.$.geo, geoRules);
      cross(model.$.city, seen('address после geo'));
    });
    const rules = defineValidation<Shape>(({ model, cross }) => {
      apply(model.$.address, addressRules);
      cross(model.$.name, (shape) => seen('корень')(shape.name));
    });
    const { model } = createShape();

    await runValidation(model, rules);

    const address = { city: '', geo: { lat: '', lng: '1' } };
    expect(snapshots).toEqual([
      ['address', address],
      ['geo', address.geo],
      ['address после geo', address],
      ['корень', 'Анна'],
    ]);
  });

  it('applyEach внутри apply: схема элемента применяется к строкам вложенного массива', async () => {
    const jobRules = defineValidation<Job>(({ model }) => {
      validate(model.$.title, [required()]);
    });
    const employmentRules = defineValidation<Employment>(({ model }) => {
      validate(model.$.company, [required()]);
      applyEach(model.$.jobs, jobRules);
    });
    const rules = defineValidation<Shape>(({ model }) => {
      apply(model.$.employment, employmentRules);
    });
    const { model, form } = createShape();

    expect(await validateModel(model, rules)).toBe(false);
    expect(issueCodes(form.employment.company)).toEqual(['required']);
    expect(issueCodes(form.employment.jobs.at(0)!.title)).toEqual(['required']);
    expect(issueCodes(form.employment.jobs.at(1)!.title)).toEqual([]);
  });

  it('сбой async-правила во вложенной области попадает в общий список сбоев прогона', async () => {
    const failure = new Error('сеть');
    const jobRules = defineValidation<Job>(({ model }) => {
      validateAsync(model.$.title, [() => Promise.reject(failure)]);
    });
    const rules = defineValidation<Shape>(({ model }) => {
      apply(model.$.employment, ({ model: employment }) => applyEach(employment.$.jobs, jobRules));
    });
    const { model } = createShape();

    const result = await runValidation(model, rules);

    expect(result.status).toBe('error');
    expect(result.failures).toHaveLength(2);
    expect(result.failures[0].handle).toBe(model.$.employment.jobs[0].title);
    expect(result.failures[1].handle).toBe(model.$.employment.jobs[1].title);
    expect(result.failures.every((entry) => entry.error === failure)).toBe(true);
  });

  it('validateWhen снаружи выключает правила во всех вложенных областях', async () => {
    const jobRule = vi.fn(() => null);
    const jobRules = defineValidation<Job>(({ model }) => {
      validate(model.$.title, [jobRule]);
    });
    const rules = defineValidation<Shape>(({ model }) => {
      validateWhen(
        () => model.name === '',
        () => apply(model.$.employment, ({ model: e }) => applyEach(e.$.jobs, jobRules))
      );
    });
    const { model } = createShape();

    const result = await runValidation(model, rules);

    expect(jobRule).not.toHaveBeenCalled();
    // Поля выключенной ветки «тронуты» пустыми корзинами — при разносе они погасятся.
    expect(result.issues.get(model.$.employment.jobs[0].title)).toEqual([]);
    expect(result.status).toBe('valid');
  });

  it('вложенный прогон той же схемы: контекст внешнего восстановлен, внешний — отменён', async () => {
    interface Pair {
      first: string;
      second: string;
    }
    const model = createModel<Pair>({ first: '', second: '' });
    let inner: Promise<ValidationResult> | undefined;
    let nested = false;
    const rules = defineValidation<Pair>(({ model: scope }) => {
      validate(scope.$.second, [
        () => {
          // Правило запускает прогон той же пары (модель, схема) — один раз: флаг ставится до
          // вызова, потому что вложенный прогон синхронно снова зовёт это правило.
          if (!nested) {
            nested = true;
            inner = runValidation(model, rules);
          }
          return null;
        },
      ]);
      // Пишет уже в сток внешнего прогона: вложенный прогон закрыл своё окно.
      validate(scope.$.first, [required()]);
    });

    const outer = await runValidation(model, rules);

    expect(outer.status).toBe('cancelled');
    expect(outer.issues.get(model.$.first)).toEqual([issue('required')]);
    expect((await inner!).status).toBe('invalid');
  });
});
