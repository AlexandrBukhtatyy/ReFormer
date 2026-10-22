import { describe, expect, it } from 'vitest';
import { emptyRules, type FormRules } from '../form-model/rules';
import { emptyRulesText, parseRulesText, printRulesText } from './rules-file';

const RULES: FormRules = {
  validation: [{ target: 'email', rules: ['required', 'email'] }],
  behavior: [{ kind: 'computeFrom', target: 'total', sources: ['a', 'b'], expr: 'a + b' }],
  render: [{ kind: 'hideWhen', selector: 'extra', condition: 'model.kind !== "pro"' }],
};

describe('файл правил формы', () => {
  it('печать и разбор — круг без потерь', () => {
    const parsed = parseRulesText(printRulesText(RULES));
    expect(parsed).toEqual({ ok: true, rules: RULES });
  });

  it('печать детерминирована и несёт версию формата', () => {
    const text = printRulesText(RULES);
    expect(printRulesText(structuredClone(RULES))).toBe(text);
    expect(JSON.parse(text)).toMatchObject({ version: 1 });
    expect(text.endsWith('\n')).toBe(true);
  });

  it('пустой набор — отдельный текст, и он разбирается в пустые правила', () => {
    expect(parseRulesText(emptyRulesText())).toEqual({ ok: true, rules: emptyRules() });
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
});
