import { describe, expect, it } from 'vitest';
import { resolvePrinterOptions, parseEditorConfig } from './prettier-config';

describe('resolvePrinterOptions', () => {
  it('.prettierrc.json → опции', () => {
    const r = resolvePrinterOptions({
      '.prettierrc.json': JSON.stringify({ tabWidth: 4, printWidth: 80 }),
    });
    expect(r.source).toBe('.prettierrc.json');
    expect(r.options.tabWidth).toBe(4);
    expect(r.options.printWidth).toBe(80);
  });

  it('package.json#prettier → опции', () => {
    const r = resolvePrinterOptions({
      'package.json': JSON.stringify({ prettier: { useTabs: true } }),
    });
    expect(r.source).toBe('package.json');
    expect(r.options.useTabs).toBe(true);
  });

  it('.prettierrc.yaml → опции', () => {
    const r = resolvePrinterOptions({ '.prettierrc.yaml': 'tabWidth: 8\nendOfLine: crlf\n' });
    expect(r.source).toBe('.prettierrc.yaml');
    expect(r.options.tabWidth).toBe(8);
    expect(r.options.endOfLine).toBe('crlf');
  });

  it('.editorconfig → опции', () => {
    const r = resolvePrinterOptions({
      '.editorconfig': '[*]\nindent_style = space\nindent_size = 4\nend_of_line = lf\n',
    });
    expect(r.source).toBe('.editorconfig');
    expect(r.options.tabWidth).toBe(4);
    expect(r.options.useTabs).toBe(false);
  });

  it('только .cjs → дефолт + плашка', () => {
    const r = resolvePrinterOptions({ '.prettierrc.cjs': 'module.exports = { tabWidth: 4 }' });
    expect(r.source).toBe('default');
    expect(r.options.tabWidth).toBe(2);
    expect(r.notice).toContain('.prettierrc.cjs');
  });

  it('пусто → дефолт без плашки', () => {
    const r = resolvePrinterOptions({});
    expect(r.source).toBe('default');
    expect(r.notice).toBeUndefined();
    expect(r.options).toEqual({ printWidth: 100, tabWidth: 2, useTabs: false, endOfLine: 'lf' });
  });
});

describe('parseEditorConfig', () => {
  it('tab → useTabs, max_line_length → printWidth', () => {
    const o = parseEditorConfig('[*]\nindent_style = tab\nmax_line_length = 120\n');
    expect(o.useTabs).toBe(true);
    expect(o.printWidth).toBe(120);
  });
});
