/**
 * Грамматика `form.intent.json`: база и секции, потолки размера, разбор запроса `grammar`.
 *
 * Потолки держат то, ради чего грамматика разбита (аудит 2026-11, A5/A7): базу читает каждая
 * модель, включая малые локальные, а секции приходят только по запросу. Образцы — записи
 * `GRAMMAR_EXAMPLE`, которую собирает настоящая сборка (`form-build.test.ts`); здесь проверено, что
 * каждый образец в тексте — разбираемый JSON.
 */

import { describe, expect, it } from 'vitest';
import {
  GRAMMAR_ALL_LIMIT,
  GRAMMAR_BASE_LIMIT,
  GRAMMAR_EXAMPLE,
  GRAMMAR_SECTIONS,
  intentGrammar,
  readGrammarRequest,
} from '../src/core/generate/intent-grammar';
import { NO_CATALOGS } from '../src/core/generate/catalogs';
import { CATALOGS } from './support/catalogs';

const base = intentGrammar(CATALOGS);
const all = intentGrammar(CATALOGS, { sections: 'all' });

/** Объекты JSON в начале строк: образцы записей. */
function sampleRows(text: string): string[] {
  const rows: string[] = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('{')) continue;
    let depth = 0;
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quoted) {
        if (c === '\\') i++;
        else if (c === '"') quoted = false;
        continue;
      }
      if (c === '"') quoted = true;
      else if (c === '{' || c === '[') depth++;
      else if (c === '}' || c === ']') {
        depth--;
        if (depth === 0) {
          rows.push(line.slice(0, i + 1));
          break;
        }
      }
    }
  }
  return rows;
}

describe('размер', () => {
  it(`база не длиннее ${GRAMMAR_BASE_LIMIT} символов`, () => {
    expect(base.length).toBeLessThanOrEqual(GRAMMAR_BASE_LIMIT);
  });

  it(`грамматика целиком не длиннее ${GRAMMAR_ALL_LIMIT} символов`, () => {
    expect(all.length).toBeLessThanOrEqual(GRAMMAR_ALL_LIMIT);
  });

  it('без каталогов база не длиннее, чем с ними', () => {
    expect(intentGrammar(NO_CATALOGS).length).toBeLessThanOrEqual(GRAMMAR_BASE_LIMIT);
  });
});

describe('база и секции', () => {
  it('база перечисляет каждую секцию и то, как её получить', () => {
    expect(base).toContain('form_build {"grammar":"<section>"}');
    for (const section of GRAMMAR_SECTIONS)
      expect(base, section).toMatch(new RegExp(`\\b${section}\\b`));
  });

  it('секция по запросу — без повтора базы', () => {
    for (const section of GRAMMAR_SECTIONS) {
      const text = intentGrammar(CATALOGS, { sections: [section] });
      expect(text.startsWith(`## ${section}`), section).toBe(true);
      expect(text).not.toContain('# form.intent.json — grammar');
    }
  });

  it('всё сразу — база и каждая секция по порядку', () => {
    const order = ['# form.intent.json', ...GRAMMAR_SECTIONS.map((s) => `\n## ${s} `)].map(
      (heading) => all.indexOf(heading)
    );
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('корень визарда в образце — явный FormWizard', () => {
    expect(GRAMMAR_EXAMPLE.layoutRoot.component).toBe('FormWizard');
    expect(intentGrammar(CATALOGS, { sections: ['wizard'] })).toContain(
      '{"kind":"container","component":"FormWizard"'
    );
  });

  it('каждый образец записи — разбираемый JSON', () => {
    // Скелет верхнего уровня с заглушками `…` — схема файла, а не образец записи.
    const rows = sampleRows(all).filter((row) => !row.includes('…'));
    expect(rows.length).toBeGreaterThan(20);
    for (const row of rows) expect(() => JSON.parse(row), row).not.toThrow();
  });

  it('текст английский: кириллица только в данных ядра', () => {
    // Образец pattern из примера ядра — данные, а не текст грамматики.
    const prose = all.replace(/pattern\([^)]*\)/g, '');
    expect(prose).not.toMatch(/[А-Яа-яЁё]/);
  });

  it('не советует generate_form и ручную сборку модуля', () => {
    expect(all).not.toMatch(/generate_form|plan_form/);
  });
});

describe('readGrammarRequest', () => {
  it('true и "base" — база, "all" — всё', () => {
    expect(readGrammarRequest(true)).toBe('base');
    expect(readGrammarRequest('base')).toBe('base');
    expect(readGrammarRequest(' ALL ')).toBe('all');
  });

  it('секции — по одной и списком через запятую', () => {
    expect(readGrammarRequest('arrays')).toEqual(['arrays']);
    expect(readGrammarRequest('wizard, arrays')).toEqual(['wizard', 'arrays']);
  });

  it('незнакомое имя и не строка — null', () => {
    expect(readGrammarRequest('array')).toBeNull();
    expect(readGrammarRequest('arrays,steps')).toBeNull();
    expect(readGrammarRequest(false)).toBeNull();
    expect(readGrammarRequest(1)).toBeNull();
  });
});
