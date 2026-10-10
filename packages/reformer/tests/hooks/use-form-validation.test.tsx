// @vitest-environment happy-dom
/**
 * `useFormValidation` в DOM: контроллер стратегии валидации в жизненном цикле компонента.
 *
 * Контроллер собирается один раз на набор аргументов и армируется в эффекте — поэтому стратегии
 * `change` / `blur` / `afterFirstSubmit` работают только после монтирования, а размонтирование их
 * снимает. Признак `isValidating` будит компонент на время прогона; запись в модель при стратегии
 * `submit` компонент не трогает. Смена аргументов пересобирает контроллер и снимает прежнюю
 * стратегию; StrictMode с двойным эффектом армирует стратегию ровно один раз.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createForm } from '../../src/form/form-bundle';
import { defineValidation, validate, validateAsync } from '../../src/form/validation';
import type { ValidationIssue } from '../../src/form/types/index';
import {
  useFormValidation,
  type UseFormValidationArgs,
} from '../../src/platforms/react/hooks/use-form-validation';
import { act, cleanup, render, renderHookCounting, screen } from '../test-utils/react';
import { liveEffects } from '../test-utils/effect-tracker';
import { advance, deferred, settle, useFakeClock } from '../test-utils/async';
import { issueCodes } from '../test-utils/issues';

vi.mock('@preact/signals-core', async (importOriginal) =>
  (await import('../test-utils/effect-tracker')).trackEffects(await importOriginal())
);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

interface Signup {
  email: string;
  name: string;
}

/** Форма и правило «почта обязательна» со счётчиком прогонов. */
function createSignup(email = '') {
  const bundle = createForm<Signup>({ initial: { email, name: '' } });
  const rule = vi.fn((value: string): ValidationIssue | null =>
    value ? null : { code: 'required' }
  );
  const rules = defineValidation<Signup>(({ model }) => {
    validate(model.$.email, [rule]);
  });
  return { ...bundle, rule, rules };
}

type Args = UseFormValidationArgs<Signup>;

const renderValidation = (args: Args, strict = false) =>
  renderHookCounting((props: Args) => useFormValidation(props), { initialProps: args, strict });

describe('useFormValidation — submit и контроллер', () => {
  it('submit — полный прогон с раскрытием ошибок; validate — тот же колбэк', async () => {
    const { model, form, rules } = createSignup();
    const hook = renderValidation({ model, schema: rules });
    expect(hook.result.current.validate).toBe(hook.result.current.submit);

    let ok: boolean | undefined;
    await act(async () => {
      ok = await hook.result.current.submit();
    });

    expect(ok).toBe(false);
    expect(issueCodes(form.email)).toEqual(['required']);
    expect(form.email.touched.value).toBe(true);
  });

  it('submit на валидной форме — true', async () => {
    const { model, rules } = createSignup('a@b.c');
    const hook = renderValidation({ model, schema: rules });

    let ok: boolean | undefined;
    await act(async () => {
      ok = await hook.result.current.submit();
    });

    expect(ok).toBe(true);
  });

  it('isValidating — true на время прогона, по ререндеру на начало и конец', async () => {
    const answer = deferred<ValidationIssue | null>();
    const { model } = createSignup();
    const rules = defineValidation<Signup>(({ model: m }) => {
      validateAsync(m.$.email, [() => answer.promise]);
    });
    const hook = renderValidation({ model, schema: rules });
    expect(hook.result.current.isValidating).toBe(false);
    const before = hook.renders();

    let running: Promise<boolean> | undefined;
    act(() => {
      running = hook.result.current.submit();
    });
    expect(hook.result.current.isValidating).toBe(true);
    expect(hook.renders()).toBe(before + 1);

    await act(async () => {
      answer.resolve(null);
      await running;
    });
    expect(hook.result.current.isValidating).toBe(false);
    expect(hook.renders()).toBe(before + 2);
  });

  it('те же аргументы — тот же контроллер: submit не меняет идентичность', () => {
    const { model, rules } = createSignup();
    const hook = renderValidation({ model, schema: rules, strategy: 'change', debounce: 0 });
    const submit = hook.result.current.submit;

    hook.rerender({ model, schema: rules, strategy: 'change', debounce: 0 });

    expect(hook.result.current.submit).toBe(submit);
  });

  it('запись в модель при стратегии submit не запускает прогон и не перерисовывает', async () => {
    const { model, rule, rules } = createSignup();
    const hook = renderValidation({ model, schema: rules });
    const before = hook.renders();

    await act(async () => {
      model.email = 'x';
      model.email = '';
      await settle();
    });

    expect(rule).not.toHaveBeenCalled();
    expect(hook.renders()).toBe(before);
  });
});

describe('useFormValidation — стратегии после монтирования', () => {
  it('change: запись в модель — живой прогон без раскрытия ошибок', async () => {
    const { model, form, rule, rules } = createSignup('a@b.c');
    renderValidation({ model, schema: rules, strategy: 'change' });

    await act(async () => {
      model.email = '';
      await settle();
    });

    expect(rule).toHaveBeenCalledTimes(1);
    expect(issueCodes(form.email)).toEqual(['required']);
    expect(form.email.touched.value).toBe(false);
  });

  it('change + debounce: серия записей — один прогон после паузы', async () => {
    useFakeClock();
    const { model, rule, rules } = createSignup();
    renderValidation({ model, schema: rules, strategy: 'change', debounce: 300 });

    await act(async () => {
      model.email = 'a';
      await advance(100);
      model.email = 'ab';
      await advance(100);
      model.email = 'abc';
    });
    expect(rule).not.toHaveBeenCalled();

    await act(async () => {
      await advance(300);
    });
    expect(rule).toHaveBeenCalledTimes(1);
    expect(rule).toHaveBeenLastCalledWith('abc');
  });

  it('blur: прогон при потере фокуса поля', async () => {
    const { model, form, rule, rules } = createSignup();
    renderValidation({ model, schema: rules, strategy: 'blur' });

    await act(async () => {
      model.email = '';
      await settle();
    });
    expect(rule).not.toHaveBeenCalled();

    await act(async () => {
      form.email.markAsTouched();
      await settle();
    });
    expect(rule).toHaveBeenCalledTimes(1);
    expect(issueCodes(form.email)).toEqual(['required']);
  });

  it('afterFirstSubmit: тихо до первой отправки, затем живая проверка', async () => {
    const { model, rule, rules } = createSignup('a');
    const hook = renderValidation({ model, schema: rules, strategy: 'afterFirstSubmit' });

    await act(async () => {
      model.email = '';
      await settle();
    });
    expect(rule).not.toHaveBeenCalled();

    await act(async () => {
      await hook.result.current.submit();
    });
    expect(rule).toHaveBeenCalledTimes(1);

    await act(async () => {
      model.email = 'b';
      await settle();
    });
    expect(rule).toHaveBeenCalledTimes(2);
  });

  it('afterFirstSubmit + liveAfterSubmit=blur: после отправки — по потере фокуса', async () => {
    const { model, form, rule, rules } = createSignup();
    const hook = renderValidation({
      model,
      schema: rules,
      strategy: 'afterFirstSubmit',
      liveAfterSubmit: 'blur',
    });
    await act(async () => {
      await hook.result.current.submit();
    });
    form.email.markAsUntouched();
    rule.mockClear();

    await act(async () => {
      model.email = 'x';
      await settle();
    });
    expect(rule).not.toHaveBeenCalled();

    await act(async () => {
      form.email.markAsTouched();
      await settle();
    });
    expect(rule).toHaveBeenCalledTimes(1);
  });
});

describe('useFormValidation — смена аргументов', () => {
  it('другая стратегия — новый контроллер, прежняя стратегия снята', async () => {
    const { model, rule, rules } = createSignup();
    const base = liveEffects();
    const hook = renderValidation({ model, schema: rules, strategy: 'change' });
    const submit = hook.result.current.submit;
    expect(liveEffects()).toBe(base + 1);

    hook.rerender({ model, schema: rules, strategy: 'submit' });
    expect(hook.result.current.submit).not.toBe(submit);
    expect(liveEffects()).toBe(base);

    await act(async () => {
      model.email = 'x';
      await settle();
    });
    expect(rule).not.toHaveBeenCalled();
  });

  it('другая модель — подписка стратегии переезжает на неё', async () => {
    const first = createSignup();
    const second = createSignup();
    const hook = renderValidation({ model: first.model, schema: first.rules, strategy: 'change' });
    const subscribed = liveEffects();

    hook.rerender({ model: second.model, schema: second.rules, strategy: 'change' });
    expect(liveEffects()).toBe(subscribed);

    await act(async () => {
      first.model.email = 'старая';
      await settle();
    });
    expect(first.rule).not.toHaveBeenCalled();

    await act(async () => {
      second.model.email = 'новая';
      await settle();
    });
    expect(second.rule).toHaveBeenCalledTimes(1);
  });

  it.each<[string, Partial<Args>]>([
    ['debounce', { debounce: 50 }],
    ['liveAfterSubmit', { liveAfterSubmit: 'blur' }],
  ])('смена %s пересобирает контроллер', (_name, patch) => {
    const { model, rules } = createSignup();
    const args: Args = { model, schema: rules, strategy: 'afterFirstSubmit' };
    const hook = renderValidation(args);
    const submit = hook.result.current.submit;

    hook.rerender({ ...args, ...patch });

    expect(hook.result.current.submit).not.toBe(submit);
  });
});

describe('useFormValidation — гидратация', () => {
  it('серверная разметка: кадр без прогона, после гидратации стратегия армирована', async () => {
    const { model, rule, rules } = createSignup();
    function Probe() {
      const { isValidating } = useFormValidation({ model, schema: rules, strategy: 'change' });
      return <span data-testid="validating">{String(isValidating)}</span>;
    }
    const container = document.createElement('div');
    container.innerHTML = renderToString(<Probe />);
    document.body.appendChild(container);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<Probe />, { container, hydrate: true });

    expect(screen.getByTestId('validating').textContent).toBe('false');
    expect(error).not.toHaveBeenCalled();
    await act(async () => {
      model.email = 'x';
      await settle();
    });
    expect(rule).toHaveBeenCalledTimes(1);
  });
});

describe('useFormValidation — StrictMode', () => {
  it('двойной эффект армирует стратегию один раз: одна запись — один прогон', async () => {
    const { model, rule, rules } = createSignup();
    const base = liveEffects();
    const hook = renderValidation({ model, schema: rules, strategy: 'change' }, true);
    expect(liveEffects()).toBe(base + 1);

    await act(async () => {
      model.email = 'x';
      await settle();
    });
    expect(rule).toHaveBeenCalledTimes(1);

    hook.unmount();
    expect(liveEffects()).toBe(base);
  });
});

describe('useFormValidation — размонтирование', () => {
  it('стратегия снята: записи не запускают прогон, effect снят', async () => {
    const { model, rule, rules } = createSignup();
    const base = liveEffects();
    const hook = renderValidation({ model, schema: rules, strategy: 'change' });
    expect(liveEffects()).toBe(base + 1);

    hook.unmount();
    await act(async () => {
      model.email = 'после';
      await settle();
    });

    expect(rule).not.toHaveBeenCalled();
    expect(liveEffects()).toBe(base);
  });

  it('прогон после размонтирования не перерисовывает', async () => {
    const { model, rules } = createSignup();
    const hook = renderValidation({ model, schema: rules });
    const submit = hook.result.current.submit;
    hook.unmount();
    const after = hook.renders();

    await act(async () => {
      await submit();
    });

    expect(hook.renders()).toBe(after);
  });
});
