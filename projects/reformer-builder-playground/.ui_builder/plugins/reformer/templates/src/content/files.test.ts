import { describe, expect, it, vi } from 'vitest';
import { isGenerated, originOf, withMarker } from '@reformer/builder-toolkit';
import type { FormTemplate } from '../contract';
import {
  applyTemplate,
  buildTemplateFiles,
  commonDirPrefix,
  formSchemaFileOf,
  isTextFile,
  keepOrigin,
  materializeFiles,
  resolvePicked,
  suggestBaseName,
  templateSlug,
} from './files';

describe('отбор файлов', () => {
  it('бинарные в шаблон не берутся, а файл без расширения — берётся', () => {
    expect(isTextFile('src/model.ts')).toBe(true);
    expect(isTextFile('assets/logo.png')).toBe(false);
    expect(isTextFile('LICENSE')).toBe(true);
    expect(isTextFile('.env')).toBe(true);
  });

  it('общий каталог схлопывается до ближайшего предка', () => {
    expect(commonDirPrefix(['a/b/model.ts', 'a/b/ui/x.ts'])).toBe('a/b');
    expect(commonDirPrefix(['a/b/x.ts', 'a/c/y.ts'])).toBe('a');
    expect(commonDirPrefix(['x.ts'])).toBe('');
  });

  it('базовое имя предлагается по последнему сегменту общего каталога', () => {
    expect(suggestBaseName(['src/credit-form/model.ts', 'src/credit-form/index.tsx'])).toBe(
      'credit-form'
    );
    expect(suggestBaseName(['credit.schema.json'])).toBe('credit');
  });

  it('slug чистит имя под файловую систему, сохраняя кириллицу', () => {
    expect(templateSlug('Кредитная форма')).toBe('кредитная-форма');
    expect(templateSlug('a/b:c')).toBe('abc');
    expect(templateSlug('   ')).toBe('template');
  });
});

describe('сборка шаблона', () => {
  it('пути становятся относительными, а имя — плейсхолдером', () => {
    const files = buildTemplateFiles(
      [
        { path: 'src/credit-form/model.ts', content: 'export type CreditForm = {};' },
        { path: 'src/credit-form/index.tsx', content: "import './credit-form/model';" },
      ],
      'credit-form'
    );
    expect(files).toEqual([
      { path: 'model.ts', content: 'export type __FormName__ = {};' },
      { path: 'index.tsx', content: "import './__form-name__/model';" },
    ]);
  });

  it('дубли путей отбрасываются, порядок сохраняется', () => {
    const files = buildTemplateFiles(
      [
        { path: 'a/x.ts', content: '1' },
        { path: 'a/x.ts', content: '2' },
      ],
      ''
    );
    expect(files).toEqual([{ path: 'x.ts', content: '1' }]);
  });
});

describe('подготовка файлов формы', () => {
  const template: FormTemplate = {
    id: 't',
    name: 'T',
    source: 'builtin',
    files: [
      { path: 'index.tsx', content: 'import { m } from "./model";' },
      { path: 'model.ts', content: 'export const m = "__FormName__";' },
      { path: 'types.ts', content: 'export type __FormName__ = {};' },
      { path: 'README.md', content: '# __FormName__' },
    ],
    requires: { 'index.tsx': ['model.ts'], 'model.ts': ['types.ts'] },
  };

  it('зависимости раскрываются транзитивно', () => {
    expect([...resolvePicked(['index.tsx'], template.requires)].sort()).toEqual([
      'index.tsx',
      'model.ts',
      'types.ts',
    ]);
  });

  it('без зависимостей набор остаётся тем, что выбрали', () => {
    expect([...resolvePicked(['README.md'], template.requires)]).toEqual(['README.md']);
  });

  it('имя подставляется и в содержимое, и в путь', () => {
    const files = materializeFiles(
      { ...template, files: [{ path: '__form-name__.ts', content: '__FormName__' }] },
      ['__form-name__.ts'],
      'user profile'
    );
    expect(files).toEqual([{ path: 'user-profile.ts', content: 'UserProfile' }]);
  });

  it('схему для открытия ищет среди json и отличает её от прочего json', () => {
    const files = [
      { path: 'package.json', content: '{"name":"x"}' },
      { path: 'form.schema.json', content: '{"format":2,"root":{"component":"$html(div)"}}' },
    ];
    expect(formSchemaFileOf(files)?.file.path).toBe('form.schema.json');
    expect(formSchemaFileOf([{ path: 'x.json', content: 'не json' }])).toBeNull();
  });

  it('корневой form.schema.json важнее под-схемы шага и прежнего имени, где бы ни стоял', () => {
    const schema = '{"format":2,"root":{"component":"$html(div)"}}';
    const files = [
      { path: 'steps/dannye/form.schema.json', content: schema },
      { path: 'renderer.schema.json', content: schema },
      { path: 'loan.schema.json', content: schema },
      { path: 'form.schema.json', content: schema },
    ];
    expect(formSchemaFileOf(files)?.file.path).toBe('form.schema.json');
    // Без канона — прежнее имя, затем прочие корневые; вложенные — последними.
    expect(formSchemaFileOf(files.slice(0, 3))?.file.path).toBe('renderer.schema.json');
    expect(formSchemaFileOf([files[0], files[2]])?.file.path).toBe('loan.schema.json');
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
    expect(formSchemaFileOf(files)?.file.path).toBe('schema/form.schema.json');
    expect(formSchemaFileOf(files.slice(0, 4))?.file.path).toBe('schema/renderer.schema.json');
    // Шаблон, снятый с формы прежней плоской раскладки, держит схему в корне — и она находится.
    expect(formSchemaFileOf(files.slice(0, 3))?.file.path).toBe('form.schema.json');
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

    const found = formSchemaFileOf(files);

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

describe('происхождение файла переживает подстановку', () => {
  // Маркер `// @reformer-generated <хэш>` считается от тела файла, а подстановка имени тело
  // меняет. Без перевыставления файл, только что напечатанный кодогеном, выглядел бы «правленным
  // руками», и билдер отказался бы перегенерировать его из правил формы.
  const tokenTemplate = (files: FormTemplate['files']): FormTemplate => ({
    id: 't',
    name: 'T',
    source: 'builtin',
    files,
  });

  it('нетронутый сгенерированный файл остаётся сгенерированным', () => {
    const [file] = materializeFiles(
      tokenTemplate([
        { path: 'types/__form-dir__.ts', content: withMarker('export type __FormType__ = {};\n') },
      ]),
      ['types/__form-dir__.ts'],
      'loan request'
    );

    expect(file.path).toBe('types/loan-request.ts');
    // Ровно то, что кодоген напечатал бы для этой формы сам: тело и маркер от него.
    expect(file.content).toBe(withMarker('export type LoanRequestForm = {};\n'));
    expect(isGenerated(file.content)).toBe(true);
  });

  it('правленный руками файл остаётся правленным: хэш у него и не должен сходиться', () => {
    const stamped = withMarker('export type __FormType__ = {};\n');
    const edited = `${stamped}// правка человека\n`;

    const [file] = materializeFiles(
      tokenTemplate([{ path: 'types.ts', content: edited }]),
      ['types.ts'],
      'loan request'
    );

    expect(originOf(file.content)).toBe('edited');
    // Строка маркера не тронута: подстановка не вправе объявить чужую правку своим выводом.
    expect(file.content.split('\n')[0]).toBe(stamped.split('\n')[0]);
  });

  it('файл без маркера маркера не получает', () => {
    expect(keepOrigin('export const a = 1;', 'export const b = 1;')).toBe('export const b = 1;');
  });

  it('снимок каталога: сгенерированный файл формы остаётся сгенерированным и в шаблоне', () => {
    const [file] = buildTemplateFiles(
      [{ path: 'credit-form/types.ts', content: withMarker('export type CreditForm = {};\n') }],
      'credit-form'
    );

    expect(file.content).toContain('__FormName__');
    expect(isGenerated(file.content)).toBe(true);
  });
});

describe('шаблон, который печатается под имя формы', () => {
  // Так устроен встроенный шаблон: его текст — вывод кодогена, уложенный под ширину строки, а
  // ширина зависит от имён модуля. Подстановка даёт верные имена в чужой раскладке, поэтому под
  // имя формы шаблон печатается заново; файлы с токенами остаются списком выбора и запасным
  // текстом.
  const files: FormTemplate['files'] = [
    { path: '__FormType__.tsx', content: 'export default function __FormType__() {}\n' },
    { path: 'types/__form-dir__.ts', content: withMarker('export type __FormType__ = {};\n') },
    { path: 'README.md', content: '# __FormTitle__\n' },
    { path: 'fixture.ts', content: 'export const fixture = {};\n', scope: 'fixture' },
  ];
  const requires = { '__FormType__.tsx': ['types/__form-dir__.ts'] };
  /** Печать под имя: раскладка другая — перенос, которого в тексте шаблона нет. */
  const printed = (formName: string): FormTemplate['files'] => {
    const type = formName === 'loan request' ? 'LoanRequestForm' : 'OtherForm';
    return [
      { path: `${type}.tsx`, content: `export default function ${type}(\n) {}\n` },
      { path: 'types/loan-request.ts', content: withMarker(`export type ${type} =\n  {};\n`) },
      { path: 'README.md', content: '# Loan request (напечатано)\n' },
      // Фикстуру печатник не печатает — но и напечатай он файл с таким путём, место занято.
      { path: 'fixture.ts', content: 'чужое\n' },
    ];
  };
  const template = (print?: FormTemplate['print']): FormTemplate => ({
    id: 'printed',
    name: 'Печатаемый',
    source: 'builtin',
    files,
    requires,
    ...(print === undefined ? {} : { print }),
  });
  const all = files.map((file) => file.path);

  it('текст берётся у печати — по совпадению пути, вместе с её маркером', async () => {
    const names: string[] = [];
    const applied = await applyTemplate(
      template(async (formName) => {
        names.push(formName);
        return printed(formName);
      }),
      all,
      'loan request'
    );

    expect(names).toEqual(['loan request']);
    expect(applied.map((file) => file.path)).toEqual([
      'LoanRequestForm.tsx',
      'types/loan-request.ts',
      'README.md',
      'fixture.ts',
    ]);
    expect(applied[0].content).toBe('export default function LoanRequestForm(\n) {}\n');
    // Маркер — тот, что поставил печатник: тело напечатано под это имя, и хэш от него.
    expect(applied[1].content).toBe(withMarker('export type LoanRequestForm =\n  {};\n'));
    expect(isGenerated(applied[1].content)).toBe(true);
    expect(applied[2].content).toBe('# Loan request (напечатано)\n');
  });

  it('фикстура остаётся своей: она идёт сверх напечатанного модуля', async () => {
    const applied = await applyTemplate(
      template(async (name) => printed(name)),
      all,
      'loan request'
    );
    const fixture = applied.find((file) => file.path === 'fixture.ts');

    expect(fixture).toEqual({
      path: 'fixture.ts',
      content: 'export const fixture = {};\n',
      scope: 'fixture',
    });
  });

  it('отбор и зависимости решает шаблон, а не печать: лишнего напечатанного в наборе нет', async () => {
    const applied = await applyTemplate(
      template(async (name) => printed(name)),
      ['__FormType__.tsx'],
      'loan request'
    );

    // Страница и то, что она тянет; README и фикстуру не отмечали.
    expect(applied.map((file) => file.path)).toEqual([
      'LoanRequestForm.tsx',
      'types/loan-request.ts',
    ]);
  });

  it('файл, которого печать не дала, остаётся подстановочным', async () => {
    const applied = await applyTemplate(
      template(async (name) => printed(name).slice(0, 1)),
      all,
      'loan request'
    );

    expect(applied[0].content).toBe('export default function LoanRequestForm(\n) {}\n');
    expect(applied[1].content).toBe(withMarker('export type LoanRequestForm = {};\n'));
    expect(applied[2].content).toBe('# Loan request\n');
  });

  it('печатать нечем — форма раскладывается подстановкой: пустой ответ и отказ печати', async () => {
    const substituted = materializeFiles(template(), all, 'loan request');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Пустой список — «печатника нет» (плагин генерации выгружен, кит не доехал).
    expect(
      await applyTemplate(
        template(async () => []),
        all,
        'loan request'
      )
    ).toEqual(substituted);
    expect(warn).not.toHaveBeenCalled();
    // Бросок — отказ печати: он назван в консоли, но создание формы не отменяет.
    const broken = template(async () => {
      throw new Error('не напечаталось');
    });
    expect(await applyTemplate(broken, all, 'loan request')).toEqual(substituted);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('шаблон без печати раскладывается подстановкой — как и раньше', async () => {
    expect(await applyTemplate(template(), all, 'loan request')).toEqual(
      materializeFiles(template(), all, 'loan request')
    );
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

  const tokenTemplate = (files: FormTemplate['files']): FormTemplate => ({
    id: 't',
    name: 'T',
    source: 'project',
    files,
  });
  const contentOf = (files: readonly { path: string; content: string }[], path: string): unknown =>
    JSON.parse(files.find((f) => f.path === path)?.content ?? 'null');

  it('найденная схема отдаётся формата 2: дальше она уходит в вид шаблона как схема', () => {
    const found = formSchemaFileOf([{ path: 'form.schema.json', content: JSON.stringify(legacy) }]);
    expect(found?.schema).toEqual(migrated);
  });

  it('прежняя схема, разбитая по шагам, собирается: ссылки найдены, шаги переведены', () => {
    const found = formSchemaFileOf(splitFiles);

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
    const one = materializeFiles(
      tokenTemplate([{ path: 'form.schema.json', content: JSON.stringify(legacy) }]),
      ['form.schema.json'],
      'Профиль'
    );
    expect(contentOf(one, 'form.schema.json')).toEqual(migrated);

    const split = materializeFiles(
      tokenTemplate(splitFiles),
      splitFiles.map((f) => f.path),
      'Профиль'
    );
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
    expect(formSchemaFileOf(split)?.schema).toMatchObject({
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
    expect(
      materializeFiles(
        tokenTemplate(files),
        files.map((f) => f.path),
        'Профиль'
      )
    ).toEqual(files);
  });
});
