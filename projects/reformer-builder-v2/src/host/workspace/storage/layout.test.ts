/**
 * Тесты раскладки хранилища.
 *
 * Раскладка — единственная часть слоя, которую можно проверить в `node` целиком, и именно
 * в ней жил дефект v1: плоский каталог на вкладку. Поэтому проверяется не «функция возвращает
 * строку», а три утверждения, на которых держится починка: путь ЗЕРКАЛИТ структуру проекта,
 * из рабочей области нельзя выйти, и разбор обратим.
 *
 * @module host/workspace/storage/layout.test
 */

import { describe, expect, it } from 'vitest';

import { isStorageError } from './errors';
import {
  assertWorkspaceId,
  counterpartLayer,
  counterpartPath,
  historyKey,
  isInsideWorkspace,
  layerRoot,
  openedKey,
  parseStoragePath,
  statKey,
  storagePath,
  workspaceRoot,
} from './layout';

describe('storagePath', () => {
  it('зеркалит структуру проекта, а не кодирует её в имя', () => {
    // Ровно то, чего не умел v1: сосед по каталогу остаётся соседом и в хранилище.
    expect(storagePath('w1', 'files', 'src/forms/credit/schema.json')).toBe(
      'ws/w1/files/src/forms/credit/schema.json'
    );
    expect(storagePath('w1', 'files', 'src/forms/shared/rules.ts')).toBe(
      'ws/w1/files/src/forms/shared/rules.ts'
    );
  });

  it('разводит слои одной рабочей области', () => {
    expect(storagePath('w1', 'base', 'a.ts')).toBe('ws/w1/base/a.ts');
    expect(storagePath('w1', 'files', 'a.ts')).toBe('ws/w1/files/a.ts');
  });

  it('нормализует путь ресурса', () => {
    expect(storagePath('w1', 'files', './src//forms/./a.ts')).toBe('ws/w1/files/src/forms/a.ts');
    expect(storagePath('w1', 'files', '/src/a.ts')).toBe('ws/w1/files/src/a.ts');
  });

  it('пустой путь адресует корень слоя', () => {
    expect(storagePath('w1', 'files', '')).toBe('ws/w1/files');
    expect(storagePath('w1', 'files', '.')).toBe(layerRoot('w1', 'files'));
  });

  it('не выпускает `..` за пределы рабочей области', () => {
    // Склейка с последующей нормализацией дала бы `etc/hosts` — путь вне рабочей области,
    // но внутри корня OPFS, то есть побег, который нормализация целого пути не заметит.
    expect(() => storagePath('w1', 'files', '../../../etc/hosts')).toThrow(/выходит за корень/);
  });

  it('разрешает `..` внутри пути', () => {
    expect(storagePath('w1', 'files', 'src/forms/credit/../shared/rules.ts')).toBe(
      'ws/w1/files/src/forms/shared/rules.ts'
    );
  });
});

describe('assertWorkspaceId', () => {
  it('пропускает обычный идентификатор', () => {
    expect(assertWorkspaceId('w1')).toBe('w1');
    expect(workspaceRoot('local-fs.2026')).toBe('ws/local-fs.2026');
  });

  it.each(['', '.', '..', 'a/b', 'a\\b'])('отвергает %o', (id) => {
    // Кодировать нельзя: `ws%2Fx` и `ws/x` схлопнулись бы при разборе.
    try {
      assertWorkspaceId(id);
      expect.unreachable('ожидался отказ');
    } catch (err) {
      expect(isStorageError(err, 'bad-workspace-id')).toBe(true);
    }
  });
});

describe('parseStoragePath', () => {
  it('обратим для обоих слоёв', () => {
    for (const layer of ['files', 'base'] as const) {
      const path = storagePath('w1', layer, 'src/a.ts');
      expect(parseStoragePath(path)).toEqual({ workspaceId: 'w1', layer, path: 'src/a.ts' });
    }
  });

  it('разбирает корень слоя как пустой путь', () => {
    expect(parseStoragePath('ws/w1/files')).toEqual({
      workspaceId: 'w1',
      layer: 'files',
      path: '',
    });
  });

  it.each(['other/w1/files/a.ts', 'ws/w1', 'ws/w1/tmp/a.ts', ''])(
    'возвращает null для чужого пути %o',
    (path) => {
      // Не бросает: разбор применяется к тому, что нашлось в OPFS, и чужой каталог — норма.
      expect(parseStoragePath(path)).toBeNull();
    }
  );
});

describe('пара files/base', () => {
  it('меняет слой местами', () => {
    expect(counterpartLayer('files')).toBe('base');
    expect(counterpartLayer('base')).toBe('files');
  });

  it('переводит путь в соседний слой — по нему идёт вытеснение парой', () => {
    expect(counterpartPath('ws/w1/files/src/a.ts')).toBe('ws/w1/base/src/a.ts');
    expect(counterpartPath('ws/w1/base/src/a.ts')).toBe('ws/w1/files/src/a.ts');
  });

  it('возвращает null для пути вне рабочей области', () => {
    expect(counterpartPath('tmp/a.ts')).toBeNull();
  });
});

describe('isInsideWorkspace', () => {
  it('различает свою область и соседнюю', () => {
    expect(isInsideWorkspace('ws/w1/files/a.ts', 'w1')).toBe(true);
    expect(isInsideWorkspace('ws/w1', 'w1')).toBe(true);
    expect(isInsideWorkspace('ws/w10/files/a.ts', 'w1')).toBe(false);
    expect(isInsideWorkspace('ws/w2/files/a.ts', 'w1')).toBe(false);
  });
});

describe('ключи IndexedDB', () => {
  it('нормализуют путь: два написания одного файла — одна запись', () => {
    expect(statKey('w1', './src//a.ts')).toEqual(statKey('w1', 'src/a.ts'));
    expect(statKey('w1', 'src/a.ts')).toEqual(['w1', 'src/a.ts']);
  });

  it('идентификатор ресурса кладут как есть — он непрозрачен', () => {
    expect(openedKey('w1', 'fs:src/a.ts')).toEqual(['w1', 'fs:src/a.ts']);
  });

  it('журнальный ключ упорядочивается по seq в пределах ресурса', () => {
    expect(historyKey('w1', 'fs:a.ts', 7)).toEqual(['w1', 'fs:a.ts', 7]);
  });

  it('отвергают негодный идентификатор области так же, как пути', () => {
    expect(() => statKey('a/b', 'x.ts')).toThrow();
    expect(() => openedKey('', 'fs:x.ts')).toThrow();
  });
});
