/**
 * Документ формы ReFormer среди файлов шаблона: какой файл — схема, сборка шагов и перевод в
 * формат 2.
 *
 * @module plugins/reformer/templates/stack/document.test
 */

import { describe, expect, it } from 'vitest';
import { formDocumentOf, upgradeFormFiles } from './document';

describe('документ формы в наборе', () => {
  it('схему для открытия ищет среди json и отличает её от прочего json', () => {
    const files = [
      { path: 'package.json', content: '{"name":"x"}' },
      { path: 'form.schema.json', content: '{"format":2,"root":{"component":"$html(div)"}}' },
    ];
    expect(formDocumentOf(files)?.file.path).toBe('form.schema.json');
    expect(formDocumentOf([{ path: 'x.json', content: 'не json' }])).toBeNull();
  });

  it('корневой form.schema.json важнее под-схемы шага и прежнего имени, где бы ни стоял', () => {
    const schema = '{"format":2,"root":{"component":"$html(div)"}}';
    const files = [
      { path: 'steps/dannye/form.schema.json', content: schema },
      { path: 'renderer.schema.json', content: schema },
      { path: 'loan.schema.json', content: schema },
      { path: 'form.schema.json', content: schema },
    ];
    expect(formDocumentOf(files)?.file.path).toBe('form.schema.json');
    // Без канона — прежнее имя, затем прочие корневые; вложенные — последними.
    expect(formDocumentOf(files.slice(0, 3))?.file.path).toBe('renderer.schema.json');
    expect(formDocumentOf([files[0], files[2]])?.file.path).toBe('loan.schema.json');
  });

  it('документ модуля в папке ролей важнее схемы в корне и под-схем шагов', () => {
    const schema = '{"format":2,"root":{"component":"$html(div)"}}';
    const files = [
      { path: 'schema/steps/dannye/form.schema.json', content: schema },
      { path: 'loan.schema.json', content: schema },
      { path: 'form.schema.json', content: schema },
      { path: 'schema/renderer.schema.json', content: schema },
      { path: 'schema/form.schema.json', content: schema },
    ];
    // Канон раскладки «папки по ролям» — `schema/form.schema.json`: его и открывают.
    expect(formDocumentOf(files)?.file.path).toBe('schema/form.schema.json');
    expect(formDocumentOf(files.slice(0, 4))?.file.path).toBe('schema/renderer.schema.json');
    // Шаблон, снятый с формы прежней плоской раскладки, держит схему в корне — и она находится.
    expect(formDocumentOf(files.slice(0, 3))?.file.path).toBe('form.schema.json');
  });

  it('схема в `schema/`, разбитая по шагам, собирается: ссылки считаются от её файла', () => {
    const step = (model: string) => ({
      node: {
        component: '$component(Step)',
        children: [{ model: `$model(${model})`, component: '$component(Input)' }],
      },
    });
    const files = [
      {
        path: 'schema/form.schema.json',
        content: JSON.stringify({
          format: 2,
          root: {
            component: '$component(Wizard)',
            children: [
              { $ref: './steps/dannye/form.schema.json' },
              { $ref: './steps/kontakty/form.schema.json' },
            ],
          },
        }),
      },
      { path: 'schema/steps/dannye/form.schema.json', content: JSON.stringify(step('lastName')) },
      { path: 'schema/steps/kontakty/form.schema.json', content: JSON.stringify(step('email')) },
    ];

    const found = formDocumentOf(files);

    // Файлы шагов лежат рядом с корневым документом — в `schema/steps/`, а не в корне шаблона.
    expect(found?.file.path).toBe('schema/form.schema.json');
    expect(found?.schema).toMatchObject({
      root: { children: [step('lastName').node, step('email').node] },
    });
    expect([...(found?.origins?.values() ?? [])].map((origin) => origin.ref)).toEqual([
      './steps/dannye/form.schema.json',
      './steps/kontakty/form.schema.json',
    ]);
  });
});

describe('шаблон со схемой прежнего формата', () => {
  // Шаблон в каталоге проекта — снимок файлов, и снят он мог быть до формата 2: привязка в
  // `value` / `array`, шаги визарда в `componentProps.steps`.
  const legacy = {
    version: '1.0',
    root: {
      component: '$component(Box)',
      children: [
        {
          component: '$component(Wizard)',
          componentProps: {
            className: 'wizard',
            steps: [
              {
                component: '$component(Step)',
                componentProps: { title: 'Данные' },
                children: [
                  {
                    value: '$model(lastName)',
                    component: '$component(Input)',
                    componentProps: { label: 'Фамилия' },
                  },
                  {
                    array: '$model(phones)',
                    item: {
                      $template: { value: '$model(number)', component: '$component(Input)' },
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
    },
  };

  const migrated = {
    format: 2,
    version: '1.0',
    root: {
      component: '$component(Box)',
      children: [
        {
          component: '$component(Wizard)',
          // Прочие пропсы визарда остаются пропсами — уезжают только шаги.
          componentProps: { className: 'wizard' },
          children: [
            {
              component: '$component(Step)',
              componentProps: { title: 'Данные' },
              children: [
                {
                  model: '$model(lastName)',
                  component: '$component(Input)',
                  componentProps: { label: 'Фамилия' },
                },
                {
                  model: '$model(phones)',
                  item: { $template: { model: '$model(number)', component: '$component(Input)' } },
                },
              ],
            },
          ],
        },
      ],
    },
  };

  // Тот же визард, но шаги вынесены в файлы — и корень, и шаги прежнего формата.
  const legacySkeleton = {
    version: '1.0',
    root: {
      component: '$component(Wizard)',
      componentProps: {
        steps: [
          { $ref: './steps/dannye/form.schema.json' },
          { $ref: './steps/kontakty/form.schema.json' },
        ],
      },
    },
  };
  const legacyStep = (title: string, model: string) => ({
    $schema: '../../form-step.schema.json',
    node: {
      component: '$component(Step)',
      componentProps: { title },
      children: [{ value: `$model(${model})`, component: '$component(Input)' }],
    },
  });
  const migratedStep = (title: string, model: string) => ({
    $schema: '../../form-step.schema.json',
    node: {
      component: '$component(Step)',
      componentProps: { title },
      children: [{ model: `$model(${model})`, component: '$component(Input)' }],
    },
  });
  const splitFiles = [
    { path: 'form.schema.json', content: JSON.stringify(legacySkeleton) },
    {
      path: 'steps/dannye/form.schema.json',
      content: JSON.stringify(legacyStep('Данные', 'lastName')),
    },
    {
      path: 'steps/kontakty/form.schema.json',
      content: JSON.stringify(legacyStep('Контакты', 'email')),
    },
  ];

  const contentOf = (files: readonly { path: string; content: string }[], path: string): unknown =>
    JSON.parse(files.find((f) => f.path === path)?.content ?? 'null');

  it('найденная схема отдаётся формата 2: дальше она уходит в вид шаблона как схема', () => {
    const found = formDocumentOf([{ path: 'form.schema.json', content: JSON.stringify(legacy) }]);
    expect(found?.schema).toEqual(migrated);
  });

  it('прежняя схема, разбитая по шагам, собирается: ссылки найдены, шаги переведены', () => {
    const found = formDocumentOf(splitFiles);

    // Ссылки лежали в `componentProps.steps` — без перевода корня их бы не нашлось, и схема
    // осталась бы скелетом без единого поля.
    expect(found?.schema).toMatchObject({
      format: 2,
      root: {
        component: '$component(Wizard)',
        children: [migratedStep('Данные', 'lastName').node, migratedStep('Контакты', 'email').node],
      },
    });
    expect((found?.schema.root as { componentProps?: unknown }).componentProps).toBeUndefined();
    expect([...(found?.origins?.values() ?? [])].map((origin) => origin.ref)).toEqual([
      './steps/dannye/form.schema.json',
      './steps/kontakty/form.schema.json',
    ]);
  });

  it('файлы формы выходят формата 2 — и схема, и файлы шагов', () => {
    const one = upgradeFormFiles([{ path: 'form.schema.json', content: JSON.stringify(legacy) }]);
    expect(contentOf(one, 'form.schema.json')).toEqual(migrated);

    const split = upgradeFormFiles(splitFiles);
    // Корень остаётся скелетом со ссылками: разбиение по шагам — решение автора шаблона.
    expect(contentOf(split, 'form.schema.json')).toEqual({
      format: 2,
      version: '1.0',
      root: {
        component: '$component(Wizard)',
        children: [
          { $ref: './steps/dannye/form.schema.json' },
          { $ref: './steps/kontakty/form.schema.json' },
        ],
      },
    });
    expect(contentOf(split, 'steps/dannye/form.schema.json')).toEqual(
      migratedStep('Данные', 'lastName')
    );
    expect(contentOf(split, 'steps/kontakty/form.schema.json')).toEqual(
      migratedStep('Контакты', 'email')
    );
    // Записанное читается обратно той же сборкой, что и исходный шаблон.
    expect(formDocumentOf(split)?.schema).toMatchObject({
      root: { children: [migratedStep('Данные', 'lastName').node, {}] },
    });
  });

  it('текст файла формата 2 и чужого json не перепечатывается', () => {
    // Перевод отдаёт документ формата 2 той же ссылкой — и перепечатка стёрла бы отступы и
    // порядок ключей, которыми файл написал человек.
    const files = [
      { path: 'form.schema.json', content: '{"root":{"component":"$html(div)"},\t"format":2}' },
      {
        path: 'steps/a/form.schema.json',
        content: '{"node":{"model":"$model(a)",   "component":"$component(Input)"}}',
      },
      { path: 'package.json', content: '{"name":"x",  "value":"$model(a)"}' },
    ];
    const upgraded = upgradeFormFiles(files);
    expect(upgraded).toEqual(files);
    // Те же объекты, а не копии: файлы, которые переводить незачем, проходят насквозь.
    upgraded.forEach((file, index) => expect(file).toBe(files[index]));
  });
});
