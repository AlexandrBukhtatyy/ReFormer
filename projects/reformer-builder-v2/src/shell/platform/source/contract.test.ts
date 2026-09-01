/**
 * ОБЩИЙ набор тестов контракта источника — правило приёмки Э3.
 *
 * Один и тот же набор проходит на File System Access и на тестовом двойнике. Это не удобство,
 * а способ поймать дырявый контракт до того, как появится первый настоящий сервер: реализация,
 * которую никто не проверял вторым способом, всегда «соответствует» контракту, потому что
 * контракт из неё и вычитали.
 *
 * **Ветвления по виду источника здесь нет и быть не может.** Там, где реализации расходятся
 * возможностями, тест спрашивает {@link Source.capabilities}, а не «кто это». Разница
 * «умеет писать / не умеет» — это тоже общее поведение: «источник без записи отвечает
 * `unsupported`» проверяется на всех четырёх случаях одинаково.
 *
 * **Почему случаев четыре, а не два.** Каждая реализация участвует дважды — с включённой
 * и выключенной записью. Иначе ветка «возможности нет» проверялась бы только на двойнике,
 * то есть ровно там, где ей проще всего быть правильной по построению.
 *
 * Отсутствие необязательного метода и отказ `unsupported` — ОДИН И ТОТ ЖЕ ответ для
 * вызывающего (так решено в контракте: проверять возможности перед вызовом нельзя). Приводит
 * одно к другому {@link callOptional} — единственное место, где это знание записано.
 *
 * @module host/source/contract.test
 */

import { describe, expect, it } from 'vitest';

import { isSourceError as consumerRecognizes } from '@/shell/platform/workspace/source';
import type { WorkspaceSource } from '@/shell/platform/workspace/source';
import { SourceError, conflictRevision, isSourceError } from './errors';
import type { SourceErrorKind, SourceErrorLike } from './errors';
import { createFakeDirectory } from './testing';
import { createFsAccessSource, createFsSourceFactory } from './fs-access';
import { createMemorySource, createMemorySourceFactory } from './memory';
import { isSourceDescriptor } from './registry';
import { isSourceUnavailable } from './types';
import type { Source, SourceDescriptor, SourceFactory } from './types';

/*
 * ────────────────────────────────  Стенд  ────────────────────────────────
 */

/** Настройки, которые обязана поддержать любая реализация, иначе часть контракта непроверяема. */
interface WorldOptions {
  /** Потолок листинга — без него отказ `budget` нечем спровоцировать. */
  readonly listLimit?: number;
}

/** Источник плюс наблюдение за нижним слоем: то, чем проверяются запреты N+1. */
interface SourceWorld {
  readonly source: Source;
  readonly factory: SourceFactory;
  /** Сколько раз нижний слой отдал ТЕЛО файла. */
  bodyReads(): number;
  /** Сколько раз перечислялся каталог. */
  listings(): number;
  /** Обнулить счётчики. */
  forget(): void;
  /** Сорвать следующее обращение к нижнему слою неопознанным сбоем транспорта. */
  breakNext(): void;
}

interface SourceCase {
  readonly name: string;
  open(files: Readonly<Record<string, string>>, options?: WorldOptions): Promise<SourceWorld>;
}

/** Метки двойников не должны протекать между тестами: реестр живых источников общий. */
let labelSeq = 0;

function fsWorld(readOnly: boolean): SourceCase['open'] {
  return async (files, options = {}) => {
    const { root, controls } = createFakeDirectory(files);
    const handleKey = 'project';
    const source = createFsAccessSource(root, {
      id: handleKey,
      handleKey,
      readOnly,
      listLimit: options.listLimit,
    });
    const factory = createFsSourceFactory(
      {
        async open(key) {
          return key === handleKey ? root : null;
        },
      },
      { readOnly, listLimit: options.listLimit, ensureAccess: async () => true }
    );
    return {
      source,
      factory,
      bodyReads: () => controls.bodyReads,
      listings: () => controls.listings,
      forget: () => {
        controls.forget();
      },
      breakNext: () => {
        controls.breakNext();
      },
    };
  };
}

function memoryWorld(writable: boolean): SourceCase['open'] {
  return async (files, options = {}) => {
    labelSeq += 1;
    const label = `memory-${labelSeq}`;
    const source = createMemorySource(files, {
      label,
      writable,
      listLimit: options.listLimit,
      // Задержка ненулевая по контракту двойника; здесь минимальная, чтобы набор не тормозил.
      delayMs: 1,
    });
    return {
      source,
      factory: createMemorySourceFactory(),
      bodyReads: () => source.bodyReads,
      listings: () => source.calls.filter((call) => call.op === 'list').length,
      forget: () => {
        source.forget();
      },
      breakNext: () => {
        source.failNext('network');
      },
    };
  };
}

const CASES: readonly SourceCase[] = [
  { name: 'File System Access', open: fsWorld(false) },
  { name: 'File System Access (только чтение)', open: fsWorld(true) },
  { name: 'двойник в памяти (запись включена)', open: memoryWorld(true) },
  { name: 'двойник в памяти', open: memoryWorld(false) },
];

/*
 * ────────────────────────────────  Помощники  ────────────────────────────────
 */

const FILES: Readonly<Record<string, string>> = {
  'package.json': '{"name":"demo"}',
  'notes.md': '# Заметки о форме',
  'src/forms/credit/schema.json': '{"root":{"component":"Form"}}',
  'src/forms/credit/validation.ts': 'export const rules = [];',
};

type Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: unknown };

async function attempt<T>(run: () => Promise<T>): Promise<Outcome<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * Вызов НЕОБЯЗАТЕЛЬНОЙ операции источника.
 *
 * Отсутствующий метод превращается в отказ `unsupported`, потому что для вызывающего это
 * один и тот же ответ — так решено в контракте, и знание об этом живёт здесь, а не
 * размазано по тестам.
 */
async function callOptional<T>(
  method: unknown,
  run: () => Promise<T>,
  operation: string
): Promise<Outcome<T>> {
  if (typeof method !== 'function') {
    return { ok: false, error: new SourceError('unsupported', `источник не умеет ${operation}`) };
  }
  return attempt(run);
}

const write = (source: Source, path: string, text: string, expected?: string) =>
  callOptional(
    source.write,
    async () => {
      const method = source.write;
      if (method === undefined) throw new SourceError('unsupported', 'запись');
      return method.call(source, path, text, expected);
    },
    'запись'
  );

const remove = (source: Source, path: string) =>
  callOptional(
    source.remove,
    async () => {
      const method = source.remove;
      if (method === undefined) throw new SourceError('unsupported', 'удаление');
      return method.call(source, path);
    },
    'удаление'
  );

const move = (source: Source, from: string, to: string) =>
  callOptional(
    source.move,
    async () => {
      const method = source.move;
      if (method === undefined) throw new SourceError('unsupported', 'перемещение');
      return method.call(source, from, to);
    },
    'перемещение'
  );

const mkdir = (source: Source, path: string) =>
  callOptional(
    source.mkdir,
    async () => {
      const method = source.mkdir;
      if (method === undefined) throw new SourceError('unsupported', 'создание каталога');
      return method.call(source, path);
    },
    'создание каталога'
  );

/** Ожидает отказ нужного вида и отдаёт его для дальнейших проверок. */
function expectRefusal(outcome: Outcome<unknown>, kind: SourceErrorKind): SourceErrorLike {
  if (outcome.ok) {
    throw new Error(`ожидался отказ «${kind}», но вызов удался: ${JSON.stringify(outcome.value)}`);
  }
  expect(isSourceError(outcome.error, kind)).toBe(true);
  return outcome.error as SourceErrorLike;
}

/*
 * ────────────────────────────────  Набор  ────────────────────────────────
 */

describe.each(CASES)('контракт источника: $name', (testCase: SourceCase) => {
  describe('чтение', () => {
    it('отдаёт текст и непрозрачную ревизию', async () => {
      const { source } = await testCase.open(FILES);
      const content = await source.read('package.json');

      expect(content.text).toBe('{"name":"demo"}');
      expect(typeof content.revision).toBe('string');
    });

    it('ревизия чтения совпадает с ревизией stat', async () => {
      const { source } = await testCase.open(FILES);
      const content = await source.read('package.json');
      const stat = await source.stat('package.json');

      expect(stat?.revision).toBe(content.revision);
    });

    it('отсутствующего ресурса — отказ «нет такого», а не пустой ответ', async () => {
      const { source } = await testCase.open(FILES);
      const refusal = expectRefusal(await attempt(() => source.read('missing.json')), 'not-found');

      expect(refusal.path).toBe('missing.json');
    });

    it('каталог текстом не читается: там нечего отдавать', async () => {
      const { source } = await testCase.open(FILES);

      expectRefusal(await attempt(() => source.read('src/forms')), 'not-found');
    });

    it('медиатип разрешён источником по расширению', async () => {
      const { source } = await testCase.open(FILES);

      expect((await source.read('package.json')).mediaType).toBe('application/json');
      expect((await source.read('src/forms/credit/validation.ts')).mediaType).toBe(
        'text/typescript'
      );
      expect((await source.read('notes.md')).mediaType).toBe('text/markdown');
    });

    it('байты и текст описывают одно и то же содержимое', async () => {
      const { source } = await testCase.open(FILES);
      const method = source.readBytes;
      if (method === undefined) throw new Error('источник обязан уметь отдавать байты');

      const bytes = await method.call(source, 'notes.md');
      const content = await source.read('notes.md');

      expect(new TextDecoder().decode(bytes.bytes)).toBe(content.text);
      expect(bytes.revision).toBe(content.revision);
    });

    it('чтение тела учитывается — иначе запрет N+1 проверялся бы вхолостую', async () => {
      const world = await testCase.open(FILES);
      world.forget();
      await world.source.read('package.json');

      expect(world.bodyReads()).toBe(1);
    });
  });

  describe('листинг', () => {
    it('отдаёт один уровень: имена, полные пути и виды', async () => {
      const { source } = await testCase.open(FILES);
      const entries = await source.list('src/forms/credit');

      expect(entries.map((entry) => entry.name)).toEqual(['schema.json', 'validation.ts']);
      expect(entries.map((entry) => entry.path)).toEqual([
        'src/forms/credit/schema.json',
        'src/forms/credit/validation.ts',
      ]);
      expect(entries.every((entry) => entry.kind === 'file')).toBe(true);
    });

    it('различает файлы и каталоги на одном уровне', async () => {
      const { source } = await testCase.open(FILES);
      const entries = await source.list('');

      expect(entries.map((entry) => `${entry.kind}:${entry.name}`)).toEqual([
        'directory:src',
        'file:notes.md',
        'file:package.json',
      ]);
    });

    it('«каталога нет» и «каталог пуст» — разные ответы', async () => {
      const empty = await testCase.open({});

      // Пустой источник: корень есть, в нём ничего.
      expect(await empty.source.list('')).toEqual([]);
      // Каталога нет вовсе: отказ, иначе Workspace примет отсутствие проекта за пустой проект.
      expectRefusal(await attempt(() => empty.source.list('nowhere')), 'not-found');
    });

    it('не читает содержимого файлов НИКОГДА', async () => {
      const world = await testCase.open(FILES);
      world.forget();

      await world.source.list('');
      await world.source.list('src/forms/credit');

      // Ровно та ошибка v1: там обход читал каждый .json-кандидат, чтобы решить, форма ли это.
      expect(world.bodyReads()).toBe(0);
    });

    it('свободное имя подбирается ОДНИМ листингом, а не тысячей проверок', async () => {
      const world = await testCase.open({ 'a.txt': '', 'a-2.txt': '', 'a-3.txt': '' });
      world.forget();

      const taken = new Set((await world.source.list('')).map((entry) => entry.name));
      let candidate = 'a.txt';
      for (let n = 2; taken.has(candidate); n += 1) candidate = `a-${n}.txt`;

      expect(candidate).toBe('a-4.txt');
      // В v1 это же занимало до 2000 обращений к ФС: uniqueName крутил existsIn в цикле.
      expect(world.listings()).toBe(1);
      expect(world.bodyReads()).toBe(0);
    });

    it('листинг сверх бюджета отказывает, а не усекается молча', async () => {
      const { source } = await testCase.open(
        { 'a.txt': 'a', 'b.txt': 'b', 'c.txt': 'c' },
        {
          listLimit: 2,
        }
      );

      expectRefusal(await attempt(() => source.list('')), 'budget');
    });
  });

  describe('свойства ресурса', () => {
    it('файл: вид, размер в байтах, медиатип и ревизия', async () => {
      const { source } = await testCase.open(FILES);
      const stat = await source.stat('notes.md');

      expect(stat?.kind).toBe('file');
      // Байты, а не символы: у кириллицы это разные числа, и путать их нельзя.
      expect(stat?.size).toBe(new TextEncoder().encode(FILES['notes.md']).length);
      expect(stat?.mediaType).toBe('text/markdown');
      expect(typeof stat?.revision).toBe('string');
    });

    it('каталог отвечает видом «каталог» — на этом стоит резолвер импортов', async () => {
      const { source } = await testCase.open(FILES);

      expect((await source.stat('src/forms'))?.kind).toBe('directory');
      expect((await source.stat(''))?.kind).toBe('directory');
    });

    it('отсутствующего — null, а не отказ: это ответ, а не авария', async () => {
      const { source } = await testCase.open(FILES);

      expect(await source.stat('missing.json')).toBeNull();
      expect(await source.stat('nowhere/at/all.txt')).toBeNull();
    });

    it('не читает содержимого', async () => {
      const world = await testCase.open(FILES);
      world.forget();

      await world.source.stat('package.json');
      await world.source.stat('src/forms');
      await world.source.stat('missing.json');

      expect(world.bodyReads()).toBe(0);
    });
  });

  describe('пути', () => {
    it('нормализуются источником, а не вызывающим', async () => {
      const { source } = await testCase.open(FILES);

      expect((await source.read('./src/../package.json')).text).toBe(FILES['package.json']);
      expect(await source.list('/')).toEqual(await source.list(''));
      expect((await source.stat('src/forms/credit/'))?.kind).toBe('directory');
    });

    it('побег за корень — отказ, а не тихое схлопывание к корню', async () => {
      const { source } = await testCase.open(FILES);

      expectRefusal(await attempt(() => source.read('../secrets')), 'forbidden');
      expectRefusal(await attempt(() => source.list('..')), 'forbidden');
      expectRefusal(await attempt(() => source.stat('src/../../etc/hosts')), 'forbidden');
    });
  });

  describe('возможности', () => {
    it('не расходятся с объявленными методами', async () => {
      const { source } = await testCase.open(FILES);
      const { write: canWrite, tree } = source.capabilities;

      expect(source.write !== undefined).toBe(canWrite);
      expect(source.remove !== undefined).toBe(canWrite);
      expect(source.move !== undefined).toBe(canWrite);
      // Каталог создаётся только там, где каталоги вообще есть.
      expect(source.mkdir !== undefined).toBe(canWrite && tree);
    });

    it('обещание ревизий подтверждается ответами', async () => {
      const { source } = await testCase.open(FILES);
      if (!source.capabilities.revisions) return;

      expect((await source.read('package.json')).revision).toBeDefined();
      expect((await source.stat('package.json'))?.revision).toBeDefined();
    });

    it('исполнение кода разрешено только локальной файловой системе', async () => {
      const { source } = await testCase.open(FILES);

      // Умолчание по контракту: код, пришедший не с диска пользователя, не исполняем.
      expect(source.capabilities.executesCode).toBe(source.descriptor.kind === 'fs');
    });
  });

  describe('запись', () => {
    it('без ожидаемой ревизии перезаписывает и отдаёт новую', async () => {
      const { source } = await testCase.open(FILES);
      const before = await source.read('package.json');

      const outcome = await write(source, 'package.json', '{"name":"changed"}');
      if (!source.capabilities.write) {
        expectRefusal(outcome, 'unsupported');
        return;
      }
      if (!outcome.ok) throw outcome.error;

      expect(outcome.value.revision).not.toBe(before.revision);
      expect((await source.read('package.json')).text).toBe('{"name":"changed"}');
    });

    it('расхождение ревизий — конфликт, несущий ТЕКУЩУЮ ревизию источника', async () => {
      const { source } = await testCase.open(FILES);
      const stale = (await source.read('package.json')).revision;

      const first = await write(source, 'package.json', 'снаружи');
      if (!source.capabilities.write) {
        expectRefusal(first, 'unsupported');
        return;
      }
      if (!first.ok) throw first.error;

      const refusal = expectRefusal(
        await write(source, 'package.json', 'моя правка', stale),
        'conflict'
      );

      // Без этой ревизии диалогу слияния нечего показать в колонке «версия источника».
      expect(conflictRevision(refusal)).toBe(first.value.revision);
      expect(refusal.revision).toBe((await source.stat('package.json'))?.revision);
      // Конфликт не записал ничего.
      expect((await source.read('package.json')).text).toBe('снаружи');
    });

    it('совпадение ревизий пропускает запись', async () => {
      const { source } = await testCase.open(FILES);
      const current = (await source.read('package.json')).revision;

      const outcome = await write(source, 'package.json', 'следующая версия', current);
      if (!source.capabilities.write) {
        expectRefusal(outcome, 'unsupported');
        return;
      }
      if (!outcome.ok) throw outcome.error;

      expect((await source.read('package.json')).text).toBe('следующая версия');
    });

    it('исчезнувший у источника файл не конфликтует, а восстанавливается', async () => {
      const { source } = await testCase.open(FILES);

      const outcome = await write(source, 'restored.txt', 'снова здесь', 'ревизия-которой-нет');
      if (!source.capabilities.write) {
        expectRefusal(outcome, 'unsupported');
        return;
      }
      if (!outcome.ok) throw outcome.error;

      expect((await source.read('restored.txt')).text).toBe('снова здесь');
    });

    it('записанный файл появляется в листинге своего каталога', async () => {
      const { source } = await testCase.open(FILES);

      const outcome = await write(source, 'src/forms/credit/ui.tsx', 'export const Ui = null;');
      if (!source.capabilities.write) {
        expectRefusal(outcome, 'unsupported');
        return;
      }
      if (!outcome.ok) throw outcome.error;

      const names = (await source.list('src/forms/credit')).map((entry) => entry.name);
      expect(names).toContain('ui.tsx');
    });

    it('запись в несуществующий каталог — отказ «нет такого»', async () => {
      const { source } = await testCase.open(FILES);
      const outcome = await write(source, 'nowhere/deep/file.txt', 'текст');

      if (!source.capabilities.write) {
        expectRefusal(outcome, 'unsupported');
        return;
      }
      // Плоскому источнику каталог создавать не надо: путь — это ключ, а не маршрут.
      if (!source.capabilities.tree) {
        expect(outcome.ok).toBe(true);
        return;
      }
      expectRefusal(outcome, 'not-found');
    });
  });

  describe('изменение размещения', () => {
    it('удаление убирает ресурс, повторное — отказ «нет такого»', async () => {
      const { source } = await testCase.open(FILES);

      const outcome = await remove(source, 'notes.md');
      if (!source.capabilities.write) {
        expectRefusal(outcome, 'unsupported');
        return;
      }
      if (!outcome.ok) throw outcome.error;

      expect(await source.stat('notes.md')).toBeNull();
      expectRefusal(await remove(source, 'notes.md'), 'not-found');
    });

    it('перемещение переносит содержимое, старого пути не остаётся', async () => {
      const { source } = await testCase.open(FILES);

      const outcome = await move(source, 'notes.md', 'src/notes.md');
      if (!source.capabilities.write) {
        expectRefusal(outcome, 'unsupported');
        return;
      }
      if (!outcome.ok) throw outcome.error;

      expect((await source.read('src/notes.md')).text).toBe(FILES['notes.md']);
      expect(await source.stat('notes.md')).toBeNull();
    });

    it('создание каталога есть только там, где каталоги есть', async () => {
      const { source } = await testCase.open(FILES);
      const outcome = await mkdir(source, 'src/generated');

      if (!(source.capabilities.write && source.capabilities.tree)) {
        expectRefusal(outcome, 'unsupported');
        return;
      }
      if (!outcome.ok) throw outcome.error;

      expect((await source.stat('src/generated'))?.kind).toBe('directory');
      expect(await source.list('src/generated')).toEqual([]);
    });
  });

  describe('отказы', () => {
    it('сорванный транспорт приходит типизированным отказом, а не голой ошибкой', async () => {
      const world = await testCase.open(FILES);
      world.breakNext();

      const outcome = await attempt(() => world.source.read('package.json'));
      expectRefusal(outcome, 'network');
    });

    it('распознаются потребителем структурно, а не по классу', async () => {
      const { source } = await testCase.open(FILES);
      const outcome = await attempt(() => source.read('missing.json'));

      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      // Проверка Workspace написана раньше источника и знает только про поле `kind`.
      expect(consumerRecognizes(outcome.error, 'not-found')).toBe(true);
      expect(consumerRecognizes(outcome.error, 'network')).toBe(false);
    });
  });

  describe('переоткрытие', () => {
    it('дескриптор переживает сериализацию', async () => {
      const { source } = await testCase.open(FILES);
      const wire: unknown = JSON.parse(JSON.stringify(source.descriptor));

      expect(isSourceDescriptor(wire)).toBe(true);
      expect(wire).toEqual(source.descriptor);
    });

    it('фабрика поднимает по дескриптору источник с тем же содержимым', async () => {
      const world = await testCase.open(FILES);
      const wire = JSON.parse(JSON.stringify(world.source.descriptor)) as SourceDescriptor;

      const restored = await world.factory.restore(wire);
      if (isSourceUnavailable(restored)) {
        throw new Error(`источник обязан был восстановиться: ${restored.unavailable}`);
      }

      expect(restored.id).toBe(world.source.id);
      expect((await restored.read('package.json')).text).toBe(FILES['package.json']);
      expect(restored.capabilities).toEqual(world.source.capabilities);
    });
  });

  describe('совместимость с потребителем', () => {
    it('подходит Workspace как есть, без переходника', async () => {
      const { source } = await testCase.open(FILES);
      // Проверка компиляцией: разойдись Source с WorkspaceSource — строка не собралась бы.
      const consumed: WorkspaceSource = source;

      expect(consumed.id).toBe(source.id);
      expect((await consumed.read('package.json')).text).toBe(FILES['package.json']);
      expect((await consumed.stat('package.json'))?.kind).toBe('file');
    });
  });
});
