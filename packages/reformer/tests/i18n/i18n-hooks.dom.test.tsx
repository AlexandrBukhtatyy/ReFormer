// @vitest-environment happy-dom
/**
 * Хуки локализации в DOM: `useI18n`, `useMessages`, `useIssueMessage` при смене языка.
 *
 * Node-близнец (`provider.test.tsx`) проверяет первый кадр. Здесь — жизнь компонента: смена
 * локали провайдера перерисовывает потребителей и переводит уже показанные замечания без повторной
 * валидации; идентичность переводчика и резолвера стабильна, пока не сменились локаль или таблица,
 * — на ней держатся `memo` и зависимости эффектов. Правки модели потребителя локали не будят;
 * размонтирование снимает подписку поля, через которое показываются замечания.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { memo, useSyncExternalStore, type ReactNode } from 'react';
import { createForm } from '../../src/form/form-bundle';
import { defineValidation, validate } from '../../src/form/validation';
import type { ValidationIssue } from '../../src/form/types/index';
import type { FormLocale, Messages } from '../../src/i18n/locale';
import { defineIssueMessages, type IssueMessages } from '../../src/i18n/validation-message';
import { ru as coreRu } from '../../src/locale/ru';
import { useI18n, useIssueMessage, useMessages } from '../../src/platforms/react/i18n/hooks';
import { I18nProvider } from '../../src/platforms/react/i18n/provider';
import { useFormControl } from '../../src/platforms/react/hooks/useFormControl';
import { act, cleanup, render, renderHookCounting, screen } from '../test-utils/react';
import { liveEffects } from '../test-utils/effect-tracker';

vi.mock('@preact/signals-core', async (importOriginal) =>
  (await import('../test-utils/effect-tracker')).trackEffects(await importOriginal())
);

afterEach(cleanup);

/** Встроенная английская таблица условного пакета. */
const KIT_EN = { 'kit.clear': 'Clear', 'kit.count': 'Selected: {count}' } as const;

const KIT_RU: FormLocale = {
  code: 'ru',
  messages: { 'kit.clear': 'Очистить', 'kit.count': 'Выбрано: {count}' },
};
const KIT_DE: FormLocale = { code: 'de', messages: { 'kit.clear': 'Leeren' } };

/**
 * Провайдер с локалью, которую тест меняет через `switchTo`. Локаль живёт во внешнем хранилище:
 * обёртка `renderHook` пропсов из `rerender` не получает.
 */
function switchableProvider(initial: FormLocale) {
  let current = initial;
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  };
  function Host({ children }: { children?: ReactNode }) {
    const locale = useSyncExternalStore(subscribe, () => current);
    return <I18nProvider locale={locale}>{children}</I18nProvider>;
  }
  const switchTo = (locale: FormLocale) =>
    act(() => {
      current = locale;
      for (const listener of listeners) listener();
    });
  return { Host, switchTo };
}

describe('useI18n — DOM', () => {
  it('без провайдера — английский с пустым словарём', () => {
    const hook = renderHookCounting(() => useI18n());

    expect(hook.result.current).toMatchObject({ code: 'en', pending: false, error: undefined });
    expect(hook.result.current.t('app.title', undefined, 'Profile')).toBe('Profile');
  });

  it('смена локали провайдера — ререндер с новым языком', () => {
    const { Host, switchTo } = switchableProvider(KIT_RU);
    const hook = renderHookCounting(() => useI18n(), { wrapper: Host });
    expect(hook.result.current.code).toBe('ru');
    const before = hook.renders();

    switchTo(KIT_DE);

    expect(hook.result.current.code).toBe('de');
    expect(hook.renders()).toBe(before + 1);
  });

  it('memo-потребитель локали не перерисовывается от правок модели и ререндера родителя', () => {
    const bundle = createForm<{ name: string }>({ initial: { name: '' } });
    let renders = 0;
    const Lang = memo(function Lang() {
      renders++;
      return <span>{useI18n().code}</span>;
    });
    const page = (count: number) => (
      <I18nProvider locale={KIT_RU}>
        <b>{count}</b>
        <Lang />
      </I18nProvider>
    );
    const view = render(page(0));
    const before = renders;

    act(() => bundle.form.name.setValue('Анна'));
    view.rerender(page(1));

    expect(screen.getByText('1').tagName).toBe('B');
    expect(renders).toBe(before);
  });
});

describe('useMessages — DOM', () => {
  it('ключ из локали провайдера, промах — встроенная таблица пакета', () => {
    const { Host } = switchableProvider(KIT_DE);
    const hook = renderHookCounting(() => useMessages(KIT_EN), { wrapper: Host });

    expect(hook.result.current('kit.clear')).toBe('Leeren');
    expect(hook.result.current('kit.count', { count: 2 })).toBe('Selected: 2');
  });

  it('переводчик стабилен при ререндере и меняется вместе с локалью', () => {
    const { Host, switchTo } = switchableProvider(KIT_RU);
    const hook = renderHookCounting(() => useMessages(KIT_EN), { wrapper: Host });
    const first = hook.result.current;

    hook.rerender();
    expect(hook.result.current).toBe(first);

    switchTo(KIT_DE);
    expect(hook.result.current).not.toBe(first);
    expect(hook.result.current('kit.clear')).toBe('Leeren');
  });

  it('другая таблица пакета — новый переводчик по ней', () => {
    const OTHER_EN = { 'kit.clear': 'Reset' } as const;
    const hook = renderHookCounting((props: { table: Messages }) => useMessages(props.table), {
      initialProps: { table: KIT_EN as Messages },
    });
    const first = hook.result.current;

    hook.rerender({ table: OTHER_EN });

    expect(hook.result.current).not.toBe(first);
    expect(hook.result.current('kit.clear')).toBe('Reset');
  });

  it('StrictMode: перевод по локали провайдера', () => {
    const { Host } = switchableProvider(KIT_RU);
    const hook = renderHookCounting(() => useMessages(KIT_EN), { wrapper: Host, strict: true });

    expect(hook.result.current('kit.count', { count: 5 })).toBe('Выбрано: 5');
  });
});

interface Contact {
  email: string;
}

/** Форма с правилом «почта обязательна»; счётчик прогонов — для «без повторной валидации». */
function createContact() {
  const rule = vi.fn((value: string): ValidationIssue | null =>
    value ? null : { code: 'required' }
  );
  const rules = defineValidation<Contact>(({ model }) => {
    validate(model.$.email, [rule]);
  });
  return { ...createForm<Contact>({ initial: { email: '' }, validation: rules }), rule };
}

describe('useIssueMessage — DOM', () => {
  it('показанные замечания переводятся при смене языка без повторной валидации', async () => {
    const bundle = createContact();
    await bundle.validate();
    function EmailError() {
      const { issues } = useFormControl(bundle.form.email);
      const message = useIssueMessage();
      return <em data-testid="error">{issues.map(message).join(', ')}</em>;
    }
    const { Host, switchTo } = switchableProvider({ code: 'en', messages: {} });
    render(
      <Host>
        <EmailError />
      </Host>
    );
    expect(screen.getByTestId('error').textContent).toBe('This field is required');

    switchTo(coreRu);

    expect(screen.getByTestId('error').textContent).toBe('Обязательное поле');
    expect(bundle.rule).toHaveBeenCalledTimes(1);
  });

  it('резолвер стабилен при тех же локали и словаре, меняется со словарём формы', () => {
    const first = defineIssueMessages({ required: 'Нужно заполнить' });
    const second = defineIssueMessages({ required: 'Заполните поле' });
    const hook = renderHookCounting(
      (props: { messages: IssueMessages }) => useIssueMessage(props.messages),
      { initialProps: { messages: first as IssueMessages } }
    );
    const resolver = hook.result.current;

    hook.rerender({ messages: first });
    expect(hook.result.current).toBe(resolver);

    hook.rerender({ messages: second });
    expect(hook.result.current).not.toBe(resolver);
    expect(hook.result.current({ code: 'required' })).toBe('Заполните поле');
  });

  it('словарь формы приоритетнее локали, промах — по локали', () => {
    const messages = defineIssueMessages({ required: 'Почта обязательна' });
    const { Host } = switchableProvider(coreRu);
    const hook = renderHookCounting(() => useIssueMessage(messages), { wrapper: Host });

    expect(hook.result.current({ code: 'required' })).toBe('Почта обязательна');
    expect(hook.result.current({ code: 'minLength', params: { minLength: 3 } })).toBe(
      'Не меньше 3 символов'
    );
  });

  it('размонтирование: подписка поля снята, замечания не перерисовывают', async () => {
    const bundle = createContact();
    let renders = 0;
    function EmailError() {
      renders++;
      const { issues } = useFormControl(bundle.form.email);
      const message = useIssueMessage();
      return <em>{issues.map(message).join(', ')}</em>;
    }
    const base = liveEffects();
    const view = render(
      <I18nProvider locale={coreRu}>
        <EmailError />
      </I18nProvider>
    );
    expect(liveEffects()).toBe(base + 1);

    view.unmount();
    const after = renders;
    await act(async () => {
      await bundle.validate();
    });

    expect(renders).toBe(after);
    expect(liveEffects()).toBe(base);
  });
});
