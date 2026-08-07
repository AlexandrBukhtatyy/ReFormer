/**
 * Состояние активного кита. Ключевая проверка — что ФОЛБЭК не «почти правильный»: до сборки
 * каталога модули (`node-kind`, `render-policy`) спрашивают дескриптор из холодных путей, и если бы
 * фолбэк отличался от дескриптора, собранного по каталогу, поведение зависело бы от порядка
 * импортов — худший класс багов.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { getActiveDescriptor, resetActiveDescriptor, setActiveDescriptor } from './active';
import { toDescriptor } from './descriptor';
import { loadCatalogJson } from '../catalog/contract';

afterEach(resetActiveDescriptor);

describe('фолбэк до сборки каталога', () => {
  it('совпадает с дескриптором из фактического каталога встроенного кита', () => {
    resetActiveDescriptor();
    const fallback = getActiveDescriptor();
    const fromCatalog = toDescriptor(loadCatalogJson());

    expect(fallback.id).toBe(fromCatalog.id);
    expect(fallback.package).toBe(fromCatalog.package);
    expect(fallback.resolve).toEqual(fromCatalog.resolve);
    expect(fallback.infra).toEqual(fromCatalog.infra);
    expect(fallback.palette.categoryByName).toBe(fromCatalog.palette.categoryByName);
    // Множества, зависящие от записей каталога: у поставляемого ui-kit per-record полей 2.0 нет,
    // поэтому они обязаны совпасть. Как только кит их пришлёт, разойдутся — и это правильно,
    // потому что к тому моменту дескриптор уже будет положен сборкой каталога.
    expect([...fallback.leafComponents].sort()).toEqual([...fromCatalog.leafComponents].sort());
    expect([...fallback.previewPolicy.keys()].sort()).toEqual(
      [...fromCatalog.previewPolicy.keys()].sort()
    );
    expect([...fallback.unresolvedReason.keys()].sort()).toEqual(
      [...fromCatalog.unresolvedReason.keys()].sort()
    );
  });

  it('стабилен между вызовами (мемо, а не новый объект каждый раз)', () => {
    resetActiveDescriptor();
    expect(getActiveDescriptor()).toBe(getActiveDescriptor());
  });
});

describe('установка и сброс', () => {
  it('положенный дескриптор побеждает фолбэк', () => {
    setActiveDescriptor(
      toDescriptor({ version: '2.0', components: [], kit: { id: 'acme', package: '@acme/ds' } })
    );
    expect(getActiveDescriptor().id).toBe('acme');
    expect(getActiveDescriptor().package).toBe('@acme/ds');
  });

  it('сброс возвращает к дефолтам билдера', () => {
    setActiveDescriptor(toDescriptor({ version: '2.0', components: [], kit: { id: 'acme' } }));
    resetActiveDescriptor();
    expect(getActiveDescriptor().id).toBe('reformer-ui-kit');
  });
});
