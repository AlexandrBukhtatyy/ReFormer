// @vitest-environment happy-dom
/**
 * `I18nProvider` в DOM: загрузка языка в жизненном цикле провайдера.
 *
 * Node-близнец (`provider.test.tsx`) видит только первый синхронный кадр, правила хранилища —
 * `locale-store.test.ts`. Здесь — то, что видит пользователь: `fallback` до первой загрузки,
 * прежний язык с `pending` на время загрузки нового, применение только последнего запроса, ошибка
 * без смены языка и свежий `onError` без пересоздания хранилища. StrictMode не дублирует запрос,
 * ответ после размонтирования никого не будит, потребитель за `memo` перерисовывается только при
 * смене значения контекста.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { memo } from 'react';
import { createLocaleLoader } from '../../src/i18n/loader';
import type { FormLocale } from '../../src/i18n/locale';
import type { LocaleLoad } from '../../src/i18n/locale-store';
import { useI18n } from '../../src/platforms/react/i18n/hooks';
import { I18nProvider } from '../../src/platforms/react/i18n/provider';
import { act, cleanup, render, screen } from '../test-utils/react';
import { liveEffects } from '../test-utils/effect-tracker';
import { deferred, type Deferred } from '../test-utils/async';

vi.mock('@preact/signals-core', async (importOriginal) =>
  (await import('../test-utils/effect-tracker')).trackEffects(await importOriginal())
);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const locale = (code: string, title: string): FormLocale => ({
  code,
  messages: { 'app.title': title },
});

const RU = locale('ru', 'Профиль');
const DE = locale('de', 'Profil');
const FR = locale('fr', 'Profil (fr)');

/** Загрузчик под контролем теста: каждый запрос — свой ручной промис. */
function controlledLoad() {
  const requests = new Map<string, Deferred<FormLocale>>();
  const load = vi.fn((code: string) => {
    const request = deferred<FormLocale>();
    requests.set(code, request);
    return request.promise;
  });
  const settle = async (code: string, outcome: FormLocale | Error) => {
    await act(async () => {
      const request = requests.get(code)!;
      if (outcome instanceof Error) request.reject(outcome);
      else request.resolve(outcome);
    });
  };
  return { load: load as LocaleLoad & typeof load, settle };
}

let probeRenders = 0;

/** Что видит компонент: язык, загрузка, ошибка и перевод ключа приложения. */
function Probe() {
  probeRenders++;
  const { code, pending, error, t } = useI18n();
  return (
    <p data-testid="probe">
      {code}|{String(pending)}|{error ? String((error as Error).message) : '-'}|
      {t('app.title', undefined, 'Profile')}
    </p>
  );
}

const probe = () => screen.getByTestId('probe').textContent;

describe('I18nProvider — провайдер грузит сам', () => {
  it('fallback до первой загрузки, затем дерево на загруженном языке', async () => {
    const { load, settle } = controlledLoad();

    render(
      <I18nProvider lang="ru" load={load} fallback={<i>загрузка</i>}>
        <Probe />
      </I18nProvider>
    );
    expect(screen.getByText('загрузка')).toBeDefined();
    expect(load).toHaveBeenCalledWith('ru');

    await settle('ru', RU);

    expect(screen.queryByText('загрузка')).toBeNull();
    expect(probe()).toBe('ru|false|-|Профиль');
  });

  it('без fallback до загрузки не рисуется ничего', async () => {
    const { load, settle } = controlledLoad();
    const view = render(
      <I18nProvider lang="ru" load={load}>
        <Probe />
      </I18nProvider>
    );
    expect(view.container.innerHTML).toBe('');

    await settle('ru', RU);
    expect(probe()).toBe('ru|false|-|Профиль');
  });

  it('локаль уже в кэше загрузчика — сразу дерево, без fallback и без pending', async () => {
    const load = createLocaleLoader([(code) => (code === 'ru' ? RU : null)]);
    await load.preload('ru');

    render(
      <I18nProvider lang="ru" load={load} fallback={<i>загрузка</i>}>
        <Probe />
      </I18nProvider>
    );

    expect(screen.queryByText('загрузка')).toBeNull();
    expect(probe()).toBe('ru|false|-|Профиль');
  });

  it('смена lang: прежний язык на экране с pending, затем новый', async () => {
    const { load, settle } = controlledLoad();
    const view = render(
      <I18nProvider lang="ru" load={load}>
        <Probe />
      </I18nProvider>
    );
    await settle('ru', RU);

    view.rerender(
      <I18nProvider lang="de" load={load}>
        <Probe />
      </I18nProvider>
    );
    expect(probe()).toBe('ru|true|-|Профиль');

    await settle('de', DE);
    expect(probe()).toBe('de|false|-|Profil');
  });

  it('быстрое переключение: применяется только последний запрос', async () => {
    const { load, settle } = controlledLoad();
    const view = render(
      <I18nProvider lang="ru" load={load}>
        <Probe />
      </I18nProvider>
    );
    await settle('ru', RU);
    for (const lang of ['de', 'fr']) {
      view.rerender(
        <I18nProvider lang={lang} load={load}>
          <Probe />
        </I18nProvider>
      );
    }

    await settle('fr', FR);
    await settle('de', DE);

    expect(probe()).toBe('fr|false|-|Profil (fr)');
  });

  it('возврат к показанному языку снимает ожидание; поздний ответ не применяется', async () => {
    const { load, settle } = controlledLoad();
    const view = render(
      <I18nProvider lang="ru" load={load}>
        <Probe />
      </I18nProvider>
    );
    await settle('ru', RU);
    view.rerender(
      <I18nProvider lang="de" load={load}>
        <Probe />
      </I18nProvider>
    );

    view.rerender(
      <I18nProvider lang="ru" load={load}>
        <Probe />
      </I18nProvider>
    );
    expect(probe()).toBe('ru|false|-|Профиль');

    await settle('de', DE);
    expect(probe()).toBe('ru|false|-|Профиль');
  });

  it('отказ загрузки: язык прежний, ошибка в контексте, onError(ошибка, язык)', async () => {
    const { load, settle } = controlledLoad();
    const onError = vi.fn();
    const view = render(
      <I18nProvider lang="ru" load={load} onError={onError}>
        <Probe />
      </I18nProvider>
    );
    await settle('ru', RU);
    view.rerender(
      <I18nProvider lang="de" load={load} onError={onError}>
        <Probe />
      </I18nProvider>
    );

    const failure = new Error('нет сети');
    await settle('de', failure);

    expect(probe()).toBe('ru|false|нет сети|Профиль');
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure, 'de');
  });

  // поведение под вопросом [ReFormer-0f7y]: первая загрузка упала — показать нечего, провайдер остаётся на
  // `fallback`, дерево не монтируется, а ошибка в контекст не попадает (контекста ещё нет). Тот же
  // язык не перезапрашивается: эффект зависит только от `lang`. Об отказе приложение узнаёт из
  // `onError`; выйти можно сменой языка (или перемонтированием провайдера).
  it('первая загрузка упала — остаётся fallback; другой язык выводит из него', async () => {
    const { load, settle } = controlledLoad();
    const onError = vi.fn();
    const page = (lang: string) => (
      <I18nProvider lang={lang} load={load} fallback={<i>загрузка</i>} onError={onError}>
        <Probe />
      </I18nProvider>
    );
    const view = render(page('ru'));

    await settle('ru', new Error('нет сети'));
    view.rerender(page('ru'));
    expect(screen.getByText('загрузка').tagName).toBe('I');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);

    view.rerender(page('de'));
    await settle('de', DE);
    expect(probe()).toBe('de|false|-|Profil');
  });

  it('новый onError не пересоздаёт хранилище — вызывается свежий колбэк', async () => {
    const { load, settle } = controlledLoad();
    const stale = vi.fn();
    const fresh = vi.fn();
    const view = render(
      <I18nProvider lang="ru" load={load} onError={stale}>
        <Probe />
      </I18nProvider>
    );
    await settle('ru', RU);

    view.rerender(
      <I18nProvider lang="ru" load={load} onError={fresh}>
        <Probe />
      </I18nProvider>
    );
    expect(load).toHaveBeenCalledTimes(1);
    view.rerender(
      <I18nProvider lang="de" load={load} onError={fresh}>
        <Probe />
      </I18nProvider>
    );
    await settle('de', new Error('сбой'));

    expect(stale).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledTimes(1);
    expect(probe()).toBe('ru|false|сбой|Профиль');
  });

  // поведение под вопросом [ReFormer-0f7y]: хранилище мемоизировано по `load`, и новый загрузчик начинает с
  // чистого листа — пока он не отдаст локаль, провайдер снова рисует `fallback` и размонтирует
  // дерево (состояние детей теряется). Инлайн-стрелка в `load` сделала бы так на каждом ререндере
  // родителя; в документации пропа требования стабильной ссылки нет.
  it('смена загрузчика без локали в кэше — снова fallback до его ответа', async () => {
    const first = controlledLoad();
    const second = controlledLoad();
    const view = render(
      <I18nProvider lang="ru" load={first.load} fallback={<i>загрузка</i>}>
        <Probe />
      </I18nProvider>
    );
    await first.settle('ru', RU);

    view.rerender(
      <I18nProvider lang="ru" load={second.load} fallback={<i>загрузка</i>}>
        <Probe />
      </I18nProvider>
    );
    expect(screen.getByText('загрузка')).toBeDefined();

    await second.settle('ru', RU);
    expect(probe()).toBe('ru|false|-|Профиль');
  });

  it('смена загрузчика с локалью в кэше — дерево остаётся', async () => {
    const first = createLocaleLoader([() => RU]);
    const second = createLocaleLoader([() => RU]);
    await first.preload('ru');
    await second.preload('ru');
    const view = render(
      <I18nProvider lang="ru" load={first} fallback={<i>загрузка</i>}>
        <Probe />
      </I18nProvider>
    );

    view.rerender(
      <I18nProvider lang="ru" load={second} fallback={<i>загрузка</i>}>
        <Probe />
      </I18nProvider>
    );

    expect(screen.queryByText('загрузка')).toBeNull();
    expect(probe()).toBe('ru|false|-|Профиль');
  });

  it('StrictMode: двойной эффект не дублирует запрос', async () => {
    const { load, settle } = controlledLoad();

    render(
      <I18nProvider lang="ru" load={load}>
        <Probe />
      </I18nProvider>,
      { reactStrictMode: true }
    );
    await settle('ru', RU);

    expect(load).toHaveBeenCalledTimes(1);
    expect(probe()).toBe('ru|false|-|Профиль');
  });

  it('ререндер родителя без смены языка не будит memo-потребителя', async () => {
    const { load, settle } = controlledLoad();
    const MemoProbe = memo(Probe);
    const page = (count: number) => (
      <I18nProvider lang="ru" load={load}>
        <b>{count}</b>
        <MemoProbe />
      </I18nProvider>
    );
    const view = render(page(0));
    await settle('ru', RU);
    const before = probeRenders;

    view.rerender(page(1));

    expect(screen.getByText('1').tagName).toBe('B');
    expect(probeRenders).toBe(before);
  });

  it('размонтирование во время загрузки: поздний ответ никого не будит', async () => {
    const { load, settle } = controlledLoad();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const base = liveEffects();
    const view = render(
      <I18nProvider lang="ru" load={load}>
        <Probe />
      </I18nProvider>
    );

    view.unmount();
    const after = probeRenders;
    await settle('ru', RU);

    expect(probeRenders).toBe(after);
    expect(error).not.toHaveBeenCalled();
    expect(liveEffects()).toBe(base);
  });
});

describe('I18nProvider — готовая локаль', () => {
  it('смена объекта локали переключает язык сразу, без pending', () => {
    const view = render(
      <I18nProvider locale={RU}>
        <Probe />
      </I18nProvider>
    );
    expect(probe()).toBe('ru|false|-|Профиль');

    view.rerender(
      <I18nProvider locale={DE}>
        <Probe />
      </I18nProvider>
    );

    expect(probe()).toBe('de|false|-|Profil');
  });

  it('тот же объект локали при ререндере родителя — memo-потребитель не перерисовывается', () => {
    const MemoProbe = memo(Probe);
    const page = (count: number) => (
      <I18nProvider locale={RU}>
        <b>{count}</b>
        <MemoProbe />
      </I18nProvider>
    );
    const view = render(page(0));
    const before = probeRenders;

    view.rerender(page(1));

    expect(screen.getByText('1').tagName).toBe('B');
    expect(probeRenders).toBe(before);
  });
});
