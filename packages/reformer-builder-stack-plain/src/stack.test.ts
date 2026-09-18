import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  applyPlainOp,
  checkPlainForm,
  initialValues,
  isPlainForm,
  looksLikePlainForm,
  nextFieldName,
  parsePlainForm,
  printFormModule,
  printPlainForm,
  sampleForm,
  type PlainForm,
} from './index';

const form = sampleForm();

describe('разбор и печать', () => {
  it('печать и разбор — взаимно обратные', () => {
    expect(parsePlainForm(printPlainForm(form))).toEqual(form);
  });

  it('проба по тексту узнаёт свою схему и не узнаёт чужую', () => {
    expect(looksLikePlainForm(printPlainForm(form))).toBe(true);
    expect(looksLikePlainForm('{"version":"1.0","root":{}}')).toBe(false);
  });

  it('отказ разбора называет, что не так', () => {
    expect(() => parsePlainForm('{"$schema":"plain-form/1","fields":[{"name":1}]}')).toThrow(
      'fields[0].name'
    );
    expect(() => parsePlainForm('{"$schema":"other"}')).toThrow('$schema');
    expect(isPlainForm({ $schema: 'plain-form/1', fields: [] })).toBe(true);
  });
});

describe('операции', () => {
  it('добавление и его обратная возвращают исходную схему', () => {
    const op = {
      type: 'add-field',
      params: { field: { name: 'email', label: 'Email', type: 'text' } },
    } as const;
    const added = applyPlainOp(form, op);
    expect(added.model.fields.at(-1)?.name).toBe('email');
    expect(applyPlainOp(added.model, added.inverse).model).toEqual(form);
  });

  it('удаление возвращается на то же место', () => {
    const removed = applyPlainOp(form, { type: 'remove-field', params: { name: 'age' } });
    expect(applyPlainOp(removed.model, removed.inverse).model).toEqual(form);
  });

  it('переименование в занятое имя — отказ, а не тихая порча', () => {
    expect(() =>
      applyPlainOp(form, { type: 'rename-field', params: { name: 'age', to: 'name' } })
    ).toThrow('уже есть');
  });

  it('нетронутые поля остаются теми же объектами', () => {
    const renamed = applyPlainOp(form, {
      type: 'rename-field',
      params: { name: 'age', to: 'years' },
    });
    expect(renamed.model.fields[0]).toBe(form.fields[0]);
  });

  it('свободное имя нового поля', () => {
    expect(nextFieldName(form)).toBe('field1');
  });
});

describe('значения и проверка', () => {
  it('значения по каждому полю, сохранённые — только для существующих', () => {
    expect(initialValues(form, { name: 'Аня', gone: 'x' })).toEqual({
      name: 'Аня',
      age: null,
      channel: 'email',
      agree: false,
    });
  });

  it('пустое имя, дубликат и выбор без вариантов', () => {
    const broken: PlainForm = {
      $schema: 'plain-form/1',
      fields: [
        { name: 'a', label: 'A', type: 'text' },
        { name: 'a', label: 'A2', type: 'text' },
        { name: '', label: 'B', type: 'text' },
        { name: 'c', label: 'C', type: 'select', options: [] },
      ],
    };
    expect(checkPlainForm(broken).map((problem) => [problem.code, problem.index])).toEqual([
      ['duplicate-name', 1],
      ['empty-name', 2],
      ['no-options', 3],
    ]);
    expect(checkPlainForm(form)).toEqual([]);
  });
});

describe('печать Form.tsx', () => {
  const module = printFormModule(form, { componentName: 'ContactForm' });

  it('несёт маркер происхождения и нативные элементы', () => {
    expect(module.startsWith('// @reformer-generated ')).toBe(true);
    expect(module).toContain('export function ContactForm(');
    expect(module).toContain('<select');
    expect(module).toContain('type="checkbox"');
    expect(module).toContain('type="number"');
  });

  it('подписи и имена попадают в код литералами', () => {
    const tricky = printFormModule({
      $schema: 'plain-form/1',
      fields: [{ name: 'a"b', label: 'Имя {x} <y>', type: 'text' }],
    });
    expect(tricky).toContain('{"Имя {x} <y>"}');
    expect(tricky).toContain('"a\\"b": string;');
  });

  it('не импортирует ничего, кроме React', () => {
    const imports = module.match(/^import .* from '([^']+)';$/gm) ?? [];
    expect(imports).toEqual(["import { useState } from 'react';"]);
  });
});

describe('стек не знает ReFormer', () => {
  it('в зависимостях нет рендерера, ядра форм и стека ReFormer', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    const all = Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies });
    expect(all).not.toContain('@reformer/renderer-json');
    expect(all).not.toContain('@reformer/core');
    expect(all).not.toContain('@reformer/builder-stack-reformer');
  });
});
