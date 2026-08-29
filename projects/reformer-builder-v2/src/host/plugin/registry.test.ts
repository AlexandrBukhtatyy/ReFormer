import { describe, expect, it, vi } from 'vitest';

import { createCommandRegistry, type CommandRegistry } from '../primitives/command';
import { createEventBus, defineEvent, type EventBus } from '../primitives/event';
import {
  createExtensionRegistry,
  defineExtensionPoint,
  type RootExtensionRegistry,
} from '../primitives/extension-point';
import { createServiceRegistry, defineService, type ServiceRegistry } from '../primitives/service';
import { createPluginRegistry, type PluginFailure, type PluginRegistry } from './registry';
import { createMemoryStorageBackend, type PluginStorageBackend } from './storage';
import { definePlugin, type Plugin, type PluginContext } from './types';

interface Greeter {
  greet(name: string): string;
}

const GreeterToken = defineService<Greeter>('test.greeter');
const PanelPoint = defineExtensionPoint<string>('test.panel');
const PingEvent = defineEvent<string>('test.ping');

interface Host {
  readonly services: ServiceRegistry;
  readonly extensions: RootExtensionRegistry;
  readonly commands: CommandRegistry;
  readonly events: EventBus;
  readonly storage: PluginStorageBackend;
  readonly onError: ReturnType<typeof vi.fn>;
  readonly registry: PluginRegistry;
}

/** Платформа целиком, как её собирает запуск оболочки, только с подставным хранилищем. */
function createHost(): Host {
  const services = createServiceRegistry();
  const extensions = createExtensionRegistry();
  const commands = createCommandRegistry();
  const events = createEventBus();
  const storage = createMemoryStorageBackend();
  const onError = vi.fn();
  const registry = createPluginRegistry({
    services,
    extensions,
    commands,
    events,
    storage,
    onError,
  });
  return { services, extensions, commands, events, storage, onError, registry };
}

const panelIds = (host: Host): string[] =>
  host.extensions.get(PanelPoint).map((c) => `${c.pluginId}/${c.id}`);

/**
 * Три плагина, где **второй пользуется сервисом третьего**.
 *
 * Вклады получают явные `id` и `order`, и это часть проверки: без явного `id` реестр вкладов
 * генерирует его с номером регистрации, который от порядка активации зависит — тогда тест
 * сравнивал бы номера, а не поведение. `order` расставлен наперекор порядку регистрации
 * (гамма 0, бета 5, альфа 10), чтобы было видно: очередь в слоте задаёт `order`, а не то,
 * кто активировался раньше.
 */
function scenarioPlugins(): { alpha: Plugin; beta: Plugin; gamma: Plugin } {
  const alpha = definePlugin({
    id: 'alpha',
    activate(ctx) {
      ctx.subscriptions.push(
        ctx.extensions.contribute(PanelPoint, 'панель альфы', { id: 'alpha.panel', order: 10 })
      );
    },
  });

  const beta = definePlugin({
    id: 'beta',
    activate(ctx) {
      ctx.subscriptions.push(
        ctx.extensions.contribute(PanelPoint, 'панель беты', { id: 'beta.panel', order: 5 }),
        ctx.commands.register({
          id: 'beta.greet',
          titleKey: 'test.command.greet',
          run: (args) => {
            // Здесь и только здесь: сервис ищется в момент использования. Если бы бета
            // достала гаммин сервис в activate, обратный порядок сломал бы её насмерть.
            const greeter = ctx.services.get(GreeterToken);
            return greeter === undefined ? 'сервиса нет' : greeter.greet(String(args));
          },
        })
      );
    },
  });

  const gamma = definePlugin({
    id: 'gamma',
    activate(ctx) {
      ctx.subscriptions.push(
        ctx.services.register(GreeterToken, { greet: (name) => `привет, ${name}` }),
        ctx.extensions.contribute(PanelPoint, 'панель гаммы', { id: 'gamma.panel', order: 0 })
      );
    },
  });

  return { alpha, beta, gamma };
}

/**
 * Снимок наблюдаемого поведения после активации набора в заданном порядке.
 *
 * Сравнивается именно снимок, а не отдельные утверждения: правило приёмки говорит «то же
 * поведение», и проверять его надо целиком — вклады с их происхождением и очередью, результат
 * команды, которая ходит в чужой сервис, и состояния плагинов.
 */
async function behaviourOf(order: readonly Plugin[]): Promise<{
  panels: string[];
  greeting: unknown;
  states: string[];
  activated: string[];
}> {
  const host = createHost();
  host.registry.registerAll(order);
  const report = host.registry.activateAll();

  return {
    panels: panelIds(host),
    greeting: await host.commands.execute('beta.greet', 'мир'),
    states: host.registry
      .statuses()
      .map((s) => `${s.id}:${s.state}`)
      .sort(),
    activated: [...report.activated].sort(),
  };
}

describe('порядок активации ничего не значит', () => {
  it('активация в обратном порядке даёт то же поведение', async () => {
    const { alpha, beta, gamma } = scenarioPlugins();

    const forward = await behaviourOf([alpha, beta, gamma]);
    const reverse = await behaviourOf([gamma, beta, alpha]);

    expect(reverse).toEqual(forward);

    // Что именно совпало, названо явно: иначе тест прошёл бы и на двух одинаково сломанных
    // прогонах — например, если бы команда в обоих случаях не нашла сервис.
    expect(forward.greeting).toBe('привет, мир');
    expect(forward.panels).toEqual(['gamma/gamma.panel', 'beta/beta.panel', 'alpha/alpha.panel']);
    expect(forward.states).toEqual(['alpha:active', 'beta:active', 'gamma:active']);
  });

  it('сервис находится в момент использования, а не активации', async () => {
    const { beta, gamma } = scenarioPlugins();
    const host = createHost();
    host.registry.registerAll([beta, gamma]);

    // Бета поднята первой и работает, хотя её сервиса ещё нет: деградация штатная.
    expect(host.registry.activate('beta')).toBe(true);
    await expect(host.commands.execute('beta.greet', 'мир')).resolves.toBe('сервиса нет');

    host.registry.activate('gamma');

    // Та же команда, тот же экземпляр — но сервис уже есть, и она его находит.
    await expect(host.commands.execute('beta.greet', 'мир')).resolves.toBe('привет, мир');
  });
});

describe('падение одного плагина не мешает остальным', () => {
  const failing = (id: string, calls: { count: number }): Plugin =>
    definePlugin({
      id,
      activate(ctx) {
        calls.count += 1;
        // Половина работы уже сделана — она обязана быть откачена вместе с отказом.
        ctx.subscriptions.push(
          ctx.extensions.contribute(PanelPoint, 'половина панели', { id: `${id}.panel` })
        );
        throw new Error('провайдер недоступен');
      },
    });

  it('соседи активируются, упавший помечен отказавшим с идентификатором и текстом', () => {
    const { alpha, gamma } = scenarioPlugins();
    const calls = { count: 0 };
    const host = createHost();
    host.registry.registerAll([alpha, failing('bad', calls), gamma]);

    const report = host.registry.activateAll();

    expect(report.activated).toEqual(['alpha', 'gamma']);
    expect(host.registry.isActive('alpha')).toBe(true);
    expect(host.registry.isActive('gamma')).toBe(true);
    expect(host.registry.status('bad')?.state).toBe('failed');

    const failures = host.registry.failures();
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({
      pluginId: 'bad',
      phase: 'activate',
      message: 'провайдер недоступен',
    });
    expect(failures[0].error).toBeInstanceOf(Error);
    expect(report.failed).toEqual(failures);
  });

  it('вклады половинчатой активации сняты', () => {
    const { alpha } = scenarioPlugins();
    const host = createHost();
    host.registry.registerAll([alpha, failing('bad', { count: 0 })]);

    host.registry.activateAll();

    expect(panelIds(host)).toEqual(['alpha/alpha.panel']);
  });

  it('отказ уходит в канал диагностики, а не наружу из activateAll', () => {
    const host = createHost();
    host.registry.register(failing('bad', { count: 0 }));

    expect(() => host.registry.activateAll()).not.toThrow();
    expect(host.onError).toHaveBeenCalledTimes(1);
    expect((host.onError.mock.calls[0][0] as PluginFailure).pluginId).toBe('bad');
  });

  it('автоповтора нет: повторный activateAll отказавшего не трогает', () => {
    const calls = { count: 0 };
    const host = createHost();
    host.registry.register(failing('bad', calls));

    host.registry.activateAll();
    const second = host.registry.activateAll();

    expect(calls.count).toBe(1);
    expect(second.skipped).toEqual(['bad']);
    expect(second.failed).toEqual([]);
  });

  it('явная активация отказавшего — попытка по просьбе человека, и она делается', () => {
    const calls = { count: 0 };
    const host = createHost();
    host.registry.register(failing('bad', calls));
    host.registry.activateAll();

    expect(host.registry.activate('bad')).toBe(false);
    expect(calls.count).toBe(2);
  });
});

describe('деактивация снимает вклады и подписки', () => {
  /** Плагин, который кладёт в `subscriptions` вклад, команду и подписку — всё сразу. */
  const wired = (deactivated: string[]): Plugin =>
    definePlugin({
      id: 'wired',
      activate(ctx) {
        ctx.subscriptions.push(
          ctx.extensions.contribute(PanelPoint, 'панель', { id: 'wired.panel' }),
          ctx.commands.register({
            id: 'wired.do',
            titleKey: 'test.command.do',
            run: () => 'сделано',
          }),
          ctx.events.on(PingEvent, (payload) => {
            deactivated.push(`ping:${payload}`);
          })
        );
      },
      deactivate() {
        deactivated.push('deactivate');
      },
    });

  it('после деактивации не остаётся ни вклада, ни команды, ни подписки', async () => {
    const log: string[] = [];
    const host = createHost();
    host.registry.register(wired(log));
    host.registry.activateAll();

    expect(panelIds(host)).toEqual(['wired/wired.panel']);
    await expect(host.commands.execute('wired.do')).resolves.toBe('сделано');
    host.events.emit(PingEvent, 'раз');
    expect(log).toEqual(['ping:раз']);

    host.registry.deactivate('wired');

    expect(panelIds(host)).toEqual([]);
    expect(host.commands.get('wired.do')).toBeUndefined();
    host.events.emit(PingEvent, 'два');
    expect(log).toEqual(['ping:раз', 'deactivate']);
    expect(host.registry.status('wired')?.state).toBe('inactive');
  });

  it('деактивация неактивного — ничего не делает, а незарегистрированного — отказ', () => {
    const log: string[] = [];
    const host = createHost();
    host.registry.register(wired(log));

    host.registry.deactivate('wired');
    expect(log).toEqual([]);

    expect(() => host.registry.deactivate('нет-такого')).toThrow(/не зарегистрирован/);
  });

  it('упавший deactivate не оставляет вклады в реестрах', () => {
    const host = createHost();
    host.registry.register(
      definePlugin({
        id: 'грязный',
        activate(ctx) {
          ctx.subscriptions.push(
            ctx.extensions.contribute(PanelPoint, 'панель', { id: 'грязный.panel' })
          );
        },
        deactivate() {
          throw new Error('таймер не остановился');
        },
      })
    );
    host.registry.activateAll();

    host.registry.deactivate('грязный');

    // Иначе одна ошибка в deactivate прибивала бы панель в интерфейсе навсегда.
    expect(panelIds(host)).toEqual([]);
    expect(host.registry.status('грязный')?.state).toBe('inactive');
    expect(host.onError).toHaveBeenCalledTimes(1);
    expect((host.onError.mock.calls[0][0] as PluginFailure).phase).toBe('deactivate');
  });

  it('deactivateAll выключает всех в порядке, обратном активации', () => {
    const log: string[] = [];
    const host = createHost();
    const noisy = (id: string): Plugin =>
      definePlugin({
        id,
        activate() {},
        deactivate() {
          log.push(id);
        },
      });
    host.registry.registerAll([noisy('первый'), noisy('второй'), noisy('третий')]);
    host.registry.activateAll();

    host.registry.deactivateAll();

    expect(log).toEqual(['третий', 'второй', 'первый']);
    expect(host.registry.statuses().every((s) => s.state === 'inactive')).toBe(true);
  });
});

describe('перезагрузка', () => {
  it('поднимает новый экземпляр под тем же идентификатором и снимает вклады прежнего', () => {
    const host = createHost();
    const version = (n: number): Plugin =>
      definePlugin({
        id: 'из-каталога',
        activate(ctx) {
          ctx.subscriptions.push(
            ctx.extensions.contribute(PanelPoint, `версия ${n}`, { id: 'каталог.panel' })
          );
        },
      });

    host.registry.register(version(1));
    host.registry.activateAll();
    expect(host.extensions.get(PanelPoint).map((c) => c.value)).toEqual(['версия 1']);

    // Ровно то, что делает команда «перезагрузить плагин»: файл перечитан, объект новый.
    expect(host.registry.reload('из-каталога', version(2))).toBe(true);

    expect(host.extensions.get(PanelPoint).map((c) => c.value)).toEqual(['версия 2']);
    expect(host.registry.isActive('из-каталога')).toBe(true);
  });

  it('не даёт подменить плагин объектом с другим идентификатором', () => {
    const host = createHost();
    host.registry.register(definePlugin({ id: 'свой', activate() {} }));
    host.registry.activateAll();

    expect(() =>
      host.registry.reload('свой', definePlugin({ id: 'чужой', activate() {} }))
    ).toThrow(/Идентификатор/);
  });

  it('секреты сессии переживают перезагрузку плагина, контекст — нет', async () => {
    const host = createHost();
    const contexts: PluginContext[] = [];
    host.registry.register(
      definePlugin({
        id: 'секретоносец',
        activate(ctx) {
          contexts.push(ctx);
        },
      })
    );
    host.registry.activateAll();
    await contexts[0].secrets.set('token', 'абв');

    host.registry.reload('секретоносец');

    expect(contexts).toHaveLength(2);
    expect(contexts[1]).not.toBe(contexts[0]);
    expect(contexts[1].subscriptions).toEqual([]);
    // Память сессии принадлежит рантайму, а не активации: иначе перезагрузка плагина
    // означала бы повторный ввод ключа провайдера.
    await expect(contexts[1].secrets.get('token')).resolves.toBe('абв');
  });
});

describe('регистрация набора', () => {
  it('повторная регистрация того же идентификатора — отказ, а не замена', () => {
    const host = createHost();
    host.registry.register(definePlugin({ id: 'один', activate() {} }));

    expect(() => host.registry.register(definePlugin({ id: 'один', activate() {} }))).toThrow(
      /уже зарегистрирован/
    );
  });

  it('активация незарегистрированного — отказ вызывающему', () => {
    const host = createHost();

    expect(() => host.registry.activate('нет-такого')).toThrow(/не зарегистрирован/);
  });

  it('повторная активация активного ничего не делает', () => {
    const calls = { count: 0 };
    const host = createHost();
    host.registry.register(
      definePlugin({
        id: 'один',
        activate() {
          calls.count += 1;
        },
      })
    );

    host.registry.activateAll();
    expect(host.registry.activate('один')).toBe(true);
    const second = host.registry.activateAll();

    expect(calls.count).toBe(1);
    expect(second.skipped).toEqual(['один']);
  });
});
