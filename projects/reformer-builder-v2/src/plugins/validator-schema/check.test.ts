import { describe, expect, it } from 'vitest';

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { validateFormSchema } from '@reformer/renderer-json/validate';
import { builtinEntries } from '@/lib/catalog/__fixtures__/builtin-catalog';
import { ensureNodeIds, type NodeIdFactory } from '@/lib/form-model/node-id';
import { emptyRules, type FormRules } from '@/lib/form-model/rules';
import type { Diagnostic } from '@/sdk';
import { checkForm } from './check';
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

  it('адресуется УЗЛОМ: идентификатор не съезжает при вставке соседей', () => {
    const found = check(schemaOf(box([field('$component(Inpt)')])));

    const problem = found.find((item) => item.code === CODES.UNKNOWN_COMPONENT);
    expect(problem?.target).toEqual({ kind: 'node', nodeId: 'node0002' });
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
    expect(problem?.target).toEqual({ kind: 'node', nodeId: 'node0002' });
    expect(problem?.fixes?.[0]).toEqual({
      titleKey: QUICKFIX.RENAME_PROPERTY,
      commandId: COMMANDS.RENAME_PROP,
      args: { resource, nodeId: 'node0002', from: 'lable', to: 'label' },
    });
  });

  it('находка на месте, у которого своего идентификатора нет, поднимается к ближайшему узлу', () => {
    const schema = schemaOf(box([{ componentProps: {} } as unknown as JsonNode]));

    const found = check(schema);

    expect(found.length).toBeGreaterThan(0);
    // `{ componentProps: {} }` узлом не является и идентификатора не несёт — адресуется корень.
    expect(found[0].target).toEqual({ kind: 'node', nodeId: 'node0001' });
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

  it('вкладка без value адресуется своим узлом', () => {
    const found = check(schemaOf(tabs([trigger(), panel('one')])));

    const problem = found.find((item) => item.code === CODES.TAB_WITHOUT_VALUE);
    expect(problem?.target).toEqual({ kind: 'node', nodeId: 'node0002' });
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
    // Узла, на который правило указывает, не существует — в том и находка.
    expect(problem?.target).toEqual({ kind: 'resource' });
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

  it('находятся и сообщаются предупреждением', () => {
    // Смотрится ТЕКСТ, а не модель: в модели двойников уже нет — разбор их чинит перевыдачей,
    // и молча. Не скажи мы об этом, человек унёс бы файл с двойниками дальше.
    const found = checkForm(
      { resource: 'mem:form.json', text: withIds('bbbbbbbb', 'bbbbbbbb') },
      { catalog: [] }
    );
    const dup = found.filter((d) => d.code === 'schema.duplicate-node-id');

    expect(dup).toHaveLength(1);
    expect(dup[0]?.severity).toBe('warning');
    expect(dup[0]?.target).toEqual({ kind: 'node', nodeId: 'bbbbbbbb' });
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
