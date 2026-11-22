import { describe, expect, it } from 'vitest';
import { emptyRules, type FormRules } from '../form-model/rules';
import { parseRulesText } from './rules-file';
import { legacyRulesText } from '../testing';

const RULES: FormRules = {
  validation: [{ target: 'email', rules: ['required', 'email'] }],
  behavior: [{ kind: 'computeFrom', target: 'total', sources: ['a', 'b'], expr: 'a + b' }],
  render: [{ kind: 'hideWhen', selector: 'extra', condition: 'model.kind !== "pro"' }],
};

describe('прежний файл правил формы', () => {
  it('разбирается без потерь', () => {
    expect(parseRulesText(legacyRulesText(RULES))).toEqual({ ok: true, rules: RULES });
  });

  it('без правил — пустые правила', () => {
    expect(parseRulesText(legacyRulesText(emptyRules()))).toEqual({
      ok: true,
      rules: emptyRules(),
    });
  });

  it('битый JSON и корень не-объект — отказ, а не «правил нет»', () => {
    expect(parseRulesText('{ "validation": [').ok).toBe(false);
    expect(parseRulesText('[]').ok).toBe(false);
    expect(parseRulesText('null').ok).toBe(false);
  });

  it('прежний ключ visibility сворачивается в правило узла', () => {
    const parsed = parseRulesText(
      JSON.stringify({ visibility: [{ selector: 'extra', condition: 'model.a' }] })
    );
    expect(parsed.ok && parsed.rules.render).toEqual([
      { kind: 'hideWhen', selector: 'extra', condition: 'model.a' },
    ]);
  });

  it('значения источников данных читаются', () => {
    const rules: FormRules = {
      ...emptyRules(),
      dataSources: { CITIES: [{ value: 'msk', label: 'Москва' }] },
    };
    expect(parseRulesText(legacyRulesText(rules))).toEqual({ ok: true, rules });
  });
});
