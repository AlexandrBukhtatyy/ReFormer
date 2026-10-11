import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import {
  emptySchema,
  ensureSchema,
  isFormSchema,
  migrateNodeFormat,
  migrateTextNodes,
} from './normalize';

describe('isFormSchema / ensureSchema', () => {
  it('узнаёт схему по узлу в root и отвергает произвольный JSON', () => {
    expect(isFormSchema({ root: { component: '$html(div)' } })).toBe(true);
    expect(isFormSchema({ $schema: 'http://json-schema.org/draft-07/schema#' })).toBe(false);
    expect(() => ensureSchema({ some: 'json' })).toThrow(/JsonFormSchema/);
  });

  it('узнаёт документ прежнего формата: корень-поле несёт привязку в value', () => {
    expect(isFormSchema({ root: { value: '$model(name)' } })).toBe(true);
    expect(isFormSchema({ format: 2, root: { model: '$model(name)' } })).toBe(true);
  });
});

describe('emptySchema', () => {
  it('пустая схема — формата 2, шапка идёт первой', () => {
    const schema = emptySchema({ $schema: './form-schema.schema.json' });
    expect(Object.keys(schema)).toEqual(['$schema', 'format', 'version', 'root']);
    expect(schema.format).toBe(2);
  });
});

describe('перевод прежнего формата', () => {
  const legacy = () => ({
    version: '1.0',
    root: {
      component: '$component(Wizard)',
      componentProps: {
        className: 'card',
        steps: [
          {
            component: '$component(Step)',
            componentProps: { title: 'Шаг 1' },
            children: [
              { value: '$model(name)', component: '$component(Input)' },
              {
                array: '$model(items)',
                item: { $template: { value: '$model(title)', component: '$component(Input)' } },
              },
            ],
          },
        ],
      },
    },
  });

  it('ensureSchema: value и array становятся model, шаги переезжают в children', () => {
    const schema = ensureSchema(legacy());
    expect(schema.format).toBe(2);
    expect(schema.root).toEqual({
      component: '$component(Wizard)',
      componentProps: { className: 'card' },
      children: [
        {
          component: '$component(Step)',
          componentProps: { title: 'Шаг 1' },
          children: [
            { model: '$model(name)', component: '$component(Input)' },
            {
              model: '$model(items)',
              item: { $template: { model: '$model(title)', component: '$component(Input)' } },
            },
          ],
        },
      ],
    });
  });

  it('документ формата 2 возвращается той же ссылкой — round-trip не страдает', () => {
    const schema = ensureSchema(legacy());
    expect(ensureSchema(schema)).toBe(schema);
  });

  it('исходный документ не изменяется', () => {
    const source = legacy();
    ensureSchema(source);
    expect(source).toEqual(legacy());
  });

  it('migrateNodeFormat переводит узел файла шага', () => {
    const step = legacy().root.componentProps.steps[0];
    const migrated = migrateNodeFormat(step) as unknown as { children: { model?: string }[] };
    expect(migrated.children[0].model).toBe('$model(name)');
    expect(migrated.children[1].model).toBe('$model(items)');
  });

  it('migrateNodeFormat узел формата 2 возвращает той же ссылкой', () => {
    const step = {
      component: '$component(Step)',
      children: [{ model: '$model(name)', component: '$component(Input)' }],
    };
    expect(migrateNodeFormat(step)).toBe(step);
  });

  it('migrateNodeFormat не портит проп с оператором в value у узла формата 2', () => {
    // Перевод принял бы такой объект в пропсах за узел прежнего формата и переписал бы ключ.
    const step = {
      component: '$component(Step)',
      children: [
        {
          model: '$model(total)',
          component: '$component(Summary)',
          componentProps: { row: { value: '$model(total)', label: 'Итого' } },
        },
      ],
    };
    expect(migrateNodeFormat(step)).toBe(step);
  });
});

describe('migrateTextNodes', () => {
  it('переносит text в начало children — туда, где он и рендерился', () => {
    const schema = {
      format: 2,
      version: '1.0',
      root: {
        component: '$html(p)',
        text: 'Внимание! ',
        children: [{ component: '$html(b)', text: 'важно' }],
      },
    } as unknown as JsonFormSchema;
    expect(migrateTextNodes(schema).root).toEqual({
      component: '$html(p)',
      children: ['Внимание! ', { component: '$html(b)', children: ['важно'] }],
    });
  });

  it('массив частей разворачивается в отдельные текстовые дети', () => {
    const schema = {
      root: { component: '$html(p)', text: ['Платёж: ', '$model(monthlyPayment)', ' ₽'] },
    } as unknown as JsonFormSchema;
    expect((migrateTextNodes(schema).root as { children: unknown[] }).children).toEqual([
      'Платёж: ',
      '$model(monthlyPayment)',
      ' ₽',
    ]);
  });

  it('доходит до узлов, вложенных в componentProps (шаги мастера)', () => {
    const schema = {
      root: {
        component: '$component(Wizard)',
        componentProps: {
          steps: [{ component: '$component(Step)', text: 'Шаг 1' }],
        },
      },
    } as unknown as JsonFormSchema;
    const steps = (
      migrateTextNodes(schema).root as unknown as {
        componentProps: { steps: Array<{ children: unknown[] }> };
      }
    ).componentProps.steps;
    expect(steps[0].children).toEqual(['Шаг 1']);
  });

  it('не трогает componentProps.text компонента — это его проп, а не содержимое узла', () => {
    const schema = {
      root: { component: '$component(Input)', componentProps: { text: 'подпись' } },
    } as unknown as JsonFormSchema;
    expect(migrateTextNodes(schema)).toEqual(schema);
  });

  it('схему без text возвращает той же ссылкой — round-trip не страдает', () => {
    const schema = {
      format: 2,
      version: '1.0',
      root: { component: '$html(div)', children: [{ component: '$html(p)', children: ['x'] }] },
    } as unknown as JsonFormSchema;
    expect(migrateTextNodes(schema)).toBe(schema);
  });
});
