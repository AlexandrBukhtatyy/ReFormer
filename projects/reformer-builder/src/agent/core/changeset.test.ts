import { describe, expect, it } from 'vitest';
import { emptySchema } from '../../model';
import { sampleSchema } from '../../model/__fixtures__/sample-schema';
import { createChangeSet, describeChangeSet, hasChanges, withOutcome } from './changeset';
import type { ToolOutcome } from './types';

const write = (summary: string): ToolOutcome => ({
  ok: true,
  text: 'ok',
  schema: emptySchema(),
  ops: [{ kind: 'add', ref: '/root/children/0', summary }],
});

describe('ChangeSet', () => {
  it('новый набор изменений пуст', () => {
    const set = createChangeSet(sampleSchema());
    expect(hasChanges(set)).toBe(false);
    expect(set.ops).toEqual([]);
  });

  it('read-only результат набор не меняет', () => {
    const set = withOutcome(createChangeSet(sampleSchema()), { ok: true, text: 'карта формы' });
    expect(hasChanges(set)).toBe(false);
    expect(set.ops).toHaveLength(0);
  });

  it('ошибка набор не меняет — журнал описывает только случившееся', () => {
    const set = withOutcome(createChangeSet(sampleSchema()), {
      ok: false,
      text: 'нет такого компонента',
      error: { code: 'UNKNOWN_COMPONENT', message: 'нет' },
    });
    expect(hasChanges(set)).toBe(false);
    expect(set.ops).toHaveLength(0);
  });

  it('успешная запись двигает черновик и копит операции; база не меняется', () => {
    const base = sampleSchema();
    let set = createChangeSet(base);
    set = withOutcome(set, write('Email (Input)'));
    set = withOutcome(set, write('Телефон (Input)'));
    expect(hasChanges(set)).toBe(true);
    expect(set.base).toBe(base);
    expect(set.ops).toHaveLength(2);
  });

  it('описание набора помечает вид каждой операции', () => {
    let set = createChangeSet(sampleSchema());
    set = withOutcome(set, write('Email (Input)'));
    set = withOutcome(set, {
      ...write('Email → required = true'),
      ops: [{ kind: 'update', ref: '/root/children/0', summary: 'Email → required = true' }],
    });
    set = withOutcome(set, {
      ...write('Телефон'),
      ops: [{ kind: 'remove', ref: '/root/children/1', summary: 'Телефон' }],
    });
    expect(describeChangeSet(set)).toEqual([
      '+ Email (Input)',
      '~ Email → required = true',
      '− Телефон',
    ]);
  });

  it('пакетная правка кладёт в журнал строку на каждый узел, а не на вызов', () => {
    // Предпросмотр — это то, по чему пользователь решает, применять ли ход. Свёрнутое «добавлено
    // 12 полей» одной строкой ни проверить, ни осмысленно отменить нельзя.
    const set = withOutcome(createChangeSet(sampleSchema()), {
      ok: true,
      text: 'ok',
      schema: emptySchema(),
      ops: [
        { kind: 'add', ref: '/root/children/0', summary: 'Имя (Input)' },
        { kind: 'add', ref: '/root/children/1', summary: 'Email (Input)' },
      ],
    });
    expect(describeChangeSet(set)).toEqual(['+ Имя (Input)', '+ Email (Input)']);
  });
});
