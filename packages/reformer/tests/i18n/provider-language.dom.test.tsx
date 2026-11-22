// @vitest-environment happy-dom
/**
 * `I18nProvider({ language })` [ReFormer-cn5g.3]: провайдер над уровнем языка.
 *
 * Язык меняют вне React — сигналом уровня или полем модели. Провайдер обязан показать `fallback`
 * до первой локали, держать прежний язык с `pending` на время загрузки, показать детей на
 * встроенном английском при упавшей первой загрузке и не перерисовывать потребителей без смены
 * значения контекста.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createModel } from '../../src/model/index';
import type { FormLocale } from '../../src/i18n/locale';
import type { LocaleLoad } from '../../src/i18n/locale-store';
import { createLanguage } from '../../src/language/index';
import { useI18n } from '../../src/platforms/react/i18n/hooks';
import { I18nProvider } from '../../src/platforms/react/i18n/provider';
import { act, cleanup, fireEvent, render, screen } from '../test-utils/react';
import { deferred, type Deferred } from '../test-utils/async';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const locale = (code: string, title: string): FormLocale => ({
  code,
  messages: { 'app.title': title },
});
const RU = locale('ru', 'Профиль');
const EN = locale('en', 'Profile (en)');

function controlledLoad() {
  const requests = new Map<string, Deferred<FormLocale>>();
  const load = vi.fn((code: string) => {
    const request = deferred<FormLocale>();
    requests.set(code, request);
    return request.promise;
  }) as unknown as LocaleLoad;
  const settle = async (code: string, outcome: FormLocale | Error) => {
    await act(async () => {
      const request = requests.get(code)!;
      if (outcome instanceof Error) request.reject(outcome);
      else request.resolve(outcome);
    });
  };
  return { load, settle };
}

let renders = 0;
function Probe() {
  renders++;
  const { code, pending, error, t } = useI18n();
  return (
    <p data-testid="probe">
      {code}|{String(pending)}|{error ? (error as Error).message : '-'}|
      {t('app.title', undefined, 'Profile')}
    </p>
  );
}
const probe = () => screen.getByTestId('probe').textContent;

describe('I18nProvider — режим language', () => {
  it('fallback до первой локали, затем дерево на загруженном языке', async () => {
    const { load, settle } = controlledLoad();
    const language = createLanguage({ load, initial: 'ru', detect: null, document: null });
    render(
      <I18nProvider language={language} fallback={<span>загрузка</span>}>
        <Probe />
      </I18nProvider>
    );
    expect(screen.getByText('загрузка')).toBeTruthy();
    await settle('ru', RU);
    expect(probe()).toBe('ru|false|-|Профиль');
    language.dispose();
  });

  it('без fallback до первой локали — ничего', () => {
    const { load } = controlledLoad();
    const language = createLanguage({ load, initial: 'ru', detect: null, document: null });
    const view = render(
      <I18nProvider language={language}>
        <Probe />
      </I18nProvider>
    );
    expect(view.container.innerHTML).toBe('');
    language.dispose();
  });

  it('смена языка вне React: прежний язык с pending, затем новый', async () => {
    const { load, settle } = controlledLoad();
    const model = createModel({ lang: 'ru' });
    const language = createLanguage({ lang: model.$.lang, load, detect: null, document: null });
    render(
      <I18nProvider language={language}>
        <Probe />
      </I18nProvider>
    );
    await settle('ru', RU);
    act(() => {
      model.lang = 'en'; // форма настроек пишет поле модели
    });
    expect(probe()).toBe('ru|true|-|Профиль');
    await settle('en', EN);
    expect(probe()).toBe('en|false|-|Profile (en)');
    language.dispose();
  });

  it('упала первая загрузка — дети на встроенном английском, retry повторяет', async () => {
    const { load, settle } = controlledLoad();
    const language = createLanguage({ load, initial: 'ru', detect: null, document: null });
    function Retry() {
      const { retry } = useI18n();
      return (
        <button type="button" onClick={retry}>
          retry
        </button>
      );
    }
    render(
      <I18nProvider language={language}>
        <Probe />
        <Retry />
      </I18nProvider>
    );
    await settle('ru', new Error('сеть'));
    expect(probe()).toBe('en|false|сеть|Profile');
    fireEvent.click(screen.getByRole('button', { name: 'retry' }));
    expect(probe()).toBe('en|true|-|Profile');
    await settle('ru', RU);
    expect(probe()).toBe('ru|false|-|Профиль');
    language.dispose();
  });

  it('без смены значения контекста потребитель не перерисовывается', async () => {
    const { load, settle } = controlledLoad();
    const language = createLanguage({ load, initial: 'ru', detect: null, document: null });
    const view = render(
      <I18nProvider language={language}>
        <Probe />
      </I18nProvider>
    );
    await settle('ru', RU);
    const before = renders;
    view.rerender(
      <I18nProvider language={language}>
        <Probe />
      </I18nProvider>
    );
    act(() => {
      void language.set('ru'); // тот же язык — состояние не меняется
    });
    expect(renders - before).toBeLessThanOrEqual(1); // только rerender родителя
    language.dispose();
  });
});
