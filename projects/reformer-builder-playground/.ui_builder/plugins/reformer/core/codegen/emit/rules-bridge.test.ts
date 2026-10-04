import { describe, expect, it } from 'vitest';
import { wizardRules, wizardRulesSchema, builtinKit } from '../__fixtures__/kit';
import { prepare } from '../context';
import { stepOfRule, stepValidationFromRules, wizardValidationFromRules } from './rules-bridge';

function wizardCtx() {
  return prepare({
    schema: wizardRulesSchema(),
    formName: 'Анкета',
    kit: builtinKit(),
    rules: wizardRules(),
  });
}

describe('правила визарда по шагам', () => {
  it('правило идёт к шагу по своей цели; вне шагов — никуда', () => {
    const ctx = wizardCtx();
    const [fullName, email, phone, comment] = ctx.rules.validation;
    expect(stepOfRule(fullName!, ctx.layout)?.dir).toBe('dannye');
    expect(stepOfRule(email!, ctx.layout)?.dir).toBe('kontakty');
    // Условие читает другое поле шага — принадлежность решает цель.
    expect(stepOfRule(phone!, ctx.layout)?.dir).toBe('kontakty');
    expect(stepOfRule(comment!, ctx.layout)).toBeUndefined();
  });

  it('файл шага печатает только свои правила и импортирует тип из корня', () => {
    const ctx = wizardCtx();
    const code = stepValidationFromRules(ctx.rules, ctx.names, ctx.layout, ctx.layout.steps[1]!);
    expect(code).toContain('export const stepValidation');
    expect(code).toContain('model.$.contacts.email');
    expect(code).not.toContain('model.$.fullName');
    expect(code).toContain("from '../../types'");
  });

  it('шаг без своих правил отдаёт null — заготовку печатает шаблон', () => {
    const ctx = wizardCtx();
    const rules = { ...ctx.rules, validation: ctx.rules.validation.slice(1) };
    expect(stepValidationFromRules(rules, ctx.names, ctx.layout, ctx.layout.steps[0]!)).toBeNull();
  });

  it('корень: правила вне шагов + сборка шагов + пошаговый контракт', () => {
    const ctx = wizardCtx();
    const code = wizardValidationFromRules(ctx.rules, ctx.names, ctx.layout) ?? '';
    expect(code).toContain('export const restValidation');
    expect(code).toContain('model.$.comment');
    expect(code).not.toContain('model.$.fullName');
    expect(code).toContain('apply(...stepValidations, restValidation)');
    expect(code).toContain('export function makeValidationConfig');
    expect(code).toMatch(/import \{[^}]*\bapply\b[^}]*\} from '@reformer\/core\/validation'/);
    expect(code).toContain("import { stepValidations } from './steps';");
  });

  it('все правила в шагах — корень печатает шаблон-агрегатор (null)', () => {
    const ctx = wizardCtx();
    const rules = { ...ctx.rules, validation: ctx.rules.validation.slice(0, 3) };
    expect(wizardValidationFromRules(rules, ctx.names, ctx.layout)).toBeNull();
  });
});
