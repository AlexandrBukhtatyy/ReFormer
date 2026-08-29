/**
 * Тесты тестового двойника — того, чем он ОТЛИЧАЕТСЯ от файловой системы.
 *
 * Общий набор (`contract.test.ts`) проверяет, что двойник соблюдает контракт. Здесь
 * проверяется вторая половина его смысла: он обязан быть устроен иначе. Копия файловой
 * системы в памяти не ловит ничего — контракт из неё и вычитали, — поэтому каждое
 * расхождение здесь закреплено тестом, чтобы его не «починили» обратно.
 *
 * @module host/source/memory.test
 */

import { describe, expect, it } from 'vitest';

import { conflictRevision, isSourceError } from './errors';
import { createMemorySource, createMemorySourceFactory } from './memory';

const files = { 'a.json': '{"a":1}', 'nested/b.txt': 'текст' };

describe('устройство двойника', () => {
  it('ревизии непрозрачны и НЕ упорядочены', async () => {
    const source = createMemorySource({}, { writable: true, label: 'ревизии' });
    const write = source.write;
    if (write === undefined) throw new Error('запись обязана быть включена');

    const revisions: string[] = [];
    for (let n = 0; n < 6; n += 1) {
      const written = await write.call(source, 'a.txt', `версия ${n}`);
      if (written.revision === undefined) throw new Error('ревизия обязана быть');
      revisions.push(written.revision);
    }

    // Ни число, ни время: код, научившийся сравнивать ревизии на «новее», обязан сломаться
    // здесь, а не на первом настоящем сервере.
    expect(revisions.every((revision) => Number.isNaN(Number(revision)))).toBe(true);
    expect([...revisions].sort()).not.toEqual(revisions);
    expect(new Set(revisions).size).toBe(revisions.length);
  });

  it('задержка ненулевая: ответ не приходит в той же микрозадаче', async () => {
    const source = createMemorySource(files, { delayMs: 5, label: 'задержка' });

    let answered = false;
    const pending = source.stat('a.json').then(() => {
      answered = true;
    });
    await Promise.resolve();

    // Код, «работавший» потому, что промис успевал разрешиться до следующей строки,
    // на настоящем источнике не работает никогда.
    expect(answered).toBe(false);
    await pending;
    expect(answered).toBe(true);
  });

  it('нулевую задержку двойник не принимает', () => {
    expect(() => createMemorySource(files, { delayMs: 0 })).toThrow(/ненулевой/);
  });

  it('пространство имён плоское: каталогов нет, а пути есть', async () => {
    const source = createMemorySource(files, { writable: true, label: 'плоский' });

    expect(source.capabilities.tree).toBe(false);
    expect(source.mkdir).toBeUndefined();

    // Каталог не создаётся, но и не нужен: путь здесь — ключ, а не маршрут.
    const write = source.write;
    if (write === undefined) throw new Error('запись обязана быть включена');
    await write.call(source, 'глубоко/вложенный/файл.txt', 'ок');

    expect((await source.stat('глубоко/вложенный'))?.kind).toBe('directory');
    expect((await source.list('глубоко')).map((entry) => entry.kind)).toEqual(['directory']);
  });

  it('исполнение кода выключено, запись по умолчанию тоже', () => {
    const source = createMemorySource(files, { label: 'умолчания' });

    expect(source.capabilities.executesCode).toBe(false);
    expect(source.capabilities.write).toBe(false);
    expect(source.write).toBeUndefined();
    expect(source.remove).toBeUndefined();
    expect(source.move).toBeUndefined();
  });
});

describe('намеренные отказы', () => {
  it('заказываются по виду и приходят типизированными', async () => {
    const source = createMemorySource(files, { label: 'отказы' });

    for (const kind of ['network', 'unauthorized', 'forbidden', 'budget', 'aborted'] as const) {
      source.failNext(kind);
      const error = await source.read('a.json').catch((err: unknown) => err);
      expect(isSourceError(error, kind)).toBe(true);
    }
  });

  it('одноразовы: следующее обращение проходит', async () => {
    const source = createMemorySource(files, { label: 'одноразовые' });
    source.failNext('network');

    await expect(source.read('a.json')).rejects.toThrow();
    expect((await source.read('a.json')).text).toBe(files['a.json']);
  });

  it('наводятся на конкретную операцию и путь', async () => {
    const source = createMemorySource(files, { label: 'наводка' });
    source.failNext('unauthorized', { op: 'read', path: 'nested/b.txt' });

    // Другая операция и другой путь идут своим ходом.
    expect(await source.stat('nested/b.txt')).not.toBeNull();
    expect((await source.read('a.json')).text).toBe(files['a.json']);

    const error = await source.read('nested/b.txt').catch((err: unknown) => err);
    expect(isSourceError(error, 'unauthorized')).toBe(true);
  });

  it('заказанный конфликт всё равно несёт текущую ревизию', async () => {
    const source = createMemorySource(files, { writable: true, label: 'конфликт' });
    source.failNext('conflict', { op: 'write', path: 'a.json' });

    const write = source.write;
    if (write === undefined) throw new Error('запись обязана быть включена');
    const error = await write.call(source, 'a.json', 'моё').catch((err: unknown) => err);

    expect(conflictRevision(error)).toBe(source.revisionOf('a.json'));
  });
});

describe('наблюдение и правка мимо контракта', () => {
  it('журнал обращений копит операции и обнуляется', async () => {
    const source = createMemorySource(files, { label: 'журнал' });

    await source.read('a.json');
    await source.list('');
    await source.stat('a.json');

    expect(source.calls.map((call) => call.op)).toEqual(['read', 'list', 'stat']);
    source.forget();
    expect(source.calls).toEqual([]);
    expect(source.bodyReads).toBe(0);
  });

  it('внешняя правка меняет содержимое и ревизию, не оставляя следа в журнале', async () => {
    const source = createMemorySource(files, { label: 'снаружи' });
    const before = source.revisionOf('a.json');

    source.put('a.json', '{"a":2}');

    expect(source.textOf('a.json')).toBe('{"a":2}');
    expect(source.revisionOf('a.json')).not.toBe(before);
    // Так имитируется правка файла в стороннем редакторе: источник о ней не «докладывал».
    expect(source.calls).toEqual([]);
  });

  it('внешнее удаление превращает чтение в отказ', async () => {
    const source = createMemorySource(files, { label: 'удаление' });
    source.drop('a.json');

    const error = await source.read('a.json').catch((err: unknown) => err);
    expect(isSourceError(error, 'not-found')).toBe(true);
  });
});

describe('переоткрытие двойника', () => {
  it('восстанавливается по метке, чужой дескриптор не берёт', async () => {
    const source = createMemorySource(files, { label: 'метка-1' });
    const factory = createMemorySourceFactory();

    // Незнакомая метка и чужой вид — «источника нет», а не «доступ не дан»: модели разрешений
    // у двойника нет вовсе, и отвечать `denied` значило бы обещать интерфейсу кнопку
    // «разрешить», за которой ничего не стоит.
    expect(await factory.restore({ kind: 'memory', label: 'метка-1' })).toBe(source);
    expect(await factory.restore({ kind: 'memory', label: 'метка-2' })).toEqual({
      unavailable: 'missing',
    });
    expect(await factory.restore({ kind: 'fs', handleKey: 'метка-1' })).toEqual({
      unavailable: 'missing',
    });
  });
});
