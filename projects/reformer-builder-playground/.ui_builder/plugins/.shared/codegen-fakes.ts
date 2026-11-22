/**
 * Двойник чтения рабочей области для тестов генерации кода и стеков в ней.
 *
 * Хозяин генерации (`forms/codegen`) и стек ReFormer (`reformer/codegen`) лежат в разных доменах и
 * друг друга не импортируют, а рабочая область для их тестов одна и та же: файлы картой
 * «адрес → текст», адрес — сам путь. Поэтому двойник здесь — типы только из SDK, без знания о
 * формате формы.
 *
 * @module plugins/.shared/codegen-fakes
 */

import type {
  CodegenDocument,
  CodegenReader,
  PluginContext,
  ResourceId,
  ResourceRef,
} from '@reformer/builder-plugin-api';

/** Двойник чтения: карта файлов на виду у теста. */
export interface FakeReader extends CodegenReader {
  /** То, что «лежит на диске»: адрес → текст. Тест кладёт и читает напрямую. */
  readonly files: Map<string, string>;
  list(dir: ResourceId): Promise<readonly ResourceRef[]>;
}

/**
 * Двойник чтения рабочей области.
 *
 * Листинг выводится из той же плоской карты: «в каталоге» — значит адрес начинается с него
 * и не уходит глубже. Отдельного дерева каталогов у двойника нет — оно было бы вторым
 * ответом на вопрос «что лежит на диске».
 *
 * Каталоги — тоже выводом: адрес глубже одного уровня называет подкаталог своим первым
 * сегментом. Файлы идут первыми, каталоги за ними — порядок листинга не обещан, и тесты
 * на него не опираются.
 */
export function createFakeReader(
  files: Record<string, string> | Map<string, string> = {},
  documentOf: (id: ResourceId) => CodegenDocument | null = () => null
): FakeReader {
  const map = files instanceof Map ? files : new Map(Object.entries(files));
  return {
    files: map,
    documentOf,
    parentOf: (id) => id.slice(0, id.lastIndexOf('/')) as ResourceId,
    resolve: (dir, ...segments) =>
      [dir, ...segments].filter((s) => s !== '').join('/') as ResourceId,
    exists: async (id) => map.has(id),
    readText: async (id) => map.get(id) ?? null,
    list: async (dir) => {
      const inside = [...map.keys()].filter((id) => id.startsWith(`${dir}/`));
      const own = inside
        .filter((id) => !id.slice(dir.length + 1).includes('/'))
        .map((id) => {
          const name = id.slice(dir.length + 1);
          return {
            id: id as ResourceId,
            sourceId: 'fake',
            path: id,
            name,
            kind: 'file' as const,
            mediaType: name.endsWith('.json') ? 'application/json' : 'text/plain',
          };
        });
      const dirs = [
        ...new Set(
          inside
            .map((id) => id.slice(dir.length + 1))
            .filter((rest) => rest.includes('/'))
            .map((rest) => rest.slice(0, rest.indexOf('/')))
        ),
      ].map((name) => ({
        id: `${dir}/${name}` as ResourceId,
        sourceId: 'fake',
        path: `${dir}/${name}`,
        name,
        kind: 'directory' as const,
        mediaType: 'inode/directory',
      }));
      return [...own, ...dirs];
    },
  };
}

/**
 * Открытый документ двойника. Вид ресурса по умолчанию — `form.schema`, как у модельного
 * документа схемы ReFormer.
 */
export function createFakeDocument(
  id: string,
  text: string,
  name: string = 'form.schema.json',
  resourceKind: string = 'form.schema'
): CodegenDocument {
  return {
    id: id as ResourceId,
    ref: {
      id: id as ResourceId,
      sourceId: 'fake',
      path: id,
      name,
      kind: 'file',
      mediaType: 'application/json',
    },
    resourceKind,
    getText: () => text,
    model: () => undefined,
  };
}

/** Вклад, как его запомнил двойник реестра. */
export interface FakeContribution {
  readonly point: string;
  readonly id?: string;
  readonly order?: number;
  readonly pluginId: string;
  readonly value: unknown;
}

/**
 * Контекст активации в объёме, который трогают плагины генерации: вклады (с чтением по точке),
 * команды, словарь и службы.
 *
 * Служб нет ни одной, кроме занятых самим плагином: композиция вправе не дать ни уведомлений,
 * ни кита, и плагин обязан активироваться без них — молча, а не отказом. Реестр вкладов общий
 * для нескольких плагинов: второй контекст поверх тех же `contributions` видит вклады первого.
 */
export function createFakePluginContext(
  id: string,
  contributions: FakeContribution[] = []
): {
  readonly ctx: PluginContext;
  readonly contributions: FakeContribution[];
  readonly commands: string[];
  readonly locales: string[];
  readonly services: Map<string, unknown>;
} {
  const commands: string[] = [];
  const locales: string[] = [];
  const services = new Map<string, unknown>();
  const registered = new Map<string, { run(args?: unknown): unknown }>();
  const ctx = {
    id,
    subscriptions: [],
    i18n: {
      locale: 'ru',
      t: (key: string) => key,
      contribute: (locale: string) => locales.push(locale),
      onDidChangeLocale: () => ({ dispose: () => undefined }),
    },
    extensions: {
      contribute: (
        point: { id: string },
        value: unknown,
        meta?: { id?: string; order?: number }
      ) => {
        const entry: FakeContribution = {
          point: point.id,
          id: meta?.id,
          order: meta?.order,
          pluginId: id,
          value,
        };
        contributions.push(entry);
        return {
          dispose: () => {
            const at = contributions.indexOf(entry);
            if (at >= 0) contributions.splice(at, 1);
          },
        };
      },
      get: (point: { id: string }) =>
        contributions
          .filter((entry) => entry.point === point.id)
          .map((entry) => ({
            id: entry.id ?? '',
            pluginId: entry.pluginId,
            order: entry.order ?? 0,
            value: entry.value,
          })),
      observe: () => ({ dispose: () => undefined }),
    },
    commands: {
      register: (command: { id: string; run(args?: unknown): unknown }) => {
        commands.push(command.id);
        registered.set(command.id, command);
        return { dispose: () => undefined };
      },
      get: (commandId: string) => registered.get(commandId),
      execute: () => Promise.resolve(true),
    },
    services: {
      get: (token: { id: string }) => services.get(token.id),
      register: (token: { id: string }, service: unknown) => {
        services.set(token.id, service);
        return { dispose: () => {} };
      },
    },
  } as unknown as PluginContext;
  return { ctx, contributions, commands, locales, services };
}
