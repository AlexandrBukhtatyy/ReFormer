/**
 * Удержание перезагрузок: правило «что останавливать и когда отдавать долг».
 *
 * Сама привязка к событию клиента Vite здесь не проверяется — её нечем проверить без dev-сервера.
 * Проверяется решение: какая перезагрузка останавливается, какая проходит, и что отложенная
 * выполняется ровно один раз — при выключении режима.
 *
 * @module shell/embedded/reload-hold.test
 */

import { describe, expect, it, vi } from 'vitest';
import { createReloadHold } from './reload-hold';

describe('перезагрузки страницы, пока открыт билдер', () => {
  it('пока билдер закрыт, перезагрузка проходит как обычно', () => {
    const hold = createReloadHold();

    expect(hold.intercept({ triggeredBy: '/src/forms/contact/form.schema.json' })).toBeUndefined();
  });

  it('перезагрузка из-за правки файла останавливается', () => {
    const hold = createReloadHold();
    hold.hold(vi.fn());

    expect(hold.intercept({ triggeredBy: '/src/forms/contact/form.schema.json' })).toBeInstanceOf(
      Promise
    );
  });

  it('правка страницы приходит без файла-причины, с путём страницы — тоже останавливается', () => {
    const hold = createReloadHold();
    hold.hold(vi.fn());

    expect(hold.intercept({ path: '/index.html' })).toBeInstanceOf(Promise);
  });

  it('перезагрузка «всем» без названного файла проходит: сервер сменил зависимости', () => {
    const hold = createReloadHold();
    const reload = vi.fn();
    const release = hold.hold(reload);

    expect(hold.intercept({ path: '*' })).toBeUndefined();
    expect(hold.intercept({})).toBeUndefined();
    release();
    // Пропущенную перезагрузку страница выполнила сама — возвращать нечего.
    expect(reload).not.toHaveBeenCalled();
  });

  it('отложенная перезагрузка выполняется при закрытии билдера — один раз', () => {
    const hold = createReloadHold();
    const reload = vi.fn();
    const release = hold.hold(reload);

    void hold.intercept({ triggeredBy: '/src/a.ts' });
    void hold.intercept({ triggeredBy: '/src/b.ts' });
    expect(reload).not.toHaveBeenCalled();

    release();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('ничего не откладывалось — закрытие билдера страницу не трогает', () => {
    const hold = createReloadHold();
    const reload = vi.fn();

    hold.hold(reload)();

    expect(reload).not.toHaveBeenCalled();
  });

  it('после закрытия перезагрузки снова проходят, а долг не переносится на следующее открытие', () => {
    const hold = createReloadHold();
    const first = vi.fn();
    const release = hold.hold(first);
    void hold.intercept({ triggeredBy: '/src/a.ts' });
    release();

    expect(hold.intercept({ triggeredBy: '/src/a.ts' })).toBeUndefined();

    const second = vi.fn();
    hold.hold(second)();
    expect(second).not.toHaveBeenCalled();
  });
});
