import { describe, expect, it, vi } from 'vitest';

import {
  createCapabilityAccess,
  defineCapability,
  meetsRequirement,
  type Capability,
} from './capability';
import { createServiceRegistry, defineService } from './service';

interface Kits {
  activeId(): string;
}

const KitsCap: Capability<Kits> = defineCapability<Kits>({
  id: 'reformer.kit.catalog',
  version: '1.0.0',
});

const kits = (id: string): Kits => ({ activeId: () => id });

describe('defineCapability', () => {
  it('возвращает токен с идентификатором и версией', () => {
    expect(KitsCap).toEqual({ id: 'reformer.kit.catalog', version: '1.0.0' });
  });

  it('не даёт объявить пустой идентификатор', () => {
    expect(() => defineCapability({ id: '  ', version: '1.0.0' })).toThrow(/пуст/);
  });

  it('не даёт объявить ДИАПАЗОН вместо версии', () => {
    // Иначе сравнение молча всегда ложно: satisfies('^1', '^1') — это false.
    expect(() => defineCapability({ id: 'x', version: '^1' })).toThrow(/1\.0\.0/);
    expect(() => defineCapability({ id: 'x', version: '1.x' })).toThrow(/1\.0\.0/);
    expect(() => defineCapability({ id: 'x', version: '1.0.0-beta' })).toThrow(/1\.0\.0/);
  });
});

describe('capability — это токен службы, а не второй реестр', () => {
  it('регистрируется и читается тем же ServiceRegistry', () => {
    const services = createServiceRegistry();
    const impl = kits('material');

    services.register(KitsCap, impl);

    expect(services.get(KitsCap)).toBe(impl);
  });

  it('находит службу, зарегистрированную ОБЫЧНЫМ токеном с тем же id, и наоборот', () => {
    // Это и есть довод против параллельного реестра: ключ один — строка, и разойтись
    // «служба есть, а возможности нет» физически нечему.
    const services = createServiceRegistry();
    const token = defineService<Kits>('reformer.kit.catalog');
    const impl = kits('material');
    services.register(token, impl);

    expect(createCapabilityAccess(services).get(KitsCap)).toBe(impl);
  });
});

describe('meetsRequirement', () => {
  it('сверяет идентификатор и диапазон', () => {
    expect(meetsRequirement(KitsCap, { id: 'reformer.kit.catalog', range: '^1' })).toBe(true);
    expect(meetsRequirement(KitsCap, { id: 'reformer.kit.catalog', range: '^2' })).toBe(false);
    expect(meetsRequirement(KitsCap, { id: 'other', range: '^1' })).toBe(false);
  });

  it('неразбираемый диапазон не выполнен ничем', () => {
    expect(meetsRequirement(KitsCap, { id: 'reformer.kit.catalog', range: '>=1 <2' })).toBe(false);
  });
});

describe('CapabilityAccess — вид на реестр служб', () => {
  it('get отдаёт undefined, а не бросает', () => {
    const access = createCapabilityAccess(createServiceRegistry());

    expect(access.get(KitsCap)).toBeUndefined();
  });

  it('require называет и требование, и того, кто мог бы его дать', () => {
    const access = createCapabilityAccess(createServiceRegistry(), {
      providers: (id) => (id === 'reformer.kit.catalog' ? ['kits'] : []),
    });

    expect(() => access.require(KitsCap)).toThrow(/reformer\.kit\.catalog/);
    expect(() => access.require(KitsCap)).toThrow(/1\.0\.0/);
    expect(() => access.require(KitsCap)).toThrow(/«kits»/);
  });

  it('без подсказки о провайдерах отказ всё равно внятен', () => {
    const access = createCapabilityAccess(createServiceRegistry());

    expect(() => access.require(KitsCap)).toThrow(/ни один плагин/);
  });

  it('require отдаёт реализацию, когда она есть', () => {
    const services = createServiceRegistry();
    const impl = kits('material');
    services.register(KitsCap, impl);

    expect(createCapabilityAccess(services).require(KitsCap)).toBe(impl);
  });
});

describe('observe — за появлением провайдера', () => {
  it('зовёт обработчик сразу с текущим значением', () => {
    // Без немедленного вызова каждый потребитель писал бы `get` плюс `observe` — две строки,
    // между которыми помещается гонка.
    const services = createServiceRegistry();
    const seen = vi.fn();

    createCapabilityAccess(services).observe(KitsCap, seen);

    expect(seen).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it('сообщает о появлении и об исчезновении', () => {
    const services = createServiceRegistry();
    const impl = kits('material');
    const seen: Array<Kits | undefined> = [];
    createCapabilityAccess(services).observe(KitsCap, (value) => seen.push(value));

    const registration = services.register(KitsCap, impl);
    registration.dispose();

    expect(seen).toEqual([undefined, impl, undefined]);
  });

  it('чужая служба наблюдателя не будит', () => {
    const services = createServiceRegistry();
    const seen = vi.fn();
    createCapabilityAccess(services).observe(KitsCap, seen);

    services.register(defineService<Kits>('other.service'), kits('x'));

    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('dispose прекращает наблюдение', () => {
    const services = createServiceRegistry();
    const seen = vi.fn();
    createCapabilityAccess(services).observe(KitsCap, seen).dispose();

    services.register(KitsCap, kits('material'));

    expect(seen).toHaveBeenCalledTimes(1);
  });
});
