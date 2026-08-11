/**
 * Имя формы по файлу её схемы: от него зависит имя каталога при экспорте примера. Каноничное имя
 * схемы (`renderer.schema.json`) имени формы не несёт — его несёт каталог, поэтому голое имя должно
 * откатываться на путь, а не давать безымянный `form/`.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@reformer/ui-kit/sonner', () => ({ toast: vi.fn() }));

import { formNameFromSchemaFile } from './save-actions';

describe('formNameFromSchemaFile', () => {
  it('снимает каноничный хвост схемы', () => {
    expect(formNameFromSchemaFile('credit.renderer.schema.json')).toBe('credit');
    expect(formNameFromSchemaFile('credit-application.form.json')).toBe('credit-application');
    expect(formNameFromSchemaFile('credit.json')).toBe('credit');
  });

  it('голое имя схемы → имя каталога', () => {
    expect(
      formNameFromSchemaFile('renderer.schema.json', 'src/forms/user-profile/renderer.schema.json')
    ).toBe('user-profile');
    expect(formNameFromSchemaFile('form.json', 'src/forms/loan/form.json')).toBe('loan');
  });

  it('без пути и без имени — читаемый фолбэк вместо пустой строки', () => {
    expect(formNameFromSchemaFile('renderer.schema.json')).toBe('form');
    expect(formNameFromSchemaFile('renderer.schema.json', 'renderer.schema.json')).toBe('form');
  });

  it('регистр расширения не важен, точки внутри имени сохраняются', () => {
    expect(formNameFromSchemaFile('Credit.RENDERER.SCHEMA.JSON')).toBe('Credit');
    expect(formNameFromSchemaFile('v2.credit.json')).toBe('v2.credit');
  });
});
