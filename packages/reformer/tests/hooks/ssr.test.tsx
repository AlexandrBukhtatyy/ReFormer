/**
 * Серверный рендер React-слоя ядра: `renderToString` в окружении node, без DOM.
 *
 * На сервере эффекты не выполняются, поэтому хуки обязаны отдать первый кадр из текущих значений
 * сигналов (серверный снимок `useSyncExternalStore`) и ничего не подписать: число живых effect'ов
 * после рендера не меняется, стратегия валидации не армирована, внешний ref поля не заполнен.
 * Повторные рендеры подписки не накапливают.
 */

import { describe, expect, it, vi } from 'vitest';
import { createRef, type RefObject } from 'react';
import { renderToString } from 'react-dom/server';
import { arrayOf } from '../../src/model';
import type { FormModel } from '../../src/model/types';
import { createForm, type FormBundle } from '../../src/form/form-bundle';
import { createFormFlow } from '../../src/form/flow/flow';
import { defineValidation, validate } from '../../src/form/validation';
import type { ValidationIssue } from '../../src/form/types/index';
import { useFormControl } from '../../src/platforms/react/hooks/useFormControl';
import { useFormControlValue } from '../../src/platforms/react/hooks/useFormControlValue';
import { useArrayLength } from '../../src/platforms/react/hooks/useArrayLength';
import { useFormFlow } from '../../src/platforms/react/hooks/use-form-flow';
import { useFormValidation } from '../../src/platforms/react/hooks/use-form-validation';
import { useFormBundle } from '../../src/platforms/react/hooks/use-form-bundle';
import {
  FormBundleContext,
  useFormBundleContext,
} from '../../src/platforms/react/form-bundle-context';
import {
  useFieldHandleRef,
  type FieldHandle,
} from '../../src/platforms/react/field-binding/field-handle';
import { I18nProvider } from '../../src/platforms/react/i18n/provider';
import { useIssueMessage } from '../../src/platforms/react/i18n/hooks';
import { ru as coreRu } from '../../src/locale/ru';
import { liveEffects } from '../test-utils/effect-tracker';
import { settle } from '../test-utils/async';
import { InputStub } from '../test-utils/stubs';

vi.mock('@preact/signals-core', async (importOriginal) =>
  (await import('../test-utils/effect-tracker')).trackEffects(await importOriginal())
);

interface Phone {
  number: string;
}

interface Profile {
  email: string;
  phones: Phone[];
}

const phoneRow = (row: FormModel<Phone>) => ({
  children: [{ model: row.$.number, component: InputStub }],
});

const createProfile = () =>
  createForm<Profile>({
    initial: {
      email: 'a@b.c',
      phones: arrayOf(() => ({ number: '' }), [{ number: '111' }, { number: '222' }]),
    },
    schema: (model) => ({
      children: [
        { model: model.$.email, component: InputStub },
        { model: model.$.phones, item: phoneRow },
      ],
    }),
  });

/** Правило «почта обязательна» со счётчиком прогонов. */
function emailRule() {
  const rule = vi.fn((value: string): ValidationIssue | null =>
    value ? null : { code: 'required' }
  );
  const rules = defineValidation<{ email: string }>(({ model }) => {
    validate(model.$.email, [rule]);
  });
  return { rule, rules };
}

describe('SSR — хуки нод формы', () => {
  it('useFormControl: поле, массив и undefined — первый кадр без подписок', () => {
    const { form } = createProfile();
    function Probe() {
      const field = useFormControl(form.email);
      const array = useFormControl(form.phones);
      const empty = useFormControl(undefined);
      return (
        <p>
          {field.value}|{String(field.shouldShowError)}|{array.length}|{empty.length}
        </p>
      );
    }
    const base = liveEffects();

    const html = renderToString(<Probe />);

    expect(html).toBe('<p>a@b.c<!-- -->|<!-- -->false<!-- -->|<!-- -->2<!-- -->|<!-- -->0</p>');
    expect(liveEffects()).toBe(base);
  });

  it('useFormControlValue и useArrayLength — значения на сервере', () => {
    const { form } = createProfile();
    function Probe() {
      return (
        <p>
          {useFormControlValue(form.email)}:{useArrayLength(form.phones)}
        </p>
      );
    }
    const base = liveEffects();

    expect(renderToString(<Probe />)).toBe('<p>a@b.c<!-- -->:<!-- -->2</p>');
    expect(liveEffects()).toBe(base);
  });

  it('useFormFlow — текущий шаг без подписки', () => {
    const flow = createFormFlow({ steps: ['loan', 'contacts'] });
    function Probe() {
      const { current, isFirst, validating } = useFormFlow(flow);
      return (
        <p>
          {current}|{String(isFirst)}|{String(validating)}
        </p>
      );
    }
    const base = liveEffects();

    expect(renderToString(<Probe />)).toBe(
      '<p>loan<!-- -->|<!-- -->true<!-- -->|<!-- -->false</p>'
    );
    expect(liveEffects()).toBe(base);
  });

  it('повторные рендеры не накапливают подписки', () => {
    const { form } = createProfile();
    function Probe() {
      const { value } = useFormControl(form.email);
      return <p>{value}</p>;
    }
    const base = liveEffects();

    for (let i = 0; i < 20; i++) renderToString(<Probe />);

    expect(liveEffects()).toBe(base);
  });
});

describe('SSR — валидация и сборка', () => {
  it('useFormValidation: серверный снимок — false, стратегия не армирована', async () => {
    const { model } = createForm<{ email: string }>({ initial: { email: 'x' } });
    const { rule, rules } = emailRule();
    function Probe() {
      const { isValidating } = useFormValidation({ model, schema: rules, strategy: 'change' });
      return <p>{String(isValidating)}</p>;
    }
    const base = liveEffects();

    expect(renderToString(<Probe />)).toBe('<p>false</p>');
    expect(liveEffects()).toBe(base);

    model.email = '';
    await settle();
    expect(rule).not.toHaveBeenCalled();
  });

  it('useFormBundle: фабрика один раз, живая проверка не армирована', async () => {
    const { rule, rules } = emailRule();
    const factory = vi.fn(
      (): FormBundle<{ email: string }> =>
        createForm<{ email: string }>({
          initial: { email: 'x' },
          validation: { rules, strategy: 'change' },
        })
    );
    function Probe() {
      return <p>{useFormBundle(factory).model.email}</p>;
    }
    const base = liveEffects();

    expect(renderToString(<Probe />)).toBe('<p>x</p>');
    expect(factory).toHaveBeenCalledTimes(1);
    expect(liveEffects()).toBe(base);

    factory.mock.results[0].value.model.email = '';
    await settle();
    expect(rule).not.toHaveBeenCalled();
  });

  it('useFormBundleContext — бандл провайдера на сервере', () => {
    const bundle = createProfile();
    function Probe() {
      return <p>{useFormBundleContext<Profile>()?.model.email ?? 'нет'}</p>;
    }

    expect(
      renderToString(
        <FormBundleContext.Provider value={bundle}>
          <Probe />
        </FormBundleContext.Provider>
      )
    ).toBe('<p>a@b.c</p>');
    expect(renderToString(<Probe />)).toBe('<p>нет</p>');
  });
});

describe('SSR — поле и локализация', () => {
  it('useFieldHandleRef: разметка есть, внешний ref на сервере не заполняется', () => {
    const outer = createRef<FieldHandle>();
    function Field() {
      const inner = useFieldHandleRef(outer);
      return <input ref={inner as RefObject<HTMLInputElement>} />;
    }

    expect(renderToString(<Field />)).toBe('<input/>');
    expect(outer.current).toBeNull();
  });

  it('замечание поля под I18nProvider — текст на языке локали в первом кадре', () => {
    const { form } = createProfile();
    form.email.setIssues([{ code: 'required' }]);
    function FieldError() {
      const { issues } = useFormControl(form.email);
      const message = useIssueMessage();
      return <em>{message(issues[0])}</em>;
    }

    const html = renderToString(
      <I18nProvider locale={coreRu}>
        <FieldError />
      </I18nProvider>
    );

    expect(html).toBe('<em>Обязательное поле</em>');
  });
});
