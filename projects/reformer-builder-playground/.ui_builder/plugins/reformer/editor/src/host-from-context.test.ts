import { describe, expect, it, vi } from 'vitest';
import { withMarker } from '@reformer/builder-toolkit';
import type {
  GenerateRequest,
  ModuleGeneratorService,
  ResourceId,
} from '@reformer/builder-plugin-api';
import { createRulesCache, type RulesCachePort } from '../../core/codegen/rules-cache';
import { RULE_TARGET_IDS } from '../../core/codegen/rules-code';
import { schemaRulesPort } from './host-from-context';

const DOC = 'forms/loan/schema/form.schema.json';
const FORM_RULES = 'forms/loan/validation/form.ts';
const RULES = { validation: [{ target: 'a', rules: ['required()'] }], behavior: [], render: [] };

function setup(options: { readonly generator?: boolean } = {}) {
  const texts = new Map<string, string>([
    [
      FORM_RULES,
      withMarker(
        "import { defineValidation, validate } from '@reformer/core/validation';\n" +
          "import { required } from '@reformer/core/validators';\n\n" +
          'export const formRules = defineValidation<LoanForm>(({ model }) => {\n' +
          '  validate(model.$.a, [required()]);\n' +
          '});\n'
      ),
    ],
  ]);
  const port: RulesCachePort = {
    parentOf: (id) => id.slice(0, id.lastIndexOf('/')),
    resolve: (dir, ...segments) => [dir, ...segments].join('/'),
    readText: (id) => Promise.resolve(texts.get(id) ?? null),
    onDidChange: () => ({ dispose: () => {} }),
  };
  const documents = {
    documentOf: (id: ResourceId) => (id === DOC ? ({ ref: { path: DOC } } as never) : null),
  };
  const requests: GenerateRequest[] = [];
  const generator: ModuleGeneratorService = {
    generate: (_id, request = {}) => {
      requests.push(request);
      return Promise.resolve({
        ok: true,
        formName: 'loan',
        dir: 'forms/loan',
        written: [],
        skipped: [],
        failed: [],
      });
    },
  };
  const rules = schemaRulesPort(createRulesCache(port), documents, () =>
    options.generator === false ? undefined : generator
  );
  return { rules, requests };
}

describe('порт правил редактора над кодом модуля', () => {
  it('правила документа — из кода его модуля, когда кэш его дочитал', async () => {
    const { rules } = setup();
    expect(rules.get(DOC)).toBeNull();
    await vi.waitFor(() => expect(rules.get(DOC)).toEqual(RULES));
    expect(rules.get('other.json')).toBeNull();
  });

  it('запись — генерацией только файлов правил, с правилами вместо прочитанных', () => {
    const { rules, requests } = setup();
    const empty = { validation: [], behavior: [], render: [] };

    expect(rules.set(DOC, empty)).toBe(true);
    expect(requests).toEqual([
      { stackInput: { stack: 'reformer', value: { rules: empty } }, only: RULE_TARGET_IDS },
    ]);
  });

  it('без генерации кода записать нечем — отказ', () => {
    const { rules, requests } = setup({ generator: false });
    expect(rules.set(DOC, { validation: [], behavior: [], render: [] })).toBe(false);
    expect(requests).toEqual([]);
  });
});
