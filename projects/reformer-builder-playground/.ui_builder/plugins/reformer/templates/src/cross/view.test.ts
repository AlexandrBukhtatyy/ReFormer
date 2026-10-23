/**
 * Шаблон формы ReFormer на движке: вид формы (`it.form`) даёт стек, отрисовывает хозяин.
 *
 * @module plugins/reformer/templates/cross/view.test
 */

import { describe, expect, it } from 'vitest';
import type { CodegenView } from '../../../core/codegen';
import { plainSchema, wizardSchema } from '../../../core/testing';
import type { FormTemplate, TemplateFile } from '../contract';
import { materializeFiles, type MaterializeOptions } from '../content/files';
import { buildTemplateView, type FormTemplateView } from '../render/render';
import { reformerStack } from '../stack/testing';

/** Стек ReFormer со встроенным китом. */
const OPTIONS: MaterializeOptions = { stacks: [reformerStack()] };

/** Вид формы стека ReFormer — вид генерации кодогена. */
const formOf = (view: FormTemplateView): CodegenView | null => view.form as CodegenView | null;

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
  path: 'form.schema.json',
  content: JSON.stringify(schema, null, 2),
});

describe('вид шаблона формы от стека ReFormer', () => {
  it('без схемы в наборе вид формы отсутствует — и это отдельный вопрос к шаблону', () => {
    const view = buildTemplateView(template([{ path: 'a.ts', content: '' }]), 'Форма', OPTIONS);
    expect(formOf(view)).toBeNull();
  });

  it('без кита вид формы отсутствует, даже когда схема есть', () => {
    // Кит называет и спецификатор импорта, и символы компонентов. Умолчание здесь вернуло бы
    // ровно тот дефект, ради которого дескриптор кита и заводился, только молча.
    const view = buildTemplateView(template([schemaFile(plainSchema())]), 'Форма', {
      stacks: [reformerStack({ kit: null })],
    });
    expect(formOf(view)).toBeNull();
  });

  it('со схемой и китом отдаёт полный вид генерации', () => {
    const view = buildTemplateView(
      template([schemaFile(plainSchema())]),
      'Заявка на кредит',
      OPTIONS
    );
    expect(formOf(view)?.names.TypeName).toBe('ZayavkaNaKreditForm');
    expect(formOf(view)?.registry.kitSymbols).toContain('Input');
    // Вид формы решает схема: без узла с шагами это простая форма, и визарда в реестре нет.
    expect(formOf(view)?.layout.isWizard).toBe(false);
    expect(formOf(view)?.registry.wizard).toBeNull();
  });

  it('визард в схеме виден шаблону — на нём и строится ветвление', () => {
    const view = buildTemplateView(template([schemaFile(wizardSchema())]), 'Анкета', OPTIONS);
    expect(formOf(view)?.layout.isWizard).toBe(true);
    // Чем визард регистрируется, говорит кит: его адаптер, а не переходник приложения.
    expect(formOf(view)?.registry.wizard?.symbol).toBe('FormWizard');
  });

  it('пути вида считаются от места схемы в шаблоне', () => {
    // Шаблон, снятый с формы прежней раскладки, держит схему в корне; модуль «папки по ролям» —
    // в `schema/`. Импорты и место файлов шагов шаблон берёт из вида, и они обязаны сходиться
    // с тем, где схема лежит на самом деле.
    const flat = buildTemplateView(template([schemaFile(plainSchema())]), 'Анкета', OPTIONS);
    const nested = buildTemplateView(
      template([{ ...schemaFile(plainSchema()), path: 'schema/form.schema.json' }]),
      'Анкета',
      OPTIONS
    );

    expect(formOf(flat)?.layout.files.schema).toBe('form.schema.json');
    expect(formOf(flat)?.rel('create', 'schema')).toBe('../form.schema.json');
    expect(formOf(nested)?.layout.files.schema).toBe('schema/form.schema.json');
    expect(formOf(nested)?.rel('create', 'schema')).toBe('../schema/form.schema.json');
  });

  it('схема прежнего формата рассказывает о форме то же: и визард, и поля', () => {
    // Шаблон проекта мог быть снят до формата 2: привязка в `value`, шаги в
    // `componentProps.steps`. Вид собирается по переведённой схеме — непереведённая отдала бы
    // форму без визарда и без единого поля, и шаблон молча напечатал бы пустой модуль.
    const legacy = {
      version: '1.0',
      root: {
        component: '$component(Box)',
        children: [
          {
            component: '$component(Wizard)',
            componentProps: {
              steps: [
                {
                  component: '$component(Step)',
                  componentProps: { title: 'Шаг 1' },
                  children: [
                    {
                      value: '$model(email)',
                      component: '$component(Input)',
                      componentProps: { label: 'Почта', required: true },
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    };

    const view = buildTemplateView(template([schemaFile(legacy)]), 'Анкета', OPTIONS);

    expect(formOf(view)?.layout.isWizard).toBe(true);
    expect(formOf(view)?.registry.wizard?.symbol).toBe('FormWizard');
    expect(formOf(view)?.required).toEqual(['email']);
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
      OPTIONS
    );
    // Состав приезжает из СХЕМЫ, а не из имени формы: ровно это и было недостижимо.
    expect(files[0].content).toContain('// Input');
    expect(files[0].content).toContain('// Checkbox');
  });

  it('ветвление по наличию визарда', () => {
    const body = '<% if (it.form.layout.isWizard) { %>ШАГИ<% } else { %>ОДИН ЭКРАН<% } %>';
    const withWizard = materializeFiles(
      template([schemaFile(wizardSchema()), { path: 'a.ts', content: body }]),
      ['a.ts'],
      'Анкета',
      OPTIONS
    );
    const without = materializeFiles(
      template([schemaFile(plainSchema()), { path: 'a.ts', content: body }]),
      ['a.ts'],
      'Анкета',
      OPTIONS
    );
    expect(withWizard[0].content).toBe('ШАГИ');
    expect(without[0].content).toBe('ОДИН ЭКРАН');
  });
});
