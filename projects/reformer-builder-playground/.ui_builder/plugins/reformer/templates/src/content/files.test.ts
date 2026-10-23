/**
 * Файлы шаблона у хозяина: отбор, снимок каталога, подстановка имени, печать под имя и вопросы к
 * стеку шаблона (токены модуля, перевод документа) — на двойнике стека.
 *
 * Документ формы ReFormer и перевод его формата — `../stack/document.test`; встроенные шаблоны,
 * разложенные хозяином, — `../cross/builtin.test`.
 *
 * @module plugins/reformer/templates/content/files.test
 */

import { describe, expect, it, vi } from 'vitest';
import { isGenerated, originOf, withMarker } from '@reformer/builder-toolkit';
import type { FormTemplate } from '../contract';
import {
  applyTemplate,
  buildTemplateFiles,
  commonDirPrefix,
  isTextFile,
  materializeFiles,
  resolvePicked,
  suggestBaseName,
  templateSlug,
} from './files';
import { createFakeTemplateStack, FAKE_DOCUMENT } from '../testing';

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
});

describe('происхождение файла переживает подстановку', () => {
  // Маркер `// @reformer-generated <хэш>` считается от тела файла, а подстановка имени тело
  // меняет. Без перевыставления файл, только что напечатанный генератором, выглядел бы
  // «правленным руками», и билдер отказался бы перегенерировать его из правил формы.
  const tokenTemplate = (files: FormTemplate['files']): FormTemplate => ({
    id: 't',
    name: 'T',
    source: 'builtin',
    files,
  });

  it('нетронутый сгенерированный файл остаётся сгенерированным', () => {
    const [file] = materializeFiles(
      tokenTemplate([
        { path: 'types/__form-name__.ts', content: withMarker('export type __FormName__ = {};\n') },
      ]),
      ['types/__form-name__.ts'],
      'loan request'
    );

    expect(file.path).toBe('types/loan-request.ts');
    // Ровно то, что генератор напечатал бы для этой формы сам: тело и маркер от него.
    expect(file.content).toBe(withMarker('export type LoanRequest = {};\n'));
    expect(isGenerated(file.content)).toBe(true);
  });

  it('правленный руками файл остаётся правленным: хэш у него и не должен сходиться', () => {
    const stamped = withMarker('export type __FormName__ = {};\n');
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
    const [file] = materializeFiles(
      tokenTemplate([{ path: 'a.ts', content: 'export const __formName__ = 1;' }]),
      ['a.ts'],
      'loan request'
    );

    expect(file.content).toBe('export const loanRequest = 1;');
    expect(isGenerated(file.content)).toBe(false);
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
    { path: '__FormName__Form.tsx', content: 'export default function __FormName__Form() {}\n' },
    { path: 'types/__form-name__.ts', content: withMarker('export type __FormName__Form = {};\n') },
    { path: 'README.md', content: '# __FormName__\n' },
    { path: 'fixture.ts', content: 'export const fixture = {};\n', scope: 'fixture' },
  ];
  const requires = { '__FormName__Form.tsx': ['types/__form-name__.ts'] };
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
      ['__FormName__Form.tsx'],
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
    expect(applied[2].content).toBe('# LoanRequest\n');
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

describe('вопросы к стеку шаблона', () => {
  // Хозяин не знает формата формы: токены модуля и перевод документа — ответы стека шаблона, того,
  // чей `owns` узнал набор. Двойник стека узнаёт набор по своему документу.
  const document = { path: `doc/${FAKE_DOCUMENT}`, content: '{}' };
  const template = (files: FormTemplate['files']): FormTemplate => ({
    id: 't',
    name: 'T',
    source: 'project',
    files,
  });
  const tokens = (prefix: string) => (formName: string) => ({
    __ModuleName__: `${prefix}-${formName}`,
  });

  it('токены имён модуля подставляет стек шаблона — и в путь, и в текст', () => {
    const files = materializeFiles(
      template([document, { path: '__ModuleName__.ts', content: 'name = __ModuleName__' }]),
      ['__ModuleName__.ts'],
      'loan',
      {
        stacks: [
          createFakeTemplateStack({ id: 'other', owns: () => false, tokens: tokens('other') }),
          createFakeTemplateStack({ tokens: tokens('own') }),
        ],
      }
    );

    expect(files).toEqual([{ path: 'own-loan.ts', content: 'name = own-loan' }]);
  });

  it('у ничьего шаблона токены модуля — от первого стека, где они есть', () => {
    const files = materializeFiles(
      template([{ path: 'styles/__ModuleName__.css', content: '' }]),
      ['styles/__ModuleName__.css'],
      'loan',
      {
        stacks: [
          createFakeTemplateStack({ id: 'silent' }),
          createFakeTemplateStack({ id: 'named', tokens: tokens('named') }),
        ],
      }
    );

    expect(files.map((file) => file.path)).toEqual(['styles/named-loan.css']);
  });

  it('без стеков подставляются только написания имени, токены модуля остаются', () => {
    const files = materializeFiles(
      template([{ path: '__ModuleName__/__form-name__.ts', content: '' }]),
      ['__ModuleName__/__form-name__.ts'],
      'loan request'
    );

    expect(files.map((file) => file.path)).toEqual(['__ModuleName__/loan-request.ts']);
  });

  it('готовые файлы переводит стек, которому они принадлежат, — после подстановки', () => {
    const seen: string[][] = [];
    const stack = createFakeTemplateStack({
      upgrade: (files) => {
        seen.push(files.map((file) => file.content));
        return files.map((file) => ({ ...file, content: `${file.content}!` }));
      },
    });

    const files = materializeFiles(
      template([document, { path: 'a.ts', content: '__FormName__' }]),
      [document.path, 'a.ts'],
      'loan',
      { stacks: [stack] }
    );

    expect(seen).toEqual([['{}', 'Loan']]);
    expect(files.map((file) => file.content)).toEqual(['{}!', 'Loan!']);
  });

  it('ничьи файлы стек не переводит', () => {
    const upgrade = vi.fn((files: FormTemplate['files']) => files);
    materializeFiles(template([{ path: 'a.ts', content: '' }]), ['a.ts'], 'loan', {
      stacks: [createFakeTemplateStack({ upgrade })],
    });

    expect(upgrade).not.toHaveBeenCalled();
  });

  it('снимок каталога не съедает токены модуля: имя, совпавшее с их словами, не токенизируется', () => {
    const files = buildTemplateFiles(
      [{ path: 'x/a.ts', content: '__ModuleName__ module-name' }],
      'module name',
      ['__ModuleName__']
    );

    expect(files).toEqual([{ path: 'a.ts', content: '__ModuleName__ module-name' }]);
  });
});
