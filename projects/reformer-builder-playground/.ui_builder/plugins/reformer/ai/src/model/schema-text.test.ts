/**
 * Схема формы как текст: разбор буфера и печать результата хода.
 *
 * Главное здесь — вход прежнего формата. Ассистент описывает модели документ формата 2 (карта
 * формы, адреса, инструменты), поэтому файл, записанный раньше, обязан стать моделью формата 2
 * уже на разборе: иначе карта показала бы шаги, которых инструменты не находят.
 *
 * @module plugins/reformer/ai/model/schema-text.test
 */

import { describe, expect, it } from 'vitest';
import { sampleSchema } from '../../../core/testing';
import { buildOutline } from './outline';
import { looksLikeSchemaText, parseSchemaText, printSchemaText } from './schema-text';

/** Тот же визард, что `sampleSchema()`, но записанный прежним форматом — как файл с диска. */
const LEGACY_TEXT = JSON.stringify(
  {
    version: '1.0',
    root: {
      component: '$component(RendererFormWizard)',
      componentProps: {
        className: 'bg-white',
        steps: [
          {
            component: '$component(Step)',
            componentProps: { title: 'Кредит' },
            children: [
              {
                value: '$model(loanType)',
                component: '$component(Select)',
                componentProps: { label: 'Тип кредита', options: '$dataSource(LOAN_TYPES)' },
              },
              {
                value: '$model(loanAmount)',
                component: '$component(InputNumber)',
                componentProps: { label: 'Сумма', step: 1000 },
              },
            ],
          },
          {
            component: '$component(Step)',
            componentProps: { title: 'Имущество' },
            children: [
              {
                selector: 'properties-array',
                array: '$model(properties)',
                initialValue: { type: 'apartment' },
                componentProps: { title: 'Имущество', itemLabel: '$dataSource(PROP_LABEL)' },
                item: {
                  $template: {
                    component: '$component(Box)',
                    children: [
                      {
                        value: '$model(type)',
                        component: '$component(Select)',
                        componentProps: { label: 'Тип имущества' },
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
      },
    },
  },
  null,
  2
);

describe('parseSchemaText: файл прежнего формата', () => {
  it('разбирается в модель формата 2 — ту же, что у файла, записанного форматом 2', () => {
    expect(parseSchemaText(LEGACY_TEXT)).toEqual(sampleSchema());
  });

  it('шаги визарда — его children, привязки — ключ model', () => {
    const schema = parseSchemaText(LEGACY_TEXT);
    expect(schema.format).toBe(2);

    const root = schema.root as unknown as {
      componentProps: Record<string, unknown>;
      children: { children: Record<string, unknown>[] }[];
    };
    // Шаги переехали, остальные пропсы визарда на месте.
    expect(root.componentProps).toEqual({ className: 'bg-white' });
    expect(root.children).toHaveLength(2);

    const [field] = root.children[0].children;
    expect(field.model).toBe('$model(loanType)');
    expect(field).not.toHaveProperty('value');

    const [array] = root.children[1].children;
    expect(array.model).toBe('$model(properties)');
    expect(array).not.toHaveProperty('array');
    // Литерал `initialValue` — данные, а не привязка: перевод его не трогает.
    expect(array.initialValue).toEqual({ type: 'apartment' });
  });

  it('карта формы адресует узлы так же, как у файла формата 2', () => {
    const outline = buildOutline(parseSchemaText(LEGACY_TEXT));
    expect(outline).toEqual(buildOutline(sampleSchema()));
    expect(outline.map((e) => e.ref)).toContain('/root/children/1/children/0/item/$template');
    expect(outline.some((e) => e.ref.includes('componentProps'))).toBe(false);
  });

  it('печатается форматом 2: применённый ход переводит файл', () => {
    const text = printSchemaText(parseSchemaText(LEGACY_TEXT));
    expect(text).toBe(printSchemaText(sampleSchema()));
    expect(text).toContain('"format": 2');
    expect(text).not.toContain('"steps"');
    expect(text).not.toMatch(/"(value|array)": "\$model\(/);
  });
});

describe('parseSchemaText: файл формата 2', () => {
  it('круг «прочитать → напечатать» возвращает тот же текст', () => {
    const text = printSchemaText(sampleSchema());
    expect(printSchemaText(parseSchemaText(text))).toBe(text);
  });

  it('не-схема и битый JSON — отказ, а не пустая модель', () => {
    expect(() => parseSchemaText('{"title":"не форма"}')).toThrow();
    expect(() => parseSchemaText('{ не json')).toThrow();
  });
});

describe('looksLikeSchemaText', () => {
  it('узнаёт файл формы в обоих форматах — вопрос задаётся тексту до перевода', () => {
    expect(looksLikeSchemaText(LEGACY_TEXT)).toBe(true);
    expect(looksLikeSchemaText(printSchemaText(sampleSchema()))).toBe(true);
  });

  it('чужой и битый текст — «не моё», без исключения', () => {
    expect(looksLikeSchemaText('{"title":"не форма"}')).toBe(false);
    expect(looksLikeSchemaText('# заметки')).toBe(false);
  });
});
