import { describe, expect, it } from 'vitest';
import { formNameOfSchemaPath, importOf, MODULE_FILES, SCHEMA_FILE_NAMES } from './layout';

describe('formNameOfSchemaPath', () => {
  it('канонический файл схемы называет форму именем папки', () => {
    expect(formNameOfSchemaPath('forms/loan-application/form.schema.json')).toBe(
      'loan-application'
    );
  });

  it('прежнее имя схемы — тоже по папке, а не «renderer»', () => {
    expect(formNameOfSchemaPath('forms/loan/renderer.schema.json')).toBe('loan');
  });

  it('прочие имена — по файлу до первой точки', () => {
    expect(formNameOfSchemaPath('forms/loan.schema.json')).toBe('loan');
    expect(formNameOfSchemaPath('loan.form.json')).toBe('loan');
  });

  it('канонический файл в корне без папки даёт умолчание, а не пустое имя', () => {
    expect(formNameOfSchemaPath('form.schema.json')).toBe('form');
  });

  it('обратные слэши Windows не ломают разбор', () => {
    expect(formNameOfSchemaPath('forms\\loan\\form.schema.json')).toBe('loan');
  });
});

describe('importOf', () => {
  it('из корня: скрипт без расширения, данные — с ним', () => {
    expect(importOf('index.tsx', MODULE_FILES.render)).toBe('./form.render');
    expect(importOf('index.tsx', MODULE_FILES.schema)).toBe('./form.schema.json');
  });

  it('папка импортируется через её index', () => {
    expect(importOf('form.validation.ts', 'steps/index.ts')).toBe('./steps');
  });

  it('из папки шага — вверх до корня', () => {
    expect(importOf('steps/kontakty/form.validation.ts', 'types.ts')).toBe('../../types');
  });

  it('из агрегатора — вниз в папку шага', () => {
    expect(importOf('steps/index.ts', 'steps/kontakty/form.render.ts')).toBe(
      './kontakty/form.render'
    );
  });
});

describe('SCHEMA_FILE_NAMES', () => {
  it('канон первым: форма с обоими файлами открывается по новому', () => {
    expect(SCHEMA_FILE_NAMES[0]).toBe('form.schema.json');
    expect(SCHEMA_FILE_NAMES).toContain('renderer.schema.json');
  });
});
