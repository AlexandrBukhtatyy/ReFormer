/**
 * Резолв опций форматирования из конфигов проекта (спека §6). Браузер не может выполнить
 * `.cjs/.js/.mjs`-конфиг (нет `require`, небезопасно eval'ить), поэтому читаем только
 * парсимые-как-данные формы: `.prettierrc[.json]`, `.prettierrc.yaml`, `package.json#prettier`,
 * `.editorconfig`. Для неисполнимых — дефолты + плашка (документированное ограничение MVP).
 *
 * Значимы для JSON-принтера только `printWidth/tabWidth/useTabs/endOfLine` — остальное игнорируем.
 *
 * @module reformer-builder/io/prettier-config
 */

import * as YAML from 'yaml';
import { DEFAULT_PRINTER_OPTIONS, type PrinterOptions } from '../model/printer';

/** Результат резолва: опции (слитые с дефолтом), источник, опц. плашка про неисполнимый конфиг. */
export interface ResolvedPrinter {
  options: Required<PrinterOptions>;
  source: string;
  notice?: string;
}

/** Конфиги, которые нельзя выполнить в браузере. */
const UNEVALUABLE = [
  '.prettierrc.cjs',
  '.prettierrc.js',
  '.prettierrc.mjs',
  '.prettierrc.ts',
  'prettier.config.js',
  'prettier.config.cjs',
  'prettier.config.mjs',
  'prettier.config.ts',
];

function pick(raw: unknown): PrinterOptions {
  const o: PrinterOptions = {};
  if (raw == null || typeof raw !== 'object') return o;
  const r = raw as Record<string, unknown>;
  if (typeof r.printWidth === 'number') o.printWidth = r.printWidth;
  if (typeof r.tabWidth === 'number') o.tabWidth = r.tabWidth;
  if (typeof r.useTabs === 'boolean') o.useTabs = r.useTabs;
  if (r.endOfLine === 'lf' || r.endOfLine === 'crlf' || r.endOfLine === 'cr') o.endOfLine = r.endOfLine;
  return o;
}

/** Разобрать `.editorconfig` (секции `[*]` / `[*.json]`) в опции принтера. */
export function parseEditorConfig(content: string): PrinterOptions {
  const out: PrinterOptions = {};
  let applies = false;
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) continue;
    const section = trimmed.match(/^\[(.+)\]$/);
    if (section) {
      const glob = section[1];
      applies = glob === '*' || /(^|[,{])\*?\.json(,|}|$)/.test(glob) || glob.includes('*');
      continue;
    }
    if (!applies) continue;
    const kv = trimmed.match(/^([\w.-]+)\s*=\s*(.+)$/);
    if (!kv) continue;
    const key = kv[1].toLowerCase();
    const value = kv[2].trim().toLowerCase();
    if (key === 'indent_size' && /^\d+$/.test(value)) out.tabWidth = Number(value);
    else if (key === 'indent_style') out.useTabs = value === 'tab';
    else if (key === 'end_of_line' && (value === 'lf' || value === 'crlf' || value === 'cr'))
      out.endOfLine = value;
    else if (key === 'max_line_length' && /^\d+$/.test(value)) out.printWidth = Number(value);
  }
  return out;
}

/** Резолв опций форматирования из найденных конфигов (карта `имя файла → содержимое`). */
export function resolvePrinterOptions(files: Record<string, string>): ResolvedPrinter {
  const tryParse = (name: string, parse: (c: string) => unknown): ResolvedPrinter | null => {
    if (files[name] == null) return null;
    try {
      const opts = pick(parse(files[name]));
      if (Object.keys(opts).length > 0) {
        return { options: { ...DEFAULT_PRINTER_OPTIONS, ...opts }, source: name };
      }
    } catch {
      /* следующий кандидат */
    }
    return null;
  };

  const candidates: ResolvedPrinter[] = [
    tryParse('package.json', (c) => (JSON.parse(c) as { prettier?: unknown }).prettier),
    tryParse('.prettierrc.json', (c) => JSON.parse(c)),
    tryParse('.prettierrc', (c) => {
      try {
        return JSON.parse(c);
      } catch {
        return YAML.parse(c);
      }
    }),
    tryParse('.prettierrc.yaml', (c) => YAML.parse(c)),
    tryParse('.prettierrc.yml', (c) => YAML.parse(c)),
  ].filter((x): x is ResolvedPrinter => x != null);
  if (candidates.length > 0) return candidates[0];

  if (files['.editorconfig'] != null) {
    const opts = parseEditorConfig(files['.editorconfig']);
    if (Object.keys(opts).length > 0) {
      return { options: { ...DEFAULT_PRINTER_OPTIONS, ...opts }, source: '.editorconfig' };
    }
  }

  const unevaluable = UNEVALUABLE.find((n) => files[n] != null);
  if (unevaluable) {
    return {
      options: { ...DEFAULT_PRINTER_OPTIONS },
      source: 'default',
      notice: `Конфиг ${unevaluable} нельзя выполнить в браузере — форматирование по умолчанию.`,
    };
  }

  return { options: { ...DEFAULT_PRINTER_OPTIONS }, source: 'default' };
}
