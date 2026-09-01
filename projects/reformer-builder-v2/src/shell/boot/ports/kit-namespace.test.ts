/**
 * Ленивая загрузка кита: кто узнаёт о ней и когда.
 *
 * Ценность теста — в одном свойстве, которое стоило пользователю видимого дефекта: форма,
 * собранная до загрузки кита, обязана пересобраться после неё. Проверять это на настоящем
 * импорте нечем — он тянет чанк на сотни килобайт, — поэтому загрузка внедряется параметром.
 *
 * @module app/kit-namespace.test
 */

import { describe, expect, it, vi } from 'vitest';
import type { KitNamespace } from '@/lib/kits/types';
import { createKitNamespaceLoader } from './kit-namespace';

const KIT: KitNamespace = Object.freeze({ InputField: () => null }) as unknown as KitNamespace;

/** Загрузка, которую можно разрешить вручную: гонки проверяются порядком, а не таймерами. */
function deferred(): { load: () => Promise<KitNamespace>; resolve: () => Promise<void> } {
  let settle: (() => void) | null = null;
  const gate = new Promise<void>((done) => {
    settle = done;
  });
  return {
    load: () => gate.then(() => KIT),
    resolve: async () => {
      settle?.();
      // Два оборота микротасков: один на `gate`, второй на `.then` внутри загрузчика.
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

describe('createKitNamespaceLoader', () => {
  it('до загрузки отвечает «кита нет», и это законное состояние', () => {
    const loader = createKitNamespaceLoader(() => new Promise(() => {}));
    expect(loader.get()).toBeNull();
  });

  it('загрузка начинается первым обращением, а не созданием', () => {
    const load = vi.fn(() => new Promise<KitNamespace>(() => {}));
    const loader = createKitNamespaceLoader(load);
    expect(load).not.toHaveBeenCalled();
    loader.get();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('повторные обращения второй загрузки не запускают', () => {
    const load = vi.fn(() => new Promise<KitNamespace>(() => {}));
    const loader = createKitNamespaceLoader(load);
    loader.get();
    loader.get();
    loader.get();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('подписчик узнаёт о загрузке: без этого форма остаётся в заглушках', async () => {
    const gate = deferred();
    const loader = createKitNamespaceLoader(gate.load);
    loader.get();
    const onLoad = vi.fn();
    loader.onDidLoad(onLoad);

    await gate.resolve();

    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(loader.get()).toBe(KIT);
  });

  it('опоздавший подписчик узнаёт тоже — уведомление ушло, пока слушать было некому', async () => {
    const gate = deferred();
    const loader = createKitNamespaceLoader(gate.load);
    loader.get();
    // Подписки ещё нет: так бывает, когда импорт разрешается раньше, чем отработает эффект.
    await gate.resolve();

    const onLoad = vi.fn();
    loader.onDidLoad(onLoad);
    await Promise.resolve();

    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it('второй опоздавший уже не будится: форма собрана правильным китом', async () => {
    const gate = deferred();
    const loader = createKitNamespaceLoader(gate.load);
    loader.get();
    await gate.resolve();

    const first = vi.fn();
    loader.onDidLoad(first);
    await Promise.resolve();

    const second = vi.fn();
    loader.onDidLoad(second);
    await Promise.resolve();

    expect(first).toHaveBeenCalledTimes(1);
    // Иначе каждое открытие вида пересобирало бы форму лишний раз — с уже нужным китом.
    expect(second).not.toHaveBeenCalled();
  });

  it('подписчик, услышавший загрузку вовремя, второй раз не будится', async () => {
    const gate = deferred();
    const loader = createKitNamespaceLoader(gate.load);
    loader.get();
    const onLoad = vi.fn();
    loader.onDidLoad(onLoad);
    await gate.resolve();

    const late = vi.fn();
    loader.onDidLoad(late);
    await Promise.resolve();

    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(late).not.toHaveBeenCalled();
  });

  it('отписка перестаёт уведомлять', async () => {
    const gate = deferred();
    const loader = createKitNamespaceLoader(gate.load);
    loader.get();
    const onLoad = vi.fn();
    loader.onDidLoad(onLoad).dispose();

    await gate.resolve();

    expect(onLoad).not.toHaveBeenCalled();
  });

  it('отказ загрузки не бросает наружу: форма рисуется заглушками', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const loader = createKitNamespaceLoader(() => Promise.reject(new Error('чанк не доехал')));
      loader.get();
      await Promise.resolve();
      await Promise.resolve();
      expect(loader.get()).toBeNull();
      expect(errors).toHaveBeenCalled();
    } finally {
      errors.mockRestore();
    }
  });

  it('упавший подписчик не мешает остальным узнать', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const gate = deferred();
      const loader = createKitNamespaceLoader(gate.load);
      loader.get();
      loader.onDidLoad(() => {
        throw new Error('подписчик сломался');
      });
      const good = vi.fn();
      loader.onDidLoad(good);

      await gate.resolve();

      expect(good).toHaveBeenCalledTimes(1);
    } finally {
      errors.mockRestore();
    }
  });
});
