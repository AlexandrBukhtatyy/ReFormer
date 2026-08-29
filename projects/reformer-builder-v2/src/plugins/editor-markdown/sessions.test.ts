import { describe, expect, it, vi } from 'vitest';

import { createMarkdownViewStore, type ViewSettings } from './sessions';
import { MARKDOWN_VIEW_SETTING } from './view';

const DOC = 'fs:README.md';
const OTHER = 'fs:docs/plan.md';

/** Настройки-двойник: помнит записанное, как настоящая служба. */
function fakeSettings(initial?: unknown): ViewSettings & { readonly written: unknown[] } {
  const written: unknown[] = [];
  let value = initial;
  return {
    written,
    get: <T>() => value as T | undefined,
    set: (_key, next) => {
      value = next;
      written.push(next);
    },
  };
}

function store(options: { settings?: ViewSettings; hasTextEditor?: boolean } = {}) {
  return createMarkdownViewStore({
    settings: options.settings ?? null,
    settingKey: MARKDOWN_VIEW_SETTING,
    hasTextEditor: () => options.hasTextEditor ?? true,
  });
}

describe('режим документа', () => {
  it('первый вопрос отвечает предпочтением из настроек', () => {
    const views = store({ settings: fakeSettings('preview') });

    expect(views.get(DOC)).toBe('preview');
    views.dispose();
  });

  it('без настроек и без записи режим — исходник', () => {
    const views = store();

    expect(views.get(DOC)).toBe('code');
    views.dispose();
  });

  it('режимы документов независимы', () => {
    const views = store();

    views.set(DOC, 'preview');
    views.set(OTHER, 'code');

    expect(views.get(DOC)).toBe('preview');
    expect(views.get(OTHER)).toBe('code');
    views.dispose();
  });

  it('новый документ берёт предпочтение, а не режим соседа', () => {
    const views = store({ settings: fakeSettings('code') });

    views.set(DOC, 'split');

    // Предпочтение обновилось вместе с явной сменой — второй документ откроется так же.
    expect(views.get(OTHER)).toBe('split');
    views.dispose();
  });
});

describe('липкость предпочтения', () => {
  it('явная смена режима запоминается для следующих документов', () => {
    const settings = fakeSettings();
    const views = store({ settings });

    views.set(DOC, 'split');

    expect(settings.written).toEqual(['split']);
    views.dispose();
  });

  it('приведение к доступному режиму предпочтением не считается', () => {
    const settings = fakeSettings('split');
    // Редактора кода нет: «рядом» превращается в предпросмотр — но это не выбор человека.
    const views = store({ settings, hasTextEditor: false });

    views.set(DOC, 'split', false);

    expect(views.get(DOC)).toBe('preview');
    expect(settings.written).toEqual([]);
    views.dispose();
  });

  it('сохранённое «рядом» без редактора кода не показывает пустую половину', () => {
    const views = store({ settings: fakeSettings('split'), hasTextEditor: false });

    expect(views.get(DOC)).toBe('preview');
    views.dispose();
  });
});

describe('наблюдение', () => {
  it('смена режима будит подписчика, повтор того же — нет', () => {
    const views = store();
    const seen = vi.fn();
    views.subscribe(seen);

    views.set(DOC, 'preview');
    expect(seen).toHaveBeenCalledTimes(1);

    views.set(DOC, 'preview');
    expect(seen).toHaveBeenCalledTimes(1);
    views.dispose();
  });

  it('забытый документ возвращается к предпочтению', () => {
    const views = store({ settings: fakeSettings('code') });

    views.set(DOC, 'preview');
    views.forget(DOC);

    // Предпочтение к этому моменту уже «preview»: явная смена его и записала.
    expect(views.get(DOC)).toBe('preview');
    views.dispose();
  });

  it('упавший подписчик не мешает остальным узнать о смене', () => {
    const views = store();
    const good = vi.fn();
    views.subscribe(() => {
      throw new Error('подписчик сломан');
    });
    views.subscribe(good);

    views.set(DOC, 'preview');

    expect(good).toHaveBeenCalledTimes(1);
    views.dispose();
  });
});
