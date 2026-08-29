/**
 * Тесты журнала — против подставной IndexedDB и настоящего хранилища метаданных.
 *
 * Проверяется то, ради чего журнал и заведён: он один поток, он переживает перезагрузку,
 * из него восстанавливается текст, ход ассистента откатывается целиком — и после любой
 * уборки в нём не остаётся правок без основания.
 *
 * @module host/workspace/journal/journal.test
 */

import { describe, expect, it } from 'vitest';

import type { ResourceId } from '../../primitives/resource';
import { applyTextEdits, diffText, type TextEdit } from '../model/history';
import { createWorkspaceMetaStore, type WorkspaceMetaStore } from '../storage/idb';
import { createMemoryIndexedDb, type MemoryIndexedDbControl } from '../storage/testing';
import { createJournal, createJournalRelief, type Journal } from './journal';
import { checkSnapshotInvariant, type JournalPolicy } from './policy';
import { indexOf, type JournalIndexEntry, type JournalOrigin } from './record';

let dbSeq = 0;

interface Harness {
  readonly journal: Journal;
  readonly store: WorkspaceMetaStore;
  readonly control: MemoryIndexedDbControl;
  /** Часы журнала: тесты двигают их руками, иначе окно схлопывания непроверяемо. */
  clock: number;
  /** Правка текста: сначала меняется содержимое, потом пишется запись — как у документа. */
  write(
    resource: ResourceId,
    text: string,
    options?: { origin?: JournalOrigin; txId?: string }
  ): Promise<void>;
  text(resource: ResourceId): string;
  /** Указатель прямо из хранилища — мимо памяти журнала. */
  storedIndex(): Promise<readonly JournalIndexEntry[]>;
}

function makeHarness(policy?: Partial<JournalPolicy>): Harness {
  const memory = createMemoryIndexedDb();
  dbSeq += 1;
  const store = createWorkspaceMetaStore({
    factory: memory.factory,
    databaseName: `journal-${dbSeq}`,
    // В node нет navigator.storage: отдаём «места вдоволь», чтобы превентивная ветка
    // не вмешивалась в тесты, которые про другое.
    estimate: async () => ({ usage: 0, quota: 1_000_000 }),
  });
  const texts = new Map<ResourceId, string>();

  const harness: Harness = {
    journal: createJournal({
      store,
      workspaceId: 'w1',
      content: (resource) => texts.get(resource),
      now: () => harness.clock,
      ...(policy === undefined ? {} : { policy }),
    }),
    store,
    control: memory.control,
    clock: 1_000,
    async write(resource, next, options) {
      const before = texts.get(resource) ?? '';
      const edits = diffText(before, next);
      texts.set(resource, next);
      await harness.journal.record({
        resource,
        origin: options?.origin ?? 'user',
        ...(options?.txId === undefined ? {} : { txId: options.txId }),
        payload: { kind: 'text', edits },
      });
    },
    text: (resource) => texts.get(resource) ?? '',
    async storedIndex() {
      return indexOf(await store.listWorkspaceHistory('w1'));
    },
  };
  return harness;
}

describe('один поток', () => {
  it('нумерует записи сквозно по области, а не по ресурсу', async () => {
    const h = makeHarness();
    await h.write('fs:a.ts', 'a');
    await h.write('fs:b.ts', 'b');
    await h.write('fs:a.ts', 'ab');

    const index = await h.journal.index();
    // Старшинство между правками РАЗНЫХ файлов обязано быть определено — иначе «покажи,
    // что изменилось» не собирается в один список. Записей пять, а не три: первая правка
    // каждого ресурса закрывается опорным снимком.
    expect(index.map((entry) => entry.seq)).toEqual([1, 2, 3, 4, 5]);
    expect(index.map((entry) => entry.resource)).toEqual([
      'fs:a.ts',
      'fs:a.ts',
      'fs:b.ts',
      'fs:b.ts',
      'fs:a.ts',
    ]);
  });

  it('первая запись ресурса сразу получает опорный снимок', async () => {
    const h = makeHarness();
    await h.write('fs:a.ts', 'a');

    const index = await h.storedIndex();
    expect(index.map((entry) => entry.kind)).toEqual(['entry', 'snapshot']);
    // Инвариант держится с самой первой записи, а не «когда-нибудь потом».
    expect(checkSnapshotInvariant(index).ok).toBe(true);
  });

  it('переживает перезагрузку: второй журнал над тем же хранилищем продолжает поток', async () => {
    const h = makeHarness();
    await h.write('fs:a.ts', 'a');

    const reopened = createJournal({ store: h.store, workspaceId: 'w1', now: () => h.clock });
    await reopened.record({
      resource: 'fs:a.ts',
      origin: 'user',
      payload: { kind: 'text', edits: [{ offset: 1, removed: '', inserted: 'b' }] },
    });

    const index = await reopened.index();
    expect(index[index.length - 1].seq).toBe(3);
    expect(await reopened.restore('fs:a.ts')).toBe('ab');
  });
});

describe('схлопывание в хвост', () => {
  it('соседние нажатия переписывают одну запись, а не добавляют новые', async () => {
    const h = makeHarness();
    await h.write('fs:a.ts', 'a');
    // Первая запись закрыта опорным снимком, поэтому набор продолжается со второй.
    await h.write('fs:a.ts', 'ab');
    h.clock += 500;
    await h.write('fs:a.ts', 'abc');
    h.clock += 500;
    await h.write('fs:a.ts', 'abcd');

    const stored = await h.store.listHistory('w1', 'fs:a.ts');
    const entries = stored.filter((record) => record.kind === 'entry');
    expect(entries).toHaveLength(2);
    expect(entries[1].payload).toEqual({
      kind: 'text',
      edits: [{ offset: 1, removed: '', inserted: 'bcd' }],
    });
    expect(await h.journal.restore('fs:a.ts')).toBe('abcd');
  });

  it('не сливает через границу txId и через смену origin', async () => {
    const h = makeHarness();
    await h.write('fs:a.ts', 'a');
    await h.write('fs:a.ts', 'ab', { origin: 'agent', txId: 'turn-1' });
    await h.write('fs:a.ts', 'abc', { origin: 'agent', txId: 'turn-2' });
    await h.write('fs:a.ts', 'abcd', { origin: 'user' });

    const stored = await h.store.listHistory('w1', 'fs:a.ts');
    expect(stored.filter((record) => record.kind === 'entry')).toHaveLength(4);
  });

  it('пауза длиннее окна начинает новую запись', async () => {
    const h = makeHarness();
    await h.write('fs:a.ts', 'a');
    await h.write('fs:a.ts', 'ab');
    h.clock += 3_001;
    await h.write('fs:a.ts', 'abc');

    const stored = await h.store.listHistory('w1', 'fs:a.ts');
    expect(stored.filter((record) => record.kind === 'entry')).toHaveLength(3);
  });

  it('опорный снимок закрывает хвост: запись перед ним больше не переписывается', async () => {
    // Снимок описывает состояние после всего, что было до него. Дописать правку в запись,
    // оставшуюся перед снимком, значит сделать снимок неверным.
    const h = makeHarness({ snapshotEveryRecords: 1 });
    await h.write('fs:a.ts', 'a');
    await h.write('fs:a.ts', 'ab');
    await h.write('fs:a.ts', 'abc');

    const stored = await h.store.listHistory('w1', 'fs:a.ts');
    expect(stored.filter((record) => record.kind === 'entry')).toHaveLength(3);
    expect(await h.journal.restore('fs:a.ts')).toBe('abc');
  });
});

describe('восстановление', () => {
  it('проигрывание от снимка даёт исходный текст', async () => {
    const h = makeHarness();
    const steps = ['const a = 1;', 'const ab = 1;', 'const ab = 2;', 'const ab = 2; // ok'];
    for (const step of steps) {
      h.clock += 5_000;
      await h.write('fs:a.ts', step);
    }

    expect(await h.journal.restore('fs:a.ts')).toBe(h.text('fs:a.ts'));
  });

  it('восстанавливает состояние на любой момент потока', async () => {
    const h = makeHarness();
    await h.write('fs:a.ts', 'a');
    h.clock += 5_000;
    await h.write('fs:a.ts', 'ab');
    const middle = (await h.journal.index()).map((entry) => entry.seq);
    h.clock += 5_000;
    await h.write('fs:a.ts', 'abc');

    expect(await h.journal.restore('fs:a.ts', { through: middle[middle.length - 1] })).toBe('ab');
  });

  it('без снимка воспроизводить не от чего — и это видно, а не угадывается', async () => {
    const h = makeHarness();
    expect(await h.journal.restore('fs:missing.ts')).toBeUndefined();
  });

  it('отказывается проигрывать операции над моделью без applier’а', async () => {
    const h = makeHarness();
    await h.write('fs:form.json', '{}');
    await h.journal.record({
      resource: 'fs:form.json',
      origin: 'user',
      payload: { kind: 'model', ops: [{ type: 'set-prop', target: 'n1' }] },
    });

    // Словарь операций принадлежит провайдеру модели: Host его не знает и делать вид,
    // что восстановил, не имеет права.
    await expect(h.journal.restore('fs:form.json')).rejects.toThrow(/applyOps/);
  });
});

describe('откат хода', () => {
  it('ход с txId откатывается целиком', async () => {
    const h = makeHarness();
    await h.write('fs:a.ts', 'первая строка');
    h.clock += 5_000;
    const before = h.text('fs:a.ts');

    // Ход ассистента: несколько правок с общим txId, между ними паузы больше окна —
    // схлопывание их не соберёт, а откат обязан снять весь ход.
    await h.write('fs:a.ts', 'первая строка\nвторая', { origin: 'agent', txId: 'turn-1' });
    h.clock += 5_000;
    await h.write('fs:a.ts', 'первая строка\nвторая строка', { origin: 'agent', txId: 'turn-1' });
    h.clock += 5_000;
    await h.write('fs:a.ts', 'первая строка\nвторая строка\n', { origin: 'agent', txId: 'turn-1' });

    const stored = await h.store.listHistory('w1', 'fs:a.ts');
    expect(
      stored.filter((record) => record.kind === 'entry' && record.txId === 'turn-1')
    ).toHaveLength(3);
    expect(await h.journal.undoTransaction('fs:a.ts', 'turn-1', h.text('fs:a.ts'))).toBe(before);
  });

  it('не откатывает ход поверх чужих правок, а отказывает', async () => {
    const h = makeHarness();
    await h.write('fs:a.ts', 'abc');
    h.clock += 5_000;
    await h.write('fs:a.ts', 'abcX', { origin: 'agent', txId: 'turn-1' });
    h.clock += 5_000;
    await h.write('fs:a.ts', 'ZZZ');

    // Обратная правка отсчитана от текста сразу после хода; поверх легло другое —
    // основания под ней больше нет. Правдоподобно испорченный текст был бы хуже отказа.
    await expect(
      h.journal.undoTransaction('fs:a.ts', 'turn-1', h.text('fs:a.ts'))
    ).rejects.toThrow();
  });
});

describe('кодовые единицы UTF-16', () => {
  it('смещения считаются как в JavaScript — проверено на эмодзи', async () => {
    const h = makeHarness();
    await h.write('fs:a.ts', 'a😀b');
    h.clock += 5_000;
    // «b» стоит на смещении 3: эмодзи занимает ДВЕ кодовые единицы.
    await h.write('fs:a.ts', 'a😀bc');

    const stored = await h.store.listHistory('w1', 'fs:a.ts');
    const last = stored[stored.length - 1];
    expect(last.kind === 'entry' && last.payload.kind === 'text' ? last.payload.edits : []).toEqual(
      [{ offset: 4, removed: '', inserted: 'c' }]
    );
    expect(await h.journal.restore('fs:a.ts')).toBe('a😀bc');
  });

  it('схлопывание набора эмодзи не разрезает суррогатных пар', async () => {
    const h = makeHarness();
    await h.write('fs:a.ts', 'x');
    await h.write('fs:a.ts', 'x😀');
    await h.write('fs:a.ts', 'x😀🙂');

    const stored = await h.store.listHistory('w1', 'fs:a.ts');
    const entries = stored.filter((record) => record.kind === 'entry');
    const merged = entries[entries.length - 1];
    const edits: readonly TextEdit[] = merged.payload.kind === 'text' ? merged.payload.edits : [];
    expect(edits).toEqual([{ offset: 1, removed: '', inserted: '😀🙂' }]);
    expect(applyTextEdits('x', edits)).toBe('x😀🙂');
  });
});

describe('политика хранения', () => {
  /** Записи двух ресурсов: у каждого опорный снимок и правки поверх него. */
  async function fill(h: Harness): Promise<void> {
    await h.write('fs:a.ts', 'aaaa');
    await h.write('fs:b.ts', 'bbbb');
    h.clock += 4_000;
    await h.write('fs:a.ts', 'aaaa aaaa');
    await h.write('fs:b.ts', 'bbbb bbbb');
  }

  it('уборка по возрасту не оставляет хвоста без основания', async () => {
    const h = makeHarness({ maxAgeMs: 5_000 });
    await fill(h);
    const oldest = (await h.journal.index())[0].seq;

    // Первая половина записей состарилась, вторая — нет.
    h.clock += 4_000;
    const result = await h.journal.compact();

    expect(result.removed).toBeGreaterThan(0);
    expect(result.cutSeq).toBeGreaterThan(oldest);
    const index = await h.storedIndex();
    expect(checkSnapshotInvariant(index).ok).toBe(true);
    // И журнал по-прежнему воспроизводится — ради этого инвариант и держат.
    expect(await h.journal.restore('fs:a.ts')).toBe(h.text('fs:a.ts'));
    expect(await h.journal.restore('fs:b.ts')).toBe(h.text('fs:b.ts'));
  });

  it('уборка по объёму доводит журнал до потолка', async () => {
    const h = makeHarness({ maxBytes: 400, maxAgeMs: Number.MAX_SAFE_INTEGER });
    for (let i = 0; i < 12; i += 1) {
      h.clock += 5_000;
      await h.write('fs:a.ts', `строка ${i} — ${'x'.repeat(20)}`);
    }

    const index = await h.storedIndex();
    const bytes = index.reduce((sum, entry) => sum + entry.bytes, 0);
    expect(bytes).toBeLessThanOrEqual(400);
    expect(checkSnapshotInvariant(index).ok).toBe(true);
    expect(await h.journal.restore('fs:a.ts')).toBe(h.text('fs:a.ts'));
  });

  it('перед удалением кладёт свежий снимок — иначе резать было бы нечего', async () => {
    const h = makeHarness({ maxAgeMs: 5_000 });
    await fill(h);
    h.clock += 4_000;

    const result = await h.journal.compact();

    // Шаг 0 политики: снимок делает удаление допустимым, поэтому идёт первым.
    expect([...result.snapshots].sort()).toEqual(['fs:a.ts', 'fs:b.ts']);
  });

  it('без источника содержимого снимка не выдумывает, а признаёт, что резать нельзя', async () => {
    const h = makeHarness({ maxAgeMs: 1 });
    // Тот же поток, но журнал без `content`: положить опорный снимок не из чего.
    const blind = createJournal({ store: h.store, workspaceId: 'w1', now: () => h.clock });
    await blind.record({
      resource: 'fs:a.ts',
      origin: 'user',
      payload: { kind: 'text', edits: [{ offset: 0, removed: '', inserted: 'a' }] },
    });
    h.clock += 60_000;

    const result = await blind.compact();

    // Записи старше срока, но удалить их значит потерять единственный след правки:
    // инвариант сильнее возраста, и снимок остаётся заказанным.
    expect(result.removed).toBe(0);
    expect(result.needSnapshot).toEqual(['fs:a.ts']);
    expect(result.snapshots).toEqual([]);
  });

  it('журнал уходит вместе с рабочей областью', async () => {
    const h = makeHarness();
    await h.write('fs:a.ts', 'a');
    await h.store.removeWorkspace('w1');

    expect(await h.store.listWorkspaceHistory('w1')).toEqual([]);
  });
});

describe('освобождение места по квоте', () => {
  it('грубое удаление самых старых записей оставляет хвост без основания', async () => {
    const h = makeHarness();
    await h.write('fs:a.ts', 'aaa');
    h.clock += 5_000;
    await h.write('fs:a.ts', 'aaa bbb');

    // Ровно то, что делает умолчание хранилища (`removeOldestHistory`), только с числом,
    // помещающимся в тест: записи выбрасываются, не глядя на снимки.
    await h.store.removeOldestHistory('w1', 2);

    const index = await h.storedIndex();
    expect(checkSnapshotInvariant(index)).toEqual({ ok: false, unfounded: ['fs:a.ts'] });
    // Восстановить ресурс больше нечем — это и есть долг, записанный в `idb.ts`.
    expect(await h.journal.restore('fs:a.ts')).toBeUndefined();
  });

  it('политика журнала, переданная в onQuotaPressure, инвариант соблюдает', async () => {
    const memory = createMemoryIndexedDb();
    dbSeq += 1;
    const journals = new Map<string, Journal>();
    const store = createWorkspaceMetaStore({
      factory: memory.factory,
      databaseName: `journal-relief-${dbSeq}`,
      estimate: async () => ({ usage: 0, quota: 1_000_000 }),
      onQuotaPressure: createJournalRelief((id) => journals.get(id)),
    });

    const texts = new Map<ResourceId, string>();
    let clock = 1_000;
    const journal = createJournal({
      store,
      workspaceId: 'w1',
      content: (resource) => texts.get(resource),
      now: () => clock,
      policy: { maxAgeMs: 5_000 },
    });
    journals.set('w1', journal);

    const write = async (resource: ResourceId, next: string): Promise<void> => {
      const edits = diffText(texts.get(resource) ?? '', next);
      texts.set(resource, next);
      await journal.record({ resource, origin: 'user', payload: { kind: 'text', edits } });
    };
    await write('fs:a.ts', 'aaa');
    await write('fs:b.ts', 'bbb');
    clock += 4_000;
    await write('fs:a.ts', 'aaa ccc');
    await write('fs:b.ts', 'bbb ddd');
    const before = indexOf(await store.listWorkspaceHistory('w1')).length;

    // Первые записи состарились; место кончается — хранилище зовёт освобождение.
    clock += 4_000;
    memory.control.failNextWrites(1);
    await store.putStat({
      workspaceId: 'w1',
      path: 'a.ts',
      kind: 'file',
      revision: 'r1',
      size: 3,
      hasBase: false,
      materializedAt: clock,
      lastUsedAt: clock,
      dirty: false,
    });

    const index = indexOf(await store.listWorkspaceHistory('w1'));
    expect(index.length).toBeLessThan(before);
    // Главное отличие от умолчания: после уборки журнал по-прежнему воспроизводится.
    expect(checkSnapshotInvariant(index).ok).toBe(true);
    expect(await journal.restore('fs:a.ts')).toBe('aaa ccc');
    expect(await journal.restore('fs:b.ts')).toBe('bbb ddd');
  });

  it('под давлением убирает с запасом, а не ровно под потолок', async () => {
    const h = makeHarness({ maxAgeMs: Number.MAX_SAFE_INTEGER });
    for (let i = 0; i < 6; i += 1) {
      h.clock += 5_000;
      await h.write('fs:a.ts', `строка ${i}`);
    }
    const before = (await h.storedIndex()).reduce((sum, entry) => sum + entry.bytes, 0);

    // Тот же журнал, но с потолком ровно по его нынешнему размеру: обычной уборке резать
    // нечего, а срочная считает потолок вдвое ниже — повтор записи у хранилища РОВНО один,
    // и уборка «ровно под потолок» отправила бы следующую запись в тот же отказ.
    const tight = createJournal({
      store: h.store,
      workspaceId: 'w1',
      content: (resource) => h.text(resource),
      now: () => h.clock,
      policy: { maxBytes: before, maxAgeMs: Number.MAX_SAFE_INTEGER },
    });

    expect((await tight.compact()).removed).toBe(0);
    await tight.relieve({ workspaceId: 'w1', urgent: true });

    const index = await h.storedIndex();
    const after = index.reduce((sum, entry) => sum + entry.bytes, 0);
    expect(after).toBeLessThan(before);
    expect(checkSnapshotInvariant(index).ok).toBe(true);
    expect(await tight.restore('fs:a.ts')).toBe(h.text('fs:a.ts'));
  });

  it('чужое давление журнал не трогает', async () => {
    const h = makeHarness({ maxAgeMs: 1 });
    await h.write('fs:a.ts', 'a');
    h.clock += 60_000;

    await h.journal.relieve({ workspaceId: 'w2', urgent: true });

    expect((await h.storedIndex()).length).toBe(2);
  });
});
