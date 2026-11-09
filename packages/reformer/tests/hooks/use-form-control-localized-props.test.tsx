// @vitest-environment happy-dom
/**
 * Описатели сообщений в `componentProps` раскрывает `useFormControl` [ReFormer-7ec].
 *
 * Раньше `msg('…')` в пропсах схемы доходил до компонента объектом, и подпись поля нельзя было
 * локализовать декларативно — только `updateComponentProps({ label: t(…) })` в эффекте. Теперь хук
 * отдаёт строки по локали `I18nProvider`, в том числе внутри массивов (подписи опций), а пропсы без
 * описателей сохраняют ссылку — лишних перерисовок нет.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createForm } from '../../src/form/form-bundle';
import { createModel } from '../../src/model/index';
import { msg } from '../../src/i18n/descriptor';
import { useFormControl } from '../../src/platforms/react/hooks/useFormControl';
import { I18nProvider } from '../../src/platforms/react/i18n/provider';
import type { FormLocale } from '../../src/i18n/locale';
import { cleanup, render, screen } from '../test-utils/react';

afterEach(cleanup);

const ru: FormLocale = {
  code: 'ru',
  messages: { 'profile.email': 'Почта', 'opt.a': 'Вариант А' },
};
const en: FormLocale = {
  code: 'en',
  messages: { 'profile.email': 'Email', 'opt.a': 'Option A' },
};

function createProfile(componentProps: Record<string, unknown>) {
  return createForm<{ email: string }>({
    model: createModel<{ email: string }>({ email: '' }),
    schema: (m) => ({
      children: [{ model: m.$.email, component: () => null, componentProps }],
    }),
  });
}

describe('useFormControl — описатели msg() в componentProps', () => {
  it('раскрываются по локали провайдера, в том числе в опциях, и следуют смене языка', () => {
    const { form } = createProfile({
      label: msg('profile.email'),
      options: [{ value: 'a', label: msg('opt.a') }],
      placeholder: 'x@y.z',
    });
    function Probe() {
      const { componentProps } = useFormControl(form.email);
      const options = componentProps.options as Array<{ label: string }>;
      return (
        <span data-testid="out">
          {String(componentProps.label)}|{options[0].label}|{String(componentProps.placeholder)}
        </span>
      );
    }

    const { rerender } = render(
      <I18nProvider locale={ru}>
        <Probe />
      </I18nProvider>
    );
    expect(screen.getByTestId('out').textContent).toBe('Почта|Вариант А|x@y.z');

    rerender(
      <I18nProvider locale={en}>
        <Probe />
      </I18nProvider>
    );
    expect(screen.getByTestId('out').textContent).toBe('Email|Option A|x@y.z');
  });

  it('пропсы без описателей отдаются тем же объектом', () => {
    const { form } = createProfile({ label: 'Почта' });
    const seen: unknown[] = [];
    function Probe() {
      seen.push(useFormControl(form.email).componentProps);
      return null;
    }

    render(
      <I18nProvider locale={ru}>
        <Probe />
      </I18nProvider>
    );
    expect(seen[0]).toBe(form.email.componentProps.peek());
  });
});
