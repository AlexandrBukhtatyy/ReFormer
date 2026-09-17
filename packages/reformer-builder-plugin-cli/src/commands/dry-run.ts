/**
 * «Сухая» активация собранного плагина: исполнить `main.js` под Node и посмотреть, что он
 * зарегистрирует, — ради двух отказов, которые оболочка иначе покажет только при включении.
 *
 * - **`not-a-plugin` и `id-mismatch`** — экспорты точки входа узнаются правилом загрузчика
 *   (`pluginFromExports` из контракта), `id` сверяется с манифестом.
 * - **`provides-unregistered`** — оболочка после `activate` смотрит, занят ли в реестре служб
 *   слот каждой объявленной возможности. Здесь то же: реестр служб контекста записывает,
 *   под какими идентификаторами плагин что-то зарегистрировал.
 *
 * ## Что настоящее, а что нет
 *
 * Настоящий — пакет контракта (`@reformer/builder-plugin-api`, он же `@builder/sdk`): токены
 * служб в нём — объекты с `id`, и регистрация под подменным токеном дала бы ложный отказ.
 * Остальные модули рантайма (React, ядро форм, кит) и всё в контексте, кроме реестра служб, —
 * заглушки, принимающие любое обращение. Подними мы их по-настоящему, проверка требовала бы DOM
 * и всего билдера.
 *
 * Отсюда граница честности. Если код падает НА ЗАГЛУШКЕ — при исполнении модуля или в `activate`,
 * — это не отказ: вне оболочки такое бывает у рабочих плагинов (например, `activate` читает
 * значение службы, которой здесь нет). Такой исход возвращается ЗАМЕТКОЙ «не проверено»,
 * а не отказом, и сборка проходит. Отказом становится только то, что видно наверняка.
 *
 * @module @reformer/builder-plugin-cli/commands/dry-run
 */

import {
  pluginFromExports,
  PLUGIN_RUNTIME_MODULES,
  type PluginManifestBase,
} from '@reformer/builder-plugin-api/tooling';

import type { Finding } from './findings.js';

export interface DryRunResult {
  readonly findings: readonly Finding[];
  /** Почему проверку не удалось довести до конца. Не отказ. */
  readonly notices: readonly string[];
}

const PLUGIN_API_SPECIFIERS = new Set(['@builder/sdk', '@reformer/builder-plugin-api']);

/**
 * Заглушка, принимающая любое обращение: свойство, вызов, `new`.
 *
 * `then` отсутствует намеренно — иначе `await stub` никогда бы не завершился. Приведение
 * к строке и числу даёт пустое значение, чтобы шаблонные строки в коде плагина не падали.
 */
function createStub(): unknown {
  const target = function stub() {};
  const proxy: unknown = new Proxy(target, {
    get(_, key) {
      if (key === 'then') return undefined;
      if (key === Symbol.toPrimitive) return () => '';
      if (key === Symbol.iterator) return function* () {};
      return proxy;
    },
    apply: () => proxy,
    construct: () => proxy as object,
  });
  return proxy;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @param code собранный `main.js` (CommonJS)
 * @param manifest манифест, против которого сверяются `id` и `provides`
 */
export async function dryActivate(
  code: string,
  manifest: Pick<PluginManifestBase, 'id' | 'provides'>
): Promise<DryRunResult> {
  const pluginApi = (await import('@reformer/builder-plugin-api')) as Record<string, unknown>;

  const requireShim = (specifier: string): unknown => {
    if (PLUGIN_API_SPECIFIERS.has(specifier)) return pluginApi;
    if (PLUGIN_RUNTIME_MODULES.includes(specifier)) return createStub();
    // Сюда сборка не пропускает: всё, что не модуль рантайма, вложено в `main.js`.
    throw new Error(`модуль «${specifier}» оболочка не подставляет`);
  };

  const module = { exports: {} as unknown };
  try {
    const evaluate = new Function('module', 'exports', 'require', code) as (
      m: typeof module,
      e: unknown,
      r: typeof requireShim
    ) => void;
    evaluate(module, module.exports, requireShim);
  } catch (error) {
    return {
      findings: [],
      notices: [`модуль не исполнился вне оболочки (${describe(error)}) — экспорты не проверены`],
    };
  }

  const plugin = pluginFromExports(module.exports);
  if (plugin === undefined) {
    return {
      findings: [
        {
          code: 'not-a-plugin',
          message:
            'main.js не экспортировал плагин: ожидается объект с «id» и «activate» ' +
            'в module.exports или в экспорте по умолчанию',
          file: 'main.js',
        },
      ],
      notices: [],
    };
  }
  if (plugin.id !== manifest.id) {
    return {
      findings: [
        {
          code: 'id-mismatch',
          message: `код объявляет плагин «${plugin.id}», а манифест — «${manifest.id}»`,
          file: 'main.js',
        },
      ],
      notices: [],
    };
  }

  const provides: NonNullable<PluginManifestBase['provides']> = manifest.provides ?? [];
  if (provides.length === 0) return { findings: [], notices: [] };

  const registered = new Set<string>();
  const disposable = { dispose: () => undefined };
  const services = {
    register: (token: { id: string }) => {
      registered.add(token.id);
      return disposable;
    },
    get: () => undefined,
    require: () => createStub(),
    onDidChange: () => disposable,
  };
  const stub = createStub() as Record<string, unknown>;
  const ctx = new Proxy(
    { id: manifest.id, services, subscriptions: [] as unknown[] },
    {
      get: (target, key) =>
        key in target ? target[key as keyof typeof target] : stub[key as never],
    }
  );

  try {
    await Promise.resolve(plugin.activate(ctx as never));
  } catch (error) {
    return {
      findings: [],
      notices: [`activate упал вне оболочки (${describe(error)}) — «provides» не проверен`],
    };
  }

  const missing = provides.filter((item) => !registered.has(item.id));
  if (missing.length === 0) return { findings: [], notices: [] };
  const names = missing.map((item) => `«${item.id}» версии ${item.version}`).join(', ');
  return {
    findings: [
      {
        code: 'provides-unregistered',
        message:
          `манифест обещает ${names}, но activate это не зарегистрировал. ` +
          'Оболочка выключит такой плагин при включении',
        file: 'manifest.json',
      },
    ],
    notices: [],
  };
}
