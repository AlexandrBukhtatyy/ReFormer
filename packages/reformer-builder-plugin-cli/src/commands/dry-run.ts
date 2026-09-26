/**
 * «Сухая» активация собранного плагина: исполнить `main.js` под Node и посмотреть, что он
 * зарегистрирует, — ради двух отказов, которые оболочка иначе покажет только при включении.
 *
 * - **`not-a-plugin` и `id-mismatch`** — экспорты точки входа узнаются правилом загрузчика
 *   (`pluginFromExports` из контракта), `id` сверяется с манифестом.
 * - **`provides-unregistered`** — оболочка после `activate` смотрит, занят ли в реестре служб
 *   слот каждой объявленной возможности. Здесь то же: реестр служб контекста записывает,
 *   под какими идентификаторами плагин что-то зарегистрировал.
 * - **киты** — вклад в точку `reformer.kit.source` реестр китов проверяет при включении плагина
 *   и отвергает уведомлением. Здесь те же правила и та же проверка каталога
 *   (`loadCatalogValidator` контракта): кит обязан назвать себя (`kit-no-id`), каталог — пройти
 *   контракт (`kit-invalid-catalog`) и назвать себя так же, как шапка (`kit-mismatch`).
 *   Пространство имён кита не грузится: это сами компоненты, и вне оболочки им нужен DOM.
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

import type { KitSource } from '@reformer/builder-plugin-api';
import {
  loadCatalogValidator,
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

/** Сколько ошибок контракта каталога показывать: автору нужен повод, а не простыня. */
const CATALOG_ERRORS_SHOWN = 3;

/**
 * Проверяет киты, внесённые плагином, по правилам реестра китов.
 *
 * Каталог-загрузчик зовётся: реестр зовёт его так же при первом выборе кита, и каталог, который
 * не загружается вне оболочки (читает DOM), — заметка «не проверено», а не отказ.
 */
async function checkKits(
  sources: readonly KitSource[],
  declaredKitId: (source: KitSource) => string | undefined
): Promise<{ findings: Finding[]; notices: string[] }> {
  const findings: Finding[] = [];
  const notices: string[] = [];
  if (sources.length === 0) return { findings, notices };
  const validate = await loadCatalogValidator();

  for (const source of sources) {
    const id = declaredKitId(source);
    if (id === undefined) {
      findings.push({
        code: 'kit-no-id',
        message:
          'кит не назвал себя: нет ни шапки «kit», ни блока «kit» у каталога-значения — ' +
          'реестр китов такой кит не примет',
        file: 'main.js',
      });
    }
    const name = id ?? 'без имени';

    let catalog: unknown;
    try {
      catalog = typeof source.catalog === 'function' ? await source.catalog() : source.catalog;
    } catch (error) {
      notices.push(
        `каталог кита «${name}» не загрузился вне оболочки (${describe(error)}) — не проверен`
      );
      continue;
    }

    const check = validate(catalog);
    if (!check.valid) {
      const shown = check.errors.slice(0, CATALOG_ERRORS_SHOWN).join('; ');
      const more = check.errors.length > CATALOG_ERRORS_SHOWN ? '; …' : '';
      findings.push({
        code: 'kit-invalid-catalog',
        message: `каталог кита «${name}» не проходит контракт каталога: ${shown}${more}`,
        file: 'main.js',
      });
      continue;
    }

    const own = (catalog as { kit?: { id?: string } }).kit?.id;
    const header = source.kit?.id;
    if (header !== undefined && own !== undefined && own !== header) {
      findings.push({
        code: 'kit-mismatch',
        message: `шапка кита называет его «${header}», а каталог — «${own}»: ключ выбора менялся бы под ногами`,
        file: 'main.js',
      });
    }
  }
  return { findings, notices };
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
  const kitPointId = (pluginApi.KitSourcePoint as { id: string }).id;
  const declaredKitId = pluginApi.declaredKitId as (source: KitSource) => string | undefined;

  const registered = new Set<string>();
  const kits: KitSource[] = [];
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
  // Точки расширения — настоящие только в одном: вклад в точку китов запоминается. Остальное
  // (наблюдение, чтение чужих вкладов) — заглушка, как весь контекст.
  const extensions = new Proxy(
    {
      contribute: (point: { id?: unknown } | undefined, value: unknown) => {
        if (point?.id === kitPointId) kits.push(value as KitSource);
        return disposable;
      },
    },
    {
      get: (target, key) =>
        key in target ? target[key as keyof typeof target] : stub[key as never],
    }
  );
  const ctx = new Proxy(
    { id: manifest.id, services, extensions, subscriptions: [] as unknown[] },
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
      notices: [
        `activate упал вне оболочки (${describe(error)}) — «provides» и каталоги китов не проверены`,
      ],
    };
  }

  const findings: Finding[] = [];
  const missing = provides.filter((item) => !registered.has(item.id));
  if (missing.length > 0) {
    const names = missing.map((item) => `«${item.id}» версии ${item.version}`).join(', ');
    findings.push({
      code: 'provides-unregistered',
      message:
        `манифест обещает ${names}, но activate это не зарегистрировал. ` +
        'Оболочка выключит такой плагин при включении',
      file: 'manifest.json',
    });
  }

  const checked = await checkKits(kits, declaredKitId);
  return { findings: [...findings, ...checked.findings], notices: checked.notices };
}
