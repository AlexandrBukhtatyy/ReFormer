/**
 * Тесты выбора языка и адреса модели.
 *
 * @module plugins/editor-monaco/language.test
 */

import { describe, expect, it } from 'vitest';
import { languageFor, modelPathFor, PLAIN_TEXT_LANGUAGE } from './language';

describe('languageFor', () => {
  it.each([
    ['application/json', 'json'],
    ['text/typescript', 'typescript'],
    ['text/typescript-jsx', 'typescript'],
    ['text/javascript', 'javascript'],
    ['text/markdown', 'markdown'],
    ['text/css', 'css'],
    ['application/yaml', 'yaml'],
  ])('%s → %s', (mediaType, expected) => {
    expect(languageFor(mediaType)).toBe(expected);
  });

  it('отбрасывает параметры медиатипа', () => {
    expect(languageFor('application/json; charset=utf-8')).toBe('json');
  });

  it('не зависит от регистра: медиатип мог прийти от источника как есть', () => {
    expect(languageFor('Application/JSON')).toBe('json');
  });

  it('понимает структурный суффикс: схема — это тот же JSON', () => {
    expect(languageFor('application/schema+json')).toBe('json');
  });

  it('неизвестный тип открывается без подсветки, а не отказом', () => {
    expect(languageFor('application/x-newfangled')).toBe(PLAIN_TEXT_LANGUAGE);
  });
});

describe('modelPathFor', () => {
  it('разводит одинаковые пути разных источников', () => {
    const first = modelPathFor({ sourceId: 'fs', path: 'a/form.json' });
    const second = modelPathFor({ sourceId: 'mem', path: 'a/form.json' });
    expect(first).not.toBe(second);
  });

  it('сохраняет расширение: по нему языковая служба сопоставляет схемы', () => {
    expect(modelPathFor({ sourceId: 'fs', path: 'forms/credit.json' })).toMatch(/\.json$/);
  });

  it('переносит разделители пути, а не съедает их', () => {
    expect(modelPathFor({ sourceId: 'fs', path: 'a/b/c.ts' })).toBe(
      'inmemory://document/fs/a/b/c.ts'
    );
  });

  it('экранирует то, что в URI невыразимо', () => {
    expect(modelPathFor({ sourceId: 'fs', path: 'папка/файл с пробелом.ts' })).not.toContain(' ');
  });
});
