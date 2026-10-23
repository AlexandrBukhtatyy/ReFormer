/**
 * Двойники для тестов хозяина генерации: порт рабочей области и стек.
 *
 * Отдельным модулем, а не в файле теста: порт проверяют и доставка, и прогон, и панель, а три
 * копии двойника разошлись бы — и первым же расхождением стало бы «у меня проходит».
 * Тот же приём, что у `plugins/forms/preview/testing`.
 *
 * Формы здесь не знают: двойник стека печатает то, что ему велели, и отказывает, когда велели.
 * Прогон через настоящий стек ReFormer — в тестах обеих сторон.
 *
 * @module plugins/forms/codegen/testing
 */

import {
  toDescriptor,
  type CodegenDocument,
  type CodegenFile,
  type CodegenForm,
  type CodegenNote,
  type CodegenOpenResult,
  type CodegenPrintRequest,
  type CodegenReader,
  type CodegenRefusal,
  type CodegenStack,
  type CodegenTarget,
  type Disposable,
  type KitDescriptor,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import { createFakeDocument, createFakeReader } from '../../../.shared/codegen-fakes';
import type { CodegenHost } from './host';
import type { Stacks } from './stacks';

export { createFakeDocument, createFakeReader };

/** Кит двойника — подпись «Кит: …» в панели. */
export const FAKE_KIT: KitDescriptor = toDescriptor({
  version: '2.1',
  kit: { id: 'fake-kit', label: 'Fake kit', package: '@fake/kit' },
  components: [],
});

export interface FakeHostOptions {
  /** Содержимое «рабочей области»: адрес → текст. */
  readonly files?: Record<string, string>;
  /** Активный кит; `null` — службы китов нет. По умолчанию — {@link FAKE_KIT}. */
  readonly kit?: KitDescriptor | null;
  readonly write?: boolean;
  /** Документ, который отдаёт `documentOf` на ЛЮБОЙ адрес. */
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

export function createFakeHost(options: FakeHostOptions = {}): FakeHost {
  const reader = createFakeReader(options.files ?? {}, () => options.document ?? null);
  const written = reader.files;
  const saved: ResourceId[] = [];

  const host: FakeHost = {
    ...reader,
    written,
    saved,
    useTranslate: () => (key) => key,
    useActiveDocument: () => null,
    sourceOf: () => ({ write: options.write ?? true }),
    kit: () => (options.kit === undefined ? FAKE_KIT : options.kit),
    onDidChangeKit: () => noop,
    writeText: async (id, text) => {
      written.set(id, text);
    },
  };

  if (options.root !== undefined) {
    const root = options.root as ResourceId;
    host.projectRoot = () => root;
  }
  if (options.withSave === true) {
    host.save = async (ids) => {
      saved.push(...ids);
      return true;
    };
  }
  return host;
}

/** Файл модуля двойника: `derived`, встроенный, цель по пути. */
export function fakeFile(path: string, content = `// ${path}\n`, over: Partial<CodegenFile> = {}) {
  const file: CodegenFile = {
    path,
    content,
    cls: 'derived',
    regenerable: false,
    targetId: `fake.${path}`,
    origin: 'builtin',
    ...over,
  };
  return file;
}

export interface FakeStackOptions {
  readonly id?: string;
  readonly kinds?: readonly string[];
  /** Корень модуля, куда пишет хозяин. По умолчанию — `src/forms/demo`. */
  readonly root?: string;
  readonly formName?: string;
  /** Что печатает форма. По умолчанию — один производный файл на каждую поданную цель. */
  readonly files?: readonly CodegenFile[];
  /** Ответ `open`: отказ, `null` («не моя форма») либо форма по умолчанию. */
  readonly open?: CodegenRefusal | null | 'form';
  /** Ответ `find`; `undefined` — стек из дерева не генерирует. */
  readonly find?: CodegenRefusal | null | 'form';
  /** Отказ записи (`CodegenModule.check`). */
  readonly check?: CodegenRefusal;
  readonly notes?: readonly CodegenNote[];
  readonly snippet?: string;
  readonly staleOverride?: CodegenStack['staleOverride'];
}

export interface FakeStack extends CodegenStack {
  /** Заказы печати — что и с каким именем просил напечатать хозяин. */
  readonly printed: CodegenPrintRequest[];
  /** Кто читал рабочую область: стек получает её от хозяина. */
  readonly readers: CodegenReader[];
}

/** Двойник стека: перевод — сам ключ с подстановками в скобках, чтобы тест видел обе части. */
export function createFakeStack(options: FakeStackOptions = {}): FakeStack {
  const printed: CodegenPrintRequest[] = [];
  const readers: CodegenReader[] = [];
  const root = (options.root ?? 'src/forms/demo') as ResourceId;

  const form: CodegenForm = {
    root,
    rootPath: root,
    formName: options.formName ?? 'demo',
    async print(request) {
      printed.push(request);
      const files =
        options.files ??
        request.targets.map((target: CodegenTarget) =>
          fakeFile(target.path, `// ${target.id}\n`, { targetId: target.id })
        );
      return {
        files,
        problems: [],
        view: { formName: request.formName },
        snippet: options.snippet ?? '',
        ...(options.check === undefined ? {} : { check: async () => options.check ?? null }),
        ...(options.notes === undefined ? {} : { inspect: async () => options.notes ?? [] }),
      };
    },
  };
  const answer = (value: CodegenRefusal | null | 'form' | undefined): CodegenOpenResult =>
    value === undefined || value === 'form' ? form : value;

  const stack: FakeStack = {
    printed,
    readers,
    id: options.id ?? 'fake',
    kinds: options.kinds ?? ['form.schema'],
    translate: (key, params) => (params === undefined ? key : `${key}(${JSON.stringify(params)})`),
    formNameOf: (path) => path.slice(path.lastIndexOf('/') + 1).split('.')[0],
    async open(_document, reader) {
      readers.push(reader);
      return answer(options.open);
    },
    ...(options.find === undefined
      ? {}
      : {
          async find(_dir: ResourceId, reader: CodegenReader) {
            readers.push(reader);
            return answer(options.find);
          },
        }),
    ...(options.staleOverride === undefined ? {} : { staleOverride: options.staleOverride }),
  };
  return stack;
}

/** Стеки для хозяина: каждый — от своего «плагина» `<id>.plugin`. */
export function stacksOf(...stacks: readonly CodegenStack[]): Stacks {
  return () => stacks.map((stack) => ({ stack, pluginId: `${stack.id}.plugin` }));
}
