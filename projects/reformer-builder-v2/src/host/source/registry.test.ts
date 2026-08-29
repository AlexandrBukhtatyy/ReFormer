/**
 * Тесты реестра источников.
 *
 * Проверяется шов переоткрытия: дескриптор сериализуем, живой объект нет, и связывает их
 * фабрика по виду. Отдельно — два различения, которые легко схлопнуть и потом не разобрать
 * в интерфейсе: «фабрика не смогла» (`null`) против «вида не знает никто» (отказ), и «слот
 * занят» против «тихо заменили».
 *
 * @module host/source/registry.test
 */

import { describe, expect, it } from 'vitest';

import { isSourceError } from './errors';
import { createMemorySource, createMemorySourceFactory } from './memory';
import { createSourceRegistry, isSourceDescriptor } from './registry';
import type { RestoredSource, SourceDescriptor, SourceFactory } from './types';

const stubFactory = (
  kind: string,
  source: RestoredSource = { unavailable: 'missing' }
): SourceFactory => ({
  kind,
  restore: async () => source,
});

describe('createSourceRegistry', () => {
  it('поднимает источник по дескриптору через фабрику его вида', async () => {
    const registry = createSourceRegistry();
    const source = createMemorySource({ 'a.json': '{}' }, { label: 'реестр-1' });
    registry.register(createMemorySourceFactory());

    const restored = await registry.restore({ kind: 'memory', label: 'реестр-1' });

    expect(restored).toBe(source);
  });

  it('пропускает причину от фабрики: «восстановить нельзя» — обычный ответ', async () => {
    const registry = createSourceRegistry();
    registry.register(createMemorySourceFactory());

    expect(await registry.restore({ kind: 'memory', label: 'никогда-не-создавали' })).toEqual({
      unavailable: 'missing',
    });
  });

  it('причина доходит от фабрики до вызывающего неизменной', async () => {
    // Реестр её не толкует и не обобщает: знает причину только тот, кто отказал, и ровно
    // в тот момент, а интерфейсу по ней выбирать кнопку.
    const registry = createSourceRegistry();
    registry.register(stubFactory('memory', { unavailable: 'denied' }));

    expect(await registry.restore({ kind: 'memory', label: 'что-угодно' })).toEqual({
      unavailable: 'denied',
    });
  });

  it('неизвестный вид — отказ, а не причина: это другой случай и другой разговор', async () => {
    const registry = createSourceRegistry();
    registry.register(stubFactory('memory'));

    const error = await registry.restore({ kind: 'fs', handleKey: 'x' }).catch((err) => err);

    expect(isSourceError(error, 'unsupported')).toBe(true);
    // В сообщении — что реестр вообще знает: иначе диагностика упирается в тупик.
    expect((error as Error).message).toContain('memory');
  });

  it('занятый вид — ошибка, а не тихая замена', () => {
    const registry = createSourceRegistry();
    registry.register(stubFactory('fs'));

    expect(() => registry.register(stubFactory('fs'))).toThrow(/уже зарегистрирован/);
    expect(registry.kinds()).toEqual(['fs']);
  });

  it('снятие вклада убирает вид, повторное снятие безвредно', async () => {
    const registry = createSourceRegistry();
    const subscription = registry.register(stubFactory('fs'));

    expect(registry.has('fs')).toBe(true);
    subscription.dispose();
    subscription.dispose();

    expect(registry.has('fs')).toBe(false);
    expect(registry.kinds()).toEqual([]);
  });

  it('снятие вклада не трогает чужой, занявший слот после', () => {
    const registry = createSourceRegistry();
    const first = registry.register(stubFactory('fs'));
    first.dispose();
    const second = stubFactory('fs');
    registry.register(second);

    // Запоздалое снятие первого не должно выбить второго — иначе выключение плагина
    // уносит с собой источник, который зарегистрировал уже другой.
    first.dispose();

    expect(registry.has('fs')).toBe(true);
  });

  it('перечисляет известные виды по алфавиту', () => {
    const registry = createSourceRegistry();
    registry.register(stubFactory('memory'));
    registry.register(stubFactory('fs'));
    registry.register(stubFactory('http'));

    expect(registry.kinds()).toEqual(['fs', 'http', 'memory']);
  });

  it('пустой вид не регистрируется', () => {
    const registry = createSourceRegistry();

    expect(() => registry.register(stubFactory(''))).toThrow(/пустым/);
  });
});

describe('isSourceDescriptor', () => {
  it('признаёт то, что приехало из хранилища разобранным JSON', () => {
    const descriptor: SourceDescriptor = { kind: 'fs', handleKey: 'project' };
    const wire: unknown = JSON.parse(JSON.stringify(descriptor));

    expect(isSourceDescriptor(wire)).toBe(true);
  });

  it('отвергает всё, у чего нет непустого строкового вида', () => {
    expect(isSourceDescriptor(null)).toBe(false);
    expect(isSourceDescriptor('fs')).toBe(false);
    expect(isSourceDescriptor({})).toBe(false);
    expect(isSourceDescriptor({ kind: '' })).toBe(false);
    expect(isSourceDescriptor({ kind: 42 })).toBe(false);
  });

  it('не судит о полях чужого вида: это знание фабрики, а не реестра', () => {
    // Реестр открыт для видов, которых он не знает, — иначе плагин не смог бы добавить свой.
    expect(isSourceDescriptor({ kind: 'http', origin: 'https://example.test' })).toBe(true);
  });
});
