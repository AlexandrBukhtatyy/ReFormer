/**
 * Адреса превью — чистая арифметика над адресом страницы приложения.
 *
 * Проверяется то, на чём стоит уговор между билдером и приложением в рамке: адрес стенда
 * возвращает тот же путь модуля, который в него положили; адрес страницы никогда не содержит
 * параметра стенда; путь, уводящий с источника или из проекта, стенд загружать отказывается.
 *
 * @module shell/embedded/preview-address.test
 */

import { describe, expect, it, vi } from 'vitest';
import { APP_PREVIEW_FRAME_NAME } from '@reformer/builder-plugin-api/internal';
import {
  createAppPreviewService,
  createSourceWriteSignal,
  FORM_STAND_PARAM,
  formUrlOf,
  isPreviewFrame,
  moduleUrlOf,
  pageUrlOf,
  standRequest,
  type PageLocation,
} from './preview-address';

const at = (path: string): PageLocation => {
  const url = new URL(path, 'http://localhost:5173');
  return { origin: url.origin, pathname: url.pathname, search: url.search, hash: url.hash };
};

describe('рамка превью', () => {
  it('узнаётся по имени окна', () => {
    expect(isPreviewFrame({ name: APP_PREVIEW_FRAME_NAME })).toBe(true);
  });

  it('любое другое окно — обычная страница, даже если оно тоже рамка', () => {
    expect(isPreviewFrame({ name: '' })).toBe(false);
    expect(isPreviewFrame({ name: 'чужая-рамка' })).toBe(false);
  });
});

describe('адрес стенда', () => {
  it('несёт путь модуля, и стенд читает его обратно без потерь', () => {
    const url = new URL(formUrlOf(at('/contacts'), 'src/forms/contact/index.tsx'));

    expect(url.pathname).toBe('/contacts');
    expect(standRequest(url.search)).toBe('src/forms/contact/index.tsx');
  });

  it('сохраняет параметры страницы: маршрут с запросом остаётся тем же маршрутом', () => {
    const url = new URL(formUrlOf(at('/list?tab=open'), 'src/forms/a/index.tsx'));

    expect(url.searchParams.get('tab')).toBe('open');
    expect(url.searchParams.get(FORM_STAND_PARAM)).toBe('src/forms/a/index.tsx');
  });

  it('путь приводится к виду «от корня проекта, прямые разделители»', () => {
    const url = new URL(formUrlOf(at('/'), '\\src\\forms\\a\\index.tsx'));

    expect(standRequest(url.search)).toBe('src/forms/a/index.tsx');
  });

  it('адрес стенда, построенный со стенда, не копит параметр', () => {
    const first = new URL(formUrlOf(at('/'), 'src/forms/a/index.tsx'));
    const second = new URL(formUrlOf(at(`/${first.search}`), 'src/forms/b/index.tsx'));

    expect(second.searchParams.getAll(FORM_STAND_PARAM)).toEqual(['src/forms/b/index.tsx']);
  });

  it('обычная страница стендом не считается', () => {
    expect(standRequest('')).toBeNull();
    expect(standRequest('?tab=open')).toBeNull();
    expect(standRequest(`?${FORM_STAND_PARAM}=`)).toBeNull();
  });
});

describe('адрес страницы', () => {
  it('отдаётся как есть — с запросом и якорем', () => {
    expect(pageUrlOf(at('/list?tab=open#row-3'))).toBe('http://localhost:5173/list?tab=open#row-3');
  });

  it('параметра стенда в нём нет: стенд — не страница приложения', () => {
    const stand = formUrlOf(at('/list?tab=open'), 'src/forms/a/index.tsx');

    expect(pageUrlOf(at(stand.slice('http://localhost:5173'.length)))).toBe(
      'http://localhost:5173/list?tab=open'
    );
  });
});

describe('адрес модуля формы на dev-сервере', () => {
  const origin = 'http://localhost:5173';

  it('проект открыт в корне сервера — путь модуля и есть путь адреса', () => {
    expect(moduleUrlOf(origin, '/', 'src/forms/contact/index.tsx')).toBe(
      'http://localhost:5173/src/forms/contact/index.tsx'
    );
  });

  it('проект открыт во вложенной папке — путь идёт под её префиксом', () => {
    expect(moduleUrlOf(origin, '/src', 'forms/contact/index.tsx')).toBe(
      'http://localhost:5173/src/forms/contact/index.tsx'
    );
    expect(moduleUrlOf(origin, 'src/', '/forms/contact/index.tsx')).toBe(
      'http://localhost:5173/src/forms/contact/index.tsx'
    );
  });

  it('чужой источник в пути не уводит загрузку с этого источника', () => {
    const url = moduleUrlOf(origin, '/', '//evil.example/x.js');

    expect(url).not.toBeNull();
    expect(new URL(url as string).origin).toBe(origin);
  });

  it('выход над префикс проекта — отказ, а не загрузка постороннего файла', () => {
    expect(moduleUrlOf(origin, '/src', '../vite.config.ts')).toBeNull();
  });
});

describe('служба адресов', () => {
  it('читает адрес страницы в момент вопроса, а не при создании', () => {
    let current = at('/first');
    const service = createAppPreviewService(() => current, createSourceWriteSignal());

    expect(service.pageUrl()).toBe('http://localhost:5173/first');
    current = at('/second');
    expect(service.pageUrl()).toBe('http://localhost:5173/second');
    expect(new URL(service.formUrl('src/forms/a/index.tsx')).pathname).toBe('/second');
  });

  it('сообщает о записи файлов на диск — и перестаёт после отписки', () => {
    const writes = createSourceWriteSignal();
    const service = createAppPreviewService(() => at('/'), writes);
    const listener = vi.fn();
    const subscription = service.onDidWriteSource(listener);

    writes.emit();
    subscription.dispose();
    writes.emit();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('упавший подписчик записи не мешает остальным', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const writes = createSourceWriteSignal();
    const listener = vi.fn();
    writes.subscribe(() => {
      throw new Error('подписчик сломан');
    });
    writes.subscribe(listener);

    writes.emit();

    expect(listener).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
});
