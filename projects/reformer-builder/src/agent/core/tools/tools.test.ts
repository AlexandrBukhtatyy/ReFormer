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

describe('describe_component для имён вне каталога', () => {
  it('компонент из реестра проекта объясняется, а не отвергается', () => {
    // Корень реальных схем и фикстуры — RendererFormWizard: каталогу билдера он неизвестен, но в
    // форме законен и гейтом пропускается. Ответ «нет в каталоге» про узел, который прямо сейчас
    // стоит в форме, читался как «форма сломана».
    const res = reg.invoke('describe_component', { name: 'RendererFormWizard' }, ctx());
    expect(res.ok).toBe(true);
    expect(res.text).toContain('get_form_node');
  });

  it('выдуманное имя по-прежнему отвергается', () => {
    const res = reg.invoke('describe_component', { name: 'EmailField' }, ctx());
    expect(res.error?.code).toBe('UNKNOWN_COMPONENT');
  });
});

describe('expect в write-инструментах', () => {
  it('null в expect — это «не проверять», а не ошибка аргументов', () => {
    // Модели заполняют объект целиком и ставят null там, где проверять нечего (у контейнера нет
    // модели). В живом прогоне такой вызов дважды отвергался как INVALID_PARAMS — два шага хода
    // из двадцати четырёх ушли на форму записи, а не на работу.
    const res = reg.invoke(
      'remove_node',
      {
        ref: '/root/componentProps/steps/0/children/0',
        expect: { component: 'Select', model: null },
      },
      ctx()
    );
    expect(res.error?.code).not.toBe('INVALID_PARAMS');
    expect(res.ok).toBe(true);
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
    expect(res.text).toContain('no errors');
  });

  it('адрес ошибки — тот же диалект, которым правят инструменты', () => {
    // Валидатор адресует точками (root.children[0]), write-инструменты — JSON Pointer. Пока
    // трансляции не было, модель получала диагноз, который некуда подставить.
    const base = sampleSchema();
    const draft = sampleSchema();
    const field = getAt(draft, [...P.step0field1]) as { componentProps: Record<string, unknown> };
    field.componentProps = { ...field.componentProps, labl: 'опечатка' };

    const res = reg.invoke('validate_form', {}, { base, draft });
    expect(res.text).toContain('/root/componentProps/steps/0/children/1');
    expect(res.text).not.toContain('root.componentProps');
    // Рядом с адресом — компонент: он же нужен для expect в следующей правке.
    expect(res.text).toContain('(Input)');
  });

  it('свойство, из-за которого ошибка, названо явно', () => {
    const base = sampleSchema();
    const draft = sampleSchema();
    const field = getAt(draft, [...P.step0field1]) as { componentProps: Record<string, unknown> };
    field.componentProps = { ...field.componentProps, min: 'не-число' };

    const res = reg.invoke('validate_form', {}, { base, draft });
    expect(res.text).toContain('min');
  });
});
