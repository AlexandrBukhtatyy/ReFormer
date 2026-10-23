import { describe, expect, it } from 'vitest';
import { createTurnWrites } from './turn-writes';
import { createFileJournal } from '@reformer/builder-toolkit';
import { createFakeFiles } from '../testing';

const MARK = { origin: 'agent' as const, txId: 'turn-1' };
const writer = { readOnly: false };

describe('дверь записи хода', () => {
  it('пишет с пометкой хода, помнит «до» первой записи и отдаёт строку журнала', async () => {
    const files = createFakeFiles({ 'notes.md': 'one\n' });
    const writes = createTurnWrites({ files, mark: MARK, refuse: () => null });

    const first = await writes.write('notes.md', 'one\ntwo\n', writer);
    await writes.write('notes.md', 'one\ntwo\nthree\n', writer);

    expect(first).toEqual({
      ok: true,
      op: { kind: 'update', ref: 'notes.md', summary: 'notes.md (+1 −0)' },
    });
    expect(files.writes.map((w) => w.mark)).toEqual([MARK, MARK]);
    expect(writes.entries().get('notes.md')).toEqual({
      before: 'one\n',
      after: 'one\ntwo\nthree\n',
    });
    expect(writes.count).toBe(2);
  });

  it('новый файл — «до» нет, операция add', async () => {
    const files = createFakeFiles();
    const writes = createTurnWrites({ files, mark: MARK, refuse: () => null });
    const result = await writes.write('docs/new.md', '# new', writer);
    expect(result.ok && result.op.kind).toBe('add');
    expect(writes.entries().get('docs/new.md')?.before).toBeNull();
  });

  it('файл модуля учитывается в журнале хода, а не в своей карте', async () => {
    const files = createFakeFiles({ 'forms/loan/validation/x.ts': 'a' });
    const journal = createFileJournal();
    const writes = createTurnWrites({
      files,
      mark: MARK,
      refuse: () => null,
      module: {
        journal,
        relOf: (id) => (id.startsWith('forms/loan/') ? id.slice('forms/loan/'.length) : null),
      },
    });
    await writes.write('forms/loan/validation/x.ts', 'b', writer);
    await writes.write('docs/outside.md', 'c', writer);

    expect(journal.get('forms/loan/validation/x.ts')).toEqual({
      rel: 'validation/x.ts',
      before: 'a',
      after: 'b',
    });
    expect([...writes.entries().keys()]).toEqual(['docs/outside.md']);
  });

  it('отказы: только читающему, по правилу хода, без порта, после конца хода', async () => {
    const files = createFakeFiles();
    const writes = createTurnWrites({
      files,
      mark: MARK,
      refuse: (id) => (id === 'form.json' ? 'form is busy' : null),
    });
    expect(await writes.write('a.md', 'x', { readOnly: true })).toMatchObject({
      ok: false,
      code: 'read-only',
    });
    expect(await writes.write('form.json', 'x', writer)).toEqual({
      ok: false,
      code: 'refused',
      message: 'form is busy',
    });
    const portless = createTurnWrites({ files: undefined, mark: MARK, refuse: () => null });
    expect(await portless.write('a.md', 'x', writer)).toMatchObject({ code: 'unavailable' });

    writes.close();
    expect(await writes.write('a.md', 'x', writer)).toMatchObject({ code: 'turn-ended' });
    expect(files.writes).toEqual([]);
  });

  it('сбой записи — отказ failed, файл не учитывается', async () => {
    const files = createFakeFiles();
    files.failWrites(new Error('диск полон'));
    const writes = createTurnWrites({ files, mark: MARK, refuse: () => null });
    expect(await writes.write('a.md', 'x', writer)).toEqual({
      ok: false,
      code: 'failed',
      message: 'диск полон',
    });
    expect(writes.count).toBe(0);
  });

  it('параллельные записи одного файла идут по очереди: «до» — исходный текст', async () => {
    const files = createFakeFiles({ 'a.md': 'zero' });
    const writes = createTurnWrites({ files, mark: MARK, refuse: () => null });
    await Promise.all([writes.write('a.md', 'one', writer), writes.write('a.md', 'two', writer)]);
    expect(writes.entries().get('a.md')).toEqual({ before: 'zero', after: 'two' });
  });
});
