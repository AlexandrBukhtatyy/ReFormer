/**
 * Привратник служб: что видит плагин с правом и без него.
 *
 * Проверяется поведение, а не список: привилегированной считается служба из
 * {@link PRIVILEGED_SERVICES}, и тест берёт её ОТТУДА же. Зашей он сюда `reformer.workspace.save`
 * литералом — переименование службы оставило бы тест зелёным при открытой настежь двери.
 *
 * @module shell/platform/plugin/permissions.test
 */

import { describe, expect, it } from 'vitest';

import { defineService, type ServiceRegistry } from '@reformer/builder-plugin-api/internal';
import { createServiceRegistry } from '@/shell/platform/primitives/service';
import { createPermittedServices, PluginPermissionError, PRIVILEGED_SERVICES } from './permissions';

const [privilegedId, permission] = [...PRIVILEGED_SERVICES][0] ?? [];
const Privileged = defineService<{ mark: string }>(privilegedId ?? 'нет привилегированных служб');
const Ordinary = defineService<{ mark: string }>('test.ordinary');

function registryWith(): ServiceRegistry {
  const services = createServiceRegistry();
  services.register(Privileged, { mark: 'привилегированная' });
  services.register(Ordinary, { mark: 'обычная' });
  return services;
}

const viewFor = (granted: string[]): ServiceRegistry =>
  createPermittedServices(registryWith(), {
    pluginId: 'acme',
    granted: granted as never,
  });

describe('вид реестра, суженный правами', () => {
  it('привилегированных служб в списке есть хотя бы одна', () => {
    // Иначе весь файл проверял бы пустоту: механизм заводится вместе со своей первой дверью.
    expect(privilegedId).toBeDefined();
    expect(permission).toBeDefined();
  });

  it('без права: get молчит, require отказывает, register не пускает', () => {
    const view = viewFor([]);

    expect(view.get(Privileged)).toBeUndefined();
    expect(() => view.require(Privileged)).toThrowError(PluginPermissionError);
    // Регистрация тоже под правом: иначе плагин занял бы слот сам и стал бы тем,
    // у кого соседи спрашивают запертую службу.
    expect(() => view.register(Privileged, { mark: 'подмена' })).toThrowError(
      PluginPermissionError
    );
  });

  it('с правом: та же служба, что в реестре', () => {
    const view = viewFor([permission as string]);

    expect(view.get(Privileged)).toEqual({ mark: 'привилегированная' });
    expect(view.require(Privileged)).toEqual({ mark: 'привилегированная' });
  });

  it('обычные службы проходят насквозь в обоих случаях', () => {
    expect(viewFor([]).get(Ordinary)).toEqual({ mark: 'обычная' });
    expect(viewFor([permission as string]).require(Ordinary)).toEqual({ mark: 'обычная' });
  });

  it('отказ называет плагин, службу и право — интерфейсу не нужно разбирать текст', () => {
    try {
      viewFor([]).require(Privileged);
      expect.unreachable('require обязан был отказать');
    } catch (error) {
      expect(error).toBeInstanceOf(PluginPermissionError);
      const refusal = error as PluginPermissionError;
      expect(refusal.pluginId).toBe('acme');
      expect(refusal.serviceId).toBe(privilegedId);
      expect(refusal.permission).toBe(permission);
    }
  });
});
