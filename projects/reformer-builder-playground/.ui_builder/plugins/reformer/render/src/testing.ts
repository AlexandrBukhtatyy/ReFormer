/**
 * Подставной порт платформы — для тестов плагина.
 *
 * Настоящий порт собирается композицией и требует рабочей области, сервиса китов и загрузчика
 * модулей. Проверять на нём то, чем владеет плагин, значило бы поднимать половину приложения
 * ради ответа на вопрос «в какую точку ушёл вклад».
 *
 * Двойник намеренно БЕДЕН: `modules` по умолчанию нет, namespace кита пуст, источник исполнять
 * код не разрешает. Это худший из штатных случаев, и поведение плагина в нём — самое интересное:
 * именно так выглядит проект, открытый по сети.
 *
 * Файлы у двойника бывают двух видов. `siblings` — плоский каталог формы без листинга: порт,
 * у которого есть только соседи документа. `tree` — дерево проекта с листингом: модуль формы,
 * разложенный по папкам ролей, иначе не прочитать.
 *
 * Рядом — подставной загрузчик модулей ({@link createFakeModules}): CommonJS без транспиляции,
 * с тем же резолвом путей, что у линковщика оболочки.
 *
 * @module plugins/reformer/render/testing
 */

import type { ComponentType } from 'react';
import { toDescriptor } from '@reformer/builder-plugin-api';
import type { CatalogEntry } from '../../core/catalog';
import type {
  KitDescriptor,
  KitFrameProps,
  KitNamespace,
  KitOrigin,
} from '@reformer/builder-plugin-api';
import type {
  Disposable,
  DocumentKind,
  ResourceId,
  ResourceRef,
} from '@reformer/builder-plugin-api';
import type {
  PreviewDocument,
  PreviewHost,
  PreviewModuleGraph,
  PreviewModules,
  PreviewSourceCapabilities,
} from './host';

const NOOP: Disposable = Object.freeze({ dispose: () => undefined });
const BUILTIN: KitOrigin = Object.freeze({ kind: 'builtin' });

export interface FakeHostOptions {
  readonly text?: string;
  readonly model?: unknown;
  readonly kind?: DocumentKind;
  readonly mediaType?: string;
  readonly catalog?: readonly CatalogEntry[];
  readonly descriptor?: KitDescriptor;
  readonly namespace?: KitNamespace | null;
  /** Происхождение кита; по умолчанию — встроенный. */
  readonly origin?: KitOrigin | null;
  /** Рамка кита; по умолчанию её нет — форма рисуется как есть. */
  readonly frame?: ComponentType<KitFrameProps> | null;
  readonly source?: PreviewSourceCapabilities | null;
  readonly modules?: PreviewModules;
  /** Соседние файлы каталога формы: имя → текст. */
  readonly siblings?: Readonly<Record<string, string>>;
  /**
   * Дерево проекта: путь от корня источника → текст (`form/validation/form.ts`). С ним порт
   * умеет листинг, каталог ресурса и адрес от корня — то есть читает модуль с папками ролей.
   * Адрес файла — `fake:<путь>`. Старше {@link siblings}.
   */
  readonly tree?: Readonly<Record<string, string>>;
}

/** Ссылка на ресурс с разумными умолчаниями. */
export function fakeRef(id: ResourceId, overrides: Partial<ResourceRef> = {}): ResourceRef {
  const path = id.includes(':') ? id.slice(id.indexOf(':') + 1) : id;
  return {
    id,
    sourceId: 'fake',
    path,
    name: path.slice(path.lastIndexOf('/') + 1),
    kind: 'file',
    mediaType: 'application/json',
    ...overrides,
  };
}

/** Префикс адреса двойника: источник один. */
const FAKE_SOURCE = 'fake:';

/** Порт файлов над деревом проекта: листинг, каталог ресурса, чтение и адрес от корня. */
function treeFiles(
  tree: Readonly<Record<string, string>>
): Pick<PreviewHost, 'siblings' | 'list' | 'parentOf' | 'readText' | 'resolveFromRoot'> {
  const pathOf = (id: ResourceId): string => id.slice(FAKE_SOURCE.length);
  const parentOf = (id: ResourceId): ResourceId => {
    const path = pathOf(id);
    const at = path.lastIndexOf('/');
    // Каталог ресурса в корне источника — сам корень, как у настоящей службы.
    return `${FAKE_SOURCE}${at <= 0 ? '' : path.slice(0, at)}`;
  };
  const list = (dir: ResourceId): Promise<readonly ResourceRef[]> => {
    const base = pathOf(dir);
    const prefix = base === '' ? '' : `${base}/`;
    const names = new Map<string, ResourceRef['kind']>();
    for (const path of Object.keys(tree)) {
      if (!path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length);
      const cut = rest.indexOf('/');
      names.set(cut === -1 ? rest : rest.slice(0, cut), cut === -1 ? 'file' : 'directory');
    }
    return Promise.resolve(
      [...names].map(([name, kind]) => fakeRef(`${FAKE_SOURCE}${prefix}${name}`, { kind }))
    );
  };
  return {
    parentOf,
    list,
    siblings: (id) => list(parentOf(id)),
    readText: (id) => {
      const found = tree[pathOf(id)];
      return found === undefined
        ? Promise.reject(new Error(`нет файла ${id}`))
        : Promise.resolve(found);
    },
    resolveFromRoot: (_anchor, path) => `${FAKE_SOURCE}${path}`,
  };
}

export function createFakeHost(options: FakeHostOptions = {}): PreviewHost {
  const text = options.text ?? '{}';
  const siblings = options.siblings ?? {};

  const document = (id: ResourceId): PreviewDocument => ({
    id,
    ref: fakeRef(id, { mediaType: options.mediaType ?? 'application/json' }),
    kind: options.kind ?? 'text',
    getText: () => text,
    model: () => options.model,
    onDidChangeContent: () => NOOP,
  });

  return {
    useTranslate: () => (key) => key,
    documentOf: (id) => document(id),
    useActiveDocument: () => null,
    sourceOf: () => options.source ?? { executesCode: false },
    catalog: () => options.catalog ?? [],
    kit: () => options.descriptor ?? toDescriptor({ version: '1.0', components: [] }),
    kitNamespace: () => options.namespace ?? null,
    kitOrigin: () => (options.origin === undefined ? BUILTIN : options.origin),
    kitFrame: () => options.frame ?? null,
    onDidChangeKit: () => NOOP,
    siblings: () =>
      Promise.resolve(Object.keys(siblings).map((name) => fakeRef(`fake:form/${name}`))),
    readText: (id) => {
      const name = id.slice(id.lastIndexOf('/') + 1);
      const found = siblings[name];
      return found === undefined
        ? Promise.reject(new Error(`нет файла ${id}`))
        : Promise.resolve(found);
    },
    ...(options.tree === undefined ? {} : treeFiles(options.tree)),
    modules: options.modules,
  };
}

/** Расширения, которые дописываются к импорту без расширения, — порядок как у линковщика. */
const EXTENSIONS: readonly string[] = ['.ts', '.tsx', '.js', '.json'];

/** Каталог файла набора; у файла в корне — пустая строка. */
function dirOf(path: string): string {
  const at = path.lastIndexOf('/');
  return at < 0 ? '' : path.slice(0, at);
}

/** Путь набора по относительному спецификатору; `undefined` — путь вышел за корень набора. */
function joinFrom(from: string, specifier: string): string | undefined {
  const out = dirOf(from) === '' ? [] : dirOf(from).split('/');
  for (const segment of specifier.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (out.length === 0) return undefined;
      out.pop();
      continue;
    }
    out.push(segment);
  }
  return out.join('/');
}

/**
 * Подставной загрузчик модулей: файлы набора написаны на CommonJS, поэтому движок транспиляции
 * не нужен вовсе, а проверяется ровно то, что делает превью, — что требует точка входа и что из
 * исполненного доезжает до формы.
 *
 * Резолв — как у линковщика оболочки, иначе тест проверял бы не то, что происходит в приложении:
 * подстановки графа (`overrides`) идут первыми и сравниваются с тем, что НАПИСАНО в импорте;
 * относительный путь считается от файла-импортёра, не выходит за корень набора и достраивается
 * расширением либо `index` каталога; имя пакета берётся только из переданного реестра. Каждый
 * файл исполняется один раз за граф.
 *
 * @param packages - Реестр модулей оболочки: имя пакета → его экспорты.
 */
export function createFakeModules(
  packages: Readonly<Record<string, unknown>> = {}
): PreviewModules {
  return {
    load: (files, entry, options) => {
      const done = new Map<string, unknown>();

      const resolve = (from: string, specifier: string): string => {
        const target = joinFrom(from, specifier);
        const candidates =
          target === undefined
            ? []
            : [
                target,
                ...EXTENSIONS.map((extension) => `${target}${extension}`),
                ...EXTENSIONS.map((extension) => `${target}/index${extension}`),
              ];
        const found = candidates.find((candidate) => files.has(candidate));
        if (found === undefined) throw new Error(`${from}: импорт «${specifier}» не найден`);
        return found;
      };

      const loadFile = (file: string): unknown => {
        if (done.has(file)) return done.get(file);
        const source = files.get(file) ?? '';
        if (file.endsWith('.json')) {
          const data: unknown = JSON.parse(source);
          done.set(file, data);
          return data;
        }
        const module: { exports: unknown } = { exports: {} };
        const require = (specifier: string): unknown => {
          if (options?.overrides?.has(specifier) === true) return options.overrides.get(specifier);
          if (specifier.startsWith('.')) return loadFile(resolve(file, specifier));
          if (!(specifier in packages)) throw new Error(`модуль «${specifier}» недоступен`);
          return packages[specifier];
        };
        new Function('exports', 'require', 'module', source)(module.exports, require, module);
        done.set(file, module.exports);
        return module.exports;
      };

      const graph: PreviewModuleGraph = { entry: loadFile(entry), modules: done, errors: [] };
      return Promise.resolve(graph);
    },
  };
}
