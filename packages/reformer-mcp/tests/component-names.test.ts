/**
 * Имя компонента не из кита: регистр сборка исправляет сама, имя из другой библиотеки или словами —
 * подсказка в ошибке (ReFormer-11oe.19).
 */

import { describe, expect, it } from 'vitest';
import { CATALOGS } from './support/catalogs';
import {
  didYouMean,
  suggestComponents,
  SYNONYM_GROUPS,
  synonymKey,
} from '../src/core/generate/component-names';
import { intentGrammar } from '../src/core/generate/intent-grammar';
import { judgeIntent } from '../src/core/generate/judge';

const kitNames = Object.keys(CATALOGS.uiKit.exports);

const form = (
  field: Record<string, unknown>,
  container: Record<string, unknown> = { kind: 'container', component: 'Box' }
) => ({
  formName: 'Feedback',
  target: 'renderer-react',
  fields: [{ name: 'name', type: 'string', label: 'Имя', initialValue: '', ...field }],
  layoutRoot: { ...container, children: ['name'] },
});

describe('таблица синонимов', () => {
  it('называет только компоненты, которые есть в ките', () => {
    const targets = new Set(SYNONYM_GROUPS.flatMap(([, components]) => components));
    expect([...targets].filter((name) => !kitNames.includes(name))).toEqual([]);
  });

  it('ключ — не имя кита и записан в виде synonymKey', () => {
    const kit = new Set(kitNames.map((name) => name.toLowerCase()));
    const keys = SYNONYM_GROUPS.flatMap(([synonyms]) => synonyms);
    expect(keys.filter((key) => kit.has(key))).toEqual([]);
    expect(keys.filter((key) => synonymKey(key) !== key)).toEqual([]);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('suggestComponents', () => {
  it('регистр, опечатка, синоним по-английски и по-русски', () => {
    expect(suggestComponents('input', kitNames)).toEqual(['Input']);
    expect(suggestComponents('Inptu', kitNames)).toEqual(['Input']);
    expect(suggestComponents('TextField', kitNames)).toEqual(['Input', 'Textarea']);
    expect(suggestComponents('text-field', kitNames)).toEqual(['Input', 'Textarea']);
    expect(suggestComponents('текстовое поле', kitNames)).toEqual(['Input', 'Textarea']);
    expect(suggestComponents('Dropdown', kitNames)).toEqual(['Select', 'Combobox']);
    expect(suggestComponents('выпадающий список', kitNames)).toEqual(['Select', 'Combobox']);
  });

  it('компонента нет в ките — не подсказывается; подсказать нечего — пусто', () => {
    expect(suggestComponents('Dropdown', ['Combobox', 'Input'])).toEqual(['Combobox']);
    expect(suggestComponents('TextField', ['Select'])).toEqual([]);
    expect(suggestComponents('ColorPicker', kitNames)).toEqual([]);
    expect(suggestComponents('Input', kitNames)).toEqual([]);
  });

  it('текст подсказки: одно имя, два, ни одного', () => {
    expect(didYouMean(['Input'])).toBe('did you mean `Input`?');
    expect(didYouMean(['Input', 'Textarea'])).toBe('did you mean `Input` or `Textarea`?');
    expect(didYouMean(['Box', 'Section', 'Card'])).toBe('did you mean `Box`, `Section` or `Card`?');
    expect(didYouMean([])).toBe('');
  });
});

describe('form_build: имя компонента в другом регистре', () => {
  it('поле `input` собирается как `Input` — с предупреждением, без ошибки', () => {
    const verdict = judgeIntent(form({ component: 'input' }), CATALOGS);
    expect(verdict.errors).toEqual([]);
    expect(verdict.intent.fields[0].component).toBe('Input');
    expect(verdict.warnings).toContainEqual(
      expect.objectContaining({
        code: 'component-normalized',
        message: expect.stringContaining('`input` is `Input` — component names are case-sensitive'),
      })
    );
  });

  it('`input` у числа — `InputNumber`: исправленное имя проходит те же правила, что точное', () => {
    const verdict = judgeIntent(
      form({ type: 'number', component: 'input', initialValue: 0 }),
      CATALOGS
    );
    expect(verdict.errors).toEqual([]);
    expect(verdict.intent.fields[0].component).toBe('InputNumber');
  });

  it('контейнер `card` собирается как `Card`', () => {
    const verdict = judgeIntent(
      form({ component: 'Input' }, { kind: 'container', component: 'card' }),
      CATALOGS
    );
    expect(verdict.errors).toEqual([]);
    expect(verdict.intent.layoutRoot).toMatchObject({ kind: 'container', component: 'Card' });
    expect(verdict.warnings).toContainEqual(
      expect.objectContaining({
        code: 'component-normalized',
        message: expect.stringContaining('`card` is `Card`'),
      })
    );
  });
});

describe('form_build: имя из другой библиотеки или словами', () => {
  it('ошибка остаётся, но называет компоненты кита', () => {
    const messages = (component: string) =>
      judgeIntent(form({ component }), CATALOGS).errors.map((error) => error.message);
    expect(messages('TextField')).toEqual([
      'the component `TextField` is not in @reformer/ui-kit — did you mean `Input` or `Textarea`?',
    ]);
    expect(messages('текстовое поле')).toEqual([
      'the component `текстовое поле` is not in @reformer/ui-kit — did you mean `Input` or `Textarea`?',
    ]);
  });

  it('контейнер `Stack` — `Box` или `Section`', () => {
    const verdict = judgeIntent(
      form({ component: 'Input' }, { kind: 'container', component: 'Stack' }),
      CATALOGS
    );
    expect(verdict.errors.map((error) => error.message)).toEqual([
      'the component `Stack` is not in @reformer/ui-kit — did you mean `Box` or `Section`?',
    ]);
  });

  it('grammar components:… — та же подсказка, регистр не важен', () => {
    const text = intentGrammar(CATALOGS, { sections: { components: ['TextField', 'card'] } });
    expect(text).toContain(
      '## TextField — not in @reformer/ui-kit; did you mean `Input` or `Textarea`? The list: form_build {"grammar":"components"}'
    );
    expect(text).toContain('## Card — ');
  });
});
