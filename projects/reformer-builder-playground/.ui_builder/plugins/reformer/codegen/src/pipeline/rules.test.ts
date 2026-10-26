import { describe, expect, it } from 'vitest';
import { legacyRulesText as printRulesText } from '../../../core/testing';
import { readFormRules, RulesFileError, type RulesFilePort } from './rules';

const RULES = {
  validation: [{ target: 'fullName', rules: ['required'] }],
  behavior: [],
  render: [],
};

/** Рабочая область как карта «путь → текст»; адрес — сам путь. */
function port(texts: Record<string, string>): RulesFilePort {
  return {
    parentOf: (id) => id.slice(0, Math.max(0, id.lastIndexOf('/'))),
    resolve: (dir, ...segments) => [dir, ...segments].filter(Boolean).join('/'),
    readText: (id) => Promise.resolve(texts[id] ?? null),
  };
}

describe('правила формы для прогона — файл рядом с документом', () => {
  it('нет файла — нет правил', async () => {
    expect(
      await readFormRules(
        port({}),
        'forms/loan/schema/form.schema.json',
        'forms/loan/schema/form.schema.json'
      )
    ).toBeNull();
  });

  it('файл рядом с документом разбирается; у свободного имени — свой файл', async () => {
    const files = port({
      'forms/loan/schema/form.rules.json': printRulesText(RULES),
      'forms/credit.rules.json': printRulesText(RULES),
    });
    const nested = 'forms/loan/schema/form.schema.json';
    expect(await readFormRules(files, nested, nested)).toEqual(RULES);
    const detached = 'forms/credit.schema.json';
    expect(await readFormRules(files, detached, detached)).toEqual(RULES);
  });

  it('битый файл — исключение с адресом файла, а не «правил нет»', async () => {
    const files = port({ 'forms/loan/form.rules.json': '{ broken' });
    const doc = 'forms/loan/form.schema.json';
    await expect(readFormRules(files, doc, doc)).rejects.toBeInstanceOf(RulesFileError);
    await expect(readFormRules(files, doc, doc)).rejects.toThrow('forms/loan/form.rules.json');
  });
});
