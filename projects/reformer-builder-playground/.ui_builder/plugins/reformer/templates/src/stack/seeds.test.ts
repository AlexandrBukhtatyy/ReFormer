/**
 * Затравки встроенных шаблонов: состав анкеты, её правила и подгонка под кит.
 *
 * Проверяется то, ради чего затравки стали содержательными: по одному образцу каждого вида поля,
 * правила, которые указывают в существующие узлы, и состав, следующий каталогу кита.
 *
 * @module plugins/reformer/templates/stack/seeds.test
 */

import { describe, expect, it } from 'vitest';
import {
  collectSchemaSelectors,
  type JsonFormSchema,
  type JsonNode,
} from '@reformer/renderer-json';
import { arrayNode, fieldNode, type CatalogEntry } from '../../../core/catalog';
import {
  checkRules,
  childSlots,
  collectModelPaths,
  collectOperatorNames,
  componentOf,
  labelOf,
  modelOf,
  walkNodes,
} from '../../../core/form-model';
import { builtinEntries, builtinKit, noWizardKit } from '../../../core/testing';
import {
  hasWizard,
  seedData,
  seedKitOf,
  simpleRules,
  simpleSeed,
  wizardRules,
  wizardSeed,
} from './seeds';

const childrenOf = (node: JsonNode): JsonNode[] => (node as { children: JsonNode[] }).children;

/** Все пути анкеты, в порядке полей на форме. */
const PATHS = [
  'lastName',
  'firstName',
  'fullName',
  'birthDate',
  'gender',
  'phone',
  'email',
  'city',
  'position',
  'skills',
  'experience',
  'about',
  'documents',
  'hasReferences',
  'references',
  'agree',
];

/** Сколько раз компонент стоит среди полей формы — без полей строки массива. */
function countOf(schema: JsonFormSchema): Map<string, number> {
  const counts = new Map<string, number>();
  walkNodes(schema, (node, path) => {
    // Шаблон строки массива — не поле формы: его пути относительны строке.
    if (path.includes('$template')) return;
    if (modelOf(node) === undefined) return;
    const name = componentOf(node) ?? '';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  });
  return counts;
}

/** Узел массива рекомендателей. */
function arrayOf(schema: JsonFormSchema): JsonNode & Record<string, unknown> {
  let found: JsonNode | undefined;
  walkNodes(schema, (node) => {
    if (modelOf(node) === 'references') found = node;
  });
  if (found === undefined) throw new Error('массива в затравке нет');
  return found as JsonNode & Record<string, unknown>;
}

/**
 * Запись каталога с закрытым списком пропсов.
 *
 * Узел записи массива собирает та же фабрика, что в настоящем каталоге: с компонентом — у кита,
 * который массив рисует, без него — у кита, которому запись досталась только от билдера.
 */
function entry(name: string, role: CatalogEntry['role'], props?: readonly string[]): CatalogEntry {
  return {
    name,
    role,
    propsSchema: (props === undefined
      ? { type: 'object' }
      : {
          type: 'object',
          additionalProperties: false,
          properties: Object.fromEntries(props.map((prop) => [prop, {}])),
        }) as CatalogEntry['propsSchema'],
    makeNode: () => (role === 'array' ? arrayNode(name) : fieldNode(name)),
  };
}

/** Запись массива у кита без компонента массива: её добавил билдер, рисовать её киту нечем. */
function syntheticArrayEntry(): CatalogEntry {
  return { ...entry('FieldArray', 'array'), makeNode: () => arrayNode() };
}

describe('состав анкеты', () => {
  it('документ формата 2, привязка поля — в `model` и только в нём', () => {
    const schema = simpleSeed();

    expect(schema.format).toBe(2);
    expect(collectModelPaths(schema)).toEqual(PATHS);
    // Привязку ставит фабрика узла (`newField`), затравка её переписывает. Второй ключ рядом
    // с `model` оставил бы все поля привязанными к одному пути.
    walkNodes(schema, (node) => {
      expect(node).not.toHaveProperty('value');
      expect(modelOf(node)).not.toBe('newField');
    });
  });

  it('по одному образцу каждого вида поля с нетривиальным API', () => {
    const counts = countOf(simpleSeed());

    // Ровно по одному: образец копируют, и второй такой же только мешал бы выбрать, с какого.
    for (const component of [
      'InputMask',
      'InputNumber',
      'DatePicker',
      'RadioGroup',
      'Select',
      'Combobox',
      'ComboboxMulti',
      'Textarea',
      'FileUploadDropzone',
      'FieldArray',
    ]) {
      expect(counts.get(component), component).toBe(1);
    }
    // Текстовых полей и флажков несколько, и это не образцы одного и того же: обязательное,
    // вычисляемое, с типом `email`; флажок-условие и флажок-согласие.
    expect(counts.get('Input')).toBe(4);
    expect(counts.get('Checkbox')).toBe(2);
    expect([...counts.keys()].sort()).toEqual(
      [
        'Checkbox',
        'Combobox',
        'ComboboxMulti',
        'DatePicker',
        'FieldArray',
        'FileUploadDropzone',
        'Input',
        'InputMask',
        'InputNumber',
        'RadioGroup',
        'Select',
        'Textarea',
      ].sort()
    );
  });

  it('комбобокс, мультикомбобокс и выбор даты — то, чем были задуманы поля анкеты', () => {
    // Прежде их место занимали ввод с подсказками, мультивыбор и `Input` с типом `date`: импорт
    // комбобокса и выбора даты из главного входа кита не компилировался. Теперь образец один на
    // вид поля — второй «список» или вторая «дата» только мешали бы выбрать, что копировать.
    const nodes = new Map<string, JsonNode>();
    walkNodes(simpleSeed(), (node) => {
      const path = modelOf(node);
      if (path !== undefined) nodes.set(path, node);
    });
    const nodeOf = (path: string): JsonNode => {
      const node = nodes.get(path);
      if (node === undefined) throw new Error(`поля «${path}» в затравке нет`);
      return node;
    };
    const props = (path: string): unknown =>
      (nodeOf(path) as { componentProps?: unknown }).componentProps;

    expect(componentOf(nodeOf('position'))).toBe('Combobox');
    // Опции — из источника данных, крестик очистки включён: оба — то, ради чего поле копируют.
    expect(props('position')).toMatchObject({
      options: '$dataSource(POSITIONS)',
      clearable: true,
    });

    expect(componentOf(nodeOf('skills'))).toBe('ComboboxMulti');
    expect(props('skills')).toMatchObject({ options: '$dataSource(SKILLS)', maxItems: 3 });

    expect(componentOf(nodeOf('birthDate'))).toBe('DatePicker');
    expect(props('birthDate')).toMatchObject({ dateFormat: 'dd.MM.yyyy' });
    // Ни одного из прежних заменителей в анкете не осталось.
    const counts = countOf(simpleSeed());
    expect(counts.has('InputSuggest')).toBe(false);
    expect(counts.has('SelectMulti')).toBe(false);
    expect(props('birthDate')).not.toHaveProperty('type');
  });

  it('потолок мультикомбобокса в интерфейсе и правило формы называют одно число', () => {
    // `maxItems` — подсказка интерфейса (лишние пункты выключаются), а не правило формы: значение,
    // пришедшее мимо контрола, ловит только валидатор. Разойдись числа — форма принимала бы
    // выбор, который сама же не даёт сделать, или наоборот.
    const rule = simpleRules().validation.find((item) => item.target === 'skills');
    expect(rule?.rules).toEqual(['maxLength(3)']);
    // Потолок меньше числа опций — иначе упереться в него нельзя и образец ничего не показывает.
    expect((seedData().dataSources.SKILLS as unknown[]).length).toBeGreaterThan(3);
    // Дата рождения — не в будущем: правило читает `Date`, который кладёт выбор даты.
    expect(simpleRules().validation.find((item) => item.target === 'birthDate')?.rules).toEqual([
      'pastDate',
    ]);
    // Комбобокс-должность необязателен и правил не несёт: поле убирается, не задев соседей.
    expect(simpleRules().validation.some((item) => item.target === 'position')).toBe(false);
  });

  it('у каждого поля осмысленные пропсы, а не пустой объект', () => {
    walkNodes(simpleSeed(), (node) => {
      if (modelOf(node) === undefined) return;
      const props = (node as { componentProps?: Record<string, unknown> }).componentProps ?? {};
      // Подпись — минимум: по ней поле узнают и на форме, и в дереве редактора.
      expect(labelOf(node), modelOf(node)).toBeTruthy();
      expect(Object.keys(props).length, modelOf(node)).toBeGreaterThan(0);
    });
  });

  it('массив — секция со строкой-шаблоном, подписью строки и строкой для «добавить»', () => {
    const array = arrayOf(simpleSeed());

    // Без компонента рендерер рисует одни строки: ни «добавить», ни подписи строки.
    expect(array.component).toBe('$component(FieldArray)');
    expect(array.componentProps).toMatchObject({
      title: 'Рекомендатели',
      itemLabel: '$dataSource(REFERENCE_LABEL)',
      addButtonLabel: '+ Добавить рекомендателя',
    });
    const row = (array.item as { $template: JsonNode }).$template;
    expect(childrenOf(row).map(modelOf)).toEqual(['name', 'phone']);
    expect(childrenOf(row).map(componentOf)).toEqual(['Input', 'InputMask']);
    // Ключи новой строки покрывают все поля шаблона: поле без ключа осталось бы без сигнала.
    expect(array.initialValue).toEqual({ name: '', phone: '' });
  });

  it('списки берутся из источников данных, а не вписаны в схему', () => {
    expect(collectOperatorNames(simpleSeed()).dataSources.sort()).toEqual([
      'CITY_LIST',
      'GENDERS',
      'POSITIONS',
      'REFERENCE_LABEL',
      'SKILLS',
    ]);
  });

  it('простая форма — три секции и кнопка отправки', () => {
    const sections = childrenOf(simpleSeed().root);

    expect(sections.map(componentOf)).toEqual(['Section', 'Section', 'Section', 'Button']);
    expect(sections.slice(0, 3).map(labelOf)).toEqual([
      'Личные данные',
      'Контакты',
      'Дополнительно',
    ]);
  });

  it('шаги пошаговой формы — дети визарда, а не его пропс; поля те же', () => {
    const schema = wizardSeed();
    const [wizard] = childrenOf(schema.root);
    const slots = childSlots(wizard, ['root', 'children', 0]);

    expect(slots.map((slot) => slot.kind)).toEqual(['steps']);
    expect(wizard).not.toHaveProperty('componentProps.steps');
    const steps = slots[0].entries.map((item) => item.node);
    expect(steps.map(labelOf)).toEqual(['Данные', 'Контакты', 'Дополнительно']);
    // Те же поля в том же порядке — пошаговая форма отличается раскладкой, а не составом.
    expect(collectModelPaths(schema)).toEqual(PATHS);
    expect(countOf(schema)).toEqual(countOf(simpleSeed()));
  });

  it('две сборки затравки не делят узлы: правка одной схемы не задевает другую', () => {
    // Прежде проверялось на списке подсказок поля ввода; того поля в анкете больше нет, а
    // свойство то же — ни пропсы поля, ни строка-шаблон массива между сборками не общие.
    const first = simpleSeed();
    const second = simpleSeed();
    const propsOf = (schema: JsonFormSchema, path: string): Record<string, unknown> => {
      let found: Record<string, unknown> = {};
      walkNodes(schema, (node) => {
        const props = (node as { componentProps?: Record<string, unknown> }).componentProps;
        if (modelOf(node) === path && props !== undefined) found = props;
      });
      return found;
    };
    const rowOf = (schema: JsonFormSchema): JsonNode[] =>
      childrenOf((arrayOf(schema).item as { $template: JsonNode }).$template);

    propsOf(first, 'position').placeholder = 'Чужое';
    propsOf(first, 'skills').maxItems = 99;
    rowOf(first).push({ component: '$component(Input)' } as JsonNode);
    (arrayOf(first).initialValue as Record<string, unknown>).extra = 'Чужое';

    expect(propsOf(second, 'position').placeholder).toBe('Выберите должность');
    expect(propsOf(second, 'skills').maxItems).toBe(3);
    expect(rowOf(second)).toHaveLength(2);
    expect(arrayOf(second).initialValue).toEqual({ name: '', phone: '' });
  });
});

describe('правила анкеты', () => {
  const SEEDS = [
    { name: 'простая форма', schema: simpleSeed(), rules: simpleRules() },
    { name: 'пошаговая форма', schema: wizardSeed(), rules: wizardRules() },
  ];

  it.each(SEEDS)('$name: правило узла адресует селектор, который в схеме есть', (seed) => {
    const selectors = new Set(collectSchemaSelectors(seed.schema));

    expect(seed.rules.render.length).toBeGreaterThan(0);
    for (const rule of seed.rules.render) {
      // Селектор проставлен в затравке ЯВНО: правило не ждёт, что кодоген выведет его из пути.
      expect(selectors.has(rule.selector), rule.selector).toBe(true);
    }
  });

  it.each(SEEDS)('$name: ни одно правило не указывает в никуда', (seed) => {
    // Та же проверка, которой редактор схемы встречает открытую форму.
    expect(checkRules(seed.schema, seed.rules)).toEqual([]);
  });

  it('условие правила узла читает МОДЕЛЬ, а не поле формы', () => {
    for (const rule of simpleRules().render) {
      if (rule.kind !== 'hideWhen') continue;
      expect(rule.condition).toBe('!model.hasReferences');
      expect(rule.condition).not.toContain('form.');
    }
  });

  it('валидация: обязательность, почта, границы числа и правило по строкам массива', () => {
    const byTarget = new Map(simpleRules().validation.map((rule) => [rule.target, rule]));

    expect(byTarget.get('lastName')?.rules).toEqual(['required']);
    expect(byTarget.get('email')?.rules).toEqual(['required', 'email']);
    expect(byTarget.get('experience')?.rules).toEqual(['min(0)', 'max(50)']);
    // Правило строки: цель полным путём, массив — в `each`. Так его принимает и проверка
    // целостности правил, и печать.
    expect(byTarget.get('references.name')).toMatchObject({
      each: 'references',
      rules: ['required'],
    });
  });

  it('связей между полями ровно две: вычисляемое поле и рекомендатели под флажком', () => {
    const rules = simpleRules();

    // Каждая связь — помеха удалению поля. Третья сделала бы шаблон хрупким: убрал поле —
    // сломал соседа. У второй связи две стороны — узел скрыт, поле модели выключено и пусто, — и
    // обе выведены из одной записи затравки.
    expect(rules.behavior).toEqual([
      {
        kind: 'computeFrom',
        target: 'fullName',
        sources: ['lastName', 'firstName'],
        expr: "[lastName, firstName].filter(Boolean).join(' ')",
      },
      {
        kind: 'enableWhen',
        target: 'references',
        sources: ['hasReferences'],
        expr: 'model.hasReferences',
      },
    ]);
    expect(rules.render).toHaveLength(1);
    expect(rules.validation.every((rule) => rule.when === undefined)).toBe(true);
  });

  it('скрытый массив ещё и выключен: пустая строка под снятым флажком не держит отправку', () => {
    // `hideWhen` убирает узел с экрана, а строки в модели остаются — и правило строки проверяло
    // бы их дальше: форма не отправлялась бы из-за поля, которого не видно. Поэтому рядом с
    // правилом видимости стоит `enableWhen` по тому же флажку.
    const rules = simpleRules();
    const hidden = rules.render.find((rule) => rule.kind === 'hideWhen');
    const enabled = rules.behavior.find((rule) => rule.kind === 'enableWhen');

    expect(hidden).toMatchObject({ selector: 'references', condition: '!model.hasReferences' });
    // Массив включён ровно тогда, когда не скрыт: условия — отрицания друг друга.
    expect(enabled).toMatchObject({ target: 'references', expr: 'model.hasReferences' });
    // Цель — сам массив, а не поле строки: выключается он целиком, со всеми строками.
    expect(rules.validation.some((rule) => rule.each === enabled?.target)).toBe(true);
    // Без сброса: выключенные строки не проверяет ни отправка простой формы, ни визард — обе
    // проверяют форму как сборка, — а набранное возвращается вместе с флажком.
    expect(enabled?.options).toBeUndefined();
  });
});

describe('данные затравки', () => {
  it('источники — настоящие значения, а не синтезированные option1/2/3', () => {
    const { dataSources } = seedData();

    expect(Object.keys(dataSources).sort()).toEqual([
      'CITY_LIST',
      'GENDERS',
      'POSITIONS',
      'SKILLS',
    ]);
    expect(dataSources.CITY_LIST).toContainEqual({ value: 'msk', label: 'Москва' });
    expect(dataSources.POSITIONS).toContainEqual({ value: 'developer', label: 'Разработчик' });
    expect(JSON.stringify(dataSources)).not.toContain('option1');
  });

  it('значения полей — только для предпросмотра и только существующих полей', () => {
    const { model } = seedData();

    for (const path of Object.keys(model)) expect(PATHS).toContain(path);
    expect(model).toMatchObject({ lastName: 'Иванов', firstName: 'Иван', city: 'msk' });
  });
});

describe('затравка следует каталогу кита', () => {
  it('под встроенным китом — анкета целиком, и каталог знает каждый её компонент', () => {
    const kit = seedKitOf(builtinEntries());

    expect(simpleSeed(kit)).toEqual(simpleSeed());
    expect(wizardSeed(kit)).toEqual(wizardSeed());
    expect(simpleRules(kit)).toEqual(simpleRules());
    expect(hasWizard(kit)).toBe(true);
  });

  it('без каталога (кит ещё не доехал) — анкета целиком', () => {
    // Пустой каталог не значит «у кита ничего нет»: сказать о компонентах пока нечего.
    expect(seedKitOf([])).toBeUndefined();
    expect(simpleSeed(seedKitOf([]))).toEqual(simpleSeed());
  });

  it('компонента нет в каталоге — нет ни поля, ни его правила, ни его источника', () => {
    // Кит в объёме HexaUI: полей шесть; масок, радиогрупп, комбобоксов, выбора даты, загрузки
    // файлов и массива нет.
    const kit = seedKitOf([
      entry('Box', 'container'),
      entry('Section', 'container'),
      entry('Button', 'container'),
      entry('Input', 'field'),
      entry('InputNumber', 'field'),
      entry('Textarea', 'field'),
      entry('Checkbox', 'field'),
      entry('Select', 'field'),
    ]);
    const schema = simpleSeed(kit);
    const rules = simpleRules(kit);

    expect(collectOperatorNames(schema).components.sort()).toEqual(
      ['Box', 'Button', 'Checkbox', 'Input', 'InputNumber', 'Section', 'Select', 'Textarea'].sort()
    );
    // Комбобокса, мультикомбобокса и выбора даты у такого кита нет — нет и их полей: заменять
    // их похожим компонентом затравка не берётся.
    expect(collectModelPaths(schema)).toEqual([
      'lastName',
      'firstName',
      'fullName',
      'email',
      'city',
      'experience',
      'about',
      'agree',
    ]);
    // Правила остались только у полей, которые есть: ни одно не указывает в никуда.
    expect(checkRules(schema, rules)).toEqual([]);
    expect(rules.validation.map((rule) => rule.target)).toEqual([
      'lastName',
      'firstName',
      'email',
      'experience',
      'about',
      'agree',
    ]);
    // Массива нет — нет ни правила его видимости, ни флажка, который существовал ради него.
    expect(rules.render).toEqual([]);
    expect(collectModelPaths(schema)).not.toContain('hasReferences');
    expect(Object.keys(seedData(kit).dataSources)).toEqual(['CITY_LIST']);
  });

  it('проп, которого каталог компоненту не объявил, не пишется', () => {
    const kit = seedKitOf([
      entry('Box', 'container', ['className']),
      // Секция кита без заголовка, поле ввода без `readOnly`, `type` и `description`.
      entry('Section', 'container', ['className']),
      entry('Input', 'field', ['label', 'placeholder', 'required']),
    ]);
    const schema = simpleSeed(kit);
    const props = new Map<string, Record<string, unknown>>();
    walkNodes(schema, (node) => {
      const path = modelOf(node);
      const own = (node as { componentProps?: Record<string, unknown> }).componentProps;
      if (path !== undefined && own !== undefined) props.set(path, own);
    });

    expect(props.get('fullName')).toEqual({ label: 'Полное имя' });
    expect(props.get('email')).toEqual({
      label: 'Электронная почта',
      placeholder: 'name@example.com',
      required: true,
    });
    const [section] = childrenOf(schema.root);
    expect((section as { componentProps: unknown }).componentProps).toEqual({
      className: 'space-y-4',
    });
    // Секция осталась адресуемой: селектор — свойство узла, а не проп компонента.
    expect(section).toMatchObject({ selector: 'personal-section' });
  });

  it('кит без секции получает обычный контейнер, без кнопки — форму без неё', () => {
    const kit = seedKitOf([entry('Box', 'container'), entry('Input', 'field')]);

    // Отправку в форму без кнопки вставит кодоген — как у любой формы без неё.
    expect(childrenOf(simpleSeed(kit).root).map(componentOf)).toEqual(['Box', 'Box']);
  });

  it('флажок-условие без массива не нужен; массив без флажка виден всегда', () => {
    const fields = ['Box', 'Section', 'Button', 'Input'].map((name) =>
      entry(name, name === 'Input' ? 'field' : 'container')
    );
    const withoutArray = seedKitOf([...fields, entry('Checkbox', 'field')]);
    const withoutFlag = seedKitOf([...fields, entry('FieldArray', 'array')]);

    expect(collectModelPaths(simpleSeed(withoutArray))).not.toContain('hasReferences');
    expect(collectModelPaths(simpleSeed(withoutArray))).toContain('agree');

    expect(collectModelPaths(simpleSeed(withoutFlag))).toContain('references');
    expect(simpleRules(withoutFlag).render).toEqual([]);
    // И не выключается: выключать его нечем — флажка нет, а значит, нет и условия.
    expect(simpleRules(withoutFlag).behavior.some((rule) => rule.kind === 'enableWhen')).toBe(
      false
    );
    // В строке осталось только то, что кит умеет нарисовать.
    const row = (arrayOf(simpleSeed(withoutFlag)).item as { $template: JsonNode }).$template;
    expect(childrenOf(row).map(modelOf)).toEqual(['name']);
    expect(arrayOf(simpleSeed(withoutFlag)).initialValue).toEqual({ name: '' });
  });

  it('кит без компонента массива: запись массива в каталоге есть, а массива в затравке нет', () => {
    // Запись `FieldArray` билдер добавляет к каталогу ЛЮБОГО кита — узел-массив его собственный.
    // Рисует же массив компонент кита, и у кита без него (так у HexaUI) узел затравки сослался бы
    // на символ, которого в пакете кита нет: реестр модуля уехал бы с несуществующим импортом.
    const fields = ['Box', 'Section', 'Button'].map((name) => entry(name, 'container'));
    const inputs = ['Input', 'Checkbox'].map((name) => entry(name, 'field'));
    const drawsArray = seedKitOf([...fields, ...inputs, entry('FieldArray', 'array')]);
    const noArray = seedKitOf([...fields, ...inputs, syntheticArrayEntry()]);

    expect(drawsArray?.array).toBe(true);
    expect(noArray?.array).toBe(false);
    // Запись в каталоге есть у обоих — по одному её наличию киты не различить.
    expect(noArray?.has('FieldArray')).toBe(true);

    const schema = simpleSeed(noArray);
    const rules = simpleRules(noArray);
    expect(collectModelPaths(schema)).not.toContain('references');
    expect(collectOperatorNames(schema).components).not.toContain('FieldArray');
    // Вместе с массивом уходит всё, что существовало ради него: флажок, подпись строки, правило
    // видимости, связь доступности и правило строки.
    expect(collectModelPaths(schema)).not.toContain('hasReferences');
    expect(collectOperatorNames(schema).dataSources).not.toContain('REFERENCE_LABEL');
    expect(rules.render).toEqual([]);
    expect(rules.behavior.map((rule) => rule.kind)).toEqual(['computeFrom']);
    expect(rules.validation.some((rule) => rule.each !== undefined)).toBe(false);
    expect(checkRules(schema, rules)).toEqual([]);
    // Остальное — как было: флажок согласия на месте, поля кита тоже.
    expect(collectModelPaths(schema)).toEqual([
      'lastName',
      'firstName',
      'fullName',
      'email',
      'agree',
    ]);

    // У кита с компонентом массив на месте — вместе с флажком и обоими правилами.
    expect(collectModelPaths(simpleSeed(drawsArray))).toEqual(
      expect.arrayContaining(['hasReferences', 'references'])
    );
    expect(simpleRules(drawsArray).behavior.map((rule) => rule.kind)).toEqual([
      'computeFrom',
      'enableWhen',
    ]);
  });

  it('пошаговой формы нет у кита без визарда и шага в каталоге', () => {
    expect(hasWizard(seedKitOf([entry('Box', 'container'), entry('Input', 'field')]))).toBe(false);
    expect(
      hasWizard(
        seedKitOf([
          entry('Box', 'container'),
          entry('Wizard', 'container'),
          entry('Step', 'container'),
        ])
      )
    ).toBe(true);
  });

  it('и у кита без адаптера визарда: узлы в каталоге есть, а рисовать их нечем', () => {
    // Узлы `Wizard` и `Step` билдер добавляет к каталогу ЛЮБОГО кита, поэтому одного каталога
    // мало. Без адаптера кодоген регистрирует визард заглушкой: все шаги разом и без отправки.
    const catalog = builtinEntries();

    expect(hasWizard(seedKitOf(catalog, builtinKit().kit))).toBe(true);
    expect(hasWizard(seedKitOf(catalog, noWizardKit().kit))).toBe(false);
    // Дескриптора нет — отказать не на чем.
    expect(hasWizard(seedKitOf(catalog, null))).toBe(true);
  });
});
