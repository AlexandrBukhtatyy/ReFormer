/**
 * `FormGroupNode` — утечки: снятие группы, её поведения и вложенных нод.
 *
 * Группа сама effect'ов не держит: за ней стоят effect'ы поведения формы (cleanup прикреплён к
 * корневой группе) и effect'ы массивов под-форм на любой глубине. Здесь проверяется, что
 * - снятие формы возвращает счётчик effect'ов к базе, снятие вложенной группы — только её часть,
 *   повторное снятие ничего не меняет;
 * - снятая форма отпускает поведение: замыкания операторов уходят сборщику мусора, хотя форма и
 *   модель живы;
 * - сборка, упавшая после построения нод, ничего живого не оставляет — снять её некому.
 * Что `dispose` останавливает `compute` и зовёт cleanup поведения один раз — в
 * `form-group-node.test.ts`.
 */

import { describe, expect, it, vi } from 'vitest';
import { liveEffects } from '../../test-utils/effect-tracker';
import { disposeForm } from '../../test-utils/dispose-form';
import { tick } from '../../test-utils/async';
import { collectGarbage, collectUntilReleased } from '../../test-utils/gc';
import { arrayOf, createModel, type FormModel } from '../../../src/model/index';
import { createFormFromModel } from '../../../src/form/create-form';
import { createForm } from '../../../src/form/form-bundle';
import { rawNode } from '../../../src/form/nodes/node-kind';
import { compute, defineFormBehavior, onChange } from '../../../src/form/behaviors';
import type { FormBehavior } from '../../../src/form/behaviors';
import type { FormGroup } from '../../../src/form/types/nodes';
import type { FormSchemaNode } from '../../../src/form/types/schema-node';

vi.mock('@preact/signals-core', async (importOriginal) =>
  (await import('../../test-utils/effect-tracker')).trackEffects(await importOriginal())
);

interface Room {
  number: string;
}
interface Office {
  city: string;
  rooms: Room[];
}
interface Company {
  name: string;
  headcount: number;
  summary: string;
  office: Office;
  branches: Office[];
}

const blankRoom = (): Room => ({ number: '' });
const blankOffice = (): Office => ({ city: '', rooms: arrayOf(blankRoom) });

/** Компания: группа с массивом внутри и массив строк с вложенным массивом. */
const createCompany = (): FormModel<Company> =>
  createModel<Company>({
    name: '',
    headcount: 0,
    summary: '',
    office: { city: 'Москва', rooms: arrayOf(blankRoom, [{ number: '101' }]) },
    branches: arrayOf(blankOffice, [{ city: 'Казань', rooms: [{ number: '1' }] }]),
  });

const roomRow = (room: FormModel<Room>): FormSchemaNode => ({ model: room.$.number });

const companySchema = (model: FormModel<Company>): FormSchemaNode => ({
  children: [
    { model: model.$.name },
    { model: model.$.office.city },
    { model: model.$.office.rooms, item: roomRow },
    {
      model: model.$.branches,
      item: (branch: FormModel<Office>) => ({
        children: [{ model: branch.$.city }, { model: branch.$.rooms, item: roomRow }],
      }),
    },
  ],
});

/** Сводка по компании и реакция на имя — два effect'а поведения. */
const companyBehavior = (onName: (name: string) => void = () => {}): FormBehavior<Company> =>
  defineFormBehavior<Company>(({ model }) => {
    compute(model.$.summary, () => `${model.name}: ${model.headcount}`);
    onChange(model.$.name, onName);
  });

/** Массивы формы: `office.rooms`, `branches` и `rooms` единственного филиала. */
const ARRAY_EFFECTS = 3;
const BEHAVIOR_EFFECTS = 2;

describe("form-group-node — счёт effect'ов", () => {
  it("за формой стоят effect'ы массивов на любой глубине и поведения; снятие возвращает к базе", () => {
    const base = liveEffects();
    const model = createCompany();

    const plain = createFormFromModel<Company>({ model, schema: companySchema(model) });
    const arrays = liveEffects() - base;
    disposeForm(plain);
    const afterPlain = liveEffects() - base;
    const form = createFormFromModel<Company>({
      model,
      schema: companySchema(model),
      behavior: companyBehavior(),
    });
    const withBehavior = liveEffects() - base;
    disposeForm(form);

    expect({ arrays, afterPlain, withBehavior, disposed: liveEffects() - base }).toEqual({
      arrays: ARRAY_EFFECTS,
      afterPlain: 0,
      withBehavior: ARRAY_EFFECTS + BEHAVIOR_EFFECTS,
      disposed: 0,
    });
  });

  it('снятие вложенной группы снимает только её массив; поведение корня и остальное живы', () => {
    const model = createCompany();
    const form = createFormFromModel<Company>({
      model,
      schema: companySchema(model),
      behavior: companyBehavior(),
    });
    const before = liveEffects();

    rawNode(form.office).dispose();
    const afterGroup = liveEffects() - before;
    model.headcount = 12;
    model.branches.push({ city: 'Томск', rooms: [] });

    expect({ afterGroup, summary: model.summary, branches: form.branches.length }).toEqual({
      afterGroup: -1,
      summary: ': 12',
      branches: 2,
    });
    disposeForm(form);
  });

  it('повторное снятие формы и вложенной группы счётчик не трогает', () => {
    const base = liveEffects();
    const model = createCompany();
    const form = createFormFromModel<Company>({
      model,
      schema: companySchema(model),
      behavior: companyBehavior(),
    });

    rawNode(form.office).dispose();
    rawNode(form.office).dispose();
    const afterGroup = liveEffects() - base;
    disposeForm(form);
    const afterForm = liveEffects() - base;
    disposeForm(form);

    expect({ afterGroup, afterForm, again: liveEffects() - base }).toEqual({
      afterGroup: ARRAY_EFFECTS + BEHAVIOR_EFFECTS - 1,
      afterForm: 0,
      again: 0,
    });
  });

  it("форма без схемы и поведения effect'ов не держит — снимать нечего", () => {
    const base = liveEffects();

    const form = createFormFromModel<Company>({ model: createCompany() });
    const built = liveEffects() - base;
    disposeForm(form);

    expect({ built, disposed: liveEffects() - base }).toEqual({ built: 0, disposed: 0 });
  });
});

describe('form-group-node — сборщик мусора', () => {
  /**
   * Форма с поведением, колбэк которого замыкает отдельный объект. Наружу — форма и слабая ссылка
   * на этот объект.
   */
  function buildWithPayload(model: FormModel<Company>): {
    form: FormGroup<Company>;
    payload: WeakRef<object>;
  } {
    const payload = { held: 'замкнут колбэком onChange' };
    const form = createFormFromModel<Company>({
      model,
      schema: companySchema(model),
      behavior: companyBehavior(() => void payload.held),
    });
    return { form, payload: new WeakRef(payload) };
  }

  it('снятая форма отпускает поведение, хотя форма и модель живы; без снятия — держит', async () => {
    const disposedModel = createCompany();
    const keptModel = createCompany();
    const disposed = buildWithPayload(disposedModel);
    const kept = buildWithPayload(keptModel);

    disposeForm(disposed.form);
    await collectUntilReleased([disposed.payload]);
    // Контроль честный: сборка мусора прошла только что — поведение неснятой формы её пережило.
    await tick();
    collectGarbage();

    expect({
      disposed: disposed.payload.deref() === undefined,
      kept: kept.payload.deref() === undefined,
      // Обе формы и обе модели живы: поведение отпустило снятие, а не сборщик вместе с формой.
      alive: [disposed.form.branches.length, disposedModel.office.city, keptModel.office.city],
    }).toEqual({ disposed: true, kept: false, alive: [1, 'Москва', 'Москва'] });
    disposeForm(kept.form);
  });
});

describe('form-group-node — сборка упала после построения нод', () => {
  it("сбой поведения на форме без массивов: effect'ы поведения сняты — живого не остаётся", () => {
    const base = liveEffects();

    expect(() =>
      createFormFromModel<Company>({
        model: createCompany(),
        behavior: defineFormBehavior<Company>(({ model }) => {
          compute(model.$.summary, () => model.name);
          throw new Error('сбой поведения');
        }),
      })
    ).toThrowError('сбой поведения');

    expect(liveEffects() - base).toBe(0);
  });

  // Ноды к запуску поведения уже построены, и effect'ы массивов под-форм подписаны на модель.
  // Было: форму вызывающий не получил, снять их некому — при каждой правке массива «потерянная»
  // форма продолжала строить формы строк.
  it("сбой поведения снимает и effect'ы уже построенных массивов [ReFormer-u0au]", () => {
    const base = liveEffects();
    const model = createCompany();

    try {
      createFormFromModel<Company>({
        model,
        schema: companySchema(model),
        behavior: defineFormBehavior<Company>(() => {
          throw new Error('сбой поведения');
        }),
      });
    } catch {
      // Сборка упала — формы у вызывающего нет.
    }

    expect(liveEffects() - base).toBe(0);
  });

  // То же со сбоем `setup` сборки: к нему готовы и ноды, и поведение. Было: и то и другое
  // оставалось жить без владельца.
  it('сбой setup сборки снимает ноды и поведение [ReFormer-iio7]', () => {
    const base = liveEffects();

    try {
      createForm<Company>({
        model: createCompany(),
        schema: companySchema,
        behavior: companyBehavior(),
        setup: () => {
          throw new Error('сбой setup');
        },
      });
    } catch {
      // Сборка упала — бандла у вызывающего нет.
    }

    expect(liveEffects() - base).toBe(0);
  });
});
