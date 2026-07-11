import { describe, it, expect } from 'vitest';
import {
  createLocaleService,
  createLocaleResolver,
  defaultLocaleResolver,
  type LocaleService,
} from './locale-service';

describe('createLocaleService (closure table, params/plural)', () => {
  it('resolves with params (interpolation)', () => {
    const svc = createLocaleService({ 'fields.min': (p) => `Минимум ${p?.count} символов` });
    expect(svc.resolve('fields.min', { count: 3 })).toBe('Минимум 3 символов');
  });

  it('supports hand-written pluralization', () => {
    const svc = createLocaleService({
      'users.count': (p) => {
        const n = Number(p?.count);
        const forms = ['пользователь', 'пользователя', 'пользователей'];
        const idx =
          n % 10 === 1 && n % 100 !== 11
            ? 0
            : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)
              ? 1
              : 2;
        return `${n} ${forms[idx]}`;
      },
    });
    expect(svc.resolve('users.count', { count: 1 })).toBe('1 пользователь');
    expect(svc.resolve('users.count', { count: 3 })).toBe('3 пользователя');
    expect(svc.resolve('users.count', { count: 5 })).toBe('5 пользователей');
  });

  it('falls back to the key on a miss', () => {
    const svc = createLocaleService({ a: () => 'A' });
    expect(svc.resolve('missing')).toBe('missing');
  });

  it('exposes keys for validate-time typo detection', () => {
    const svc = createLocaleService({ a: () => 'A', b: () => 'B' });
    expect(svc.keys).toEqual(['a', 'b']);
  });
});

describe('backward compatibility', () => {
  it('createLocaleResolver still resolves plain catalogs (no params)', () => {
    const svc = createLocaleResolver({ a: 'A' });
    expect(svc.resolve('a')).toBe('A');
    expect(svc.resolve('x')).toBe('x'); // fallback-to-key
  });

  it('defaultLocaleResolver returns the key', () => {
    expect(defaultLocaleResolver('any.key')).toBe('any.key');
  });

  it('a params-less (key) => string closure satisfies the widened LocaleService', () => {
    // Существующий резолвер `(key) => string` присваивается `LocaleService` (второй параметр опционален).
    const svc: LocaleService = { resolve: (key: string) => key.toUpperCase() };
    expect(svc.resolve('x')).toBe('X');
    expect(svc.resolve('y', { count: 1 })).toBe('Y'); // вызов с params типизируется, резолвер их игнорирует
  });
});
