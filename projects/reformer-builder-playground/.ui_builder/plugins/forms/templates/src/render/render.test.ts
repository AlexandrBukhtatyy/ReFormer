/**
 * Шаблон формы на движке: что видит `it` и что из этого следует. Вид формы — от двойника стека;
 * вид стека ReFormer — `../cross/view.test`.
 *
 * @module plugins/forms/templates/render/render.test
 */

import { describe, expect, it } from 'vitest';
import type { FormTemplate, TemplateFile } from '../contract';
import { materializeFiles } from '../content/files';
import { createFakeTemplateStack, FAKE_DOCUMENT } from '../testing';
import { buildTemplateView } from './render';

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

  it('вид формы даёт стек шаблона — по файлам ДО отрисовки', () => {
    const seen: string[][] = [];
    const stack = createFakeTemplateStack({
      view: (files, formName) => {
        seen.push(files.map((file) => file.path));
        return { title: formName };
      },
    });
    const files = [
      { path: FAKE_DOCUMENT, content: '<%= it.form.title %>' },
      { path: 'a.ts', content: '' },
    ];

    const view = buildTemplateView(template(files), 'Анкета', { stacks: [stack] });

    expect(view.form).toEqual({ title: 'Анкета' });
    expect(seen).toEqual([[FAKE_DOCUMENT, 'a.ts']]);
  });

  it('ничей шаблон и стек без вида — вида формы нет', () => {
    const viewing = createFakeTemplateStack({ owns: () => false, view: () => ({}) });
    const silent = createFakeTemplateStack();
    const document = [{ path: FAKE_DOCUMENT, content: '' }];

    expect(buildTemplateView(template(document), 'Форма', { stacks: [viewing] }).form).toBeNull();
    expect(buildTemplateView(template(document), 'Форма', { stacks: [silent] }).form).toBeNull();
    expect(buildTemplateView(template(document), 'Форма').form).toBeNull();
  });

  it('вид стека доступен шаблону как it.form', () => {
    const stack = createFakeTemplateStack({ view: () => ({ fields: ['a', 'b'] }) });
    const files = materializeFiles(
      template([
        { path: FAKE_DOCUMENT, content: '' },
        { path: 'f.ts', content: '<%= it.form.fields.join(",") %>' },
      ]),
      ['f.ts'],
      'Форма',
      { stacks: [stack] }
    );

    expect(files[0].content).toBe('a,b');
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
