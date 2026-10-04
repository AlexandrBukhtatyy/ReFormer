/**
 * `migrateJsonSchema`: документ прежнего формата → формат 2. Помимо точечных случаев — настоящий
 * документ кредитной заявки (`__fixtures__/credit-application.v1.json`): после перевода он обязан
 * проходить мета-схему формата 2.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { migrateJsonSchema, DEFAULT_STEP_HOSTS } from './migrate';
import { validateFormSchema } from './validate';
import { collectSchemaSelectors } from './collect-schema-selectors';
import { collectOperatorNames } from './collect-operator-names';
import { schemaFormatOf } from './types/json-schema';

/* eslint-disable @typescript-eslint/no-explicit-any */

const creditV1 = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('./__fixtures__/credit-application.v1.json', import.meta.url)),
    'utf8'
  )
) as Record<string, unknown>;

/** Все значения ключа по дереву документа. */
function collectKey(node: unknown, key: string, out: unknown[] = []): unknown[] {
  if (Array.isArray(node)) {
    node.forEach((item) => collectKey(item, key, out));
    return out;
  }
  if (node !== null && typeof node === 'object') {
    for (const [name, value] of Object.entries(node)) {
      if (name === key) out.push(value);
      collectKey(value, key, out);
    }
  }
  return out;
}

describe('migrateJsonSchema: узлы', () => {
  it('поле: `value` → `model`, остальное как есть', () => {
    const migrated = migrateJsonSchema({
      version: '1.0',
      root: {
        $nodeId: 'abcd1234',
        selector: 'email',
        value: '$model(email)',
        component: '$component(Input)',
        componentProps: { label: 'Email' },
        wrapper: { component: '$component(FormField)' },
      },
    }) as any;

    expect(migrated).toEqual({
      format: 2,
      version: '1.0',
      root: {
        $nodeId: 'abcd1234',
        selector: 'email',
        model: '$model(email)',
        component: '$component(Input)',
        componentProps: { label: 'Email' },
        wrapper: { component: '$component(FormField)' },
      },
    });
  });

  it('массив: `array` → `model`, шаблон строки переводится, `initialValue` сохраняется', () => {
    const migrated = migrateJsonSchema({
      root: {
        array: '$model(phones)',
        component: '$component(FormArray)',
        initialValue: { number: '' },
        item: { $template: { value: '$model(number)', component: '$component(Input)' } },
      },
    }) as any;

    expect(migrated.root).toEqual({
      model: '$model(phones)',
      component: '$component(FormArray)',
      initialValue: { number: '' },
      item: { $template: { model: '$model(number)', component: '$component(Input)' } },
    });
  });

  it('`value` в данных — не привязка: литерал пропса и `initialValue` не трогаются', () => {
    const migrated = migrateJsonSchema({
      root: {
        value: '$model(loanType)',
        component: '$component(Select)',
        componentProps: { options: [{ value: 'consumer', label: 'Потребительский' }] },
      },
    }) as any;

    expect(migrated.root.componentProps.options).toEqual([
      { value: 'consumer', label: 'Потребительский' },
    ]);
  });

  it('узлы, вложенные в `componentProps`, переводятся тоже', () => {
    const migrated = migrateJsonSchema({
      root: {
        component: '$component(Card)',
        componentProps: {
          header: { value: '$model(title)', component: '$component(Input)' },
        },
      },
    }) as any;

    expect(migrated.root.componentProps.header).toEqual({
      model: '$model(title)',
      component: '$component(Input)',
    });
  });

  it('`$schema` остаётся первым ключом, `format` — сразу за ним', () => {
    const migrated = migrateJsonSchema({
      $schema: './form-schema.schema.json',
      version: '1.0',
      root: { component: '$component(Box)' },
    });
    expect(Object.keys(migrated)).toEqual(['$schema', 'format', 'version', 'root']);
  });

  it('аргумент не мутируется; документ формата 2 возвращается тем же', () => {
    const source = { root: { value: '$model(a)', component: '$component(Input)' } };
    const snapshot = JSON.stringify(source);
    const migrated = migrateJsonSchema(source);

    expect(JSON.stringify(source)).toBe(snapshot);
    expect(migrateJsonSchema(migrated)).toBe(migrated);
  });
});

describe('migrateJsonSchema: шаги визарда', () => {
  const wizard = (component: string) => ({
    root: {
      selector: 'wizard',
      component,
      componentProps: {
        submitLabel: 'Отправить',
        steps: [
          {
            component: '$component(Step)',
            componentProps: { title: 'A' },
            children: [{ value: '$model(a)', component: '$component(Input)' }],
          },
          { $ref: './steps/b/form.schema.json' },
        ],
      },
    },
  });

  it('`componentProps.steps` визарда переезжают в `children`, прочие пропсы остаются', () => {
    const migrated = migrateJsonSchema(wizard('$component(RendererFormWizard)')) as any;

    expect(migrated.root.componentProps).toEqual({ submitLabel: 'Отправить' });
    expect(migrated.root.children).toEqual([
      {
        component: '$component(Step)',
        componentProps: { title: 'A' },
        children: [{ model: '$model(a)', component: '$component(Input)' }],
      },
      // Ссылка на файл шага переезжает как есть — её разворачивает composeJsonFormSchema.
      { $ref: './steps/b/form.schema.json' },
    ]);
    // Имя компонента не меняется: на библиотечный визард его переключает реестр приложения.
    expect(migrated.root.component).toBe('$component(RendererFormWizard)');
  });

  it('`componentProps` из одних шагов исчезает целиком', () => {
    const migrated = migrateJsonSchema({
      root: { component: '$component(Wizard)', componentProps: { steps: [] } },
    }) as any;

    expect('componentProps' in migrated.root).toBe(false);
    expect(migrated.root.children).toEqual([]);
  });

  it('у компонента не из списка `steps` — обычный проп', () => {
    const migrated = migrateJsonSchema(wizard('$component(Stepper)')) as any;

    expect(migrated.root.children).toBeUndefined();
    // Узел внутри пропса всё равно переводится.
    expect(migrated.root.componentProps.steps[0].children[0].model).toBe('$model(a)');
  });

  it('список визардов задаётся параметром', () => {
    expect(DEFAULT_STEP_HOSTS).toEqual(['Wizard', 'RendererFormWizard', 'FormWizard']);
    const migrated = migrateJsonSchema(wizard('$component(Stepper)'), {
      stepHosts: [...DEFAULT_STEP_HOSTS, 'Stepper'],
    }) as any;
    expect(migrated.root.children).toHaveLength(2);
  });
});

describe('migrateJsonSchema: документ кредитной заявки', () => {
  const migrated = migrateJsonSchema(creditV1);

  it('исходный документ — прежнего формата и проходит свою мета-схему', () => {
    expect(schemaFormatOf(creditV1)).toBe(1);
    expect(validateFormSchema(creditV1).errors).toEqual([]);
  });

  it('после перевода проходит мета-схему формата 2', () => {
    expect(schemaFormatOf(migrated)).toBe(2);
    expect(validateFormSchema(migrated).errors).toEqual([]);
  });

  it('привязок `value` / `array` не осталось, число привязок прежнее', () => {
    const isModelOp = (value: unknown): boolean =>
      typeof value === 'string' && value.startsWith('$model(');
    const before = [...collectKey(creditV1, 'value'), ...collectKey(creditV1, 'array')].filter(
      isModelOp
    );
    const after = collectKey(migrated, 'model').filter(isModelOp);

    expect(collectKey(migrated, 'array')).toEqual([]);
    expect(collectKey(migrated, 'value').filter(isModelOp)).toEqual([]);
    expect(after).toHaveLength(before.length);
    expect([...after].sort()).toEqual([...before].sort());
  });

  it('шаги визарда стоят в `children`, пропс `steps` снят', () => {
    const root = migrated.root as any;
    const wizard = root.children[0];
    const stepsBefore = (creditV1.root as any).children[0].componentProps.steps as unknown[];

    expect(wizard.selector).toBe('wizard');
    expect('steps' in wizard.componentProps).toBe(false);
    expect(wizard.children).toHaveLength(stepsBefore.length);
    for (const step of wizard.children) expect(step.component).toBe('$component(Step)');
  });

  it('селекторы и имена операторов не изменились', () => {
    expect([...collectSchemaSelectors(migrated)].sort()).toEqual(
      [...collectSchemaSelectors(creditV1 as any)].sort()
    );
    const sorted = (names: ReturnType<typeof collectOperatorNames>) => ({
      components: [...names.components].sort(),
      dataSources: [...names.dataSources].sort(),
      fns: [...names.fns].sort(),
      locales: [...names.locales].sort(),
    });
    expect(sorted(collectOperatorNames(migrated))).toEqual(
      sorted(collectOperatorNames(creditV1 as any))
    );
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
