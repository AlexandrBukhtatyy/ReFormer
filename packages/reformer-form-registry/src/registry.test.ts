import { describe, it, expect, beforeEach } from 'vitest';
import { createFormRegistry, getFormRegistry, resetFormRegistry } from './registry';
import type { FormEntry } from './types';

const entry = (over: Partial<FormEntry> & Pick<FormEntry, 'id'>): FormEntry => ({
  version: '1.0.0',
  owner: 'mfe-a',
  schema: { kind: 'inline', value: { root: {} } as never },
  ...over,
});

const ctx = { permissions: new Set<string>(), flags: new Set<string>() };

beforeEach(() => resetFormRegistry());

describe('FormRegistry — регистрация и снятие', () => {
  it('register возвращает unregister, который снимает запись', () => {
    const reg = createFormRegistry();
    const off = reg.register(entry({ id: 'a' }));
    expect(reg.list()).toHaveLength(1);
    off();
    expect(reg.list()).toHaveLength(0);
  });

  it('unregister идемпотентен', () => {
    const reg = createFormRegistry();
    const off = reg.register(entry({ id: 'a' }));
    off();
    off();
    expect(reg.list()).toHaveLength(0);
  });

  it('unregister прошлого владельца не снимает запись, перезаписавшую ключ', () => {
    // Сценарий single-spa: приложение A выгружается ПОСЛЕ того, как B заняло тот же id.
    const reg = createFormRegistry();
    const offA = reg.register(entry({ id: 'a', owner: 'mfe-a' }));
    reg.register(entry({ id: 'a', owner: 'mfe-b' }), { onConflict: 'replace' });
    offA();
    expect(reg.list().map((e) => e.owner)).toEqual(['mfe-b']);
  });

  it('registerAll снимает всю пачку одним вызовом', () => {
    const reg = createFormRegistry();
    const off = reg.registerAll([entry({ id: 'a' }), entry({ id: 'b' })]);
    expect(reg.list()).toHaveLength(2);
    off();
    expect(reg.list()).toHaveLength(0);
  });

  it('разные версии одной формы сосуществуют', () => {
    const reg = createFormRegistry();
    reg.register(entry({ id: 'a', version: '1.0.0' }));
    reg.register(entry({ id: 'a', version: '2.0.0' }));
    expect(reg.list()).toHaveLength(2);
  });
});

describe('FormRegistry — конфликты id между микрофронтами', () => {
  it('по умолчанию бросает и называет обоих владельцев', () => {
    const reg = createFormRegistry();
    reg.register(entry({ id: 'a', owner: 'mfe-a' }));
    expect(() => reg.register(entry({ id: 'a', owner: 'mfe-b' }))).toThrow(/mfe-a[\s\S]*mfe-b/);
  });

  it("'keep' оставляет первую и пишет диагностику", () => {
    const reg = createFormRegistry();
    reg.register(entry({ id: 'a', owner: 'mfe-a' }));
    reg.register(entry({ id: 'a', owner: 'mfe-b' }), { onConflict: 'keep' });
    expect(reg.list().map((e) => e.owner)).toEqual(['mfe-a']);
    expect(reg.diagnostics.map((d) => d.code)).toContain('duplicate-entry-kept');
  });

  it("'replace' заменяет и пишет диагностику", () => {
    const reg = createFormRegistry();
    reg.register(entry({ id: 'a', owner: 'mfe-a' }));
    reg.register(entry({ id: 'a', owner: 'mfe-b' }), { onConflict: 'replace' });
    expect(reg.list().map((e) => e.owner)).toEqual(['mfe-b']);
    expect(reg.diagnostics.map((d) => d.code)).toContain('duplicate-entry-replaced');
  });

  it('повторная регистрация ТОЙ ЖЕ записи не считается конфликтом', () => {
    const reg = createFormRegistry();
    const e = entry({ id: 'a' });
    reg.register(e);
    expect(() => reg.register(e)).not.toThrow();
  });
});

describe('FormRegistry — подписка', () => {
  it('уведомляет при регистрации и снятии', () => {
    const reg = createFormRegistry();
    let calls = 0;
    const off = reg.subscribe(() => calls++);
    const unregister = reg.register(entry({ id: 'a' }));
    expect(calls).toBe(1);
    unregister();
    expect(calls).toBe(2);
    off();
    reg.register(entry({ id: 'b' }));
    expect(calls).toBe(2); // отписались
  });
});

describe('FormRegistry — стабильность снимка', () => {
  it('list() возвращает ТУ ЖЕ ссылку, пока состав не менялся', () => {
    // Нарушение этого инварианта даёт бесконечный цикл рендера в useSyncExternalStore
    // (React error #185): он сравнивает снимок по ссылке.
    const reg = createFormRegistry();
    reg.register(entry({ id: 'a' }));
    expect(reg.list()).toBe(reg.list());
  });

  it('после регистрации ссылка меняется', () => {
    const reg = createFormRegistry();
    const before = reg.list();
    reg.register(entry({ id: 'a' }));
    expect(reg.list()).not.toBe(before);
  });

  it('после снятия ссылка меняется', () => {
    const reg = createFormRegistry();
    const off = reg.register(entry({ id: 'a' }));
    const before = reg.list();
    off();
    expect(reg.list()).not.toBe(before);
  });
});

describe('getFormRegistry — пиннинг на realm', () => {
  it('возвращает один и тот же инстанс', () => {
    expect(getFormRegistry()).toBe(getFormRegistry());
  });

  it('инстанс лежит в globalThis под Symbol.for — виден другой копии модуля', () => {
    const reg = getFormRegistry();
    reg.register(entry({ id: 'shared' }));

    // Имитация второй копии пакета: свой доступ к realm-слоту по тому же ключу.
    const slot = (globalThis as unknown as Record<symbol, { instance?: typeof reg }>)[
      Symbol.for('reformer.form-registry.v1')
    ];
    expect(slot?.instance).toBe(reg);
    expect(slot?.instance?.resolve({ by: 'id', id: 'shared' }, ctx)).toHaveLength(1);
  });

  it('resetFormRegistry даёт чистый инстанс', () => {
    const first = getFormRegistry();
    resetFormRegistry();
    expect(getFormRegistry()).not.toBe(first);
  });
});
