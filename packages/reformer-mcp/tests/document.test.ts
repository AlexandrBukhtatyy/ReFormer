/**
 * Документ формы: грамматика профиля `document` и то, что документ держит (аудит 2026-11, D3, D4;
 * план — фаза 4). Потребитель — ассистент конструктора (`build_form`).
 */

import { describe, expect, it } from 'vitest';
import { CATALOGS } from './support/catalogs';
import { NO_CORE_OPERATORS } from '../src/core/generate/core-operators';
import { GRAMMAR_EXAMPLE } from '../src/core/generate/intent-grammar';
import {
  DOCUMENT_GRAMMAR_EXAMPLE,
  DOCUMENT_GRAMMAR_LIMIT,
  documentCapabilities,
  INTENT_CONTRACT_VERSION,
  intentGrammar,
  judgeIntent,
  readIntent,
} from '../src/core/intent';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const read = (raw: unknown) => readIntent(raw, { uiKit: CATALOGS.uiKit }).intent;
const document = (catalogs = CATALOGS) => intentGrammar(catalogs, { profile: 'document' });

describe('грамматика документа', () => {
  it.each([
    ['с индексом ядра', CATALOGS],
    ['без индекса ядра — как у ассистента конструктора', { ...CATALOGS, core: NO_CORE_OPERATORS }],
  ])('%s — не длиннее потолка', (_name, catalogs) => {
    expect(document(catalogs).length).toBeLessThanOrEqual(DOCUMENT_GRAMMAR_LIMIT);
  });

  it('без таргета, разметки JSX, начальных значений и кода модуля', () => {
    const text = document();
    for (const absent of ['index.tsx', 'initialValue', '"type":', '"kind":"call"']) {
      expect(text).not.toContain(absent);
    }
    // `target` правил и связей — путь модели; стека у документа нет.
    expect(text).not.toMatch(/"target":"(core|renderer-react|renderer-json)"/);
    expect(text).not.toMatch(/form_build|form\.intent\.json/);
  });

  it('без индекса ядра называет ходовые правила, а не «индекс не найден»', () => {
    const text = document({ ...CATALOGS, core: NO_CORE_OPERATORS });
    expect(text).toContain('- rules: required email minLength(n)');
    expect(text).not.toContain('not found');
  });

  it('строки — из примера документа, и пример проходит судью документа начисто', () => {
    expect(document()).toContain(JSON.stringify(DOCUMENT_GRAMMAR_EXAMPLE.arrays[0]));
    const verdict = judgeIntent(clone(DOCUMENT_GRAMMAR_EXAMPLE), CATALOGS, { forDocument: true });
    expect(verdict.errors).toEqual([]);
    expect(verdict.warnings).toEqual([]);
  });
});

describe('что держит документ', () => {
  it('код модуля — ошибки not-in-document; событие компонента документ держит', () => {
    const { errors } = documentCapabilities(read(clone(GRAMMAR_EXAMPLE)));
    expect(errors.map((error) => error.at)).toEqual([
      'operators',
      'validation[8].call',
      'behavior: call price',
      'behavior: renderEffect',
      'behavior: onInit mortgage-section',
      'behavior: onMount wizard',
      'behavior: onUnmount wizard',
    ]);
    expect(new Set(errors.map((error) => error.code))).toEqual(new Set(['not-in-document']));
    expect(errors.every((error) => error.hint !== undefined)).toBe(true);
  });

  it('severity и params кросс-проверки — ошибка: документ читает её обратно только с кодом', () => {
    const { errors } = documentCapabilities(
      read({
        fields: [
          { name: 'a', component: 'Input', label: 'A' },
          { name: 'b', component: 'Input', label: 'B' },
        ],
        layoutRoot: { kind: 'container', component: 'Box', children: ['a', 'b'] },
        validation: [
          {
            target: 'b',
            cross: 'values.b !== values.a',
            code: 'same',
            message: 'Must differ from {a}',
            severity: 'warning',
            params: { a: 'values.a' },
          },
        ],
      })
    );
    expect(errors).toEqual([
      expect.objectContaining({
        at: 'validation[0].severity',
        message: expect.stringContaining('severity and params'),
      }),
    ]);
  });

  it('начальные значения, стартовые строки и справочник без значений — заметки not-kept', () => {
    const { errors, notes } = documentCapabilities(
      read({
        fields: [
          { name: 'a', component: 'Input', label: 'A', initialValue: 'x' },
          { name: 'kind', component: 'Select', label: 'Kind', optionsSource: 'KINDS' },
        ],
        arrays: [
          {
            name: 'rows',
            initialValue: [{ c: '' }],
            itemFields: [{ name: 'c', component: 'Input', label: 'C' }],
          },
        ],
        layoutRoot: {
          kind: 'container',
          component: 'Box',
          children: ['a', 'kind', { kind: 'array', ref: 'rows' }],
        },
        dataSources: [{ name: 'KINDS' }],
      })
    );
    expect(errors).toEqual([]);
    expect(notes.map((note) => [note.code, note.at])).toEqual([
      ['not-kept', 'fields'],
      ['not-kept', 'arrays'],
      ['not-kept', 'dataSources[0]'],
    ]);
  });

  it('пустые стартовые строки в пределах minItems документ держит — заметки нет', () => {
    const arrays = (initialValue: unknown[], minItems?: number) =>
      documentCapabilities(
        read({
          fields: [],
          arrays: [
            {
              name: 'rows',
              initialValue,
              ...(minItems === undefined ? {} : { componentProps: { minItems } }),
              itemFields: [{ name: 'c', component: 'Input', label: 'C' }],
            },
          ],
          layoutRoot: {
            kind: 'container',
            component: 'Box',
            children: [{ kind: 'array', ref: 'rows' }],
          },
        })
      ).notes.map((note) => note.at);
    expect(arrays([{ c: '' }], 1)).toEqual([]);
    // Строк больше минимума или в строке значение — не держит, и заметка называет minItems.
    expect(arrays([{ c: '' }, { c: '' }], 1)).toEqual(['arrays']);
    expect(arrays([{ c: 'x' }], 1)).toEqual(['arrays']);
    const [note] = documentCapabilities(
      read({
        fields: [],
        arrays: [
          {
            name: 'rows',
            initialValue: [{ c: '' }],
            itemFields: [{ name: 'c', component: 'Input', label: 'C' }],
          },
        ],
        layoutRoot: {
          kind: 'container',
          component: 'Box',
          children: [{ kind: 'array', ref: 'rows' }],
        },
      })
    ).notes;
    expect(note.message).toContain('"minItems"');
  });

  it('судья документа включает их в вердикт, судья модуля — нет', () => {
    const asDocument = judgeIntent(clone(GRAMMAR_EXAMPLE), CATALOGS, { forDocument: true });
    expect(asDocument.ok).toBe(false);
    expect(asDocument.errors.map((error) => error.code)).toContain('not-in-document');
    expect(asDocument.warnings.map((warning) => warning.code)).toContain('not-kept');

    const asModule = judgeIntent(clone(GRAMMAR_EXAMPLE), CATALOGS);
    expect(asModule.errors).toEqual([]);
  });
});

it('версия контракта intent открыта в точке входа', () => {
  expect(INTENT_CONTRACT_VERSION).toBe(1);
});
