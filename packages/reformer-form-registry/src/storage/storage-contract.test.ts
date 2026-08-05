/**
 * Контракт {@link StorageStrategy} — ОДИН набор против всех реализаций.
 *
 * Смысл именно в общем наборе: стратегии обязаны быть взаимозаменяемы, иначе `pickStorage`
 * незаметно меняет поведение приложения в зависимости от браузера. Отдельные наборы на каждую
 * реализацию это свойство не проверяют.
 *
 * OPFS проверяется против фейкового бэкенда: настоящий доступен только в браузере, а логика,
 * которую он покрывает (кодирование имён, JSON-обход, выбор пути записи, вытеснение), от
 * реального ввода-вывода не зависит. Пути, которые фейком не проверить, названы в конце файла.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createMemoryStorage } from './memory';
import { createIndexedDbStorage } from './indexeddb';
import { createOpfsStorage } from './opfs';
import {
  byteLength,
  cacheKey,
  selectEvictions,
  type StorageOptions,
  type StorageStrategy,
} from './types';

// ─────────────────────────────── фейковый OPFS ───────────────────────────────

class FakeDir {
  files = new Map<string, string>();
  dirs = new Map<string, FakeDir>();
  /** Считаем обращения к записи — чтобы проверить выбор пути (sync vs writable). */
  static writableOpens = 0;

  async getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<FakeDir> {
    let d = this.dirs.get(name);
    if (!d) {
      if (!opts?.create) throw Object.assign(new Error('NotFound'), { name: 'NotFoundError' });
      d = new FakeDir();
      this.dirs.set(name, d);
    }
    return d;
  }

  async getFileHandle(name: string, opts?: { create?: boolean }) {
    if (!this.files.has(name)) {
      if (!opts?.create) throw Object.assign(new Error('NotFound'), { name: 'NotFoundError' });
      this.files.set(name, '');
    }
    const files = this.files;
    return {
      getFile: async () => ({
        text: async () => files.get(name) ?? '',
        size: byteLength(files.get(name) ?? ''),
      }),
      createWritable: async () => {
        FakeDir.writableOpens++;
        let buf = '';
        return {
          write: async (data: string) => {
            buf += data;
          },
          // Коммит происходит на close() — как в спецификации (swap-файл).
          close: async () => {
            files.set(name, buf);
          },
        };
      },
    };
  }

  async removeEntry(name: string): Promise<void> {
    if (!this.files.delete(name) && !this.dirs.delete(name)) {
      throw Object.assign(new Error('NotFound'), { name: 'NotFoundError' });
    }
  }

  async *keys(): AsyncIterableIterator<string> {
    for (const k of this.files.keys()) yield k;
  }
}

let root: FakeDir;

function installFakeOpfs(): void {
  root = new FakeDir();
  Object.defineProperty(globalThis, 'navigator', {
    value: { storage: { getDirectory: async () => root } },
    configurable: true,
    writable: true,
  });
}

// ─────────────────────────────── контракт ───────────────────────────────

const rec = (key: string, body: string, at = 1000) => ({
  key,
  body,
  size: byteLength(body),
  storedAt: at,
  lastUsedAt: at,
});

/**
 * Фабрика принимает настройки: иначе тест на вытеснение вынужден ветвиться сравнением функций,
 * и добавление третьей стратегии его тихо ломает.
 */
type Make = (opts?: StorageOptions) => StorageStrategy;

const STRATEGIES: [string, Make][] = [
  ['memory', (o) => createMemoryStorage(o)],
  ['indexeddb (fake-indexeddb)', (o) => createIndexedDbStorage(o)],
  ['opfs (фейковый бэкенд)', (o) => createOpfsStorage(o)],
];

/** Свежая БД на каждый тест: новый IDBFactory — это новое пространство имён целиком. */
function installFakeIndexedDb(): void {
  Object.defineProperty(globalThis, 'indexedDB', {
    value: new IDBFactory(),
    configurable: true,
    writable: true,
  });
}

describe.each(STRATEGIES)('Контракт StorageStrategy: %s', (_name, make) => {
  let storage: StorageStrategy;

  beforeEach(() => {
    installFakeOpfs();
    installFakeIndexedDb();
    storage = make();
  });

  it('круг: записал → прочитал → удалил', async () => {
    await storage.set(rec('a/f@1', 'привет'));
    expect((await storage.get('a/f@1'))?.body).toBe('привет');
    await storage.delete('a/f@1');
    expect(await storage.get('a/f@1')).toBeUndefined();
  });

  it('промах возвращает undefined, а не бросает', async () => {
    await expect(storage.get('нет-такого')).resolves.toBeUndefined();
  });

  it('перезапись тем же ключом заменяет тело', async () => {
    await storage.set(rec('a/f@1', 'первое'));
    await storage.set(rec('a/f@1', 'второе'));
    expect((await storage.get('a/f@1'))?.body).toBe('второе');
    expect(await storage.keys()).toHaveLength(1);
  });

  it('схема в 68 КБ переживает круг без потерь', async () => {
    // Реальный порядок: complex-multy-step-form весит ~68 КБ. Проверяем и не-ASCII —
    // на нём ломается наивный подсчёт размера в символах вместо байтов.
    const big = JSON.stringify({ root: 'ю'.repeat(34 * 1024) });
    await storage.set(rec('a/big@1', big));
    const got = await storage.get('a/big@1');
    expect(got?.body).toBe(big);
    expect(got?.body.length).toBe(big.length);
  });

  it('ключи двух владельцев с одинаковым id формы не пересекаются', async () => {
    // Хранилище общее на origin: без owner в ключе микрофронты затирали бы друг друга.
    await storage.set(rec(cacheKey('mfe-a', 'checkout', '1.0.0'), 'от A'));
    await storage.set(rec(cacheKey('mfe-b', 'checkout', '1.0.0'), 'от B'));
    expect((await storage.get('mfe-a/checkout@1.0.0'))?.body).toBe('от A');
    expect((await storage.get('mfe-b/checkout@1.0.0'))?.body).toBe('от B');
  });

  it('ключ со слэшами и не-ASCII переживает круг (кодирование имён)', async () => {
    const key = cacheKey('группа/отдел', 'форма заявки', '1.0.0');
    await storage.set(rec(key, 'тело'));
    expect((await storage.get(key))?.body).toBe('тело');
    expect(await storage.keys()).toEqual([key]);
  });

  it('keys() перечисляет исходные ключи, а не имена файлов', async () => {
    await storage.set(rec('a/f@1', 'x'));
    await storage.set(rec('b/g@2', 'y'));
    expect((await storage.keys()).sort()).toEqual(['a/f@1', 'b/g@2']);
  });

  it('clear() опустошает хранилище', async () => {
    await storage.set(rec('a/f@1', 'x'));
    await storage.clear();
    expect(await storage.keys()).toEqual([]);
  });

  it('чтение обновляет lastUsedAt — иначе LRU выродится в FIFO', async () => {
    await storage.set(rec('a/f@1', 'x', 1));
    const got = await storage.get('a/f@1');
    expect(got!.lastUsedAt).toBeGreaterThan(1);
  });

  it('etag сохраняется — на нём держится условная ревалидация', async () => {
    await storage.set({ ...rec('a/f@1', 'x'), etag: 'W/"abc"' });
    expect((await storage.get('a/f@1'))?.etag).toBe('W/"abc"');
  });
});

describe('LRU-вытеснение при достижении потолка', () => {
  beforeEach(() => {
    installFakeOpfs();
    installFakeIndexedDb();
  });

  it.each(STRATEGIES)('%s вытесняет самую давно не читанную', async (_n, make) => {
    const storage = make({ maxBytes: 30 });
    await storage.set(rec('a/1@1', '0123456789', 100)); // 10 Б
    await storage.set(rec('a/2@1', '0123456789', 200)); // 20 Б
    await storage.set(rec('a/3@1', '0123456789', 300)); // 30 Б — потолок
    await storage.set(rec('a/4@1', '0123456789', 400)); // 40 Б → вытеснение

    const left = await storage.keys();
    expect(left).not.toContain('a/1@1'); // самая старая ушла
    expect(left).toContain('a/4@1'); // новая на месте
  });
});

describe('IndexedDB — запись видна ДРУГОМУ соединению', () => {
  beforeEach(() => installFakeIndexedDb());

  it('после set() данные читает независимый экземпляр стратегии', async () => {
    // Ради этого `tx()` резолвится по `transaction.oncomplete`, а не по `request.onsuccess`.
    // Резолв по onsuccess означает «запрос принят», а не «закоммичено»: вызывающий уходит
    // дальше с ложным успехом, и следующий читатель может записи не увидеть. Именно так
    // устроен projects/reformer-builder/src/io/handle-store.ts — его и не брали за образец.
    const writer = createIndexedDbStorage();
    await writer.set(rec('a/f@1', 'закоммичено'));

    const reader = createIndexedDbStorage(); // своё соединение
    expect((await reader.get('a/f@1'))?.body).toBe('закоммичено');
  });

  it('соединение переиспользуется между операциями, а не открывается заново', async () => {
    // handle-store открывал соединение на КАЖДУЮ операцию и не закрывал его.
    const openSpy = vi.spyOn(indexedDB, 'open');
    const storage = createIndexedDbStorage();
    await storage.set(rec('a/1@1', 'x'));
    await storage.set(rec('a/2@1', 'y'));
    await storage.get('a/1@1');
    await storage.keys();
    expect(openSpy).toHaveBeenCalledTimes(1);
    openSpy.mockRestore();
  });
});

describe('selectEvictions — политика вытеснения', () => {
  const r = (key: string, size: number, lastUsedAt: number) => ({ key, size, lastUsedAt });

  it('ничего не вытесняет, пока не превышен потолок', () => {
    expect(selectEvictions([r('a', 10, 1)], 10, 32)).toEqual([]);
  });

  it('вытесняет по возрастанию lastUsedAt, пока не уложится в потолок', () => {
    const recs = [r('свежая', 10, 300), r('старая', 10, 100), r('средняя', 10, 200)];
    expect(selectEvictions(recs, 30, 15)).toEqual(['старая', 'средняя']);
  });

  it('останавливается, как только уложился — лишнего не удаляет', () => {
    const recs = [r('a', 10, 1), r('b', 10, 2), r('c', 10, 3)];
    expect(selectEvictions(recs, 30, 25)).toEqual(['a']);
  });

  it('не мутирует переданный массив', () => {
    const recs = [r('b', 10, 2), r('a', 10, 1)];
    const copy = [...recs];
    selectEvictions(recs, 30, 5);
    expect(recs).toEqual(copy);
  });
});

describe('byteLength — размер в байтах, не в символах', () => {
  it('ASCII', () => expect(byteLength('abc')).toBe(3));
  it('кириллица — два байта на символ', () => expect(byteLength('привет')).toBe(12));
  it('эмодзи вне BMP — четыре байта', () => expect(byteLength('🙂')).toBe(4));
  it('совпадает с TextEncoder', () => {
    const s = 'смесь ascii и кириллицы 🙂';
    expect(byteLength(s)).toBe(new TextEncoder().encode(s).length);
  });
});

describe('OPFS — выбор пути записи', () => {
  beforeEach(() => installFakeOpfs());
  afterEach(() => {
    FakeDir.writableOpens = 0;
  });

  it('падает на createWritable, когда синхронный хэндл бросает (главный поток)', async () => {
    // На главном потоке createSyncAccessHandle бросает по спецификации. Метод ЕСТЬ, но не работает —
    // поэтому детект строится на попытке, а не на наличии метода.
    const origGetFileHandle = FakeDir.prototype.getFileHandle;
    FakeDir.prototype.getFileHandle = async function (
      this: FakeDir,
      name: string,
      opts?: { create?: boolean }
    ) {
      const fh = await origGetFileHandle.call(this, name, opts);
      return {
        ...fh,
        createSyncAccessHandle: async () => {
          throw Object.assign(new Error('worker only'), { name: 'InvalidStateError' });
        },
      };
    } as typeof FakeDir.prototype.getFileHandle;

    try {
      const storage = createOpfsStorage();
      await storage.set(rec('a/f@1', 'тело'));
      expect((await storage.get('a/f@1'))?.body).toBe('тело');
      expect(FakeDir.writableOpens).toBeGreaterThan(0);
    } finally {
      FakeDir.prototype.getFileHandle = origGetFileHandle;
    }
  });

  it('битое тело в файле читается как промах, а не как исключение', async () => {
    const storage = createOpfsStorage();
    await storage.set(rec('a/f@1', 'тело'));
    // Портим содержимое напрямую — имитация оборванной записи или чужой правки.
    const dir = root.dirs.get('reformer-forms')!.dirs.get('v1')!;
    const fileName = [...dir.files.keys()][0];
    dir.files.set(fileName, '{битый json');
    await expect(storage.get('a/f@1')).resolves.toBeUndefined();
  });
});

/*
 * Чего этот файл НЕ проверяет (и почему):
 *
 * - Настоящий OPFS — нужен браузер. Логика поверх него покрыта фейком; непокрытым остаётся
 *   сам ввод-вывод и поведение движка при исчерпании квоты.
 * - `createSyncAccessHandle` по-настоящему (Worker) — требует запуска в Worker.
 * - Атомарность записи при двух одновременных писателях — нужны две вкладки/воркера.
 * - Ветка QuotaExceededError в IndexedDB — fake-indexeddb квоту не эмулирует, а подменять
 *   внутренности стратегии значило бы тестировать мок, а не код.
 */
