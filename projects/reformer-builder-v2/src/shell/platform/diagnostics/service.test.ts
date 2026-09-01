import { describe, expect, it, vi } from 'vitest';

import { makeResourceId } from '../primitives/resource';
import { createDiagnosticsService } from './service';
import type { Diagnostic } from './types';

const schema = makeResourceId('fs', 'src/forms/credit/schema.json');
const other = makeResourceId('fs', 'src/forms/credit/validation.ts');

function nodeError(source: string, code: string, nodeId = 'ab12cd34'): Diagnostic {
  return { source, severity: 'error', code, target: { kind: 'node', nodeId } };
}

const codes = (items: readonly Diagnostic[]): string[] => items.map((item) => item.code);

describe('publish замещает результаты источника, а не добавляет', () => {
  it('вторая публикация того же источника вытесняет первую', () => {
    const diagnostics = createDiagnosticsService();
    diagnostics.publish(schema, 'schema', [
      nodeError('schema', 'component-not-registered'),
      nodeError('schema', 'duplicate-field-name'),
    ]);

    diagnostics.publish(schema, 'schema', [nodeError('schema', 'duplicate-field-name')]);

    expect(codes(diagnostics.get(schema))).toEqual(['duplicate-field-name']);
  });

  it('исправленная ошибка уходит: пустая публикация снимает всё, что было', () => {
    const diagnostics = createDiagnosticsService();
    diagnostics.publish(schema, 'schema', [nodeError('schema', 'component-not-registered')]);

    diagnostics.publish(schema, 'schema', []);

    expect(diagnostics.get(schema)).toEqual([]);
  });

  it('разные источники сосуществуют и снимаются независимо', () => {
    const diagnostics = createDiagnosticsService();
    diagnostics.publish(schema, 'schema', [nodeError('schema', 'component-not-registered')]);
    diagnostics.publish(schema, 'rules', [nodeError('rules', 'unknown-target')]);

    // Порядок — по имени источника: «rules» раньше «schema».
    expect(codes(diagnostics.get(schema))).toEqual(['unknown-target', 'component-not-registered']);

    diagnostics.publish(schema, 'schema', []);

    expect(codes(diagnostics.get(schema))).toEqual(['unknown-target']);
  });

  it('ресурсы не смешиваются', () => {
    const diagnostics = createDiagnosticsService();
    diagnostics.publish(schema, 'schema', [nodeError('schema', 'component-not-registered')]);
    diagnostics.publish(other, 'types', [nodeError('types', 'type-mismatch')]);

    expect(codes(diagnostics.get(schema))).toEqual(['component-not-registered']);
    expect(codes(diagnostics.get(other))).toEqual(['type-mismatch']);
  });

  it('запись, опубликованная не от своего имени, — ошибка', () => {
    const diagnostics = createDiagnosticsService();

    expect(() =>
      diagnostics.publish(schema, 'schema', [nodeError('rules', 'unknown-target')])
    ).toThrow(/источника/);
  });

  it('список валидатора копируется: его переиспользование не меняет свод', () => {
    const diagnostics = createDiagnosticsService();
    const items: Diagnostic[] = [nodeError('schema', 'component-not-registered')];
    diagnostics.publish(schema, 'schema', items);

    items.push(nodeError('schema', 'duplicate-field-name'));

    expect(codes(diagnostics.get(schema))).toEqual(['component-not-registered']);
  });
});

describe('get отдаёт стабильный снимок', () => {
  it('повторный вызов без изменений даёт ту же ссылку', () => {
    const diagnostics = createDiagnosticsService();
    diagnostics.publish(schema, 'schema', [nodeError('schema', 'component-not-registered')]);

    expect(diagnostics.get(schema)).toBe(diagnostics.get(schema));
  });

  it('чистые ресурсы делят одну пустую ссылку', () => {
    const diagnostics = createDiagnosticsService();

    expect(diagnostics.get(schema)).toBe(diagnostics.get(other));
  });

  it('снятие последней записи возвращает ресурс к общей пустой ссылке', () => {
    const diagnostics = createDiagnosticsService();
    diagnostics.publish(schema, 'schema', [nodeError('schema', 'component-not-registered')]);

    diagnostics.publish(schema, 'schema', []);

    expect(diagnostics.get(schema)).toBe(diagnostics.get(other));
  });

  it('публикация обновляет ссылку — иначе подписчик не увидел бы изменения', () => {
    const diagnostics = createDiagnosticsService();
    diagnostics.publish(schema, 'schema', [nodeError('schema', 'component-not-registered')]);
    const before = diagnostics.get(schema);

    diagnostics.publish(schema, 'rules', [nodeError('rules', 'unknown-target')]);

    expect(diagnostics.get(schema)).not.toBe(before);
  });

  it('порядок источников алфавитный, внутри источника — порядок публикации', () => {
    const diagnostics = createDiagnosticsService();
    diagnostics.publish(schema, 'rules', [
      nodeError('rules', 'unknown-target'),
      nodeError('rules', 'cycle'),
    ]);
    diagnostics.publish(schema, 'schema', [nodeError('schema', 'component-not-registered')]);

    expect(codes(diagnostics.get(schema))).toEqual([
      'unknown-target',
      'cycle',
      'component-not-registered',
    ]);
  });

  it('снимок заморожен: свод не правится в обход службы', () => {
    const diagnostics = createDiagnosticsService();
    diagnostics.publish(schema, 'schema', [nodeError('schema', 'component-not-registered')]);

    expect(Object.isFrozen(diagnostics.get(schema))).toBe(true);
  });
});

describe('onDidChange сообщает, какой ресурс изменился', () => {
  it('уведомляет ресурсом публикации', () => {
    const diagnostics = createDiagnosticsService();
    const seen: string[] = [];
    diagnostics.onDidChange((resource) => seen.push(resource));

    diagnostics.publish(schema, 'schema', [nodeError('schema', 'component-not-registered')]);
    diagnostics.publish(other, 'types', [nodeError('types', 'type-mismatch')]);

    expect(seen).toEqual([schema, other]);
  });

  it('снятие записей — тоже изменение', () => {
    const diagnostics = createDiagnosticsService();
    diagnostics.publish(schema, 'schema', [nodeError('schema', 'component-not-registered')]);
    const cb = vi.fn();
    diagnostics.onDidChange(cb);

    diagnostics.publish(schema, 'schema', []);

    expect(cb).toHaveBeenCalledWith(schema);
  });

  it('чистый результат по чистому источнику не уведомляет', () => {
    const diagnostics = createDiagnosticsService();
    const cb = vi.fn();
    diagnostics.onDidChange(cb);

    // Валидатор ходит на каждой правке и почти всегда ничего не находит.
    diagnostics.publish(schema, 'schema', []);
    diagnostics.publish(schema, 'schema', []);

    expect(cb).not.toHaveBeenCalled();
  });

  it('dispose снимает подписку', () => {
    const diagnostics = createDiagnosticsService();
    const cb = vi.fn();
    diagnostics.onDidChange(cb).dispose();

    diagnostics.publish(schema, 'schema', [nodeError('schema', 'component-not-registered')]);

    expect(cb).not.toHaveBeenCalled();
  });
});

describe('цель диагностики — одна', () => {
  it('синтаксическая ошибка адресуется диапазоном, структурная — узлом', () => {
    const diagnostics = createDiagnosticsService();
    diagnostics.publish(schema, 'json', [
      {
        source: 'json',
        severity: 'error',
        code: 'parse-error',
        target: { kind: 'range', range: { start: 12, end: 13 } },
      },
    ]);
    diagnostics.publish(schema, 'schema', [nodeError('schema', 'component-not-registered')]);

    const targets = diagnostics.get(schema).map((item) => item.target.kind);

    // «json» раньше «schema» по алфавиту — отсюда порядок.
    expect(targets).toEqual(['range', 'node']);
  });
});

describe('состав: какие ресурсы вообще что-то нашли', () => {
  it('перечисляет только те, у которых находки есть сейчас', () => {
    const diagnostics = createDiagnosticsService();
    diagnostics.publish(schema, 'schema', [nodeError('schema', 'component-not-registered')]);
    diagnostics.publish(other, 'schema', [nodeError('schema', 'duplicate-field-name')]);

    expect(diagnostics.resources()).toEqual([schema, other].sort());
  });

  it('исправленный ресурс уходит из состава, а не остаётся пустой строкой', () => {
    const diagnostics = createDiagnosticsService();
    diagnostics.publish(schema, 'schema', [nodeError('schema', 'component-not-registered')]);
    diagnostics.publish(other, 'schema', [nodeError('schema', 'duplicate-field-name')]);

    diagnostics.publish(schema, 'schema', []);

    expect(diagnostics.resources()).toEqual([other]);
  });

  it('порядок алфавитный, а не «кто успел раньше»: строка не должна прыгать', () => {
    const diagnostics = createDiagnosticsService();
    const b = makeResourceId('fs', 'b.json');
    const a = makeResourceId('fs', 'a.json');
    diagnostics.publish(b, 'schema', [nodeError('schema', 'x')]);
    diagnostics.publish(a, 'schema', [nodeError('schema', 'y')]);

    expect(diagnostics.resources()).toEqual([a, b]);
  });

  it('между изменениями состава — та же ссылка: снимок читает useSyncExternalStore', () => {
    const diagnostics = createDiagnosticsService();
    diagnostics.publish(schema, 'schema', [nodeError('schema', 'component-not-registered')]);

    const first = diagnostics.resources();
    // Смена находок ВНУТРИ ресурса состава не меняет — значит и снимок обязан остаться тем же.
    diagnostics.publish(schema, 'schema', [nodeError('schema', 'duplicate-field-name')]);

    expect(diagnostics.resources()).toBe(first);
  });

  it('появление нового ресурса ссылку обновляет', () => {
    const diagnostics = createDiagnosticsService();
    diagnostics.publish(schema, 'schema', [nodeError('schema', 'x')]);
    const first = diagnostics.resources();

    diagnostics.publish(other, 'schema', [nodeError('schema', 'y')]);

    expect(diagnostics.resources()).not.toBe(first);
    expect(diagnostics.resources()).toHaveLength(2);
  });

  it('пустой состав — тоже одна ссылка, а не новый массив на каждый вызов', () => {
    const diagnostics = createDiagnosticsService();

    expect(diagnostics.resources()).toBe(diagnostics.resources());
    expect(diagnostics.resources()).toEqual([]);
  });
});
