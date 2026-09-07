/**
 * Чтение сайдкаров: имена для компилятора, адреса для свода диагностик.
 *
 * @module plugins/preview/compiling/read.test
 */

import { describe, expect, it } from 'vitest';
import { createFakeHost } from '../testing';
import { attributeProblems, readSidecars } from './read';

const DOC = 'fake:form/form.json';

describe('readSidecars', () => {
  it('отдаёт и исходники по именам, и адреса по именам', async () => {
    const host = createFakeHost({
      siblings: { 'validation.ts': 'export const formValidation = {};', 'model.ts': 'export {};' },
    });
    const sources = await readSidecars(host, DOC);
    expect([...sources.files.keys()].sort()).toEqual(['model.ts', 'validation.ts']);
    expect(sources.resources.get('validation.ts')).toBe('fake:form/validation.ts');
    expect(sources.problems).toEqual([]);
  });

  it('отказ чтения одного файла адресуется этим файлом и не отменяет остальных', async () => {
    const host = createFakeHost({ siblings: { 'validation.ts': 'ok', 'model.ts': 'ok' } });
    const broken = {
      ...host,
      readText: (id: string) =>
        id.endsWith('model.ts') ? Promise.reject(new Error('нет доступа')) : host.readText(id),
    };
    const sources = await readSidecars(broken, DOC);
    expect([...sources.files.keys()]).toEqual(['validation.ts']);
    expect(sources.problems).toEqual([
      {
        file: 'model.ts',
        phase: 'resolve',
        message: 'нет доступа',
        resource: 'fake:form/model.ts',
      },
    ]);
  });
});

describe('attributeProblems', () => {
  const resources = new Map([['validation.ts', 'fake:form/validation.ts']]);

  it('находка, названная именем сайдкара, получает его адрес', () => {
    const [problem] = attributeProblems(
      [{ file: 'validation.ts', phase: 'transpile', message: 'x' }],
      resources
    );
    expect(problem.resource).toBe('fake:form/validation.ts');
  });

  it('уже адресованная находка и находка без файла остаются как есть', () => {
    const input = [
      { file: 'validation.ts', phase: 'transpile' as const, message: 'x', resource: 'own' },
      { file: '', phase: 'render' as const, message: 'y' },
    ];
    const out = attributeProblems(input, resources);
    expect(out[0]).toBe(input[0]);
    expect(out[1]).toBe(input[1]);
  });

  it('имя, которого среди сайдкаров нет, адреса не получает', () => {
    const [problem] = attributeProblems(
      [{ file: '__preview-entry__.js', phase: 'evaluate', message: 'x' }],
      resources
    );
    expect(problem.resource).toBeUndefined();
  });
});
