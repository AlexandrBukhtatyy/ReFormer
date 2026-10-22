import { describe, expect, it, vi } from 'vitest';
import type { ResourceId } from '@reformer/builder-plugin-api';
import { createRulesCache, type RulesCachePort } from '../../core/codegen/rules-cache';
import { emptyRulesText, printRulesText } from '../../core/codegen/rules-file';
import { schemaRulesPort } from './host-from-context';

const DOC = 'forms/loan/schema/form.schema.json';
const FILE = 'forms/loan/schema/form.rules.json';
const RULES = { validation: [{ target: 'a', rules: ['required'] }], behavior: [], render: [] };

function setup() {
  const texts = new Map<string, string>([[FILE, printRulesText(RULES)]]);
  const port: RulesCachePort = {
    parentOf: (id) => id.slice(0, id.lastIndexOf('/')),
    resolve: (dir, ...segments) => [dir, ...segments].join('/'),
    readText: (id) => Promise.resolve(texts.get(id) ?? null),
    onDidChange: () => ({ dispose: () => {} }),
  };
  const writeText = vi.fn((id: ResourceId, text: string) => {
    texts.set(id, text);
    return Promise.resolve();
  });
  const documents = {
    documentOf: (id: ResourceId) => (id === DOC ? ({ ref: { path: DOC } } as never) : null),
    writeText,
  };
  return { rules: schemaRulesPort(createRulesCache(port), documents), writeText, texts };
}

describe('порт правил редактора над файлом правил', () => {
  it('правила документа — из файла рядом с ним, когда кэш его дочитал', async () => {
    const { rules } = setup();
    expect(rules.get(DOC)).toBeNull();
    await vi.waitFor(() => expect(rules.get(DOC)).toEqual(RULES));
    expect(rules.get('other.json')).toBeNull();
  });

  it('запись — правка рабочей копии рядом с документом, и кэш видит её сразу', () => {
    const { rules, writeText, texts } = setup();
    const empty = { validation: [], behavior: [], render: [] };
    rules.set(DOC, empty);

    expect(writeText).toHaveBeenCalledWith(FILE, emptyRulesText());
    expect(texts.get(FILE)).toBe(emptyRulesText());
    expect(rules.get(DOC)).toEqual(empty);
  });
});
