import { describe, expect, it } from 'vitest';
import { fenceLanguage, fenceLanguageFromClass } from './fence-language';

describe('fenceLanguage', () => {
  it('псевдонимы разворачиваются в languageId monaco', () => {
    expect(fenceLanguage('ts')).toBe('typescript');
    expect(fenceLanguage('tsx')).toBe('typescript');
    expect(fenceLanguage('bash')).toBe('shell');
    expect(fenceLanguage('sh')).toBe('shell');
    expect(fenceLanguage('json')).toBe('json');
    expect(fenceLanguage('yml')).toBe('yaml');
  });

  it('регистр не важен', () => {
    expect(fenceLanguage('TS')).toBe('typescript');
    expect(fenceLanguage('JSON')).toBe('json');
  });

  it('берётся первый токен info-строки', () => {
    expect(fenceLanguage('ts title="a.ts"')).toBe('typescript');
    expect(fenceLanguage('bash,ignore')).toBe('shell');
  });

  it('className от react-markdown и фигурные скобки', () => {
    expect(fenceLanguage('language-ts')).toBe('typescript');
    expect(fenceLanguage('{ts}')).toBe('typescript');
  });

  it('пусто и незнакомое → null (рисуем без подсветки)', () => {
    expect(fenceLanguage('')).toBeNull();
    expect(fenceLanguage(null)).toBeNull();
    expect(fenceLanguage(undefined)).toBeNull();
    expect(fenceLanguage('   ')).toBeNull();
    expect(fenceLanguage('brainfuck')).toBeNull();
    expect(fenceLanguage('language-')).toBeNull();
  });
});

describe('fenceLanguageFromClass', () => {
  it('находит language-* среди прочих классов', () => {
    expect(fenceLanguageFromClass('hljs language-json extra')).toBe('json');
  });

  it('без language-* → null', () => {
    expect(fenceLanguageFromClass('hljs')).toBeNull();
    expect(fenceLanguageFromClass(undefined)).toBeNull();
  });
});
