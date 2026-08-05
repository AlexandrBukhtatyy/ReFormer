import { describe, it, expect } from 'vitest';
import { resolveForms, passesGate, compileRoute, matchRouteParams } from './resolve';
import type { FormEntry, ResolveContext } from './types';

const entry = (over: Partial<FormEntry> & Pick<FormEntry, 'id'>): FormEntry => ({
  version: '1.0.0',
  owner: 'test-mfe',
  schema: { kind: 'inline', value: { root: {} } as never },
  ...over,
});

const ctx = (permissions: string[] = [], flags: string[] = []): ResolveContext => ({
  permissions: new Set(permissions),
  flags: new Set(flags),
});

describe('resolveForms — гейт един для всех способов адресации', () => {
  const guarded = entry({
    id: 'credit',
    access: { permissions: ['loans.write'] },
    placement: { slots: ['sidebar'], routes: ['/loans/:id/apply'] },
    meta: { tags: ['loans'] },
  });

  it.each([
    ['по id', { by: 'id', id: 'credit' } as const],
    ['по слоту', { by: 'slot', slot: 'sidebar' } as const],
    ['по маршруту', { by: 'route', path: '/loans/42/apply' } as const],
    ['по тегу', { by: 'tag', tag: 'loans' } as const],
  ])('%s: без права — пусто, с правом — видно', (_label, query) => {
    expect(resolveForms([guarded], query, ctx())).toEqual([]);
    expect(resolveForms([guarded], query, ctx(['loans.write']))).toHaveLength(1);
  });
});

describe('passesGate', () => {
  it('требует ВСЕ права, а не любое', () => {
    const e = entry({ id: 'x', access: { permissions: ['a', 'b'] } });
    expect(passesGate(e, ctx(['a']))).toBe(false);
    expect(passesGate(e, ctx(['a', 'b']))).toBe(true);
  });

  it('требует ВСЕ флаги', () => {
    const e = entry({ id: 'x', access: { flags: ['beta', 'newFlow'] } });
    expect(passesGate(e, ctx([], ['beta']))).toBe(false);
    expect(passesGate(e, ctx([], ['beta', 'newFlow']))).toBe(true);
  });

  it('canRender не вызывается, если запись уже отсеяна по правам', () => {
    let called = false;
    const e = entry({
      id: 'x',
      access: {
        permissions: ['admin'],
        canRender: () => {
          called = true;
          return true;
        },
      },
    });
    expect(passesGate(e, ctx())).toBe(false);
    expect(called).toBe(false);
  });

  it('canRender решает, когда права и флаги пройдены', () => {
    const e = entry({ id: 'x', access: { canRender: (c) => c.locale === 'ru' } });
    expect(passesGate(e, { ...ctx(), locale: 'en' })).toBe(false);
    expect(passesGate(e, { ...ctx(), locale: 'ru' })).toBe(true);
  });

  it('без access доступно всем', () => {
    expect(passesGate(entry({ id: 'x' }), ctx())).toBe(true);
  });
});

describe('resolveForms — порядок выдачи', () => {
  it('приоритет размещения по убыванию', () => {
    const low = entry({ id: 'a', placement: { slots: ['s'], priority: 1 } });
    const high = entry({ id: 'b', placement: { slots: ['s'], priority: 10 } });
    const got = resolveForms([low, high], { by: 'slot', slot: 's' }, ctx());
    expect(got.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('при равном приоритете — версия по убыванию', () => {
    const v1 = entry({ id: 'a', version: '1.9.0', placement: { slots: ['s'] } });
    const v2 = entry({ id: 'a', version: '1.10.0', placement: { slots: ['s'] } });
    const got = resolveForms([v1, v2], { by: 'slot', slot: 's' }, ctx());
    // 1.10.0 новее 1.9.0 — сравнение числовое, а не лексикографическое
    expect(got.map((e) => e.version)).toEqual(['1.10.0', '1.9.0']);
  });

  it('запрос по id с версией отбирает точное совпадение', () => {
    const v1 = entry({ id: 'a', version: '1.0.0' });
    const v2 = entry({ id: 'a', version: '2.0.0' });
    const got = resolveForms([v1, v2], { by: 'id', id: 'a', version: '1.0.0' }, ctx());
    expect(got.map((e) => e.version)).toEqual(['1.0.0']);
  });
});

describe('маршруты', () => {
  it.each([
    ['/loans/:id/apply', '/loans/42/apply', true],
    ['/loans/:id/apply', '/loans/42/apply/', true],
    ['/loans/:id/apply', '/loans/42', false],
    ['/loans/:id/apply', '/loans/42/apply/extra', false],
    ['/admin/*', '/admin/users/1', true],
    ['/exact', '/exact', true],
    ['/exact', '/exactly', false],
  ])('%s против %s → %s', (pattern, path, expected) => {
    expect(compileRoute(pattern).test(path)).toBe(expected);
  });

  it('извлекает параметры маршрута', () => {
    const e = entry({ id: 'x', placement: { routes: ['/loans/:loanId/step/:step'] } });
    expect(matchRouteParams(e, '/loans/42/step/3')).toEqual({ loanId: '42', step: '3' });
  });

  it('вернёт undefined, если ни один шаблон не подошёл', () => {
    const e = entry({ id: 'x', placement: { routes: ['/a/:id'] } });
    expect(matchRouteParams(e, '/b/1')).toBeUndefined();
  });
});
