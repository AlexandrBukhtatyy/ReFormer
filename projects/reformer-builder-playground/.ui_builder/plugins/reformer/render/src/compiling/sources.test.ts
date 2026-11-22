/**
 * Отбор файлов модуля в набор линковщика: что в него входит, а что нет.
 *
 * @module plugins/reformer/render/compiling/sources.test
 */

import { describe, expect, it } from 'vitest';
import { fakeRef } from '../testing';
import { isExecutableSidecar, selectSidecars } from './sources';

describe('isExecutableSidecar', () => {
  it('сайдкары формы исполняются', () => {
    expect(isExecutableSidecar('model.ts')).toBe(true);
    expect(isExecutableSidecar('validation.ts')).toBe(true);
    expect(isExecutableSidecar('form.behavior.ts')).toBe(true);
    expect(isExecutableSidecar('registry.tsx')).toBe(true);
  });

  it('страница-обёртка не исполняется: это монтирование приложения внутрь приложения', () => {
    expect(isExecutableSidecar('index.tsx')).toBe(false);
    expect(isExecutableSidecar('index.ts')).toBe(false);
  });

  it('файлы папок ролей в наборе — и index роли тоже: вход модуля только в корне', () => {
    expect(isExecutableSidecar('model/initial-value.ts')).toBe(true);
    expect(isExecutableSidecar('validation/form.ts')).toBe(true);
    expect(isExecutableSidecar('validation/kontakty.ts')).toBe(true);
    expect(isExecutableSidecar('flow/zayavka-flow.ts')).toBe(true);
    expect(isExecutableSidecar('application/submit.ts')).toBe(true);
    expect(isExecutableSidecar('schema/registry.ts')).toBe(true);
    expect(isExecutableSidecar('behavior/index.ts')).toBe(true);
    expect(isExecutableSidecar('api/index.ts')).toBe(true);
  });

  it('данные в папках ролей — в наборе: схема шага разбитого визарда и справочники', () => {
    expect(isExecutableSidecar('schema/steps/kontakty/form.schema.json')).toBe(true);
    expect(isExecutableSidecar('constants/cities.json')).toBe(true);
  });

  it('фильтры по базовому имени действуют и в папках ролей', () => {
    expect(isExecutableSidecar('validation/form.test.ts')).toBe(false);
    expect(isExecutableSidecar('types/zayavka.d.ts')).toBe(false);
    expect(isExecutableSidecar('README.md')).toBe(false);
  });

  it('агрегатор шагов визарда — не страница: исключается только корневой index', () => {
    expect(isExecutableSidecar('steps/index.ts')).toBe(true);
    expect(isExecutableSidecar('steps/kontakty/validation.ts')).toBe(true);
    expect(isExecutableSidecar('steps/kontakty/form.render.ts')).toBe(true);
  });

  it('фильтры по базовому имени действуют и в папках шагов', () => {
    expect(isExecutableSidecar('steps/kontakty/validation.test.ts')).toBe(false);
    expect(isExecutableSidecar('steps/kontakty/fixture.ts')).toBe(false);
  });

  it('схема шага — в наборе: её импортирует агрегатор шагов; корневая схема — нет', () => {
    expect(isExecutableSidecar('steps/kontakty/form.schema.json')).toBe(true);
    expect(isExecutableSidecar('form.schema.json')).toBe(false);
  });

  it('тесты и объявления типов не исполняются', () => {
    expect(isExecutableSidecar('validation.test.ts')).toBe(false);
    expect(isExecutableSidecar('model.spec.tsx')).toBe(false);
    expect(isExecutableSidecar('types.d.ts')).toBe(false);
  });

  it('не-TypeScript в набор не попадает', () => {
    expect(isExecutableSidecar('form.json')).toBe(false);
    expect(isExecutableSidecar('README.md')).toBe(false);
  });

  it('фикстура не сайдкар: иначе `api.ts` исполнится дважды', () => {
    // Она лежит в каталоге формы и подставляет её же модули. Один граф на двоих означал бы
    // ДВА разных объекта под одним именем — см. `./fixture`.
    expect(isExecutableSidecar('fixture.ts')).toBe(false);
  });
});

describe('selectSidecars', () => {
  it('каталоги отбрасываются: каталог формы плоский', () => {
    const refs = [
      fakeRef('fake:form/model.ts'),
      fakeRef('fake:form/nested', { kind: 'directory' }),
      fakeRef('fake:form/form.json'),
    ];
    expect(selectSidecars(refs).map((ref) => ref.name)).toEqual(['model.ts']);
  });
});
