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

  it('поле в мастер напрямую — отказ, а не молчаливое превращение в шаг', () => {
    // Наблюдалось вживую: insert_node(Input, parent=<Wizard>) отвечал «Готово», а поле вставало
    // в componentProps.steps и рантайм пытался нарисовать его вместо страницы мастера.
    const base = sampleSchema();
    const res = reg.invoke('insert_node', { component: FIELD, parent: '/root' }, ctxOf(base));
    expect(res.error?.code).toBe('INVALID_PARENT');
    expect(res.schema).toBeUndefined();
    expect(res.text).toContain('Step');
  });

  it('ответ перечисляет созданное поддерево — иначе модель создаёт части повторно', () => {
    // Прямая причина сгоревшего хода: Tabs приходит собранным (список, две вкладки, две панели),
    // а ответ называл один адрес. Модель, не увидев готового TabsList, делала второй.
    const res = reg.invoke(
      'insert_node',
      { component: 'Tabs', parent: '/root' },
      ctxOf(emptySchema())
    );
    expect(res.ok).toBe(true);
    expect(res.text).toContain('TabsList');
    expect(res.text).toContain('/root/children/0/children/0/children/0');
    expect(res.text?.split('TabsList')).toHaveLength(2);
  });

  it('вставка визарда показывает посеянный шаг с его адресом', () => {
    const res = reg.invoke(
      'insert_node',
      { component: 'Wizard', parent: '/root' },
      ctxOf(emptySchema())
    );
    expect(res.text).toContain('/root/children/0/componentProps/steps/0');
    expect(res.text).toContain('Step');
  });

  it('одиночный узел отвечает как раньше — массовый путь без лишнего текста', () => {
    const res = reg.invoke(
      'insert_node',
      { component: FIELD, parent: '/root', model: 'a.b' },
      ctxOf(emptySchema())
    );
    expect(res.text).not.toContain('\n');
  });

  it('визард без шагов не теряет слот: следующий Step встаёт в steps, а не в children', () => {
    // Самоуничтожение визарда: remove_node последнего шага оставлял steps: [], слот исчезал, и
    // всё, что вставляли дальше, уходило в children — в слот, которого рантайм не рендерит.
    let schema = expectOk(
      reg.invoke('remove_node', { ref: '/root/componentProps/steps/1' }, ctxOf(sampleSchema()))
    );
    schema = expectOk(
      reg.invoke('remove_node', { ref: '/root/componentProps/steps/0' }, ctxOf(schema))
    );
    schema = expectOk(
      reg.invoke('insert_node', { component: 'Step', parent: '/root' }, ctxOf(schema))
    );

    const refs = buildOutline(schema).map((e) => e.ref);
    expect(refs).toContain('/root/componentProps/steps/0');
    expect(refs).not.toContain('/root/children/0');
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

  it('key=text пишет содержимое узла, а не componentProps', () => {
    // Подпись вкладки живёт текстовой частью children, и рендерер берёт её только оттуда. Пока
    // ключа не было, переименовать вкладку было нечем: модель перебирала пропы по кругу.
    const base = expectOk(
      reg.invoke('insert_node', { component: 'Tabs', parent: '/root' }, ctxOf(emptySchema()))
    );
    const trigger = '/root/children/0/children/0/children/0';
    const schema = expectOk(
      reg.invoke(
        'set_node_prop',
        { ref: trigger, key: 'text', value: 'Личные данные' },
        ctxOf(base)
      )
    );

    const node = getAt(schema, ['root', 'children', 0, 'children', 0, 'children', 0]) as {
      children: unknown[];
      componentProps?: Record<string, unknown>;
    };
    expect(node.children).toContain('Личные данные');
    expect(node.componentProps?.text).toBeUndefined();
  });

  it('у шага подпись — свойство title, а не содержимое', () => {
    // Наблюдалось вживую: модель переименовывала шаг ключом text, и слово «Шаг 2» вставало
    // абзацем НАД полями шага, а заголовок оставался прежним. У Step children — тело, не подпись.
    const res = reg.invoke(
      'set_node_prop',
      { ref: '/root/componentProps/steps/0', key: 'text', value: 'Шаг 2' },
      ctxOf(sampleSchema())
    );
    expect(res.error?.code).toBe('INVALID_PARENT');
    expect(res.text).toContain('title');
    expect(res.schema).toBeUndefined();
  });

  it('содержимое из нескольких частей строкой не затирается', () => {
    const draft = sampleSchema();
    const ref = '/root/componentProps/steps/0';
    const step = getAt(draft, [...P.step0]) as { children: unknown[] };
    step.children = ['Платёж: ', '$model(loanAmount)', ' ₽'];

    const res = reg.invoke('set_node_prop', { ref, key: 'text', value: 'Итого' }, ctxOf(draft));
    expect(res.ok).toBe(false);
    expect(res.schema).toBeUndefined();
  });

  it('у поля содержимого нет — отказ объясняет, чем задавать подпись', () => {
    const res = reg.invoke(
      'set_node_prop',
      { ref, key: 'text', value: 'Сумма' },
      ctxOf(sampleSchema())
    );
    expect(res.error?.code).toBe('INVALID_PARENT');
    expect(res.text).toContain('label');
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

  it('чужая ошибка, уехавшая на другой индекс, не считается новой', () => {
    // Форма уже была битой (например, открыли чужую): у первого поля min — строка. Вставка узла
    // ПЕРЕД ним сдвигает children[0] → children[1], и дословное сравнение строк читало ту же самую
    // ошибку как новую — правка отвергалась, причём с указанием на узел, которого агент не трогал.
    const base = expectOk(
      reg.invoke(
        'insert_node',
        { component: 'Input', parent: '/root', model: 'x' },
        ctxOf(emptySchema())
      )
    );
    const broken = getAt(base, ['root', 'children', 0]) as {
      componentProps: Record<string, unknown>;
    };
    broken.componentProps = { ...broken.componentProps, min: 'не-число' };

    const res = reg.invoke(
      'insert_node',
      { component: FIELD, parent: '/root', index: 0, model: 'y' },
      ctxOf(base)
    );
    expect(res.error?.code, res.text).toBeUndefined();
    expect(res.schema).toBeDefined();
  });

  it('вторая такая же ошибка у того же узла — уже ухудшение', () => {
    // Счётчики, а не множество: иначе форма с одной битой строкой молча принимала бы вторую.
    const base = expectOk(
      reg.invoke(
        'insert_node',
        { component: 'Input', parent: '/root', model: 'x' },
        ctxOf(emptySchema())
      )
    );
    const broken = getAt(base, ['root', 'children', 0]) as {
      componentProps: Record<string, unknown>;
    };
    broken.componentProps = { ...broken.componentProps, min: 'не-число' };

    const withSecond = expectOk(
      reg.invoke('insert_node', { component: 'Input', parent: '/root', model: 'z' }, ctxOf(base))
    );
    const res = reg.invoke(
      'set_node_prop',
      { ref: '/root/children/1', key: 'min', value: 'тоже-не-число' },
      ctxOf(withSecond, base)
    );
    expect(res.error?.code).toBe('SCHEMA_INVALID');
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

  it('шаги мастера группировать нельзя — обёртка схлопнула бы их в один', () => {
    // groupBlock ставит на место блока один $html(div): два шага превратились бы в одну
    // безымянную страницу, а поля внутри — остались бы, но без своих шагов.
    const draft = sampleSchema();
    const res = reg.invoke(
      'group_nodes',
      { refs: ['/root/componentProps/steps/0', '/root/componentProps/steps/1'] },
      ctxOf(draft)
    );
    expect(res.error?.code).toBe('INVALID_PARENT');
    // Отказ обязан назвать законную альтернативу, иначе модель повторит тот же вызов.
    expect(res.text?.toLowerCase()).toContain('внутри шага');
    expect(res.schema).toBeUndefined();
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
