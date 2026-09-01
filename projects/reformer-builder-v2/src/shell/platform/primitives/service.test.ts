import { describe, expect, it } from 'vitest';

import { createServiceRegistry, defineService } from './service';

interface Clock {
  now(): number;
}

interface Notifier {
  notify(text: string): void;
}

const ClockToken = defineService<Clock>('test.clock');
const NotifierToken = defineService<Notifier>('test.notifier');

const clock = (value: number): Clock => ({ now: () => value });

describe('defineService', () => {
  it('возвращает токен с переданным идентификатором', () => {
    expect(ClockToken.id).toBe('test.clock');
  });

  it('не даёт объявить токен с пустым идентификатором', () => {
    // Пустой id превратил бы диагностику в «сервис «» не зарегистрирован».
    expect(() => defineService('')).toThrow(/пуст/);
    expect(() => defineService('   ')).toThrow(/пуст/);
  });
});

describe('get — отсутствие сервиса это не ошибка', () => {
  it('отдаёт undefined для незарегистрированного токена', () => {
    const registry = createServiceRegistry();

    // Правило доступности: сервис плагина может отсутствовать, и вызывающий деградирует.
    expect(registry.get(ClockToken)).toBeUndefined();
  });

  it('отдаёт ровно ту реализацию, что зарегистрировали', () => {
    const registry = createServiceRegistry();
    const impl = clock(42);
    registry.register(ClockToken, impl);

    const found: Clock | undefined = registry.get(ClockToken);

    expect(found).toBe(impl);
    expect(found?.now()).toBe(42);
  });

  it('не путает разные токены', () => {
    const registry = createServiceRegistry();
    registry.register(ClockToken, clock(1));

    expect(registry.get(NotifierToken)).toBeUndefined();
  });
});

describe('require — только для сервисов Host', () => {
  it('отдаёт реализацию, когда она есть', () => {
    const registry = createServiceRegistry();
    const impl = clock(7);
    registry.register(ClockToken, impl);

    const found: Clock = registry.require(ClockToken);

    expect(found).toBe(impl);
  });

  it('бросает с именем токена и подсказкой про get', () => {
    const registry = createServiceRegistry();

    expect(() => registry.require(ClockToken)).toThrow(/test\.clock/);
    expect(() => registry.require(ClockToken)).toThrow(/get/);
  });
});

describe('повторная регистрация — ошибка, а не замена', () => {
  it('бросает, если слот уже занят', () => {
    const registry = createServiceRegistry();
    registry.register(ClockToken, clock(1));

    expect(() => registry.register(ClockToken, clock(2))).toThrow(/test\.clock/);
  });

  it('оставляет реестр целым: первая реализация продолжает работать', () => {
    const registry = createServiceRegistry();
    const first = clock(1);
    registry.register(ClockToken, first);

    expect(() => registry.register(ClockToken, clock(2))).toThrow();
    expect(registry.get(ClockToken)).toBe(first);
  });

  it('не зависит от порядка: какой бы плагин ни был первым, поведение одинаково', () => {
    // Правило приёмки Э4 — активация в обратном порядке даёт то же поведение.
    // При молчаливой замене этот тест был бы невыполним по построению.
    const a = clock(1);
    const b = clock(2);

    const forward = createServiceRegistry();
    forward.register(ClockToken, a);
    const backward = createServiceRegistry();
    backward.register(ClockToken, b);

    expect(() => forward.register(ClockToken, b)).toThrow();
    expect(() => backward.register(ClockToken, a)).toThrow();
    expect(forward.get(ClockToken)).toBe(a);
    expect(backward.get(ClockToken)).toBe(b);
  });
});

describe('dispose освобождает слот', () => {
  it('после снятия сервис не находится', () => {
    const registry = createServiceRegistry();
    const sub = registry.register(ClockToken, clock(1));

    sub.dispose();

    expect(registry.get(ClockToken)).toBeUndefined();
    expect(() => registry.require(ClockToken)).toThrow();
  });

  it('после снятия слот можно занять заново — это путь перезагрузки плагина', () => {
    const registry = createServiceRegistry();
    const sub = registry.register(ClockToken, clock(1));
    sub.dispose();

    const second = clock(2);
    registry.register(ClockToken, second);

    expect(registry.get(ClockToken)).toBe(second);
  });

  it('повторный dispose безвреден и не сносит новую регистрацию', () => {
    const registry = createServiceRegistry();
    const sub = registry.register(ClockToken, clock(1));
    sub.dispose();
    const second = clock(2);
    registry.register(ClockToken, second);

    sub.dispose();

    expect(registry.get(ClockToken)).toBe(second);
  });
});

describe('ключ реестра — строка id, а не объект токена', () => {
  it('два токена с одинаковым id ведут в один слот', () => {
    // Модуль с объявлением токена может оказаться в памяти дважды (плагины грузятся
    // собственным линкером). Ключ по объекту дал бы «сервис есть, но не находится».
    const registry = createServiceRegistry();
    const twin = defineService<Clock>('test.clock');
    const impl = clock(3);
    registry.register(ClockToken, impl);

    expect(registry.get(twin)).toBe(impl);
    expect(() => registry.register(twin, clock(4))).toThrow();
  });
});
