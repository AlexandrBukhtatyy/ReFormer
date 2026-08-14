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
      { parent: '/root', nodes: [{ component: 'EmailField' }] },
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
          parent: '/root',
          nodes: [{ component: FIELD, model: 'applicant.email', props: { label: 'Email' } }],
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
        { parent: '/root', nodes: [{ component: FIELD, props: { label: 'Первое' } }] },
        ctxOf(emptySchema())
      )
    );
    schema = expectOk(
      reg.invoke(
        'insert_node',
        { parent: '/root', nodes: [{ component: FIELD, props: { label: 'Второе' } }] },
        ctxOf(schema)
      )
    );
    schema = expectOk(
      reg.invoke(
        'insert_node',
        { parent: '/root', index: 0, nodes: [{ component: FIELD, props: { label: 'Нулевое' } }] },
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
      reg.invoke('insert_node', { parent: '/root', nodes: [{ component: 'Step' }] }, ctxOf(base))
    );
    expect(buildOutline(schema).map((e) => e.ref)).toContain('/root/componentProps/steps/2');
  });

  it('поле детей не принимает', () => {
    const res = reg.invoke(
      'insert_node',
      { parent: '/root/componentProps/steps/0/children/0', nodes: [{ component: FIELD }] },
      ctxOf(sampleSchema())
    );
    expect(res.error?.code).toBe('INVALID_PARENT');
  });

  it('поле в мастер напрямую — отказ, а не молчаливое превращение в шаг', () => {
    // Наблюдалось вживую: insert_node(Input, parent=<Wizard>) отвечал «Готово», а поле вставало
    // в componentProps.steps и рантайм пытался нарисовать его вместо страницы мастера.
    const base = sampleSchema();
    const res = reg.invoke(
      'insert_node',
      { parent: '/root', nodes: [{ component: FIELD }] },
      ctxOf(base)
    );
    expect(res.error?.code).toBe('INVALID_PARENT');
    expect(res.schema).toBeUndefined();
    expect(res.text).toContain('Step');
  });

  it('ответ перечисляет созданное поддерево — иначе модель создаёт части повторно', () => {
    // Прямая причина сгоревшего хода: Tabs приходит собранным (список, две вкладки, две панели),
    // а ответ называл один адрес. Модель, не увидев готового TabsList, делала второй.
    const res = reg.invoke(
      'insert_node',
      { parent: '/root', nodes: [{ component: 'Tabs' }] },
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
      { parent: '/root', nodes: [{ component: 'Wizard' }] },
      ctxOf(emptySchema())
    );
    expect(res.text).toContain('/root/children/0/componentProps/steps/0');
    expect(res.text).toContain('Step');
  });

  it('одиночный узел отвечает как раньше — массовый путь без лишнего текста', () => {
    const res = reg.invoke(
      'insert_node',
      { parent: '/root', nodes: [{ component: FIELD, model: 'a.b' }] },
      ctxOf(emptySchema())
    );
    expect(res.text).not.toContain('\n');
  });

  it('визард без шагов не теряет слот: следующий Step встаёт в steps, а не в children', () => {
    // Самоуничтожение визарда: remove_node последнего шага оставлял steps: [], слот исчезал, и
    // всё, что вставляли дальше, уходило в children — в слот, которого рантайм не рендерит.
    let schema = expectOk(
      reg.invoke('remove_node', { refs: ['/root/componentProps/steps/1'] }, ctxOf(sampleSchema()))
    );
    schema = expectOk(
      reg.invoke('remove_node', { refs: ['/root/componentProps/steps/0'] }, ctxOf(schema))
    );
    schema = expectOk(
      reg.invoke('insert_node', { parent: '/root', nodes: [{ component: 'Step' }] }, ctxOf(schema))
    );

    const refs = buildOutline(schema).map((e) => e.ref);
    expect(refs).toContain('/root/componentProps/steps/0');
    expect(refs).not.toContain('/root/children/0');
  });
});

describe('insert_node пакетом', () => {
  const fields = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      component: FIELD,
      model: `f.${i}`,
      props: { label: `Поле ${i}` },
    }));

  it('несколько узлов за вызов встают в том же порядке, что и по одному', () => {
    const batched = expectOk(
      reg.invoke('insert_node', { parent: '/root', nodes: fields(3) }, ctxOf(emptySchema()))
    );
    let serial = emptySchema();
    for (const node of fields(3)) {
      serial = expectOk(
        reg.invoke('insert_node', { parent: '/root', nodes: [node] }, ctxOf(serial))
      );
    }
    expect(buildOutline(batched)).toEqual(buildOutline(serial));
  });

  it('явный index не переворачивает пакет', () => {
    // Наивная реализация вставляла бы каждый следующий узел ПЕРЕД предыдущим: index один и тот же.
    const base = expectOk(
      reg.invoke(
        'insert_node',
        { parent: '/root', nodes: [{ component: FIELD, props: { label: 'Хвост' } }] },
        ctxOf(emptySchema())
      )
    );
    const schema = expectOk(
      reg.invoke('insert_node', { parent: '/root', index: 0, nodes: fields(2) }, ctxOf(base))
    );
    expect(
      buildOutline(schema)
        .slice(1)
        .map((e) => e.label)
    ).toEqual(['Поле 0', 'Поле 1', 'Хвост']);
  });

  it('ответ называет адрес каждого узла — по ним модель правит их дальше', () => {
    const res = reg.invoke(
      'insert_node',
      { parent: '/root', nodes: fields(3) },
      ctxOf(emptySchema())
    );
    expect(res.ok).toBe(true);
    for (const i of [0, 1, 2]) expect(res.text).toContain(`/root/children/${i}`);
    // Журнал предпросмотра — строка на узел, а не на вызов.
    expect(res.ops).toHaveLength(3);
  });

  it('негодный узел в середине отменяет ВЕСЬ пакет и называет его номер', () => {
    // Частично применённый пакет оставил бы черновик в состоянии, которого модель не знает: её
    // следующий вызов адресовал бы узлы по неверным индексам.
    const res = reg.invoke(
      'insert_node',
      {
        parent: '/root',
        nodes: [{ component: FIELD }, { component: 'НетТакого' }, { component: FIELD }],
      },
      ctxOf(emptySchema())
    );
    expect(res.error?.code).toBe('UNKNOWN_COMPONENT');
    expect(res.text).toContain('nodes[1]');
    expect(res.schema).toBeUndefined();
  });

  it('одиночная вставка номер элемента не приписывает — приписывать нечего', () => {
    const res = reg.invoke(
      'insert_node',
      { parent: '/root', nodes: [{ component: 'НетТакого' }] },
      ctxOf(emptySchema())
    );
    expect(res.text).not.toContain('nodes[');
  });
});

describe('set_node_prop пакетом', () => {
  const step0 = '/root/componentProps/steps/0';

  it('одни и те же свойства уходят на все адреса за один вызов', () => {
    const refs = [`${step0}/children/0`, `${step0}/children/1`];
    const schema = expectOk(
      reg.invoke('set_node_prop', { refs, props: { required: true } }, ctxOf(sampleSchema()))
    );
    const outline = buildOutline(schema);
    for (const ref of refs) expect(outline.find((e) => e.ref === ref)?.required).toBe(true);
  });

  it('несколько свойств одного узла — тоже один вызов', () => {
    const ref = `${step0}/children/0`;
    const schema = expectOk(
      reg.invoke(
        'set_node_prop',
        { refs: [ref], props: { required: true, label: 'Новая подпись' } },
        ctxOf(sampleSchema())
      )
    );
    const entry = buildOutline(schema).find((e) => e.ref === ref);
    expect(entry?.required).toBe(true);
    expect(entry?.label).toBe('Новая подпись');
  });

  it('ожидание при нескольких адресах отвергается — оно описывает один узел', () => {
    const res = reg.invoke(
      'set_node_prop',
      {
        refs: [`${step0}/children/0`, `${step0}/children/1`],
        props: { required: true },
        expect: { component: FIELD },
      },
      ctxOf(sampleSchema())
    );
    expect(res.error?.code).toBe('INVALID_PARAMS');
    expect(res.schema).toBeUndefined();
  });

  it('устаревший адрес в пакете отменяет весь вызов', () => {
    const res = reg.invoke(
      'set_node_prop',
      { refs: [`${step0}/children/0`, `${step0}/children/99`], props: { required: true } },
      ctxOf(sampleSchema())
    );
    expect(res.ok).toBe(false);
    expect(res.schema).toBeUndefined();
  });
});

describe('remove_node пакетом', () => {
  it('соседей удаляет именно тех, что назвали, — сдвиг индексов не подводит', () => {
    // Ровно тот класс ошибок, ради которого пакет и заведён: удаляя по одному по возрастанию,
    // модель сдвигала индексы и вторым вызовом сносила чужой узел.
    const base = expectOk(
      reg.invoke(
        'insert_node',
        {
          parent: '/root',
          nodes: [0, 1, 2].map((i) => ({ component: FIELD, model: `f.${i}` })),
        },
        ctxOf(emptySchema())
      )
    );
    const schema = expectOk(
      reg.invoke('remove_node', { refs: ['/root/children/0', '/root/children/1'] }, ctxOf(base))
    );
    // Уцелеть должен ровно третий: первые два названы, а не «первые два по счёту после сдвига».
    expect(
      buildOutline(schema)
        .slice(1)
        .map((e) => e.model)
    ).toEqual(['f.2']);
  });

  it('порядок адресов в дереве считается по числам, а не по буквам', () => {
    // На десяти и более соседях лексикографика врёт: '/children/10' < '/children/2'. Удаление
    // «с конца» перестало бы быть удалением с конца ровно там, где детей стало много.
    const base = expectOk(
      reg.invoke(
        'insert_node',
        {
          parent: '/root',
          nodes: Array.from({ length: 12 }, (_, i) => ({ component: FIELD, model: `f.${i}` })),
        },
        ctxOf(emptySchema())
      )
    );
    const schema = expectOk(
      reg.invoke('remove_node', { refs: ['/root/children/2', '/root/children/10'] }, ctxOf(base))
    );
    const left = buildOutline(schema)
      .slice(1)
      .map((e) => e.model);
    expect(left).not.toContain('f.2');
    expect(left).not.toContain('f.10');
    expect(left).toHaveLength(10);
  });
});

describe('set_node_prop', () => {
  const ref = '/root/componentProps/steps/0/children/0';

  it('задаёт свойство', () => {
    const schema = expectOk(
      reg.invoke('set_node_prop', { refs: [ref], props: { required: true } }, ctxOf(sampleSchema()))
    );
    expect(buildOutline(schema).find((e) => e.ref === ref)?.required).toBe(true);
  });

  it('null удаляет свойство', () => {
    const schema = expectOk(
      reg.invoke('set_node_prop', { refs: [ref], props: { label: null } }, ctxOf(sampleSchema()))
    );
    expect(buildOutline(schema).find((e) => e.ref === ref)?.label).toBeUndefined();
  });

  it('key=text пишет содержимое узла, а не componentProps', () => {
    // Подпись вкладки живёт текстовой частью children, и рендерер берёт её только оттуда. Пока
    // ключа не было, переименовать вкладку было нечем: модель перебирала пропы по кругу.
    const base = expectOk(
      reg.invoke(
        'insert_node',
        { parent: '/root', nodes: [{ component: 'Tabs' }] },
        ctxOf(emptySchema())
      )
    );
    const trigger = '/root/children/0/children/0/children/0';
    const schema = expectOk(
      reg.invoke(
        'set_node_prop',
        { refs: [trigger], props: { text: 'Личные данные' } },
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
      { refs: ['/root/componentProps/steps/0'], props: { text: 'Шаг 2' } },
      ctxOf(sampleSchema())
    );
    expect(res.error?.code).toBe('INVALID_PARENT');
    expect(res.text).toContain('"title" property');
    expect(res.schema).toBeUndefined();
  });

  it('содержимое из нескольких частей строкой не затирается', () => {
    const draft = sampleSchema();
    const ref = '/root/componentProps/steps/0';
    const step = getAt(draft, [...P.step0]) as { children: unknown[] };
    step.children = ['Платёж: ', '$model(loanAmount)', ' ₽'];

    const res = reg.invoke(
      'set_node_prop',
      { refs: [ref], props: { text: 'Итого' } },
      ctxOf(draft)
    );
    expect(res.ok).toBe(false);
    expect(res.schema).toBeUndefined();
  });

  it('у поля содержимого нет — отказ объясняет, чем задавать подпись', () => {
    const res = reg.invoke(
      'set_node_prop',
      { refs: [ref], props: { text: 'Сумма' } },
      ctxOf(sampleSchema())
    );
    expect(res.error?.code).toBe('INVALID_PARENT');
    expect(res.text).toContain('"label" property');
  });

  it('несовпавшее expect отклоняет правку, схема не тронута', () => {
    const draft = sampleSchema();
    const res = reg.invoke(
      'set_node_prop',
      { refs: [ref], props: { required: true }, expect: { model: 'loanAmount' } },
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
        { parent: '/root', nodes: [{ component: 'Input', model: 'x' }] },
        ctxOf(emptySchema())
      )
    );
    const res = reg.invoke(
      'set_node_prop',
      { refs: ['/root/children/0'], props: { min: 'не-число' } },
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
        { parent: '/root', nodes: [{ component: 'Input', model: 'x' }] },
        ctxOf(emptySchema())
      )
    );
    const broken = getAt(base, ['root', 'children', 0]) as {
      componentProps: Record<string, unknown>;
    };
    broken.componentProps = { ...broken.componentProps, min: 'не-число' };

    const res = reg.invoke(
      'insert_node',
      { parent: '/root', index: 0, nodes: [{ component: FIELD, model: 'y' }] },
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
        { parent: '/root', nodes: [{ component: 'Input', model: 'x' }] },
        ctxOf(emptySchema())
      )
    );
    const broken = getAt(base, ['root', 'children', 0]) as {
      componentProps: Record<string, unknown>;
    };
    broken.componentProps = { ...broken.componentProps, min: 'не-число' };

    const withSecond = expectOk(
      reg.invoke(
        'insert_node',
        { parent: '/root', nodes: [{ component: 'Input', model: 'z' }] },
        ctxOf(base)
      )
    );
    const res = reg.invoke(
      'set_node_prop',
      { refs: ['/root/children/1'], props: { min: 'тоже-не-число' } },
      ctxOf(withSecond, base)
    );
    expect(res.error?.code).toBe('SCHEMA_INVALID');
  });

  it('непричастные узлы сохраняют ссылочную идентичность', () => {
    const base = sampleSchema();
    const schema = expectOk(
      reg.invoke('set_node_prop', { refs: [ref], props: { required: true } }, ctxOf(base))
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
      { refs: ['/root/componentProps/steps/0'] },
      ctxOf(sampleSchema())
    );
    const schema = expectOk(res);
    expect(res.ops?.[0]?.summary).toContain('вложенные узлы');
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
    expect(res.text).toContain('INSIDE a step');
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

describe('замечания структуры — вдогонку к успешной правке', () => {
  /** Форма с собранным Tabs: он валиден и замечаний не даёт. */
  function withTabs(): JsonFormSchema {
    return expectOk(
      reg.invoke(
        'insert_node',
        { parent: '/root', nodes: [{ component: 'Tabs' }] },
        ctxOf(emptySchema())
      )
    );
  }

  it('правка, принёсшая замечание, сообщает о нём сразу — без отдельного validate_form', () => {
    // Третья вкладка без value ни к какой панели не привязана. На валидность это не влияет, поэтому
    // гейт правку принимает; но узнавать об этом в конце хода отдельным вызовом — целый лишний
    // обход «модель → инструмент → модель».
    const base = withTabs();
    const res = reg.invoke(
      'insert_node',
      { parent: '/root/children/0/children/0', nodes: [{ component: 'TabsTrigger' }] },
      ctxOf(base)
    );
    expect(res.ok).toBe(true);
    expect(res.text).toContain('Heads up');
    expect(res.text).toContain('no value');
  });

  it('давнее замечание чужой формы не упрекает агента на каждой правке', () => {
    // Политика «не обязана лечить, но обязана не ухудшать»: замечание, уже бывшее в базе, новым
    // не считается — иначе любая правка кривой формы выглядела бы как её порча.
    const broken = expectOk(
      reg.invoke(
        'insert_node',
        { parent: '/root/children/0/children/0', nodes: [{ component: 'TabsTrigger' }] },
        ctxOf(withTabs())
      )
    );
    const res = reg.invoke(
      'insert_node',
      { parent: '/root', nodes: [{ component: FIELD, props: { label: 'Имя' } }] },
      ctxOf(broken, broken)
    );
    expect(res.ok).toBe(true);
    expect(res.text).not.toContain('Heads up');
  });

  it('чистая правка ответ не удлиняет', () => {
    const res = reg.invoke(
      'insert_node',
      { parent: '/root', nodes: [{ component: FIELD, props: { label: 'Имя' } }] },
      ctxOf(emptySchema())
    );
    expect(res.text).not.toContain('Heads up');
  });
});
