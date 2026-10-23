/**
 * Стек ReFormer в шаблонах: ответы на вопросы хозяина без хозяина.
 *
 * @module plugins/reformer/templates/stack.test
 */

import { describe, expect, it } from 'vitest';
import { plainSchema } from '../../core/testing';
import { MODULE_TOKENS } from './names';
import { TEMPLATE_STACK_ID } from './stack';
import { reformerStack } from './testing';

const stack = reformerStack();
const schema = { path: 'schema/form.schema.json', content: JSON.stringify(plainSchema()) };

describe('стек ReFormer в шаблонах', () => {
  it('тот же идентификатор, что у стека в генерации кода', () => {
    expect(stack.id).toBe(TEMPLATE_STACK_ID);
    expect(TEMPLATE_STACK_ID).toBe('reformer');
  });

  it('узнаёт набор по документу формы и называет его', () => {
    const files = [{ path: 'model.ts', content: '' }, schema];
    expect(stack.owns(files)).toBe(true);
    expect(stack.documentOf(files)).toBe(schema);
    expect(stack.owns([{ path: 'package.json', content: '{"name":"x"}' }])).toBe(false);
    expect(stack.documentOf([{ path: 'a.ts', content: '' }])).toBeNull();
  });

  it('вид формы — только с китом и документом', () => {
    expect(stack.view?.([schema], 'Анкета')).not.toBeNull();
    expect(stack.view?.([{ path: 'a.ts', content: '' }], 'Анкета')).toBeNull();
    expect(reformerStack({ kit: null }).view?.([schema], 'Анкета')).toBeNull();
  });

  it('токены имён модуля — значения генерации для формы', () => {
    expect(stack.tokens?.('loan request')).toEqual({
      [MODULE_TOKENS.type]: 'LoanRequestForm',
      [MODULE_TOKENS.typeCamel]: 'loanRequestForm',
      [MODULE_TOKENS.dir]: 'loan-request',
      [MODULE_TOKENS.title]: 'Loan request',
    });
  });

  it('пустая форма — один документ в schema/ с пустым корнем, и этот документ стек узнаёт', () => {
    const empty = stack.empty?.();
    expect(empty?.files.map((file) => file.path)).toEqual(['schema/form.schema.json']);
    expect(JSON.parse(empty?.files[0]?.content ?? '')).toMatchObject({
      format: 2,
      root: { children: [] },
    });
    expect(stack.owns(empty?.files ?? [])).toBe(true);
  });

  it('глубина документа в модуле: папка ролей — 1, корень модуля — 0, свободное имя — модуля нет', () => {
    expect(stack.moduleDepthOf?.('forms/loan/schema/form.schema.json')).toBe(1);
    expect(stack.moduleDepthOf?.('forms/contact/form.schema.json')).toBe(0);
    expect(stack.moduleDepthOf?.('forms/contact/renderer.schema.json')).toBe(0);
    expect(stack.moduleDepthOf?.('forms/credit.schema.json')).toBeNull();
  });

  it('каталог фикстуры — корень модуля документа', () => {
    expect(stack.fixtureDirOf?.('schema/form.schema.json')).toBe('');
    expect(stack.fixtureDirOf?.('form.schema.json')).toBe('');
  });
});
