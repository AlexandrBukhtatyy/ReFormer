import { afterEach, describe, expect, it } from 'vitest';
import {
  getClientCatalog,
  getRuntimeConfig,
  resetRuntimeState,
  setClientCatalog,
  setRuntimeConfig,
} from './state';

afterEach(resetRuntimeState);

describe('config/state', () => {
  it('дефолт — пустой конфиг и отсутствие клиентского каталога', () => {
    expect(getRuntimeConfig()).toEqual({});
    expect(getClientCatalog()).toBeNull();
  });

  it('set/get конфига и каталога', () => {
    setRuntimeConfig({ ui: { theme: 'dark' } });
    setClientCatalog({ version: '2.0', components: [] });
    expect(getRuntimeConfig().ui?.theme).toBe('dark');
    expect(getClientCatalog()?.version).toBe('2.0');
  });

  it('reset возвращает к дефолтам', () => {
    setRuntimeConfig({ ui: { theme: 'dark' } });
    setClientCatalog({ version: '2.0', components: [] });
    resetRuntimeState();
    expect(getRuntimeConfig()).toEqual({});
    expect(getClientCatalog()).toBeNull();
  });
});
