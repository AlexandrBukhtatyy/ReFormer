import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { getAt } from '../../../model';
import { P, sampleSchema } from '../../../model/__fixtures__/sample-schema';
import { createEditorToolRegistry } from '../index';
import type { ToolContext } from '../types';

const reg = createEditorToolRegistry();

const ctx = (schema: JsonFormSchema = sampleSchema()): ToolContext => ({
  draft: schema,
  base: schema,
});

describe('get_form_outline', () => {
  it('отдаёт карту с адресами узлов', () => {
    const res = reg.invoke('get_form_outline', {}, ctx());
    expect(res.ok).toBe(true);
    expect(res.text).toContain('/root/componentProps/steps/0');
  });
});

describe('get_form_node', () => {
  it('отдаёт узел без дочерних поддеревьев, но сообщает об их наличии', () => {
    const res = reg.invoke('get_form_node', { ref: '/root/componentProps/steps/0' }, ctx());
    expect(res.ok).toBe(true);
    expect(res.text).toContain('"$component(Step)"');
    // Дети опущены — иначе точечный запрос выгружал бы всю форму.
    expect(res.text).not.toContain('loanType');
    expect(res.text).toContain('children: 2');
  });

  it('componentProps.steps не утекают в ответ по корню', () => {
    const res = reg.invoke('get_form_node', { ref: '/root' }, ctx());
    expect(res.text).not.toContain('$component(Step)');
    expect(res.text).toContain('steps: 2');
    // Остальные componentProps сохраняются.
    expect(res.text).toContain('bg-white');
  });

  it('битый адрес → STALE_POINTER', () => {
    const res = reg.invoke('get_form_node', { ref: '/root/children/9' }, ctx());
    expect(res.error?.code).toBe('STALE_POINTER');
  });
});

describe('describe_component', () => {
  it('выдуманное имя → UNKNOWN_COMPONENT с подсказками', () => {
    const res = reg.invoke('describe_component', { name: 'TextInput' }, ctx());
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('UNKNOWN_COMPONENT');
    expect(res.error?.suggestions?.length).toBeGreaterThan(0);
  });
});

describe('list_components', () => {
  it('роль отражена в выводе', () => {
    const res = reg.invoke('list_components', { role: 'field' }, ctx());
    expect(res.ok).toBe(true);
    expect(res.text).toContain('(field)');
  });

  it('недопустимое значение role отклоняется схемой', () => {
    expect(reg.invoke('list_components', { role: 'widget' }, ctx()).error?.code).toBe(
      'INVALID_PARAMS'
    );
  });
});

describe('validate_form', () => {
  it('компонент, выдуманный агентом, падает гейтом', () => {
    // База — то, что было у пользователя; черновик — то, что предложил агент.
    const base = sampleSchema();
    const draft = sampleSchema();
    const children = getAt(draft, P.step0children) as unknown[];
    children.push({ value: '$model(email)', component: '$component(EmailField)' });

    const res = reg.invoke('validate_form', {}, { base, draft });
    expect(res.ok).toBe(true);
    expect(res.text).toContain('EmailField');
  });

  it('нетронутая форма валидна, хотя её компонентов нет в каталоге билдера', () => {
    const res = reg.invoke('validate_form', {}, ctx());
    expect(res.text).toContain('ошибок нет');
  });
});
