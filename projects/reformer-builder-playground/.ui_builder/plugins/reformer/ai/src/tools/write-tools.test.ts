import { validateFormSchema } from '@reformer/renderer-json/validate';
import { BUILTIN_CATALOG, builtinEntries } from '../../../core/testing';
import { buildCatalog } from '../../../core/catalog';
import { describe, expect, it } from 'vitest';
import { emptyRules, type FormRules } from '../../../core/form-model';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { emptySchema } from '../../../core/form-model';
import { getAt } from '../../../core/form-model';
import { P, sampleSchema } from '../../../core/testing';
import { listComponents } from '../model/catalog-digest';
import { createEditorToolRegistry } from '../index';
import { buildOutline } from '../model/outline';
import type { ToolContext, ToolOutcome } from '../model/types';

const catalog = builtinEntries();
const reg = createEditorToolRegistry();

/** Первое поле каталога — тесты не должны зависеть от конкретного кита. */
const FIELD = listComponents(catalog, { role: 'field' })[0].name;

const ctxOf = (draft: JsonFormSchema, base = draft): ToolContext => ({
  draft,
  base,
  rules: emptyRules(),
  catalog,
  validateForm: validateFormSchema,
});

/** Вызвать инструмент и потребовать успех (иначе тест упадёт с текстом ошибки). */
function expectOk(res: ToolOutcome): JsonFormSchema {
  expect(res.error?.code, res.text).toBeUndefined();
  expect(res.schema).toBeDefined();
  return res.schema as JsonFormSchema;
}

describe('insert_node', () => {
  it('выдуманный компонент отклоняется с подсказками', async () => {
    const res = await reg.invoke(
      'insert_node',
      { parent: '/root', nodes: [{ component: 'EmailField' }] },
      ctxOf(emptySchema())
    );
    expect(res.error?.code).toBe('UNKNOWN_COMPONENT');
    // Имя может не походить ни на что в каталоге — тогда путь восстановления называется прямо.
    expect(res.text).toContain('list_components');
    expect(res.schema).toBeUndefined();
  });

  it('вставляет поле с привязкой и свойствами', async () => {
    const schema = expectOk(
      await reg.invoke(
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

  it('index задаёт позицию, по умолчанию — в конец', async () => {
    let schema = expectOk(
      await reg.invoke(
        'insert_node',
        { parent: '/root', nodes: [{ component: FIELD, props: { label: 'Первое' } }] },
        ctxOf(emptySchema())
      )
    );
    schema = expectOk(
      await reg.invoke(
        'insert_node',
        { parent: '/root', nodes: [{ component: FIELD, props: { label: 'Второе' } }] },
        ctxOf(schema)
      )
    );
    schema = expectOk(
      await reg.invoke(
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

  it('в мастер вставка идёт в слот шагов — правило размещения знает редактор', async () => {
    const base = sampleSchema();
    const schema = expectOk(
      await reg.invoke(
        'insert_node',
        { parent: '/root', nodes: [{ component: 'Step' }] },
        ctxOf(base)
      )
    );
    // Шаги — `children` визарда: новый встаёт третьим и числится шагом, а не обычным ребёнком.
    expect(buildOutline(schema).find((e) => e.ref === '/root/children/2')).toMatchObject({
      component: 'Step',
      slot: 'steps',
    });
    // Прежнего места шагов в документе не появляется.
    expect(getAt(schema, ['root', 'componentProps', 'steps'])).toBeUndefined();
  });

  it('поле детей не принимает', async () => {
    const res = await reg.invoke(
      'insert_node',
      { parent: '/root/children/0/children/0', nodes: [{ component: FIELD }] },
      ctxOf(sampleSchema())
    );
    expect(res.error?.code).toBe('INVALID_PARENT');
  });

  it('поле в мастер напрямую — отказ, а не молчаливое превращение в шаг', async () => {
    // Наблюдалось вживую: insert_node(Input, parent=<Wizard>) отвечал «Готово», а поле вставало
    // среди шагов и рантайм пытался нарисовать его вместо страницы мастера.
    const base = sampleSchema();
    const res = await reg.invoke(
      'insert_node',
      { parent: '/root', nodes: [{ component: FIELD }] },
      ctxOf(base)
    );
    expect(res.error?.code).toBe('INVALID_PARENT');
    expect(res.schema).toBeUndefined();
    expect(res.text).toContain('Step');
  });

  it('ответ перечисляет созданное поддерево — иначе модель создаёт части повторно', async () => {
    // Прямая причина сгоревшего хода: Tabs приходит собранным (список, две вкладки, две панели),
    // а ответ называл один адрес. Модель, не увидев готового TabsList, делала второй.
    const res = await reg.invoke(
      'insert_node',
      { parent: '/root', nodes: [{ component: 'Tabs' }] },
      ctxOf(emptySchema())
    );
    expect(res.ok).toBe(true);
    expect(res.text).toContain('TabsList');
    expect(res.text).toContain('/root/children/0/children/0/children/0');
    expect(res.text?.split('TabsList')).toHaveLength(2);
  });

  it('вставка визарда показывает посеянный шаг с его адресом', async () => {
    const res = await reg.invoke(
      'insert_node',
      { parent: '/root', nodes: [{ component: 'Wizard' }] },
      ctxOf(emptySchema())
    );
    expect(res.text).toContain('/root/children/0/children/0');
    expect(res.text).toContain('Step');
  });

  it('одиночный узел отвечает как раньше — массовый путь без лишнего текста', async () => {
    const res = await reg.invoke(
      'insert_node',
      { parent: '/root', nodes: [{ component: FIELD, model: 'a.b' }] },
      ctxOf(emptySchema())
    );
    expect(res.text).not.toContain('\n');
  });

  it('визард без шагов не теряет слот: следующий Step встаёт шагом, а поле не принимается', async () => {
    // Самоуничтожение визарда: remove_node последнего шага оставлял пустой список шагов, слот
    // исчезал, и всё, что вставляли дальше, уходило обычными детьми — мимо правила «в визарде
    // только шаги». Слот шагов держится на имени компонента, а не на том, есть ли в нём шаги.
    let schema = expectOk(
      await reg.invoke('remove_node', { refs: ['/root/children/1'] }, ctxOf(sampleSchema()))
    );
    schema = expectOk(
      await reg.invoke('remove_node', { refs: ['/root/children/0'] }, ctxOf(schema))
    );
    expect(getAt(schema, [...P.steps])).toEqual([]);

    // Пустой визард — всё ещё визард: поле напрямую он не принимает.
    const refused = await reg.invoke(
      'insert_node',
      { parent: '/root', nodes: [{ component: FIELD }] },
      ctxOf(schema)
    );
    expect(refused.error?.code).toBe('INVALID_PARENT');

    schema = expectOk(
      await reg.invoke(
        'insert_node',
        { parent: '/root', nodes: [{ component: 'Step' }] },
        ctxOf(schema)
      )
    );
    expect(buildOutline(schema).find((e) => e.ref === '/root/children/0')).toMatchObject({
      component: 'Step',
      slot: 'steps',
    });
  });

  it('визард без ключа children принимает шаг и по-прежнему отказывает полю', async () => {
    // Слот шагов существует и когда `children` у визарда ещё нет: иначе первый шаг было бы
    // некуда положить, а поле прошло бы как «первый ребёнок контейнера».
    const bare = {
      format: 2,
      root: { component: '$component(Wizard)' },
    } as unknown as JsonFormSchema;

    const refused = await reg.invoke(
      'insert_node',
      { parent: '/root', nodes: [{ component: FIELD }] },
      ctxOf(bare)
    );
    expect(refused.error?.code).toBe('INVALID_PARENT');

    const schema = expectOk(
      await reg.invoke(
        'insert_node',
        { parent: '/root', nodes: [{ component: 'Step' }] },
        ctxOf(bare)
      )
    );
    expect(buildOutline(schema).find((e) => e.ref === '/root/children/0')?.slot).toBe('steps');
  });

  it('привязка поля и массива пишется ключом model — прежних value и array в узле нет', async () => {
    const schema = expectOk(
      await reg.invoke(
        'insert_node',
        {
          parent: '/root',
          nodes: [
            { component: FIELD, model: 'applicant.email' },
            { component: 'FieldArray', model: 'phones' },
          ],
        },
        ctxOf(emptySchema())
      )
    );
    const [field, array] = getAt(schema, ['root', 'children']) as Record<string, unknown>[];
    expect(field.model).toBe('$model(applicant.email)');
    expect(array.model).toBe('$model(phones)');
    for (const node of [field, array]) {
      expect(node).not.toHaveProperty('value');
      expect(node).not.toHaveProperty('array');
    }
    // Результат — документ формата 2, и гейт проверял его мета-схемой формата 2.
    expect(schema.format).toBe(2);
  });

  it('массив приходит с компонентом кита — тем же узлом, что даёт палитра', async () => {
    const schema = expectOk(
      await reg.invoke(
        'insert_node',
        { parent: '/root', nodes: [{ component: 'FieldArray', model: 'phones' }] },
        ctxOf(emptySchema())
      )
    );
    const array = getAt(schema, ['root', 'children', 0]) as Record<string, unknown>;
    // Без `component` рендерер кладёт строки одну за другой — без заголовка и кнопок
    // «добавить» / «удалить»: так и выглядел массив, вставленный ассистентом.
    expect(array.component).toBe('$component(FieldArray)');

    // Палитра берёт узел у записи каталога (`entry.makeNode()`); вставка ассистента обязана
    // отличаться от него только тем, что задано в вызове, — привязкой.
    const palette = catalog.find((entry) => entry.name === 'FieldArray');
    expect(palette).toBeDefined();
    expect(array).toEqual({ ...palette!.makeNode(), model: '$model(phones)' });
  });

  it('кит без компонента массива: узел остаётся без component — как у палитры', async () => {
    // Умеет ли кит рисовать массив, известно записи каталога (она собрана с фактами о ките).
    // Ссылка на компонент, которого кит не поставляет, дала бы заглушку вместо строк.
    const bare = buildCatalog({
      ...BUILTIN_CATALOG,
      components: BUILTIN_CATALOG.components.filter((record) => record.name !== 'FieldArray'),
    }).entries;
    // Посылка: сама запись массива в каталоге осталась — она синтетическая, её даёт билдер.
    const palette = bare.find((entry) => entry.name === 'FieldArray');
    expect(palette).toBeDefined();
    expect(palette!.makeNode()).not.toHaveProperty('component');

    const schema = expectOk(
      await reg.invoke(
        'insert_node',
        { parent: '/root', nodes: [{ component: 'FieldArray', model: 'phones' }] },
        { ...ctxOf(emptySchema()), catalog: bare }
      )
    );
    const array = getAt(schema, ['root', 'children', 0]) as Record<string, unknown>;
    expect(array).not.toHaveProperty('component');
    expect(array).toEqual({ ...palette!.makeNode(), model: '$model(phones)' });
  });

  it('узел без привязки и свойств — ровно узел палитры, для каждого вида записи', async () => {
    // По одной записи на ветку фабрики: массив, поле, контейнер, лист, составной компонент и
    // его часть, визард, шаг, HTML-тег. Второй механизм создания узлов разошёлся бы с палитрой
    // молча — на первом же ките со своими листьями.
    const names = [
      'FieldArray',
      FIELD,
      'Box',
      'Separator',
      'Tabs',
      'AlertTitle',
      'Wizard',
      'Step',
      '$html(div)',
    ];
    const schema = expectOk(
      await reg.invoke(
        'insert_node',
        { parent: '/root', nodes: names.map((component) => ({ component })) },
        ctxOf(emptySchema())
      )
    );
    const inserted = getAt(schema, ['root', 'children']) as unknown[];
    expect(inserted).toHaveLength(names.length);
    names.forEach((name, index) => {
      const entry = catalog.find((candidate) => candidate.name === name);
      expect(entry, name).toBeDefined();
      expect(inserted[index], name).toEqual(entry!.makeNode());
    });
  });

  it('фабрика записи, отдающая один и тот же узел, вставкой не портится', async () => {
    // Фабрика приходит вместе с каталогом и не обязана отдавать каждый раз новый объект. Узел
    // здесь один на все вызовы и заморожен: правка на месте (привязка, свойства) бросила бы.
    const shared = Object.freeze({
      model: '$model(items)',
      component: '$component(FieldArray)',
      item: Object.freeze({
        $template: Object.freeze({ component: '$component(Box)', children: Object.freeze([]) }),
      }),
      componentProps: Object.freeze({ addButtonLabel: '+ Добавить' }),
    });
    const withShared = catalog.map((entry) =>
      entry.name === 'FieldArray' ? { ...entry, makeNode: () => shared as never } : entry
    );

    const schema = expectOk(
      await reg.invoke(
        'insert_node',
        {
          parent: '/root',
          nodes: [{ component: 'FieldArray', model: 'phones', props: { title: 'Телефоны' } }],
        },
        { ...ctxOf(emptySchema()), catalog: withShared }
      )
    );
    expect(getAt(schema, ['root', 'children', 0])).toMatchObject({
      model: '$model(phones)',
      component: '$component(FieldArray)',
      componentProps: { addButtonLabel: '+ Добавить', title: 'Телефоны' },
    });
    // Узел каталога остался каким был: следующая вставка получит его нетронутым.
    expect(shared.model).toBe('$model(items)');
    expect(shared.componentProps).toEqual({ addButtonLabel: '+ Добавить' });
  });

  it('подформа и массив с шаблоном-частью детей не принимают', async () => {
    const draft = withParts();
    for (const parent of ['/root/children/0', '/root/children/1']) {
      const res = await reg.invoke(
        'insert_node',
        { parent, nodes: [{ component: FIELD }] },
        ctxOf(draft)
      );
      expect(res.error?.code, parent).toBe('INVALID_PARENT');
      expect(res.schema).toBeUndefined();
    }
  });
});

/** Форма с подформой и с массивом, чей шаблон строки — именованная часть документа. */
function withParts(): JsonFormSchema {
  return {
    format: 2,
    parts: {
      address: {
        component: '$component(Box)',
        children: [{ model: '$model(city)', component: '$component(Input)' }],
      },
    },
    root: {
      component: '$component(Box)',
      children: [
        { model: '$model(registrationAddress)', part: '$part(address)' },
        { model: '$model(previousAddresses)', item: '$part(address)' },
        { model: '$model(email)', component: '$component(Input)' },
      ],
    },
  } as unknown as JsonFormSchema;
}

describe('подформа и массив с шаблоном-частью', () => {
  const PART = '/root/children/0';
  const ARRAY = '/root/children/1';

  it('переносятся, копируются и удаляются как обычные узлы', async () => {
    // Собирать такие узлы ассистент не обязан, но встретить в чужой форме может: правки вокруг
    // них не должны ни падать, ни ломать сам узел.
    const base = withParts();
    let schema = expectOk(
      await reg.invoke('move_node', { ref: PART, parent: '/root', index: 3 }, ctxOf(base))
    );
    // Дерево корня; разметка частей идёт в карте отдельным блоком (`/parts/…`).
    const rootKinds = (next: typeof schema) =>
      buildOutline(next)
        .filter((e) => e.ref.startsWith('/root'))
        .map((e) => e.kind);
    expect(rootKinds(schema)).toEqual(['container', 'array', 'field', 'part']);

    schema = expectOk(
      await reg.invoke('duplicate_node', { ref: '/root/children/0' }, ctxOf(schema))
    );
    expect(getAt(schema, ['root', 'children', 1])).toEqual({
      model: '$model(previousAddresses)',
      item: '$part(address)',
    });

    schema = expectOk(
      await reg.invoke(
        'remove_node',
        { refs: ['/root/children/1', '/root/children/3'] },
        ctxOf(schema)
      )
    );
    expect(rootKinds(schema)).toEqual(['container', 'array', 'field']);
    // Часть документа правки узлов не трогают.
    expect(schema.parts).toBe(base.parts);
  });

  it('раскладки и содержимого у них нет — отказ, а не падение', async () => {
    for (const ref of [PART, ARRAY]) {
      const layout = await reg.invoke('set_layout', { ref, direction: 'row' }, ctxOf(withParts()));
      expect(layout.error?.code, ref).toBe('INVALID_PARENT');

      const text = await reg.invoke(
        'set_node_prop',
        { refs: [ref], props: { text: 'Адрес' } },
        ctxOf(withParts())
      );
      expect(text.error?.code, ref).toBe('INVALID_PARENT');
    }
  });

  it('свойств компонента у подформы нет — гейт не пускает их в узел', async () => {
    // Узел-подформа закрыт: `{ model, part }` и больше ничего. Попытка дописать ему пропсы
    // отвергается мета-схемой формата 2, а не оседает в документе мусорным ключом.
    const res = await reg.invoke(
      'set_node_prop',
      { refs: [PART], props: { label: 'Адрес регистрации' } },
      ctxOf(withParts())
    );
    expect(res.error?.code).toBe('SCHEMA_INVALID');
    expect(res.schema).toBeUndefined();
  });
});

describe('insert_node пакетом', () => {
  const fields = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      component: FIELD,
      model: `f.${i}`,
      props: { label: `Поле ${i}` },
    }));

  it('несколько узлов за вызов встают в том же порядке, что и по одному', async () => {
    const batched = expectOk(
      await reg.invoke('insert_node', { parent: '/root', nodes: fields(3) }, ctxOf(emptySchema()))
    );
    let serial = emptySchema();
    for (const node of fields(3)) {
      serial = expectOk(
        await reg.invoke('insert_node', { parent: '/root', nodes: [node] }, ctxOf(serial))
      );
    }
    expect(buildOutline(batched)).toEqual(buildOutline(serial));
  });

  it('явный index не переворачивает пакет', async () => {
    // Наивная реализация вставляла бы каждый следующий узел ПЕРЕД предыдущим: index один и тот же.
    const base = expectOk(
      await reg.invoke(
        'insert_node',
        { parent: '/root', nodes: [{ component: FIELD, props: { label: 'Хвост' } }] },
        ctxOf(emptySchema())
      )
    );
    const schema = expectOk(
      await reg.invoke('insert_node', { parent: '/root', index: 0, nodes: fields(2) }, ctxOf(base))
    );
    expect(
      buildOutline(schema)
        .slice(1)
        .map((e) => e.label)
    ).toEqual(['Поле 0', 'Поле 1', 'Хвост']);
  });

  it('ответ называет адрес каждого узла — по ним модель правит их дальше', async () => {
    const res = await reg.invoke(
      'insert_node',
      { parent: '/root', nodes: fields(3) },
      ctxOf(emptySchema())
    );
    expect(res.ok).toBe(true);
    for (const i of [0, 1, 2]) expect(res.text).toContain(`/root/children/${i}`);
    // Журнал предпросмотра — строка на узел, а не на вызов.
    expect(res.ops).toHaveLength(3);
  });

  it('негодный узел в середине отменяет ВЕСЬ пакет и называет его номер', async () => {
    // Частично применённый пакет оставил бы черновик в состоянии, которого модель не знает: её
    // следующий вызов адресовал бы узлы по неверным индексам.
    const res = await reg.invoke(
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

  it('одиночная вставка номер элемента не приписывает — приписывать нечего', async () => {
    const res = await reg.invoke(
      'insert_node',
      { parent: '/root', nodes: [{ component: 'НетТакого' }] },
      ctxOf(emptySchema())
    );
    expect(res.text).not.toContain('nodes[');
  });
});

describe('set_node_prop пакетом', () => {
  const step0 = '/root/children/0';

  it('одни и те же свойства уходят на все адреса за один вызов', async () => {
    const refs = [`${step0}/children/0`, `${step0}/children/1`];
    const schema = expectOk(
      await reg.invoke('set_node_prop', { refs, props: { required: true } }, ctxOf(sampleSchema()))
    );
    const outline = buildOutline(schema);
    for (const ref of refs) expect(outline.find((e) => e.ref === ref)?.required).toBe(true);
  });

  it('несколько свойств одного узла — тоже один вызов', async () => {
    const ref = `${step0}/children/0`;
    const schema = expectOk(
      await reg.invoke(
        'set_node_prop',
        { refs: [ref], props: { required: true, label: 'Новая подпись' } },
        ctxOf(sampleSchema())
      )
    );
    const entry = buildOutline(schema).find((e) => e.ref === ref);
    expect(entry?.required).toBe(true);
    expect(entry?.label).toBe('Новая подпись');
  });

  it('ожидание при нескольких адресах отвергается — оно описывает один узел', async () => {
    const res = await reg.invoke(
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

  it('устаревший адрес в пакете отменяет весь вызов', async () => {
    const res = await reg.invoke(
      'set_node_prop',
      { refs: [`${step0}/children/0`, `${step0}/children/99`], props: { required: true } },
      ctxOf(sampleSchema())
    );
    expect(res.ok).toBe(false);
    expect(res.schema).toBeUndefined();
  });

  // ReFormer-kuj: `props` одни на все `refs`, и разные подписи шли отдельными вызовами — модель
  // упиралась в форму инструмента. `edits` даёт каждому узлу свои свойства за один вызов.
  it('edits: разные значения разным узлам — один вызов', async () => {
    const first = `${step0}/children/0`;
    const second = `${step0}/children/1`;
    const schema = expectOk(
      await reg.invoke(
        'set_node_prop',
        { edits: { [first]: { label: 'Первое' }, [second]: { label: 'Второе' } } },
        ctxOf(sampleSchema())
      )
    );
    const outline = buildOutline(schema);
    expect(outline.find((e) => e.ref === first)?.label).toBe('Первое');
    expect(outline.find((e) => e.ref === second)?.label).toBe('Второе');
  });

  it('edits сочетаются с общими props в одном вызове', async () => {
    const first = `${step0}/children/0`;
    const second = `${step0}/children/1`;
    const schema = expectOk(
      await reg.invoke(
        'set_node_prop',
        {
          refs: [first, second],
          props: { required: true },
          edits: { [second]: { label: 'Своё' } },
        },
        ctxOf(sampleSchema())
      )
    );
    const outline = buildOutline(schema);
    expect(outline.find((e) => e.ref === first)?.required).toBe(true);
    expect(outline.find((e) => e.ref === second)).toMatchObject({ required: true, label: 'Своё' });
  });

  it('вызов без refs/props и без edits отвергается', async () => {
    for (const params of [{}, { refs: [`${step0}/children/0`] }, { edits: { [step0]: {} } }]) {
      const res = await reg.invoke('set_node_prop', params, ctxOf(sampleSchema()));
      expect(res.error?.code).toBe('INVALID_PARAMS');
      expect(res.schema).toBeUndefined();
    }
  });
});

describe('remove_node пакетом', () => {
  it('соседей удаляет именно тех, что назвали, — сдвиг индексов не подводит', async () => {
    // Ровно тот класс ошибок, ради которого пакет и заведён: удаляя по одному по возрастанию,
    // модель сдвигала индексы и вторым вызовом сносила чужой узел.
    const base = expectOk(
      await reg.invoke(
        'insert_node',
        {
          parent: '/root',
          nodes: [0, 1, 2].map((i) => ({ component: FIELD, model: `f.${i}` })),
        },
        ctxOf(emptySchema())
      )
    );
    const schema = expectOk(
      await reg.invoke(
        'remove_node',
        { refs: ['/root/children/0', '/root/children/1'] },
        ctxOf(base)
      )
    );
    // Уцелеть должен ровно третий: первые два названы, а не «первые два по счёту после сдвига».
    expect(
      buildOutline(schema)
        .slice(1)
        .map((e) => e.model)
    ).toEqual(['f.2']);
  });

  it('порядок адресов в дереве считается по числам, а не по буквам', async () => {
    // На десяти и более соседях лексикографика врёт: '/children/10' < '/children/2'. Удаление
    // «с конца» перестало бы быть удалением с конца ровно там, где детей стало много.
    const base = expectOk(
      await reg.invoke(
        'insert_node',
        {
          parent: '/root',
          nodes: Array.from({ length: 12 }, (_, i) => ({ component: FIELD, model: `f.${i}` })),
        },
        ctxOf(emptySchema())
      )
    );
    const schema = expectOk(
      await reg.invoke(
        'remove_node',
        { refs: ['/root/children/2', '/root/children/10'] },
        ctxOf(base)
      )
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
  const ref = '/root/children/0/children/0';

  it('задаёт свойство', async () => {
    const schema = expectOk(
      await reg.invoke(
        'set_node_prop',
        { refs: [ref], props: { required: true } },
        ctxOf(sampleSchema())
      )
    );
    expect(buildOutline(schema).find((e) => e.ref === ref)?.required).toBe(true);
  });

  it('null удаляет свойство', async () => {
    const schema = expectOk(
      await reg.invoke(
        'set_node_prop',
        { refs: [ref], props: { label: null } },
        ctxOf(sampleSchema())
      )
    );
    expect(buildOutline(schema).find((e) => e.ref === ref)?.label).toBeUndefined();
  });

  it('key=text пишет содержимое узла, а не componentProps', async () => {
    // Подпись вкладки живёт текстовой частью children, и рендерер берёт её только оттуда. Пока
    // ключа не было, переименовать вкладку было нечем: модель перебирала пропы по кругу.
    const base = expectOk(
      await reg.invoke(
        'insert_node',
        { parent: '/root', nodes: [{ component: 'Tabs' }] },
        ctxOf(emptySchema())
      )
    );
    const trigger = '/root/children/0/children/0/children/0';
    const schema = expectOk(
      await reg.invoke(
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

  it('у шага подпись — свойство title, а не содержимое', async () => {
    // Наблюдалось вживую: модель переименовывала шаг ключом text, и слово «Шаг 2» вставало
    // абзацем НАД полями шага, а заголовок оставался прежним. У Step children — тело, не подпись.
    const res = await reg.invoke(
      'set_node_prop',
      { refs: ['/root/children/0'], props: { text: 'Шаг 2' } },
      ctxOf(sampleSchema())
    );
    expect(res.error?.code).toBe('INVALID_PARENT');
    expect(res.text).toContain('"title" property');
    expect(res.schema).toBeUndefined();
  });

  it('у мастера содержимого нет: текст не встаёт среди шагов', async () => {
    // Шаги — `children` визарда, и текстовая часть узла пишется туда же. Без отказа строка
    // оказалась бы в списке шагов наравне с ними.
    const res = await reg.invoke(
      'set_node_prop',
      { refs: ['/root'], props: { text: 'Заявка на кредит' } },
      ctxOf(sampleSchema())
    );
    expect(res.error?.code).toBe('INVALID_PARENT');
    expect(res.text).toContain('holds steps only');
    expect(res.schema).toBeUndefined();
  });

  it('содержимое из нескольких частей строкой не затирается', async () => {
    const draft = sampleSchema();
    const ref = '/root/children/0';
    const step = getAt(draft, [...P.step0]) as { children: unknown[] };
    step.children = ['Платёж: ', '$model(loanAmount)', ' ₽'];

    const res = await reg.invoke(
      'set_node_prop',
      { refs: [ref], props: { text: 'Итого' } },
      ctxOf(draft)
    );
    expect(res.ok).toBe(false);
    expect(res.schema).toBeUndefined();
  });

  it('у поля содержимого нет — отказ объясняет, чем задавать подпись', async () => {
    const res = await reg.invoke(
      'set_node_prop',
      { refs: [ref], props: { text: 'Сумма' } },
      ctxOf(sampleSchema())
    );
    expect(res.error?.code).toBe('INVALID_PARENT');
    expect(res.text).toContain('"label" property');
  });

  it('несовпавшее expect отклоняет правку, схема не тронута', async () => {
    const draft = sampleSchema();
    const res = await reg.invoke(
      'set_node_prop',
      { refs: [ref], props: { required: true }, expect: { model: 'loanAmount' } },
      ctxOf(draft)
    );
    expect(res.error?.code).toBe('STALE_POINTER');
    expect(res.schema).toBeUndefined();
  });

  it('значение неверного типа не проходит гейт', async () => {
    // Input.min — число; строка ломает componentProps-валидацию.
    const schema = expectOk(
      await reg.invoke(
        'insert_node',
        { parent: '/root', nodes: [{ component: 'Input', model: 'x' }] },
        ctxOf(emptySchema())
      )
    );
    const res = await reg.invoke(
      'set_node_prop',
      { refs: ['/root/children/0'], props: { min: 'не-число' } },
      ctxOf(schema, emptySchema())
    );
    expect(res.error?.code).toBe('SCHEMA_INVALID');
    expect(res.schema).toBeUndefined();
  });

  it('чужая ошибка, уехавшая на другой индекс, не считается новой', async () => {
    // Форма уже была битой (например, открыли чужую): у первого поля min — строка. Вставка узла
    // ПЕРЕД ним сдвигает children[0] → children[1], и дословное сравнение строк читало ту же самую
    // ошибку как новую — правка отвергалась, причём с указанием на узел, которого агент не трогал.
    const base = expectOk(
      await reg.invoke(
        'insert_node',
        { parent: '/root', nodes: [{ component: 'Input', model: 'x' }] },
        ctxOf(emptySchema())
      )
    );
    const broken = getAt(base, ['root', 'children', 0]) as {
      componentProps: Record<string, unknown>;
    };
    broken.componentProps = { ...broken.componentProps, min: 'не-число' };

    const res = await reg.invoke(
      'insert_node',
      { parent: '/root', index: 0, nodes: [{ component: FIELD, model: 'y' }] },
      ctxOf(base)
    );
    expect(res.error?.code, res.text).toBeUndefined();
    expect(res.schema).toBeDefined();
  });

  it('вторая такая же ошибка у того же узла — уже ухудшение', async () => {
    // Счётчики, а не множество: иначе форма с одной битой строкой молча принимала бы вторую.
    const base = expectOk(
      await reg.invoke(
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
      await reg.invoke(
        'insert_node',
        { parent: '/root', nodes: [{ component: 'Input', model: 'z' }] },
        ctxOf(base)
      )
    );
    const res = await reg.invoke(
      'set_node_prop',
      { refs: ['/root/children/1'], props: { min: 'тоже-не-число' } },
      ctxOf(withSecond, base)
    );
    expect(res.error?.code).toBe('SCHEMA_INVALID');
  });

  it('непричастные узлы сохраняют ссылочную идентичность', async () => {
    const base = sampleSchema();
    const schema = expectOk(
      await reg.invoke('set_node_prop', { refs: [ref], props: { required: true } }, ctxOf(base))
    );
    // Второй шаг правку не видел — structural sharing обязан сохранить тот же объект.
    expect(getAt(schema, P.step1)).toBe(getAt(base, P.step1));
    expect(getAt(schema, P.step0field1)).toBe(getAt(base, P.step0field1));
  });
});

describe('set_node_model', () => {
  it('перепривязывает поле', async () => {
    const ref = '/root/children/0/children/0';
    const schema = expectOk(
      await reg.invoke('set_node_model', { ref, model: 'loan.kind' }, ctxOf(sampleSchema()))
    );
    expect(buildOutline(schema).find((e) => e.ref === ref)?.model).toBe('loan.kind');
  });

  it('у контейнера привязки нет', async () => {
    const res = await reg.invoke(
      'set_node_model',
      { ref: '/root/children/0', model: 'x' },
      ctxOf(sampleSchema())
    );
    expect(res.error?.code).toBe('INVALID_PARENT');
  });

  it('массив перепривязывается тем же ключом model, что и поле', async () => {
    const ref = '/root/children/1/children/0';
    const schema = expectOk(
      await reg.invoke('set_node_model', { ref, model: 'assets' }, ctxOf(sampleSchema()))
    );
    const node = getAt(schema, [...P.array]) as Record<string, unknown>;
    expect(node.model).toBe('$model(assets)');
    expect(node).not.toHaveProperty('array');
    expect(node).not.toHaveProperty('value');
    // Узел остался массивом: шаблон строки на месте.
    expect(buildOutline(schema).find((e) => e.ref === ref)).toMatchObject({
      kind: 'array',
      model: 'assets',
    });
  });

  it('подформа перепривязывается к другой группе модели и остаётся подформой', async () => {
    const ref = '/root/children/0';
    const schema = expectOk(
      await reg.invoke('set_node_model', { ref, model: 'actualAddress' }, ctxOf(withParts()))
    );
    expect(getAt(schema, ['root', 'children', 0])).toEqual({
      model: '$model(actualAddress)',
      part: '$part(address)',
    });
  });
});

describe('remove_node', () => {
  it('удаляет узел и сообщает о вложенных', async () => {
    const res = await reg.invoke(
      'remove_node',
      { refs: ['/root/children/0'] },
      ctxOf(sampleSchema())
    );
    const schema = expectOk(res);
    expect(res.ops?.[0]?.summary).toContain('вложенные узлы');
    expect(buildOutline(schema).map((e) => e.ref)).not.toContain('/root/children/1');
  });
});

describe('move_node', () => {
  it('переносит узел в другой шаг', async () => {
    const schema = expectOk(
      await reg.invoke(
        'move_node',
        { ref: '/root/children/0/children/0', parent: '/root/children/1' },
        ctxOf(sampleSchema())
      )
    );
    const models = buildOutline(schema)
      .filter((e) => e.ref.startsWith('/root/children/1/children'))
      .map((e) => e.model);
    expect(models).toContain('loanType');
  });

  it('внутрь самого себя нельзя', async () => {
    const res = await reg.invoke(
      'move_node',
      { ref: '/root/children/0', parent: '/root/children/0' },
      ctxOf(sampleSchema())
    );
    expect(res.error?.code).toBe('INVALID_PARENT');
  });

  it('поле в мастер не переносится — в его children только шаги', async () => {
    // Адрес слота шагов кончается на `children`, как у любой секции: отличает его только вид слота.
    const res = await reg.invoke(
      'move_node',
      { ref: '/root/children/0/children/0', parent: '/root' },
      ctxOf(sampleSchema())
    );
    expect(res.error?.code).toBe('INVALID_PARENT');
    expect(res.text).toContain('A wizard holds steps only');
    expect(res.schema).toBeUndefined();
  });

  it('шаги переставляются внутри мастера тем же вызовом', async () => {
    const schema = expectOk(
      await reg.invoke(
        'move_node',
        { ref: '/root/children/1', parent: '/root', index: 0 },
        ctxOf(sampleSchema())
      )
    );
    expect(
      buildOutline(schema)
        .filter((e) => e.slot === 'steps')
        .map((e) => e.label)
    ).toEqual(['Имущество', 'Кредит']);
  });
});

describe('duplicate_node', () => {
  it('копия встаёт сразу после оригинала', async () => {
    const schema = expectOk(
      await reg.invoke(
        'duplicate_node',
        { ref: '/root/children/0/children/0' },
        ctxOf(sampleSchema())
      )
    );
    expect(
      buildOutline(schema)
        .filter((e) => e.ref.startsWith('/root/children/0/children'))
        .map((e) => e.model)
    ).toEqual(['loanType', 'loanType', 'loanAmount']);
  });

  it('шаблон массива дублировать нельзя', async () => {
    const res = await reg.invoke(
      'duplicate_node',
      { ref: '/root/children/1/children/0/item/$template' },
      ctxOf(sampleSchema())
    );
    expect(res.error?.code).toBe('INVALID_PARENT');
  });
});

describe('group_nodes', () => {
  const a = '/root/children/0/children/0';
  const b = '/root/children/0/children/1';

  it('оборачивает соседей в контейнер с заданной раскладкой', async () => {
    const schema = expectOk(
      await reg.invoke('group_nodes', { refs: [a, b], direction: 'row' }, ctxOf(sampleSchema()))
    );
    const group = buildOutline(schema).find((e) => e.ref === a);
    expect(group?.component).toBe('$html(div)');
    const cls = (
      getAt(schema, ['root', 'children', 0, 'children', 0, 'componentProps']) as {
        className: string;
      }
    ).className;
    expect(cls.split(/\s+/)).toContain('flex');
    expect(cls.split(/\s+/)).not.toContain('flex-col');
  });

  it('несоседние узлы группировать нельзя', async () => {
    const res = await reg.invoke(
      'group_nodes',
      { refs: [a, '/root/children/1/children/0'] },
      ctxOf(sampleSchema())
    );
    expect(res.error?.code).toBe('INVALID_PARENT');
  });

  it('шаги мастера группировать нельзя — обёртка схлопнула бы их в один', async () => {
    // groupBlock ставит на место блока один $html(div): два шага превратились бы в одну
    // безымянную страницу, а поля внутри — остались бы, но без своих шагов.
    const draft = sampleSchema();
    const res = await reg.invoke(
      'group_nodes',
      { refs: ['/root/children/0', '/root/children/1'] },
      ctxOf(draft)
    );
    expect(res.error?.code).toBe('INVALID_PARENT');
    // Отказ обязан назвать законную альтернативу, иначе модель повторит тот же вызов.
    expect(res.text).toContain('INSIDE a step');
    expect(res.schema).toBeUndefined();
  });

  it('меньше двух узлов отклоняется схемой аргументов', async () => {
    expect(
      (await reg.invoke('group_nodes', { refs: [a] }, ctxOf(sampleSchema()))).error?.code
    ).toBe('INVALID_PARAMS');
  });
});

describe('set_layout', () => {
  it('меняет раскладку контейнера, сохраняя оформление', async () => {
    const schema = expectOk(
      await reg.invoke('set_layout', { ref: '/root', columns: 2 }, ctxOf(sampleSchema()))
    );
    const cls = (getAt(schema, ['root', 'componentProps']) as { className: string }).className;
    expect(cls.split(/\s+/)).toEqual(expect.arrayContaining(['bg-white', 'grid', 'grid-cols-2']));
  });

  it('у поля раскладки нет', async () => {
    const res = await reg.invoke(
      'set_layout',
      { ref: '/root/children/0/children/0', direction: 'row' },
      ctxOf(sampleSchema())
    );
    expect(res.error?.code).toBe('INVALID_PARENT');
  });
});

describe('замечания к успешной правке — вдогонку, а не отдельным вызовом', () => {
  /** Правило валидации на поле, которое в форме есть: осиротеет, только если поле убрать. */
  const withRule = (): FormRules => ({
    ...emptyRules(),
    validation: [{ target: 'loanAmount', rules: ['required'] }],
  });

  /** Адрес того самого поля в схеме-фикстуре. */
  const LOAN_AMOUNT = '/root/children/0/children/1';

  it('правка, осиротившая правило, сообщает об этом сразу — без отдельного validate_form', async () => {
    // Правило на удалённое поле в рантайме не делает НИЧЕГО и молча: на валидность схемы это не
    // влияет, поэтому гейт правку принимает. Но узнавать об этом в конце хода отдельным вызовом —
    // целый лишний обход «модель → инструмент → модель».
    const schema = sampleSchema();
    const res = await reg.invoke(
      'remove_node',
      { refs: [LOAN_AMOUNT] },
      { draft: schema, base: schema, rules: withRule(), catalog, validateForm: validateFormSchema }
    );
    expect(res.ok).toBe(true);
    expect(res.text).toContain('Heads up');
    expect(res.text).toContain('loanAmount');
  });

  it('давнее замечание чужой формы не упрекает агента на каждой правке', async () => {
    // Политика «не обязана лечить, но обязана не ухудшать»: замечание, уже бывшее в базе, новым
    // не считается — иначе любая правка кривой формы выглядела бы как её порча.
    const schema = sampleSchema();
    const broken = expectOk(
      await reg.invoke(
        'remove_node',
        { refs: [LOAN_AMOUNT] },
        {
          draft: schema,
          base: schema,
          rules: withRule(),
          catalog,
          validateForm: validateFormSchema,
        }
      )
    );
    const res = await reg.invoke(
      'insert_node',
      {
        parent: '/root/children/0',
        nodes: [{ component: FIELD, props: { label: 'Имя' } }],
      },
      { draft: broken, base: broken, rules: withRule(), catalog, validateForm: validateFormSchema }
    );
    expect(res.ok).toBe(true);
    expect(res.text).not.toContain('Heads up');
  });

  it('чистая правка ответ не удлиняет', async () => {
    const res = await reg.invoke(
      'insert_node',
      { parent: '/root', nodes: [{ component: FIELD, props: { label: 'Имя' } }] },
      ctxOf(emptySchema())
    );
    expect(res.text).not.toContain('Heads up');
  });
});

describe('особые ключи узла: $disabled и $newRow', () => {
  const ref = '/root/children/0/children/0';

  it('$disabled кладётся в сам узел поля, а не в componentProps', async () => {
    const schema = expectOk(
      await reg.invoke(
        'set_node_prop',
        { refs: [ref], props: { $disabled: true } },
        ctxOf(sampleSchema())
      )
    );
    const node = getAt(schema, ['root', 'children', 0, 'children', 0]) as Record<string, unknown>;
    expect(node.disabled).toBe(true);
    expect((node.componentProps as Record<string, unknown> | undefined)?.$disabled).toBeUndefined();

    const cleared = expectOk(
      await reg.invoke('set_node_prop', { refs: [ref], props: { $disabled: null } }, ctxOf(schema))
    );
    expect(
      (getAt(cleared, ['root', 'children', 0, 'children', 0]) as Record<string, unknown>).disabled
    ).toBeUndefined();
  });

  it('$newRow задаёт шаблон новой строки массива при вставке; у поля — отказ', async () => {
    const schema = expectOk(
      await reg.invoke(
        'insert_node',
        {
          parent: '/root',
          nodes: [{ component: 'FieldArray', model: 'phones', props: { $newRow: { number: '' } } }],
        },
        ctxOf(emptySchema())
      )
    );
    const array = (schema.root as unknown as { children: Record<string, unknown>[] }).children[0];
    expect(array.initialValue).toEqual({ number: '' });

    const onField = await reg.invoke(
      'set_node_prop',
      { refs: [ref], props: { $newRow: {} } },
      ctxOf(sampleSchema())
    );
    expect(onField.error?.code).toBe('INVALID_PARAMS');
  });

  it('значение свойства — массив: варианты готового списка правятся на месте', async () => {
    const options = [
      { value: 'a', label: 'А' },
      { value: 'b', label: 'Б' },
    ];
    const res = await reg.invoke(
      'set_node_prop',
      { refs: [ref], props: { options } },
      ctxOf(sampleSchema())
    );
    // Принять или отвергнуть массив решает схема свойств компонента, а не схема параметров.
    expect(res.error?.code).not.toBe('INVALID_PARAMS');
  });
});

describe('extract_part — блок в часть и её второе подключение', () => {
  /** Форма с блоком адреса регистрации: поля лежат в группе `registration`. */
  function withAddressBlock(): JsonFormSchema {
    return {
      format: 2,
      root: {
        component: '$component(Box)',
        children: [
          {
            component: '$component(Box)',
            children: [
              { model: '$model(registration.city)', component: `$component(${FIELD})` },
              { model: '$model(registration.street)', component: `$component(${FIELD})` },
            ],
          },
        ],
      },
    } as unknown as JsonFormSchema;
  }

  it('блок уходит в часть с путями от группы, на его месте — подключение части', async () => {
    const schema = expectOk(
      await reg.invoke(
        'extract_part',
        { ref: '/root/children/0', name: 'address', model: 'registration' },
        ctxOf(withAddressBlock())
      )
    );
    expect(getAt(schema, ['root', 'children', 0])).toEqual({
      model: '$model(registration)',
      part: '$part(address)',
    });
    const fields = getAt(schema, ['parts', 'address', 'children']) as { model: string }[];
    expect(fields.map((field) => field.model)).toEqual(['$model(city)', '$model(street)']);

    // Второе подключение той же части — к другой группе.
    const twice = expectOk(
      await reg.invoke(
        'insert_node',
        { parent: '/root', nodes: [{ part: 'address', model: 'actual' }] },
        ctxOf(schema)
      )
    );
    expect(getAt(twice, ['root', 'children', 1])).toEqual({
      model: '$model(actual)',
      part: '$part(address)',
    });
  });

  it('поле вне группы и занятое имя — отказ; подключение несуществующей части — отказ', async () => {
    const outside = await reg.invoke(
      'extract_part',
      { ref: '/root/children/0', name: 'address', model: 'home' },
      ctxOf(withAddressBlock())
    );
    expect(outside.error?.code).toBe('INVALID_PARAMS');
    expect(outside.text).toContain('registration.city');

    const mount = await reg.invoke(
      'insert_node',
      { parent: '/root', nodes: [{ part: 'nope', model: 'actual' }] },
      ctxOf(withAddressBlock())
    );
    expect(mount.error?.code).toBe('INVALID_PARAMS');
  });
});

describe('содержимое части правится по адресу /parts/…', () => {
  it('поле части получает свойство, в часть вставляется поле', async () => {
    const base = withParts();
    const labelled = expectOk(
      await reg.invoke(
        'set_node_prop',
        { refs: ['/parts/address/children/0'], props: { label: 'Город' } },
        ctxOf(base)
      )
    );
    expect(getAt(labelled, ['parts', 'address', 'children', 0, 'componentProps'])).toMatchObject({
      label: 'Город',
    });
    const inserted = expectOk(
      await reg.invoke(
        'insert_node',
        { parent: '/parts/address', nodes: [{ component: FIELD, model: 'street' }] },
        ctxOf(labelled)
      )
    );
    expect(getAt(inserted, ['parts', 'address', 'children', 1, 'model'])).toBe('$model(street)');
  });
});
