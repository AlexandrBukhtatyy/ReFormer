/**
 * Шаблон формы на движке: что видит `it` и что из этого следует.
 *
 * @module plugins/templates/render.test
 */

import { describe, expect, it } from 'vitest';
import { builtinKit, plainSchema, wizardSchema } from '@/lib/codegen/__fixtures__/kit';
import type { FormTemplate, TemplateFile } from './contract';
import { materializeFiles } from './files';
import { buildTemplateView } from './render';

const kit = () => builtinKit();

function template(files: readonly TemplateFile[], over: Partial<FormTemplate> = {}): FormTemplate {
  return {
    id: 'my-template',
    name: 'Мой шаблон',
    source: 'project',
    files,
    engine: 'eta',
    ...over,
  };
}

const schemaFile = (schema: object): TemplateFile => ({
  path: 'renderer.schema.json',
  content: JSON.stringify(schema, null, 2),
});

describe('вид шаблона формы', () => {
  it('несёт имя формы во всех четырёх написаниях', () => {
    const view = buildTemplateView(template([]), 'профиль пользователя');
    expect(view).toMatchObject({
      pascal: 'ProfilPolzovatelya',
      camel: 'profilPolzovatelya',
      kebab: 'profil-polzovatelya',
      snake: 'profil_polzovatelya',
    });
  });

  it('без схемы в наборе вид формы отсутствует — и это отдельный вопрос к шаблону', () => {
    const view = buildTemplateView(template([{ path: 'a.ts', content: '' }]), 'Форма', {
      kit: kit(),
    });
    expect(view.form).toBeNull();
  });

  it('без кита вид формы отсутствует, даже когда схема есть', () => {
    // Кит называет и спецификатор импорта, и символы компонентов. Умолчание здесь вернуло бы
    // ровно тот дефект, ради которого дескриптор кита и заводился, только молча.
    const view = buildTemplateView(template([schemaFile(plainSchema())]), 'Форма', { kit: null });
    expect(view.form).toBeNull();
  });

  it('со схемой и китом отдаёт полный вид генерации', () => {
    const view = buildTemplateView(template([schemaFile(plainSchema())]), 'Заявка на кредит', {
      kit: kit(),
    });
    expect(view.form?.names.TypeName).toBe('ZayavkaNaKreditForm');
    expect(view.form?.registry.kitSymbols).toContain('InputField');
    expect(view.form?.wizard).toBeNull();
  });

  it('визард в схеме виден шаблону — на нём и строится ветвление', () => {
    const view = buildTemplateView(template([schemaFile(wizardSchema())]), 'Анкета', {
      kit: kit(),
    });
    expect(view.form?.wizard?.symbol).toBe('FormWizard');
  });
});

describe('подстановка выбирается шаблоном, а не вызывающим', () => {
  it('без `engine` работают токены — снимок каталога не сломан', () => {
    const files = materializeFiles(
      template([{ path: '__form-name__/model.ts', content: 'export type __FormName__ = {};' }], {
        engine: undefined,
      }),
      ['__form-name__/model.ts'],
      'Профиль'
    );
    expect(files[0].path).toBe('profil/model.ts');
    expect(files[0].content).toBe('export type Profil = {};');
  });

  it('с `engine: eta` работает движок — и в содержимом, и в пути', () => {
    const files = materializeFiles(
      template([
        { path: '<%= it.kebab %>/model.ts', content: 'export type <%= it.pascal %> = {};' },
      ]),
      ['<%= it.kebab %>/model.ts'],
      'Профиль'
    );
    expect(files[0].path).toBe('profil/model.ts');
    expect(files[0].content).toBe('export type Profil = {};');
  });

  it('токены в шаблоне на движке НЕ подставляются: правило подстановки одно', () => {
    const files = materializeFiles(
      template([{ path: 'a.ts', content: '__FormName__' }]),
      ['a.ts'],
      'Профиль'
    );
    expect(files[0].content).toBe('__FormName__');
  });
});

describe('то, чего токены не умели', () => {
  it('цикл по полям формы', () => {
    const files = materializeFiles(
      template([
        schemaFile(plainSchema()),
        {
          path: 'fields.ts',
          content:
            '<% for (const c of it.form.registry.components) { -%>\n// <%= c.name %>\n<% } -%>',
        },
      ]),
      ['fields.ts'],
      'Заявка',
      { kit: kit() }
    );
    // Состав приезжает из СХЕМЫ, а не из имени формы: ровно это и было недостижимо.
    expect(files[0].content).toContain('// Input');
    expect(files[0].content).toContain('// Checkbox');
  });

  it('ветвление по наличию визарда', () => {
    const body = '<% if (it.form.wizard !== null) { %>ШАГИ<% } else { %>ОДИН ЭКРАН<% } %>';
    const withWizard = materializeFiles(
      template([schemaFile(wizardSchema()), { path: 'a.ts', content: body }]),
      ['a.ts'],
      'Анкета',
      { kit: kit() }
    );
    const without = materializeFiles(
      template([schemaFile(plainSchema()), { path: 'a.ts', content: body }]),
      ['a.ts'],
      'Анкета',
      { kit: kit() }
    );
    expect(withWizard[0].content).toBe('ШАГИ');
    expect(without[0].content).toBe('ОДИН ЭКРАН');
  });
});

describe('новый класс отказа назван', () => {
  it('сломанный шаблон бросает, а не отдаёт половину файлов', () => {
    // У токенной подстановки броска быть не могло. Проглоти мы его — человек получил бы
    // каталог формы с недописанными файлами и никакого объяснения.
    expect(() =>
      materializeFiles(
        template([{ path: 'a.ts', content: '<%= it.nope.deep %>' }]),
        ['a.ts'],
        'Форма'
      )
    ).toThrow();
  });

  it('сообщение называет строку — иначе чинить нечего', () => {
    let message = '';
    try {
      materializeFiles(
        template([{ path: 'a.ts', content: 'строка 1\nстрока 2\n<%= it.nope.deep %>\n' }]),
        ['a.ts'],
        'Форма'
      );
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain('line 3');
  });
});
