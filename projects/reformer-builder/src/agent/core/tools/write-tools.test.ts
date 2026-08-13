import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { emptySchema, getAt } from '../../../model';
import { P, sampleSchema } from '../../../model/__fixtures__/sample-schema';
import { listComponents } from '../catalog-digest';
import { createEditorToolRegistry } from '../index';
import { buildOutline } from '../outline';
import type { ToolContext, ToolOutcome } from '../types';

const reg = createEditorToolRegistry();

/** Первое поле каталога — тесты не должны зависеть от конкретного кита. */
const FIELD = listComponents({ role: 'field' })[0].name;

const ctxOf = (draft: JsonFormSchema, base = draft): ToolContext => ({ draft, base });

/** Вызвать инструмент и потребовать успех (иначе тест упадёт с текстом ошибки). */
function expectOk(res: ToolOutcome): JsonFormSchema {
  expect(res.error?.code, res.text).toBeUndefined();
  expect(res.schema).toBeDefined();
  return res.schema as JsonFormSchema;
}

describe('insert_node', () => {
  it('выдуманный компонент отклоняется с подсказками', () => {
    const res = reg.invoke(
      'insert_node',
      { component: 'EmailField', parent: '/root' },
      ctxOf(emptySchema())
    );
    expect(res.error?.code).toBe('UNKNOWN_COMPONENT');
    // Имя может не походить ни на что в каталоге — тогда путь восстановления называется прямо.
    expect(res.text).toContain('list_components');
    expect(res.schema).toBeUndefined();
  });

  it('вставляет поле с привязкой и свойствами', () => {
    const schema = expectOk(
      reg.invoke(
        'insert_node',
        {
          component: FIELD,
          parent: '/root',
          model: 'applicant.email',
          props: { label: 'Email' },
        },
        ctxOf(emptySchema())
      )
    );
    const outline = buildOutline(schema);
    expect(outline[1]).toMatchObject({
      ref: '/root/children/0',
      component: FIELD,
      model: 'applicant.email',
      label: 'Email',
    });
  });

  it('index задаёт позицию, по умолчанию — в конец', () => {
    let schema = expectOk(
      reg.invoke(
        'insert_node',
        { component: FIELD, parent: '/root', props: { label: 'Первое' } },
        ctxOf(emptySchema())
      )
    );
    schema = expectOk(
      reg.invoke(
        'insert_node',
        { component: FIELD, parent: '/root', props: { label: 'Второе' } },
        ctxOf(schema)
      )
    );
    schema = expectOk(
      reg.invoke(
        'insert_node',
        { component: FIELD, parent: '/root', index: 0, props: { label: 'Нулевое' } },
        ctxOf(schema)
      )
    );
    expect(
      buildOutline(schema)
        .slice(1)
        .map((e) => e.label)
    ).toEqual(['Нулевое', 'Первое', 'Второе']);
  });

  it('в мастер вставка идёт в шаги, а не в children — правило размещения знает редактор', () => {
    const base = sampleSchema();
    const schema = expectOk(
      reg.invoke('insert_node', { component: 'Step', parent: '/root' }, ctxOf(base))
    );
    expect(buildOutline(schema).map((e) => e.ref)).toContain('/root/componentProps/steps/2');
  });

  it('поле детей не принимает', () => {
    const res = reg.invoke(
      'insert_node',
      { component: FIELD, parent: '/root/componentProps/steps/0/children/0' },
      ctxOf(sampleSchema())
    );
    expect(res.error?.code).toBe('INVALID_PARENT');
  });
});

describe('set_node_prop', () => {
  const ref = '/root/componentProps/steps/0/children/0';

  it('задаёт свойство', () => {
    const schema = expectOk(
      reg.invoke('set_node_prop', { ref, key: 'required', value: true }, ctxOf(sampleSchema()))
    );
    expect(buildOutline(schema).find((e) => e.ref === ref)?.required).toBe(true);
  });

  it('null удаляет свойство', () => {
    const schema = expectOk(
      reg.invoke('set_node_prop', { ref, key: 'label', value: null }, ctxOf(sampleSchema()))
    );
    expect(buildOutline(schema).find((e) => e.ref === ref)?.label).toBeUndefined();
  });

  it('несовпавшее expect отклоняет правку, схема не тронута', () => {
    const draft = sampleSchema();
    const res = reg.invoke(
      'set_node_prop',
      { ref, key: 'required', value: true, expect: { model: 'loanAmount' } },
      ctxOf(draft)
    );
    expect(res.error?.code).toBe('STALE_POINTER');
    expect(res.schema).toBeUndefined();
  });

  it('значение неверного типа не проходит гейт', () => {
    // Input.min — число; строка ломает componentProps-валидацию.
    const schema = expectOk(
      reg.invoke(
        'insert_node',
        { component: 'Input', parent: '/root', model: 'x' },
        ctxOf(emptySchema())
      )
    );
    const res = reg.invoke(
      'set_node_prop',
      { ref: '/root/children/0', key: 'min', value: 'не-число' },
      ctxOf(schema, emptySchema())
    );
    expect(res.error?.code).toBe('SCHEMA_INVALID');
    expect(res.schema).toBeUndefined();
  });

  it('непричастные узлы сохраняют ссылочную идентичность', () => {
    const base = sampleSchema();
    const schema = expectOk(
      reg.invoke('set_node_prop', { ref, key: 'required', value: true }, ctxOf(base))
    );
    // Второй шаг правку не видел — structural sharing обязан сохранить тот же объект.
    expect(getAt(schema, P.step1)).toBe(getAt(base, P.step1));
    expect(getAt(schema, P.step0field1)).toBe(getAt(base, P.step0field1));
  });
});

describe('set_node_model', () => {
  it('перепривязывает поле', () => {
    const ref = '/root/componentProps/steps/0/children/0';
    const schema = expectOk(
      reg.invoke('set_node_model', { ref, model: 'loan.kind' }, ctxOf(sampleSchema()))
    );
    expect(buildOutline(schema).find((e) => e.ref === ref)?.model).toBe('loan.kind');
  });

  it('у контейнера привязки нет', () => {
    const res = reg.invoke(
      'set_node_model',
      { ref: '/root/componentProps/steps/0', model: 'x' },
      ctxOf(sampleSchema())
    );
    expect(res.error?.code).toBe('INVALID_PARENT');
  });
});

describe('remove_node', () => {
  it('удаляет узел и сообщает о вложенных', () => {
    const res = reg.invoke(
      'remove_node',
      { ref: '/root/componentProps/steps/0' },
      ctxOf(sampleSchema())
    );
    const schema = expectOk(res);
    expect(res.op?.summary).toContain('вложенные узлы');
    expect(buildOutline(schema).map((e) => e.ref)).not.toContain('/root/componentProps/steps/1');
  });
});

describe('move_node', () => {
  it('переносит узел в другой шаг', () => {
    const schema = expectOk(
      reg.invoke(
        'move_node',
        { ref: '/root/componentProps/steps/0/children/0', parent: '/root/componentProps/steps/1' },
        ctxOf(sampleSchema())
      )
    );
    const models = buildOutline(schema)
      .filter((e) => e.ref.startsWith('/root/componentProps/steps/1/children'))
      .map((e) => e.model);
    expect(models).toContain('loanType');
  });

  it('внутрь самого себя нельзя', () => {
    const res = reg.invoke(
      'move_node',
      { ref: '/root/componentProps/steps/0', parent: '/root/componentProps/steps/0' },
      ctxOf(sampleSchema())
    );
    expect(res.error?.code).toBe('INVALID_PARENT');
  });
});

describe('duplicate_node', () => {
  it('копия встаёт сразу после оригинала', () => {
    const schema = expectOk(
      reg.invoke(
        'duplicate_node',
        { ref: '/root/componentProps/steps/0/children/0' },
        ctxOf(sampleSchema())
      )
    );
    expect(
      buildOutline(schema)
        .filter((e) => e.ref.startsWith('/root/componentProps/steps/0/children'))
        .map((e) => e.model)
    ).toEqual(['loanType', 'loanType', 'loanAmount']);
  });

  it('шаблон массива дублировать нельзя', () => {
    const res = reg.invoke(
      'duplicate_node',
      { ref: '/root/componentProps/steps/1/children/0/item/$template' },
      ctxOf(sampleSchema())
    );
    expect(res.error?.code).toBe('INVALID_PARENT');
  });
});

describe('group_nodes', () => {
  const a = '/root/componentProps/steps/0/children/0';
  const b = '/root/componentProps/steps/0/children/1';

  it('оборачивает соседей в контейнер с заданной раскладкой', () => {
    const schema = expectOk(
      reg.invoke('group_nodes', { refs: [a, b], direction: 'row' }, ctxOf(sampleSchema()))
    );
    const group = buildOutline(schema).find((e) => e.ref === a);
    expect(group?.component).toBe('$html(div)');
    const cls = (
      getAt(schema, ['root', 'componentProps', 'steps', 0, 'children', 0, 'componentProps']) as {
        className: string;
      }
    ).className;
    expect(cls.split(/\s+/)).toContain('flex');
    expect(cls.split(/\s+/)).not.toContain('flex-col');
  });

  it('несоседние узлы группировать нельзя', () => {
    const res = reg.invoke(
      'group_nodes',
      { refs: [a, '/root/componentProps/steps/1/children/0'] },
      ctxOf(sampleSchema())
    );
    expect(res.error?.code).toBe('INVALID_PARENT');
  });

  it('меньше двух узлов отклоняется схемой аргументов', () => {
    expect(reg.invoke('group_nodes', { refs: [a] }, ctxOf(sampleSchema())).error?.code).toBe(
      'INVALID_PARAMS'
    );
  });
});

describe('set_layout', () => {
  it('меняет раскладку контейнера, сохраняя оформление', () => {
    const schema = expectOk(
      reg.invoke('set_layout', { ref: '/root', columns: 2 }, ctxOf(sampleSchema()))
    );
    const cls = (getAt(schema, ['root', 'componentProps']) as { className: string }).className;
    expect(cls.split(/\s+/)).toEqual(expect.arrayContaining(['bg-white', 'grid', 'grid-cols-2']));
  });

  it('у поля раскладки нет', () => {
    const res = reg.invoke(
      'set_layout',
      { ref: '/root/componentProps/steps/0/children/0', direction: 'row' },
      ctxOf(sampleSchema())
    );
    expect(res.error?.code).toBe('INVALID_PARENT');
  });
});
