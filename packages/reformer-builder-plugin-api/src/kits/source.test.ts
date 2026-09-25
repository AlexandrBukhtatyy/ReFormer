import { describe, expect, it } from 'vitest';
import { declaredKitId, KitSourcePoint, type KitSource } from './source.js';

const catalog = (id?: string) => ({
  version: '2.1',
  components: [],
  ...(id === undefined ? {} : { kit: { id } }),
});

describe('declaredKitId — чем кит представляется до загрузки', () => {
  it('шапка — первым делом: у ленивого кита другого источника нет', () => {
    const source: KitSource = {
      catalog: () => Promise.resolve(catalog('acme')),
      kit: { id: 'acme' },
    };
    expect(declaredKitId(source)).toBe('acme');
  });

  it('ленивый кит без шапки себя не назвал — загрузчик ради имени не зовут', () => {
    let called = false;
    const source: KitSource = {
      catalog: () => {
        called = true;
        return Promise.resolve(catalog('acme'));
      },
    };
    expect(declaredKitId(source)).toBeUndefined();
    expect(called).toBe(false);
  });

  it('каталог-значение называет себя блоком kit', () => {
    expect(declaredKitId({ catalog: catalog('acme') })).toBe('acme');
    expect(declaredKitId({ catalog: catalog() })).toBeUndefined();
  });

  it('пустое имя — не имя', () => {
    expect(declaredKitId({ catalog: catalog(''), kit: { id: '' } })).toBeUndefined();
  });
});

describe('точка источников', () => {
  it('идентификатор точки — часть контракта: по нему внешний плагин вносит кит', () => {
    expect(KitSourcePoint.id).toBe('reformer.kit.source');
  });
});
