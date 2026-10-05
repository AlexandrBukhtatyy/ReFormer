import { describe, expect, it } from 'vitest';

import {
  directoryOf,
  fenceLanguage,
  fenceLanguageFromClass,
  isExternalUrl,
  isMarkdown,
  resolveRelativePath,
  splitHash,
} from './markdown';
import {
  availableViews,
  clampView,
  cycleView,
  DEFAULT_MARKDOWN_VIEW,
  isMarkdownView,
  readView,
} from '../state/view';

describe('распознавание markdown', () => {
  it('медиатип платформы достаточен', () => {
    expect(isMarkdown('readme', 'text/markdown')).toBe(true);
  });

  it('имя дополняет таблицу медиатипов, а не подменяет её', () => {
    expect(isMarkdown('README.md')).toBe(true);
    expect(isMarkdown('notes.MARKDOWN')).toBe(true);
    // `.mdx` показываем как обычный markdown: JSX внутри предпросмотра не исполняется вовсе.
    expect(isMarkdown('page.mdx')).toBe(true);
    expect(isMarkdown('schema.json', 'application/json')).toBe(false);
  });
});

describe('ссылки', () => {
  it('внешним считается всё, что не адресует файл проекта', () => {
    expect(isExternalUrl('https://example.com')).toBe(true);
    expect(isExternalUrl('data:image/png;base64,AAA')).toBe(true);
    expect(isExternalUrl('mailto:a@b.c')).toBe(true);
    expect(isExternalUrl('//cdn/x.png')).toBe(true);
    expect(isExternalUrl('#anchor')).toBe(true);
    expect(isExternalUrl('./img/logo.png')).toBe(false);
  });

  it('относительный путь считается от каталога документа', () => {
    expect(resolveRelativePath('docs', './img/logo.png')).toBe('docs/img/logo.png');
    expect(resolveRelativePath('docs/guide', '../plan.md')).toBe('docs/plan.md');
    expect(resolveRelativePath('', 'README.md')).toBe('README.md');
  });

  it('ведущий слэш читается от корня проекта, а не от корня диска', () => {
    expect(resolveRelativePath('docs/guide', '/README.md')).toBe('README.md');
  });

  it('выход за корень источника — отказ, а не чтение чужого каталога', () => {
    expect(resolveRelativePath('docs', '../../etc/passwd')).toBeNull();
    expect(resolveRelativePath('', '../secret')).toBeNull();
  });

  it('каталог и пустая ссылка читать нечего', () => {
    expect(resolveRelativePath('docs', './img/')).toBeNull();
    expect(resolveRelativePath('docs', '')).toBeNull();
  });

  it('запрос и якорь к файловой системе не относятся', () => {
    expect(resolveRelativePath('docs', './a.md?v=2#intro')).toBe('docs/a.md');
  });

  it('якорь отделяется от пути', () => {
    expect(splitHash('../a.md#intro')).toEqual({ path: '../a.md', hash: 'intro' });
    expect(splitHash('#%D0%B7%D0%B0%D0%B3')).toEqual({ path: '', hash: 'заг' });
    expect(splitHash('a.md')).toEqual({ path: 'a.md', hash: null });
  });

  it('каталог документа', () => {
    expect(directoryOf('docs/guide/plan.md')).toBe('docs/guide');
    expect(directoryOf('README.md')).toBe('');
  });
});

describe('язык блока кода', () => {
  it('псевдонимы приводятся к имени грамматики', () => {
    expect(fenceLanguage('ts')).toBe('typescript');
    expect(fenceLanguage('sh')).toBe('bash');
    expect(fenceLanguage('YAML')).toBe('yaml');
  });

  it('хвост info-строки и скобки R-Markdown не мешают', () => {
    expect(fenceLanguage('ts title="a.ts"')).toBe('typescript');
    expect(fenceLanguage('{r}')).toBeNull();
    expect(fenceLanguage('{js}')).toBe('javascript');
  });

  it('незнакомый язык — блок без подсветки, а не ошибка', () => {
    expect(fenceLanguage('brainfuck')).toBeNull();
    expect(fenceLanguage('')).toBeNull();
    expect(fenceLanguage(null)).toBeNull();
  });

  it('класс от react-markdown разбирается тем же правилом', () => {
    expect(fenceLanguageFromClass('language-tsx hljs')).toBe('typescript');
    expect(fenceLanguageFromClass('hljs')).toBeNull();
    expect(fenceLanguageFromClass(undefined)).toBeNull();
  });
});

describe('режимы вида', () => {
  it('значение настройки приводится к режиму, мусор — к умолчанию', () => {
    expect(readView('preview')).toBe('preview');
    expect(readView('нечто')).toBe(DEFAULT_MARKDOWN_VIEW);
    expect(readView(undefined)).toBe(DEFAULT_MARKDOWN_VIEW);
    expect(isMarkdownView('split')).toBe(true);
  });

  it('цикл идёт по кругу в обе стороны', () => {
    expect(cycleView('code')).toBe('preview');
    expect(cycleView('preview')).toBe('split');
    expect(cycleView('split')).toBe('code');
    expect(cycleView('code', -1)).toBe('split');
  });

  it('без редактора кода режима «рядом» не существует', () => {
    expect(availableViews(false)).toEqual(['code', 'preview']);
    expect(availableViews(true)).toEqual(['code', 'preview', 'split']);
    // Сохранённое предпочтение «рядом» не должно показывать половину экрана пустой.
    expect(clampView('split', false)).toBe('preview');
    expect(clampView('split', true)).toBe('split');
  });
});
