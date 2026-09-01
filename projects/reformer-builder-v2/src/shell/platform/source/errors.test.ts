/**
 * Тесты отказов источника.
 *
 * Проверяется не «класс создаётся», а два свойства, без которых отказы бесполезны:
 * распознавание СТРУКТУРНОЕ (чужая реализация контракта распознаётся так же, как своя)
 * и совпадающее с тем, что уже написал потребитель — Workspace, сделанный раньше источника.
 * Разойдись эти две проверки, и один и тот же отказ обрабатывался бы по-разному на разных
 * этажах: самая тихая из возможных поломок.
 *
 * @module host/source/errors.test
 */

import { describe, expect, it } from 'vitest';

import {
  conflictRevision as consumerConflictRevision,
  isSourceError as consumerRecognizes,
} from '../workspace/source';
import { TestSourceError } from '../workspace/testing';
import { SourceError, conflictRevision, isSourceError, sourcePath, unsupported } from './errors';
import type { SourceErrorKind } from './errors';

const ALL_KINDS: readonly SourceErrorKind[] = [
  'not-found',
  'conflict',
  'unauthorized',
  'forbidden',
  'unsupported',
  'budget',
  'network',
  'aborted',
];

describe('SourceError', () => {
  it('несёт вид, путь и сообщение человеку', () => {
    const error = new SourceError('not-found', 'нет ресурса a.json', { path: 'a.json' });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('SourceError');
    expect(error.kind).toBe('not-found');
    expect(error.path).toBe('a.json');
    expect(error.message).toBe('нет ресурса a.json');
  });

  it('конфликт несёт текущую ревизию источника', () => {
    const error = new SourceError('conflict', 'разошлись', { path: 'a.json', revision: 'r7' });

    expect(conflictRevision(error)).toBe('r7');
    // У отказа другого вида ревизии конфликта нет по определению.
    expect(conflictRevision(new SourceError('network', 'сеть'))).toBeUndefined();
  });

  it('сохраняет причину, когда отказ переведён из чужой ошибки', () => {
    const cause = new Error('NotFoundError');
    const error = new SourceError('not-found', 'нет', { cause });

    expect(error.cause).toBe(cause);
  });
});

describe('isSourceError', () => {
  it('распознаёт все виды', () => {
    for (const kind of ALL_KINDS) {
      const error = new SourceError(kind, kind);
      expect(isSourceError(error)).toBe(true);
      expect(isSourceError(error, kind)).toBe(true);
    }
  });

  it('отличает вид от вида', () => {
    expect(isSourceError(new SourceError('network', 'сеть'), 'not-found')).toBe(false);
  });

  it('распознаёт ЧУЖУЮ реализацию контракта, а не только свой класс', () => {
    // Двойник Workspace написан раньше источника и не наследует SourceError вовсе.
    const alien = new TestSourceError('conflict', 'разошлись', { revision: 'r3' });

    expect(isSourceError(alien, 'conflict')).toBe(true);
    expect(conflictRevision(alien)).toBe('r3');
  });

  it('не принимает за отказ ни обычную ошибку, ни объект без прототипа ошибки', () => {
    expect(isSourceError(new Error('просто ошибка'))).toBe(false);
    expect(isSourceError({ kind: 'not-found', message: 'подделка' })).toBe(false);
    expect(isSourceError(null)).toBe(false);
    expect(isSourceError('not-found')).toBe(false);
  });

  it('не принимает ошибку с посторонним значением в поле kind', () => {
    const error = Object.assign(new Error('чужое'), { kind: 'teapot' });

    expect(isSourceError(error)).toBe(false);
  });
});

describe('совместимость с потребителем', () => {
  it('Workspace распознаёт отказы источника, а источник — отказы его двойника', () => {
    for (const kind of ALL_KINDS) {
      const mine = new SourceError(kind, kind);
      const theirs = new TestSourceError(kind, kind);

      expect(consumerRecognizes(mine, kind)).toBe(true);
      expect(isSourceError(theirs, kind)).toBe(true);
    }
  });

  it('ревизия конфликта читается обеими сторонами одинаково', () => {
    const error = new SourceError('conflict', 'разошлись', { revision: 'r9' });

    expect(consumerConflictRevision(error)).toBe('r9');
    expect(conflictRevision(error)).toBe('r9');
  });
});

describe('sourcePath', () => {
  it('нормализует путь правилами ядра', () => {
    expect(sourcePath('./src/../a.json')).toBe('a.json');
    expect(sourcePath('/src/forms/')).toBe('src/forms');
    expect(sourcePath('')).toBe('');
  });

  it('побег за корень — типизированный отказ, а не голая ошибка', () => {
    const error = (() => {
      try {
        sourcePath('../../etc/hosts');
        return null;
      } catch (err) {
        return err;
      }
    })();

    expect(isSourceError(error, 'forbidden')).toBe(true);
    expect((error as SourceError).path).toBe('../../etc/hosts');
    expect((error as SourceError).cause).toBeInstanceOf(Error);
  });
});

describe('unsupported', () => {
  it('делает отказ «не умею» с названием операции', () => {
    const error = unsupported('запись', 'a.json');

    expect(isSourceError(error, 'unsupported')).toBe(true);
    expect(error.message).toContain('запись');
    expect(error.path).toBe('a.json');
  });
});
