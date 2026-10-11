// @vitest-environment happy-dom
/**
 * React-хуки — утечки: 20 ререндеров без новых effect'ов.
 *
 * Хук подписывается на сигналы один раз — при монтировании — и держит подписку до размонтирования.
 * Пересоздание подписки на каждом рендере (снять effect и тут же создать новый) число живых
 * effect'ов не меняет, поэтому его ловит счётчик созданных — `createdEffects()`.
 *
 * Здесь — хуки, у которых ререндер с прежними аргументами в соседних файлах не проверен:
 * `useArrayLength`, `useFormControl` над массивом и без контрола, `useFormValidation` и
 * `useFormBundle` (стратегия армируется один раз). У `useFormControl` над полем,
 * `useFormControlValue`, `useFormFlow` и `useSignalSubscription` та же проверка стоит в их файлах.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { arrayOf } from '../../src/model';
import type { FormModel } from '../../src/model/types';
import { createForm } from '../../src/form/form-bundle';
import { defineValidation, validate } from '../../src/form/validation';
import { required } from '../../src/form/validators';
import type { FormArray } from '../../src/form/types/index';
import { useArrayLength } from '../../src/platforms/react/hooks/useArrayLength';
import { useFormControl } from '../../src/platforms/react/hooks/useFormControl';
import { useFormBundle } from '../../src/platforms/react/hooks/use-form-bundle';
import { useFormValidation } from '../../src/platforms/react/hooks/use-form-validation';
import { cleanup, renderHookCounting } from '../test-utils/react';
import { createdEffects, liveEffects } from '../test-utils/effect-tracker';
import { disposeForm } from '../test-utils/dispose-form';
import { InputStub } from '../test-utils/stubs';

vi.mock('@preact/signals-core', async (importOriginal) =>
  (await import('../test-utils/effect-tracker')).trackEffects(await importOriginal())
);

/** Формы текущего теста: их собственные effect'ы (массивы строк) снимаются после теста. */
const forms: object[] = [];

afterEach(() => {
  cleanup();
  for (const form of forms.splice(0)) disposeForm(form);
});

interface Phone {
  number: string;
}
interface Contacts {
  email: string;
  phones: Phone[];
}

const contactsRules = defineValidation<Contacts>(({ model }) => {
  validate(model.$.email, [required()]);
});

/** Сборка контактов со стратегией живой проверки; собирается до замера базы effect'ов. */
function createContacts(strategy: 'change' | 'blur' = 'change') {
  const bundle = createForm<Contacts>({
    initial: {
      email: '',
      phones: arrayOf((): Phone => ({ number: '' }), [{ number: '111' }, { number: '222' }]),
    },
    schema: (model) => ({
      children: [
        { model: model.$.email, component: InputStub },
        {
          model: model.$.phones,
          item: (row: FormModel<Phone>) => ({ model: row.$.number, component: InputStub }),
        },
      ],
    }),
    validation: { rules: contactsRules, strategy },
  });
  forms.push(bundle.form);
  return bundle;
}

type ContactsBundle = ReturnType<typeof createContacts>;

/** Хук в таблице: как его отрисовать над готовой сборкой и сколько effect'ов он держит. */
interface HookCase {
  readonly name: string;
  readonly effects: number;
  readonly strategy?: 'change' | 'blur';
  /** Отрисовать хук; ререндер — с теми же аргументами (новый объект пропсов, прежние значения). */
  readonly mount: (
    bundle: ContactsBundle,
    strict: boolean
  ) => { rerender(): void; unmount(): void; renders(): number };
}

/** Отрисовка хука без пропсов: ререндер — повторный вызов с тем же замыканием. */
const mountPlain = (hook: () => unknown, strict: boolean) => {
  const rendered = renderHookCounting(hook, { strict });
  return {
    rerender: () => rendered.rerender(),
    unmount: () => rendered.unmount(),
    renders: () => rendered.renders(),
  };
};

const hooks: HookCase[] = [
  {
    name: 'useArrayLength',
    effects: 1,
    mount: (bundle, strict) => mountPlain(() => useArrayLength(bundle.form.phones), strict),
  },
  {
    name: 'useFormControl над массивом',
    effects: 1,
    mount: (bundle, strict) => mountPlain(() => useFormControl(bundle.form.phones), strict),
  },
  {
    name: 'useFormControl без контрола',
    effects: 1,
    mount: (_bundle, strict) =>
      mountPlain(() => useFormControl(undefined as FormArray<Phone> | undefined), strict),
  },
  {
    name: 'useFormValidation (change)',
    effects: 1,
    mount: (bundle, strict) =>
      mountPlain(
        // Объект аргументов на каждом рендере новый — контроллер обязан остаться прежним.
        () => useFormValidation({ model: bundle.model, schema: contactsRules, strategy: 'change' }),
        strict
      ),
  },
  {
    name: 'useFormValidation (blur)',
    effects: 1,
    mount: (bundle, strict) =>
      mountPlain(
        () => useFormValidation({ model: bundle.model, schema: contactsRules, strategy: 'blur' }),
        strict
      ),
  },
  {
    name: 'useFormBundle (change)',
    effects: 1,
    mount: (bundle, strict) => mountPlain(() => useFormBundle(() => bundle), strict),
  },
  {
    name: 'useFormBundle (blur)',
    effects: 1,
    strategy: 'blur',
    mount: (bundle, strict) => mountPlain(() => useFormBundle(() => bundle), strict),
  },
];

describe("hooks — 20 ререндеров без новых effect'ов", () => {
  for (const { name, effects, strategy, mount } of hooks) {
    it(`${name}: подписка создана один раз, 20 ререндеров её не пересоздают, размонтирование снимает`, () => {
      const bundle = createContacts(strategy);
      const base = liveEffects();

      const hook = mount(bundle, false);
      const mounted = liveEffects() - base;
      const createdBefore = createdEffects();
      const rendersBefore = hook.renders();
      for (let index = 0; index < 20; index++) hook.rerender();
      const rerendered = {
        renders: hook.renders() - rendersBefore,
        created: createdEffects() - createdBefore,
        live: liveEffects() - base,
      };
      hook.unmount();

      expect({ mounted, rerendered, unmounted: liveEffects() - base }).toEqual({
        mounted: effects,
        rerendered: { renders: 20, created: 0, live: effects },
        unmounted: 0,
      });
    });

    it(`${name}: в StrictMode — то же: один effect на всё время жизни`, () => {
      const bundle = createContacts(strategy);
      const base = liveEffects();

      const hook = mount(bundle, true);
      const mounted = liveEffects() - base;
      const createdBefore = createdEffects();
      for (let index = 0; index < 20; index++) hook.rerender();
      const rerendered = {
        created: createdEffects() - createdBefore,
        live: liveEffects() - base,
      };
      hook.unmount();

      expect({ mounted, rerendered, unmounted: liveEffects() - base }).toEqual({
        mounted: effects,
        rerendered: { created: 0, live: effects },
        unmounted: 0,
      });
    });
  }
});
