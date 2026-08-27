/**
 * Маркер происхождения и стабильность регенерации.
 *
 * Оба свойства — предусловия редактора схем: на них держатся «вернуть к правилам» (дифф считается
 * от текста, который реально лежит в копии) и «правки не затираются» (перезаписываем только своё).
 * Нестабильная генерация дала бы дифф там, где правок не было, и пользователь перестал бы верить
 * пометке «правлен руками».
 */

import { describe, expect, it } from 'vitest';
import { emptyRules, type FormRules } from '../model/rules';
import { exampleSchema } from './__fixtures__/example-schema';
import {
  asRecord,
  isGenerated,
  originOf,
  regenerateFile,
  regenerateModule,
  withMarker,
} from './regenerate';

const rules = (): FormRules => ({
  ...emptyRules(),
  validation: [{ target: 'amount', rules: ['required'] }],
});

describe('маркер происхождения', () => {
  it('сгенерированный текст опознаётся своим', () => {
    const text = withMarker('export const a = 1;\n');
    expect(originOf(text)).toBe('generated');
    expect(isGenerated(text)).toBe(true);
  });

  it('правка тела ломает хэш — файл становится «правлен руками»', () => {
    const text = withMarker('export const a = 1;\n') + 'export const b = 2;\n';
    expect(originOf(text)).toBe('edited');
    expect(isGenerated(text)).toBe(false);
  });

  it('файл без маркера считается рукописным — это и есть «открыли чужой проект»', () => {
    expect(originOf('export const formValidation = 1;\n')).toBe('handwritten');
    expect(originOf(null)).toBe('handwritten');
  });

  it('повторная пометка не наслаивает маркеры', () => {
    const once = withMarker('body\n');
    const twice = withMarker(once);
    expect(twice).toBe(once);
    expect(twice.split('@reformer-generated')).toHaveLength(2);
  });

  it('разные тела дают разные хэши', () => {
    const a = withMarker('export const a = 1;\n');
    const b = withMarker('export const a = 2;\n');
    expect(a).not.toBe(b);
  });
});

describe('regenerateModule — чистая функция', () => {
  it('два вызова подряд дают побайтово тот же набор', async () => {
    const first = asRecord(await regenerateModule(exampleSchema, rules(), 'loan'));
    const second = asRecord(await regenerateModule(exampleSchema, rules(), 'loan'));
    // Ровно это свойство и означает «нет правок — нет диффа». Без него `synthMock` брал бы
    // `new Date()`, и форма с полем-датой давала бы новый `model.ts` при каждой синхронизации.
    expect(second).toEqual(first);
  });

  it('все три схемы формы помечены маркером', async () => {
    const files = asRecord(await regenerateModule(exampleSchema, rules(), 'loan'));
    for (const name of ['validation.ts', 'form.behavior.ts', 'renderer.behavior.ts']) {
      expect(isGenerated(files[name])).toBe(true);
    }
  });

  it('заготовки под бэкенд маркера НЕ несут — регенерировать их не из чего', async () => {
    const files = asRecord(await regenerateModule(exampleSchema, rules(), 'loan'));
    expect(originOf(files['api.ts'])).toBe('handwritten');
    expect(originOf(files['data-sources.ts'])).toBe('handwritten');
  });

  it('правила доезжают до текста', async () => {
    const out = await regenerateFile('validation.ts', exampleSchema, rules(), 'loan');
    expect(out).toContain('amount');
    expect(out).toContain('required');
  });

  it('форматирование — часть генерации, а не доставки', async () => {
    const out = (await regenerateFile('validation.ts', exampleSchema, rules(), 'loan'))!;
    // Дифф обязан считаться от того же текста, что лежит в рабочей копии; форматирование «потом»
    // означало бы, что первый же экспорт покажет расхождение на ровном месте.
    expect(out).not.toContain('\t');
    expect(out.split('\n').every((l) => l.length <= 120)).toBe(true);
  });

  it('смена правил меняет только свой файл', async () => {
    const a = asRecord(await regenerateModule(exampleSchema, emptyRules(), 'loan'));
    const b = asRecord(await regenerateModule(exampleSchema, rules(), 'loan'));
    expect(b['validation.ts']).not.toBe(a['validation.ts']);
    expect(b['types.ts']).toBe(a['types.ts']);
    expect(b['registry.ts']).toBe(a['registry.ts']);
  });
});
