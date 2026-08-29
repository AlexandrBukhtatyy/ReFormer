/**
 * Тесты политики хранения — чистые, без хранилища.
 *
 * Проверяется не «функции работают», а те три утверждения, на которых политика держится:
 * схлопывание не стирает границ между действиями, удаление никогда не оставляет хвоста
 * без основания, и жёсткое ограничение (объём) действительно доводит журнал до потолка.
 *
 * @module host/workspace/journal/policy.test
 */

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_JOURNAL_POLICY,
  canMerge,
  checkSnapshotInvariant,
  collapse,
  journalPolicy,
  mergeRecords,
  planCompaction,
} from './policy';
import type { JournalIndexEntry, JournalRecord } from './record';

const policy = DEFAULT_JOURNAL_POLICY;

/** Запись с текстовой правкой: по умолчанию — одно нажатие. */
function typed(seq: number, ts: number, extra: Partial<JournalRecord> = {}): JournalRecord {
  return {
    seq,
    resource: 'fs:a.ts',
    ts,
    origin: 'user',
    payload: { kind: 'text', edits: [{ offset: seq, removed: '', inserted: 'x' }] },
    ...extra,
  };
}

function line(
  seq: number,
  resource: string,
  ts: number,
  kind: 'entry' | 'snapshot' = 'entry',
  bytes = 10
): JournalIndexEntry {
  return { seq, resource, ts, bytes, kind };
}

/** Что останется в журнале, если применить план. */
function applyPlan(index: readonly JournalIndexEntry[], cutSeq: number): JournalIndexEntry[] {
  return index.filter((entry) => entry.seq >= cutSeq);
}

/**
 * Ресурсы, осиротевшие ИМЕННО удалением.
 *
 * Проверять «после плана инвариант держится» в лоб нельзя: журнал мог прийти уже нарушенным
 * (снимок не лёг, запись пришла от другой версии кода). Требование к политике другое и более
 * точное — она не имеет права создать хвост без основания там, где его не было.
 */
function orphanedBy(index: readonly JournalIndexEntry[], cutSeq: number): readonly string[] {
  const before = new Set(checkSnapshotInvariant(index).unfounded);
  return checkSnapshotInvariant(applyPlan(index, cutSeq)).unfounded.filter(
    (resource) => !before.has(resource)
  );
}

describe('схлопывание', () => {
  it('сливает соседние нажатия внутри окна', () => {
    const first: JournalRecord = {
      seq: 1,
      resource: 'fs:a.ts',
      ts: 1_000,
      origin: 'user',
      payload: { kind: 'text', edits: [{ offset: 0, removed: '', inserted: 'a' }] },
    };
    const second: JournalRecord = {
      seq: 2,
      resource: 'fs:a.ts',
      ts: 1_500,
      origin: 'user',
      payload: { kind: 'text', edits: [{ offset: 1, removed: '', inserted: 'b' }] },
    };

    expect(canMerge(first, second, policy)).toBe(true);
    const merged = mergeRecords(first, second);
    // Место в потоке — от первой (шаг начался там), время — от второй (шаг длился до неё).
    expect(merged.seq).toBe(1);
    expect(merged.ts).toBe(1_500);
    expect(merged.payload).toEqual({
      kind: 'text',
      edits: [{ offset: 0, removed: '', inserted: 'ab' }],
    });
  });

  it('не сливает через границу txId', () => {
    const move = typed(1, 1_000, { origin: 'agent', txId: 'turn-1' });
    const next = typed(2, 1_100, { origin: 'agent', txId: 'turn-2' });

    // Иначе ход ассистента перестал бы быть одним шагом, и откатить его целиком было бы нечем.
    expect(canMerge(move, next, policy)).toBe(false);
    expect(collapse([move, next])).toHaveLength(2);
  });

  it('не сливает запись без хода с записью хода', () => {
    const free = typed(1, 1_000, { origin: 'agent' });
    const inTurn = typed(2, 1_100, { origin: 'agent', txId: 'turn-1' });

    expect(canMerge(free, inTurn, policy)).toBe(false);
  });

  it('не сливает при смене origin', () => {
    const human = typed(1, 1_000, { origin: 'user' });
    const machine = typed(2, 1_100, { origin: 'agent' });

    // В различимости правки человека и правки машины — половина ценности аудита.
    expect(canMerge(human, machine, policy)).toBe(false);
    expect(collapse([human, machine])).toHaveLength(2);
  });

  it('не сливает за пределами окна', () => {
    const first = typed(1, 1_000);
    const late = typed(2, 1_000 + policy.mergeWindowMs + 1);

    expect(canMerge(first, late, policy)).toBe(false);
  });

  it('не сливает правки разных ресурсов', () => {
    const here = typed(1, 1_000);
    const there = typed(2, 1_100, { resource: 'fs:b.ts' });

    expect(canMerge(here, there, policy)).toBe(false);
  });

  it('окно считается от паузы, а не от начала записи', () => {
    // Набор без остановки — одно действие, сколько бы он ни длился.
    const records = [typed(1, 0), typed(2, 2_000), typed(3, 4_000), typed(4, 6_000)];

    expect(collapse(records)).toHaveLength(1);
    // А пауза в четыре секунды заканчивает шаг.
    expect(collapse([...records, typed(5, 10_100)])).toHaveLength(2);
  });

  it('операции над моделью склеиваются списком, а правки текста — композицией', () => {
    const first: JournalRecord = {
      seq: 1,
      resource: 'fs:form.json',
      ts: 0,
      origin: 'user',
      payload: { kind: 'model', ops: [{ type: 'set-prop', target: 'n1' }] },
    };
    const second: JournalRecord = { ...first, seq: 2, ts: 100 };

    expect(mergeRecords(first, second).payload).toEqual({
      kind: 'model',
      ops: [
        { type: 'set-prop', target: 'n1' },
        { type: 'set-prop', target: 'n1' },
      ],
    });
  });

  it('отказывается сливать разную начинку', () => {
    const text = typed(1, 0);
    const model: JournalRecord = {
      ...text,
      seq: 2,
      ts: 50,
      payload: { kind: 'model', ops: [] },
    };

    expect(canMerge(text, model, policy)).toBe(false);
    expect(() => mergeRecords(text, model)).toThrow(/разной начинкой/);
  });
});

describe('инвариант опорного снимка', () => {
  it('видит ресурс, оставшийся без снимка', () => {
    const index = [line(1, 'fs:a.ts', 0, 'snapshot'), line(2, 'fs:a.ts', 0), line(3, 'fs:b.ts', 0)];

    expect(checkSnapshotInvariant(index)).toEqual({ ok: false, unfounded: ['fs:b.ts'] });
  });

  it('пустой журнал инвариант не нарушает', () => {
    expect(checkSnapshotInvariant([]).ok).toBe(true);
  });
});

describe('удаление по возрасту', () => {
  const day = 24 * 60 * 60 * 1000;
  const now = 100 * day;
  const old = now - 40 * day;

  it('не уходит глубже опорного снимка и просит новый', () => {
    const index = [
      line(1, 'fs:a.ts', old, 'snapshot'),
      line(2, 'fs:a.ts', old),
      line(3, 'fs:a.ts', now),
    ];

    const plan = planCompaction(index, { now });

    // Возраст хотел бы срезать записи 1 и 2, но тогда у ресурса не осталось бы основания
    // для записи 3 — резать нечего, пока не появится свежий снимок.
    expect(plan.removed).toBe(0);
    expect(plan.needSnapshot).toEqual(['fs:a.ts']);
    expect(orphanedBy(index, plan.cutSeq)).toEqual([]);
  });

  it('после снимка срезает старое и оставляет журнал воспроизводимым', () => {
    const index = [
      line(1, 'fs:a.ts', old, 'snapshot'),
      line(2, 'fs:a.ts', old),
      line(3, 'fs:a.ts', now),
      line(4, 'fs:a.ts', now, 'snapshot'),
    ];

    const plan = planCompaction(index, { now });

    expect(plan.removed).toBe(2);
    expect(plan.cutSeq).toBe(3);
    expect(orphanedBy(index, plan.cutSeq)).toEqual([]);
  });

  it('ресурс, уходящий из журнала целиком, снимка не требует', () => {
    const index = [
      line(1, 'fs:gone.ts', old, 'snapshot'),
      line(2, 'fs:gone.ts', old),
      line(3, 'fs:a.ts', now, 'snapshot'),
      line(4, 'fs:a.ts', now),
    ];

    const plan = planCompaction(index, { now });

    // Хвоста без основания не остаётся: у ресурса не остаётся вообще ничего.
    expect(plan.removed).toBe(2);
    expect(plan.needSnapshot).toEqual([]);
    expect(orphanedBy(index, plan.cutSeq)).toEqual([]);
  });

  it('граница одна на область, поэтому её задаёт самый требовательный ресурс', () => {
    const index = [
      line(1, 'fs:a.ts', old, 'snapshot'),
      line(2, 'fs:b.ts', old, 'snapshot'),
      line(3, 'fs:b.ts', old),
      line(4, 'fs:a.ts', now, 'snapshot'),
      line(5, 'fs:b.ts', now),
    ];

    const plan = planCompaction(index, { now });

    // `b` держит границу на своём снимке (2): за ним запись 5, которую иначе нечем
    // было бы воспроизвести. Запись 1 при этом уходит — она старше границы.
    expect(plan.cutSeq).toBe(2);
    expect(plan.removed).toBe(1);
    expect(plan.needSnapshot).toEqual(['fs:b.ts']);
    expect(orphanedBy(index, plan.cutSeq)).toEqual([]);
  });
});

describe('удаление по объёму', () => {
  const small = journalPolicy({ maxBytes: 100, maxAgeMs: Number.MAX_SAFE_INTEGER });

  it('доводит журнал до потолка', () => {
    const index = [
      line(1, 'fs:a.ts', 0, 'snapshot', 40),
      line(2, 'fs:a.ts', 1, 'entry', 40),
      line(3, 'fs:a.ts', 2, 'snapshot', 40),
      line(4, 'fs:a.ts', 3, 'entry', 40),
    ];

    const plan = planCompaction(index, { now: 10, policy: small });

    // Потолок — ограничение, а не пожелание: после уборки журнал обязан быть под ним.
    expect(plan.keptBytes).toBeLessThanOrEqual(small.maxBytes);
    expect(plan.retainedOverBudget).toBe(false);
    expect(orphanedBy(index, plan.cutSeq)).toEqual([]);
  });

  it('признаёт перерасход, пока свежего снимка нет, и доводит до потолка, когда он появился', () => {
    const index = [
      line(1, 'fs:a.ts', 0, 'snapshot', 80),
      line(2, 'fs:a.ts', 1, 'entry', 80),
      line(3, 'fs:a.ts', 2, 'entry', 80),
    ];

    const blocked = planCompaction(index, { now: 10, policy: small });

    // Объём требует срезать почти всё, но за границей остались бы записи 2 и 3 без снимка.
    // Инвариант сильнее потолка: удалять нельзя, перерасход называется вслух, снимок заказан.
    expect(blocked.removed).toBe(0);
    expect(blocked.retainedOverBudget).toBe(true);
    expect(blocked.needSnapshot).toEqual(['fs:a.ts']);
    expect(orphanedBy(index, blocked.cutSeq)).toEqual([]);

    // Шаг 0 выполнен — и та же политика доводит журнал до потолка.
    const withSnapshot = [...index, line(4, 'fs:a.ts', 3, 'snapshot', 80)];
    const plan = planCompaction(withSnapshot, { now: 10, policy: small });

    expect(plan.removed).toBe(3);
    expect(plan.keptBytes).toBeLessThanOrEqual(small.maxBytes);
    expect(plan.retainedOverBudget).toBe(false);
    expect(orphanedBy(withSnapshot, plan.cutSeq)).toEqual([]);
  });

  it('просит снимок и для ресурса, у которого его нет вовсе', () => {
    const index = [line(1, 'fs:a.ts', 0, 'snapshot', 10), line(2, 'fs:b.ts', 1, 'entry', 10)];

    // Инвариант нарушен и без всякого удаления: у `b` нет основания. План обязан это назвать,
    // а не промолчать на том основании, что резать он ничего не собирался.
    expect(planCompaction(index, { now: 10, policy: small }).needSnapshot).toEqual(['fs:b.ts']);
  });

  it('объём идёт после возраста: что бы ни оставил возраст, потолок доводит до конца', () => {
    const day = 24 * 60 * 60 * 1000;
    const now = 100 * day;
    const index = [
      line(1, 'fs:a.ts', now - 40 * day, 'snapshot', 40),
      line(2, 'fs:a.ts', now - 40 * day, 'entry', 40),
      line(3, 'fs:a.ts', now, 'snapshot', 40),
      line(4, 'fs:a.ts', now, 'entry', 40),
      line(5, 'fs:a.ts', now, 'entry', 40),
    ];

    const plan = planCompaction(index, { now, policy: journalPolicy({ maxBytes: 100 }) });

    // Возраст срезал бы только записи 1 и 2 — осталось бы 120 байт при потолке в 100.
    // Объём идёт следом и снимает ещё одну; глубже мешает снимок (3), поэтому уборка
    // останавливается на нём и честно сообщает о перерасходе, заказав свежий снимок.
    expect(plan.removed).toBe(2);
    expect(plan.needSnapshot).toEqual(['fs:a.ts']);
    expect(orphanedBy(index, plan.cutSeq)).toEqual([]);

    const withSnapshot = [...index, line(6, 'fs:a.ts', now, 'snapshot', 40)];
    const second = planCompaction(withSnapshot, { now, policy: journalPolicy({ maxBytes: 100 }) });

    expect(second.keptBytes).toBeLessThanOrEqual(100);
    expect(second.retainedOverBudget).toBe(false);
    expect(orphanedBy(withSnapshot, second.cutSeq)).toEqual([]);
  });
});
