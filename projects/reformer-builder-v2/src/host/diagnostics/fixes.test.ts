import { describe, expect, it, vi } from 'vitest';

import { usableFixes, withUsableFixes } from './fixes';
import type { Diagnostic, QuickFix } from './types';

const REPLACE: QuickFix = {
  titleKey: 'quickfix.replace-component',
  commandId: 'schema.set-component',
  args: { nodeId: 'ab12cd34', name: 'Input' },
};

const REMOVE: QuickFix = {
  titleKey: 'quickfix.remove-orphan-rule',
  commandId: 'rules.remove',
  args: { list: 'validation', index: 0 },
};

function finding(fixes?: readonly QuickFix[]): Diagnostic {
  return {
    source: 'validator.schema',
    severity: 'error',
    code: 'schema.unknown-component',
    target: { kind: 'node', nodeId: 'ab12cd34' },
    ...(fixes === undefined ? {} : { fixes }),
  };
}

/** Реестр, в котором есть перечисленные команды и больше ничего. */
const registry =
  (...ids: readonly string[]) =>
  (id: string): boolean =>
    ids.includes(id);

const none = (): boolean => false;
const all = (): boolean => true;

describe('исправление предлагается, только если команде есть чем исполниться', () => {
  it('команда есть — исправление остаётся', () => {
    expect(usableFixes(finding([REPLACE]), registry(REPLACE.commandId))).toEqual([REPLACE]);
  });

  it('команды нет — исправления нет: кнопка, которая ничего не делает, хуже её отсутствия', () => {
    expect(usableFixes(finding([REPLACE]), none)).toEqual([]);
  });

  it('отбор поштучный: исполнимое остаётся, когда рядом неисполнимое', () => {
    expect(usableFixes(finding([REPLACE, REMOVE]), registry(REMOVE.commandId))).toEqual([REMOVE]);
  });

  it('находка без исправлений отвечает пустым списком, а не падает', () => {
    expect(usableFixes(finding(), none)).toEqual([]);
  });

  it('применимость НЕ спрашивается: «команды нет» и «сейчас недоступна» — разные ответы', () => {
    // Реестр отвечает «команда есть» — этого достаточно. Доступна ли она в текущем контексте,
    // решается в момент вызова, там же, где у человека: иначе исправление пропадало бы
    // с экрана из-за того, что фокус стоит не в том месте.
    const lookup = vi.fn(() => true);
    expect(usableFixes(finding([REPLACE]), lookup)).toEqual([REPLACE]);
    expect(lookup).toHaveBeenCalledExactlyOnceWith(REPLACE.commandId);
  });
});

describe('отброшенное не исчезает бесследно', () => {
  it('о каждом неисполнимом исправлении узнаёт вызывающий', () => {
    const onUnavailable = vi.fn();
    const item = finding([REPLACE, REMOVE]);

    usableFixes(item, registry(REMOVE.commandId), { onUnavailable });

    expect(onUnavailable).toHaveBeenCalledExactlyOnceWith(REPLACE, item);
  });

  it('исполнимое о себе не сообщает', () => {
    const onUnavailable = vi.fn();
    usableFixes(finding([REPLACE]), all, { onUnavailable });
    expect(onUnavailable).not.toHaveBeenCalled();
  });
});

describe('ссылки сохраняются: свод читают из отрисовки', () => {
  it('ничего не отброшено — та же ссылка на список исправлений', () => {
    const item = finding([REPLACE]);
    expect(usableFixes(item, all)).toBe(item.fixes);
  });

  it('ничего не отброшено — та же ссылка на весь свод', () => {
    const items = [finding([REPLACE]), finding()];
    expect(withUsableFixes(items, all)).toBe(items);
  });

  it('свод без исправлений вовсе не пересобирается', () => {
    const items = [finding(), finding()];
    expect(withUsableFixes(items, none)).toBe(items);
  });

  it('запись, которой отбор не коснулся, остаётся собой внутри пересобранного свода', () => {
    const kept = finding([REMOVE]);
    const stripped = finding([REPLACE]);

    const out = withUsableFixes([kept, stripped], registry(REMOVE.commandId));

    expect(out[0]).toBe(kept);
    expect(out[1]).not.toBe(stripped);
  });
});

describe('свод после отбора', () => {
  it('пустое поле не заводится: находка без исполнимых исправлений теряет `fixes` целиком', () => {
    const [item] = withUsableFixes([finding([REPLACE])], none);
    expect('fixes' in item).toBe(false);
  });

  it('остальные поля записи не теряются', () => {
    const [item] = withUsableFixes([{ ...finding([REPLACE]), params: { name: 'Inpt' } }], none);
    expect(item).toEqual({
      source: 'validator.schema',
      severity: 'error',
      code: 'schema.unknown-component',
      params: { name: 'Inpt' },
      target: { kind: 'node', nodeId: 'ab12cd34' },
    });
  });

  it('о неисполнимых в своде сообщается по одному разу на исправление', () => {
    const onUnavailable = vi.fn();
    withUsableFixes([finding([REPLACE]), finding([REPLACE, REMOVE])], none, { onUnavailable });
    expect(onUnavailable).toHaveBeenCalledTimes(3);
  });
});
