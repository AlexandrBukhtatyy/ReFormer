/**
 * Двойник порта для тестов плагина.
 *
 * Отдельным модулем, а не в файле теста: порт проверяют и доставка, и прогон, и панель, а три
 * копии двойника разошлись бы — и первым же расхождением стало бы «у меня проходит».
 * Тот же приём, что у `plugins/base/preview/testing`.
 *
 * @module plugins/reformer/codegen/testing
 */

import { MODULE_FILES } from '@/plugins/reformer/core/codegen';
import { builtinKit } from '@/plugins/reformer/core/testing';
import type { CatalogEntry } from '@/plugins/reformer/core/catalog';
import type { FormRules } from '@/plugins/reformer/core/form-model';
import type { KitDescriptor } from '@reformer/builder-plugin-api';
import type { Disposable, ResourceId } from '@reformer/builder-plugin-api';
import type { CodegenDocument, CodegenHost } from './host';

export interface FakeHostOptions {
  /** Содержимое «рабочей области»: адрес → текст. */
  readonly files?: Record<string, string>;
  readonly kit?: KitDescriptor | null;
  readonly catalog?: readonly CatalogEntry[];
  readonly write?: boolean;
  readonly rules?: FormRules;
  readonly document?: CodegenDocument | null;
  /** Даёт ли композиция сохранение в источник. */
  readonly withSave?: boolean;
  /** Корень проекта. Без него пользовательских целей нет — так же, как в композиции. */
  readonly root?: string;
}

export interface FakeHost extends CodegenHost {
  /** То, что «лежит на диске» после прогона. */
  readonly written: Map<string, string>;
  /** Адреса, отправленные в источник. */
  readonly saved: ResourceId[];
}

const noop: Disposable = { dispose: () => {} };

/** Порт-двойник: плоская карта адресов, никакого IO. */
export function createFakeHost(options: FakeHostOptions = {}): FakeHost {
  const view = builtinKit();
  const written = new Map<string, string>(Object.entries(options.files ?? {}));
  const saved: ResourceId[] = [];

  const host: FakeHost = {
    written,
    saved,
    useTranslate: () => (key) => key,
    useActiveDocument: () => null,
    documentOf: () => options.document ?? null,
    sourceOf: () => ({ write: options.write ?? true }),
    catalog: () => options.catalog ?? view.catalog,
    kit: () => (options.kit === undefined ? view.kit : options.kit),
    onDidChangeKit: () => noop,
    parentOf: (id) => id.slice(0, id.lastIndexOf('/')) as ResourceId,
    resolve: (dir, ...segments) =>
      [dir, ...segments].filter((s) => s !== '').join('/') as ResourceId,
    exists: async (id) => written.has(id),
    // Листинг выводится из той же плоской карты: «в каталоге» — значит адрес начинается с него
    // и не уходит глубже. Отдельного дерева каталогов у двойника нет — оно было бы вторым
    // ответом на вопрос «что лежит на диске».
    //
    // Каталоги — тоже выводом: адрес глубже одного уровня называет подкаталог своим первым
    // сегментом. Файлы идут первыми, каталоги за ними — порядок листинга не обещан, и тесты
    // на него не опираются.
    list: async (dir) => {
      const inside = [...written.keys()].filter((id) => id.startsWith(`${dir}/`));
      const files = inside
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
      return [...files, ...dirs];
    },
    readText: async (id) => written.get(id) ?? null,
    writeText: async (id, text) => {
      written.set(id, text);
    },
  };

  if (options.root !== undefined) {
    const root = options.root as ResourceId;
    host.projectRoot = () => root;
  }
  if (options.rules !== undefined) {
    const rules = options.rules;
    host.rulesOf = () => rules;
  }
  if (options.withSave === true) {
    host.save = async (ids) => {
      saved.push(...ids);
      return true;
    };
  }
  return host;
}

/** Документ-двойник: минимум, которым пользуется прогон. */
export function createFakeDocument(
  id: string,
  text: string,
  name: string = MODULE_FILES.schema
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
    kind: 'model',
    getText: () => text,
    model: () => undefined,
    onDidChangeContent: () => noop,
  };
}
