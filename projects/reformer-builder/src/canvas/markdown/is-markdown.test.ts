import { describe, expect, it } from 'vitest';
import { makeCodeTab } from '../../store/reducers';
import { emptySchema } from '../../model';
import type { TabState, TabSource } from '../../store';
import { isMarkdownName, isMarkdownTab } from './is-markdown';

const codeTab = (name: string, language: string): TabState => {
  const source: TabSource = { kind: 'file', name, path: name };
  return makeCodeTab(name, source, '', language);
};

describe('isMarkdownName', () => {
  it('markdown-расширения', () => {
    expect(isMarkdownName('README.md')).toBe(true);
    expect(isMarkdownName('doc.mdx')).toBe(true);
    expect(isMarkdownName('doc.markdown')).toBe(true);
    expect(isMarkdownName('README.MD')).toBe(true);
  });

  it('прочие файлы', () => {
    expect(isMarkdownName('form.json')).toBe(false);
    expect(isMarkdownName('model.ts')).toBe(false);
    expect(isMarkdownName('mdfile')).toBe(false);
  });
});

describe('isMarkdownTab', () => {
  it('по языку вкладки', () => {
    expect(isMarkdownTab(codeTab('README.md', 'markdown'))).toBe(true);
  });

  it('по расширению, если язык не проставился', () => {
    expect(isMarkdownTab(codeTab('README.md', 'plaintext'))).toBe(true);
  });

  it('не-markdown code-вкладка', () => {
    expect(isMarkdownTab(codeTab('model.ts', 'typescript'))).toBe(false);
  });

  it('form-вкладка и пусто', () => {
    const form: TabState = {
      ...codeTab('form.json', 'json'),
      kind: 'form',
      schema: emptySchema(),
    };
    expect(isMarkdownTab(form)).toBe(false);
    expect(isMarkdownTab(null)).toBe(false);
    expect(isMarkdownTab(undefined)).toBe(false);
  });
});
