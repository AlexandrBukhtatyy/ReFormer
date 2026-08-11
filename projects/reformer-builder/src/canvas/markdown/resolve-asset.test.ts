import { describe, expect, it } from 'vitest';
import { isExternalUrl, resolveRelativePath, splitHash } from './resolve-asset';

describe('isExternalUrl', () => {
  it('схемы, протокол-относительные и якоря — внешние', () => {
    expect(isExternalUrl('https://example.com/a.png')).toBe(true);
    expect(isExternalUrl('http://example.com')).toBe(true);
    expect(isExternalUrl('data:image/png;base64,AAA')).toBe(true);
    expect(isExternalUrl('mailto:a@b.c')).toBe(true);
    expect(isExternalUrl('//cdn.example.com/a.png')).toBe(true);
    expect(isExternalUrl('#heading')).toBe(true);
  });

  it('относительные пути — нет', () => {
    expect(isExternalUrl('./a.png')).toBe(false);
    expect(isExternalUrl('../docs/plan.md')).toBe(false);
    expect(isExternalUrl('img/a.png')).toBe(false);
    expect(isExternalUrl('/docs/a.png')).toBe(false);
  });
});

describe('resolveRelativePath', () => {
  it('от каталога файла', () => {
    expect(resolveRelativePath('docs/plans', './img.png')).toBe('docs/plans/img.png');
    expect(resolveRelativePath('docs/plans', 'img.png')).toBe('docs/plans/img.png');
    expect(resolveRelativePath('docs/plans', '../specs/a.md')).toBe('docs/specs/a.md');
    expect(resolveRelativePath('docs/plans', '../../README.md')).toBe('README.md');
  });

  it('файл в корне проекта', () => {
    expect(resolveRelativePath('', './a.png')).toBe('a.png');
    expect(resolveRelativePath('', 'docs/a.png')).toBe('docs/a.png');
  });

  it('ведущий слэш — от корня проекта, а не диска', () => {
    expect(resolveRelativePath('docs/plans', '/assets/a.png')).toBe('assets/a.png');
  });

  it('query и hash отбрасываются', () => {
    expect(resolveRelativePath('docs', './a.png?raw=1')).toBe('docs/a.png');
    expect(resolveRelativePath('docs', './a.md#intro')).toBe('docs/a.md');
  });

  it('выход за корень и пустой путь → null', () => {
    expect(resolveRelativePath('docs', '../../outside.png')).toBeNull();
    expect(resolveRelativePath('', '../a.png')).toBeNull();
    expect(resolveRelativePath('docs', '')).toBeNull();
    expect(resolveRelativePath('docs', '#anchor')).toBeNull();
    expect(resolveRelativePath('docs', './')).toBeNull();
  });
});

describe('splitHash', () => {
  it('делит путь и якорь', () => {
    expect(splitHash('../a.md#intro')).toEqual({ path: '../a.md', hash: 'intro' });
    expect(splitHash('#intro')).toEqual({ path: '', hash: 'intro' });
    expect(splitHash('./a.md')).toEqual({ path: './a.md', hash: null });
  });

  it('процент-кодирование якоря раскрывается', () => {
    expect(splitHash('#%D1%84%D0%B0%D0%B9%D0%BB').hash).toBe('файл');
  });

  it('пустой якорь → null', () => {
    expect(splitHash('a.md#')).toEqual({ path: 'a.md', hash: null });
  });
});
