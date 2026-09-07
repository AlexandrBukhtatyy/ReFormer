import { describe, expect, it } from 'vitest';

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { validateFormSchema } from '@reformer/renderer-json/validate';
import { builtinEntries } from '@/lib/catalog/__fixtures__/builtin-catalog';
import { ensureNodeIds, type NodeIdFactory } from '@/lib/form-model/node-id';
import { emptyRules, type FormRules } from '@/lib/form-model/rules';
import type { Diagnostic } from '@/sdk';
import { checkForm, dedupe } from './check';
import { CODES, COMMANDS, QUICKFIX } from './codes';

const resource = 'fs:forms/credit.json';

/** Детерминированные идентификаторы: `node0001`, `node0002`, … — ровно 8 символов base36. */
function ids(): NodeIdFactory {
  let seq = 0;
  return () => {
    seq += 1;
    return `node${String(seq).padStart(4, '0')}`;
  };
}

function schemaOf(root: JsonNode): JsonFormSchema {
  return ensureNodeIds({ version: '1.0', root }, ids());
}

/**
 * Полный проход: проверка по мета-схеме передаётся ЯВНО.
 *
 * В приложении её грузит плагин (динамическим импортом, ради 127 кБ главного чанка), а тесту
 * ждать нечего — он берёт её статически. Явность здесь и есть проверка контракта: забудь её
 * передать, и две фазы из пяти отвалятся молча, что немедленно видно по красным тестам ниже.
 */
function check(schema: JsonFormSchema, rules?: FormRules): Diagnostic[] {
  return checkForm(
    { resource, text: JSON.stringify(schema, null, 2), model: schema },
    { catalog: builtinEntries(), rules, validateSchema: validateFormSchema }
  );
}

const codes = (found: readonly Diagnostic[]): string[] => found.map((item) => item.code);

const field = (component: string, props: Record<string, unknown> = {}): JsonNode =>
  ({ value: '$model(loanAmount)', component, componentProps: props }) as unknown as JsonNode;

const box = (children: JsonNode[]): JsonNode =>
  ({ component: '$component(Box)', children }) as unknown as JsonNode;

describe('неизвестный компонент', () => {
  it('даёт код и имя параметром, а не готовую фразу', () => {
    const found = check(schemaOf(box([field('$component(Inpt)')])));

    const problem = found.find((item) => item.code === CODES.UNKNOWN_COMPONENT);
    expect(problem).toBeDefined();
    expect(problem?.params?.name).toBe('Inpt');
    expect(problem?.severity).toBe('error');
  });

  it('быстрое исправление предлагает ближайшее имя из каталога', () => {
    const found = check(schemaOf(box([field('$component(Inpt)')])));

    const problem = found.find((item) => item.code === CODES.UNKNOWN_COMPONENT);
    expect(problem?.params?.suggestion).toBe('Input');
    expect(problem?.fixes).toEqual([
      {
        titleKey: QUICKFIX.REPLACE_COMPONENT,
        commandId: COMMANDS.SET_COMPONENT,
        args: { resource, nodeId: 'node0002', name: 'Input' },
      },
    ]);
  });

  it('адресуется УЗЛОМ, суженным до значения component: там и стоит неизвестное имя', () => {
    const found = check(schemaOf(box([field('$component(Inpt)')])));

    const problem = found.find((item) => item.code === CODES.UNKNOWN_COMPONENT);
    expect(problem?.target).toEqual({
      kind: 'node',
      nodeId: 'node0002',
      within: ['component'],
      at: 'value',
    });
  });

  it('имя, слишком далёкое от каталожного, остаётся без исправления', () => {
    const found = check(schemaOf(box([field('$component(СовершенноДругое)')])));

    const problem = found.find((item) => item.code === CODES.UNKNOWN_COMPONENT);
    expect(problem?.params?.suggestion).toBeUndefined();
    expect(problem?.fixes).toBeUndefined();
  });

  it('пустой каталог отключает проверку имён: сравнивать не с чем', () => {
    const schema = schemaOf(box([field('$component(Inpt)')]));

    const found = checkForm(
      { resource, text: JSON.stringify(schema), model: schema },
      { catalog: [] }
    );

    expect(codes(found)).not.toContain(CODES.UNKNOWN_COMPONENT);
  });
});

describe('ошибка в значении, а не в типе', () => {
  it('значение не из перечисления называет список — ajv его не передаёт, каталог передаёт', () => {
    const found = check(schemaOf(box([field('$component(Input)', { type: 'вбок' })])));

    const problem = found.find((item) => item.code === CODES.VALUE_NOT_ALLOWED);
    expect(problem?.params?.list).toBe('yes');
    expect(problem?.params?.allowed).toBe('text, email, tel, url, password, number, date');
    // Виновато значение, а не имя поля: подчёркивать надо «вбок», а не «type».
    expect(problem?.target).toEqual({
      kind: 'node',
      nodeId: 'node0002',
      within: ['componentProps', 'type'],
      at: 'value',
    });
  });

  it('число вне границ несёт знак и предел раздельно, а не обрывок английской фразы', () => {
    const found = check(schemaOf(box([field('$component(Progress)', { value: 500 })])));

    const problem = found.find((item) => item.code === CODES.OUT_OF_RANGE);
    expect(problem?.params).toEqual({ op: '<=', limit: '100' });
  });
});

describe('дубли находок', () => {
  it('одна ошибка не показывается дважды: мета-схема жалуется обеими ветвями anyOf', () => {
    // `component` объявлен как `anyOf` из `$component(...)` и `$html(...)`; на `5` жалуются обе,
    // и до дедупликации это давало два одинаковых маркера на одном и том же диапазоне.
    const found = check(
      schemaOf(box([{ value: '$model(a)', component: 5 } as unknown as JsonNode]))
    );

    expect(found.filter((item) => item.code === CODES.WRONG_TYPE)).toHaveLength(1);
  });

  it('исправление не теряется: из двух неотличимых остаётся то, которым можно починить', () => {
    const base: Diagnostic = {
      source: 'validator.schema',
      severity: 'error',
      code: CODES.UNKNOWN_COMPONENT,
      target: { kind: 'node', nodeId: 'node0001' },
      params: { name: 'Inpt' },
    };
    const withFix: Diagnostic = {
      ...base,
      fixes: [{ titleKey: QUICKFIX.REPLACE_COMPONENT, commandId: COMMANDS.SET_COMPONENT }],
    };

    expect(dedupe([base, withFix])).toEqual([withFix]);
  });

  it('порядок устойчив: панель проблем не переставляет строки от прохода к проходу', () => {
    const at = (nodeId: string): Diagnostic => ({
      source: 'validator.schema',
      severity: 'error',
      code: CODES.UNKNOWN_COMPONENT,
      target: { kind: 'node', nodeId },
      params: { name: 'Inpt' },
    });

    expect(dedupe([at('a'), at('b'), at('a')]).map((item) => item.target)).toEqual([
      { kind: 'node', nodeId: 'a' },
      { kind: 'node', nodeId: 'b' },
    ]);
  });

  it('разные места одной ошибки — разные находки: дедупликация не склеивает узлы', () => {
    const found = check(
      schemaOf(
        box([
          field('$component(Input)', { lable: 'Первое' }),
          field('$component(Input)', { lable: 'Второе' }),
        ])
      )
    );

    expect(found.filter((item) => item.code === CODES.UNKNOWN_PROPERTY)).toHaveLength(2);
  });
});

describe('ошибка разбора', () => {
  it('адресуется ДИАПАЗОНОМ: узла ещё нет', () => {
    const text = '{"version":"1.0","root":{,}}';

    const found = checkForm({ resource, text }, { catalog: builtinEntries() });

    expect(codes(found)).toEqual([CODES.PARSE_FAILED]);
    expect(found[0].target.kind).toBe('range');
    const target = found[0].target;
    if (target.kind !== 'range') throw new Error('ожидался диапазон');
    expect(target.range.start).toBeGreaterThan(0);
    expect(target.range.end).toBeGreaterThan(target.range.start);
    expect(target.range.end).toBeLessThanOrEqual(text.length);
  });

  it('ошибка разбора — единственная находка прохода: дерева нет', () => {
    const found = checkForm({ resource, text: 'не json вовсе' }, { catalog: builtinEntries() });

    expect(found).toHaveLength(1);
  });

  it('разобралось, но это не схема формы — проблема всего ресурса', () => {
    const found = checkForm(
      { resource, text: '{"name":"пакет","version":"1.0.0"}' },
      { catalog: builtinEntries() }
    );

    expect(codes(found)).toEqual([CODES.NOT_A_FORM]);
    expect(found[0].target).toEqual({ kind: 'resource' });
  });
});

describe('структурные ошибки', () => {
  it('опечатка в имени пропа адресуется узлом и чинится переименованием', () => {
    const found = check(schemaOf(box([field('$component(Input)', { lable: 'Сумма' })])));

    const problem = found.find((item) => item.code === CODES.UNKNOWN_PROPERTY);
    expect(problem?.params?.property).toBe('lable');
    expect(problem?.params?.suggestion).toBe('label');
    // Цель сужена до самого пропа: подчёркивать надо `"lable"`, а не `$nodeId` — тот
    // к находке отношения не имеет и был бы единственным неверным местом в узле.
    expect(problem?.target).toEqual({
      kind: 'node',
      nodeId: 'node0002',
      within: ['componentProps', 'lable'],
    });
    expect(problem?.fixes?.[0]).toEqual({
      titleKey: QUICKFIX.RENAME_PROPERTY,
      commandId: COMMANDS.RENAME_PROP,
      args: { resource, nodeId: 'node0002', from: 'lable', to: 'label' },
    });
  });

  it('пропсы, похожие на узел, не перехватывают адрес: у TabsTrigger это буквально { value }', () => {
    // Узлом считается любой объект с ключом `value`, и подъём «до похожего на узел»
    // останавливался на самих пропсах: цель уезжала в ресурс (маркер на первой строке файла),
    // а подсказка и быстрое исправление исчезали — при том что у соседнего Input всё работало.
    const tab = {
      component: '$component(TabsTrigger)',
      componentProps: { value: 'one', valu: 'опечатка' },
      children: ['Первая'],
    } as unknown as JsonNode;

    const found = check(schemaOf(box([tab])));

    const problem = found.find((item) => item.code === CODES.UNKNOWN_PROPERTY);
    expect(problem?.target).toEqual({
      kind: 'node',
      nodeId: 'node0002',
      within: ['componentProps', 'valu'],
    });
    // Подсказка и исправление считаются от ТОГО ЖЕ узла: остановись подъём на пропсах —
    // компонента у них нет, словарь пропсов пуст, и предлагать было бы нечего.
    expect(problem?.params?.suggestion).toBe('value');
    expect(problem?.fixes?.[0].commandId).toBe(COMMANDS.RENAME_PROP);
  });

  it('находка на месте, у которого своего идентификатора нет, поднимается к ближайшему узлу', () => {
    const schema = schemaOf(box([{ componentProps: {} } as unknown as JsonNode]));

    const found = check(schema);

    expect(found.length).toBeGreaterThan(0);
    // `{ componentProps: {} }` узлом не является и идентификатора не несёт — адресуется
    // ближайший узел выше, а путь до места ошибки считается ОТ НЕГО.
    expect(found[0].target).toEqual({
      kind: 'node',
      nodeId: 'node0001',
      within: ['children', 0],
    });
  });

  it('неузнанное сообщение не теряется: код общий, фраза — в параметрах', () => {
    const schema = schemaOf(box([{ componentProps: {} } as unknown as JsonNode]));

    const found = check(schema);

    for (const item of found) {
      if (item.code !== CODES.INVALID) continue;
      expect(typeof item.params?.message).toBe('string');
      expect(item.params?.message).not.toBe('');
    }
    expect(codes(found).every((code) => code.startsWith('schema.'))).toBe(true);
  });
});

describe('структурный линт: связи, которых схема не видит', () => {
  const tabs = (children: JsonNode[], props: Record<string, unknown> = {}): JsonNode =>
    ({ component: '$component(Tabs)', componentProps: props, children }) as unknown as JsonNode;
  const trigger = (value?: string): JsonNode =>
    ({
      component: '$component(TabsTrigger)',
      componentProps: value === undefined ? {} : { value },
      children: ['Вкладка'],
    }) as unknown as JsonNode;
  const panel = (value?: string): JsonNode =>
    ({
      component: '$component(TabsContent)',
      componentProps: value === undefined ? {} : { value },
      children: [],
    }) as unknown as JsonNode;

  it('вкладка без панели — предупреждение, а не ошибка', () => {
    const found = check(schemaOf(tabs([trigger('one'), panel('two')])));

    const problem = found.find((item) => item.code === CODES.TAB_WITHOUT_PANEL);
    expect(problem?.severity).toBe('warning');
    expect(problem?.params?.value).toBe('one');
    expect(codes(found)).toContain(CODES.PANEL_WITHOUT_TAB);
  });

  it('вкладка без value адресуется своим узлом и пропсами: самого ключа в тексте нет', () => {
    const found = check(schemaOf(tabs([trigger(), panel('one')])));

    const problem = found.find((item) => item.code === CODES.TAB_WITHOUT_VALUE);
    expect(problem?.target).toEqual({
      kind: 'node',
      nodeId: 'node0002',
      within: ['componentProps'],
    });
  });

  it('вкладка без панели показывает на значение, которое цитирует её фраза', () => {
    const found = check(schemaOf(tabs([trigger('one'), panel('two')])));

    const problem = found.find((item) => item.code === CODES.TAB_WITHOUT_PANEL);
    expect(problem?.target).toEqual({
      kind: 'node',
      nodeId: 'node0002',
      within: ['componentProps', 'value'],
      at: 'value',
    });
  });

  it('defaultValue, не совпадающий ни с одной вкладкой', () => {
    const found = check(schemaOf(tabs([trigger('one'), panel('one')], { defaultValue: 'two' })));

    const problem = found.find((item) => item.code === CODES.TABS_DEFAULT_VALUE_UNKNOWN);
    expect(problem?.params?.value).toBe('two');
  });
});

describe('целостность правил', () => {
  const withValidation = (target: string): FormRules => ({
    ...emptyRules(),
    validation: [{ target, rules: ['required'] }],
  });

  it('осиротевшее правило находится и несёт адрес параметром', () => {
    const schema = schemaOf(box([field('$component(Input)', { label: 'Сумма' })]));

    const found = check(schema, withValidation('несуществующее'));

    const problem = found.find((item) => item.code === CODES.RULE_VALIDATION_TARGET_MISSING);
    expect(problem?.params?.target).toBe('несуществующее');
    expect(problem?.severity).toBe('warning');
    // Узла, на который правило указывает, не существует — в том и находка. И `resource` тоже
    // не годится: он значит «ошибка уровня документа», а рисующий ставит на такую маркер
    // первой строки — то есть на `{` схемы, к которой находка не относится.
    expect(problem?.target).toEqual({ kind: 'attached' });
  });

  it('исправление предлагается, но не применяется само: правило — работа пользователя', () => {
    const schema = schemaOf(box([field('$component(Input)', { label: 'Сумма' })]));

    const found = check(schema, withValidation('несуществующее'));

    const problem = found.find((item) => item.code === CODES.RULE_VALIDATION_TARGET_MISSING);
    expect(problem?.fixes?.[0]).toEqual({
      titleKey: QUICKFIX.REMOVE_ORPHAN_RULE,
      commandId: COMMANDS.REMOVE_RULE,
      args: { resource, list: 'validation', index: 0 },
    });
  });

  it('правило на существующее поле находкой не является', () => {
    const schema = schemaOf(box([field('$component(Input)', { label: 'Сумма' })]));

    const found = check(schema, withValidation('loanAmount'));

    expect(codes(found)).not.toContain(CODES.RULE_VALIDATION_TARGET_MISSING);
  });

  it('render-правило на несуществующий селектор', () => {
    const schema = schemaOf(box([field('$component(Input)', { label: 'Сумма' })]));
    const rules: FormRules = {
      ...emptyRules(),
      render: [{ kind: 'hideWhen', selector: 'нет-такого', condition: 'true' }],
    };

    const found = check(schema, rules);

    const problem = found.find((item) => item.code === CODES.RULE_RENDER_SELECTOR_MISSING);
    expect(problem?.params).toEqual({ selector: 'нет-такого', kind: 'hideWhen' });
  });

  it('без правил проверка целостности не запускается', () => {
    const schema = schemaOf(box([field('$component(Input)', { label: 'Сумма' })]));

    expect(codes(check(schema))).toEqual([]);
  });
});

describe('двойники $nodeId в исходном тексте', () => {
  const withIds = (a: string, b: string): string =>
    JSON.stringify({
      root: {
        $nodeId: 'aaaaaaaa',
        component: '$component(Stack)',
        children: [
          { $nodeId: a, component: '$component(Input)', value: '$model(x)' },
          { $nodeId: b, component: '$component(Input)', value: '$model(y)' },
        ],
      },
    });

  it('находятся и сообщаются предупреждением — по одному на КАЖДОЕ вхождение', () => {
    // Смотрится ТЕКСТ, а не модель: в модели двойников уже нет — разбор их чинит перевыдачей,
    // и молча. Не скажи мы об этом, человек унёс бы файл с двойниками дальше.
    const text = withIds('bbbbbbbb', 'bbbbbbbb');
    const found = checkForm({ resource: 'mem:form.json', text }, { catalog: [] });
    const dup = found.filter((d) => d.code === 'schema.duplicate-node-id');

    expect(dup).toHaveLength(2);
    expect(dup[0]?.severity).toBe('warning');
    // Узлом такую находку адресовать нельзя ровно потому, в чём она и состоит: идентификатор
    // называет два места, а указатель по тексту отдаёт из них ОДНО — и это первое, то есть
    // как раз то, которое перевыдачей не трогали.
    for (const item of dup) {
      expect(item.target.kind).toBe('range');
      if (item.target.kind !== 'range') throw new Error('ожидался диапазон');
      expect(text.slice(item.target.range.start, item.target.range.end)).toBe('"bbbbbbbb"');
    }
    const [first, second] = dup.map((item) =>
      item.target.kind === 'range' ? item.target.range.start : -1
    );
    expect(second).toBeGreaterThan(first);
  });

  it('идентификатор в ТЕКСТЕ формы не путается с записанным адресом', () => {
    // `"$nodeId"` встречается и как значение — в подписи поля, например. Ключом это не делает.
    const text = JSON.stringify(
      {
        version: '1.0',
        root: {
          $nodeId: 'aaaaaaaa',
          component: '$component(Stack)',
          children: [
            { $nodeId: 'bbbbbbbb', component: '$component(Input)', value: '$model(x)' },
            { $nodeId: 'bbbbbbbb', component: '$component(Input)', value: '$model(y)' },
          ],
          componentProps: { title: 'ключ "$nodeId": "bbbbbbbb" внутри строки' },
        },
      },
      null,
      2
    );

    const dup = checkForm({ resource: 'mem:form.json', text }, { catalog: [] }).filter(
      (d) => d.code === 'schema.duplicate-node-id'
    );

    expect(dup).toHaveLength(2);
  });

  it('у файла без двойников их не находит', () => {
    const found = checkForm(
      { resource: 'mem:form.json', text: withIds('bbbbbbbb', 'cccccccc') },
      { catalog: [] }
    );
    expect(found.filter((d) => d.code === 'schema.duplicate-node-id')).toEqual([]);
  });

  it('неразбираемый текст молчит: о двойниках говорить нечего, пока нет разбора', () => {
    const found = checkForm({ resource: 'mem:form.json', text: '{ сломано' }, { catalog: [] });
    expect(found.filter((d) => d.code === 'schema.duplicate-node-id')).toEqual([]);
  });
});
