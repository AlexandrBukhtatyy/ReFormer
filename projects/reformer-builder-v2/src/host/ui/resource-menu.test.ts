import { describe, expect, it } from 'vitest';

import { makeResourceId, mediaTypeFor, type ResourceRef } from '../primitives/resource';
import { whenContext } from '../primitives/when-context';
import {
  argsOfResource,
  asResourceTarget,
  parentIdOf,
  resourceMenuTarget,
  selectedIds,
  whenResource,
} from './resource-menu';

const ROOT = makeResourceId('fs', '');

function ref(path: string, kind: 'file' | 'directory' = 'file'): ResourceRef {
  return {
    id: makeResourceId('fs', path),
    sourceId: 'fs',
    path,
    name: path.slice(path.lastIndexOf('/') + 1),
    kind,
    mediaType: kind === 'directory' ? 'inode/directory' : mediaTypeFor(path),
  };
}

describe('цель щелчка', () => {
  it('щелчок по каталогу действует ВНУТРЬ него', () => {
    const target = resourceMenuTarget(ref('src/forms', 'directory'), [], ROOT);

    expect(target.dir).toBe(makeResourceId('fs', 'src/forms'));
  });

  it('щелчок по файлу действует в его каталоге, а не внутрь файла', () => {
    const target = resourceMenuTarget(ref('src/forms/schema.json'), [], ROOT);

    expect(target.dir).toBe(makeResourceId('fs', 'src/forms'));
  });

  it('файл в корне источника действует в корне показа', () => {
    const target = resourceMenuTarget(ref('package.json'), [], ROOT);

    expect(target.dir).toBe(ROOT);
  });

  it('щелчок мимо строк действует в корне: «Новый файл…» там осмысленен', () => {
    const target = resourceMenuTarget(null, [], ROOT);

    expect(target.dir).toBe(ROOT);
    expect(target.ref).toBeNull();
  });
});

describe('родитель ресурса', () => {
  it('считается по пути', () => {
    expect(parentIdOf(ref('src/forms/schema.json'))).toBe(makeResourceId('fs', 'src/forms'));
  });

  it('у ресурса верхнего уровня родитель — корень источника, а не пустота', () => {
    expect(parentIdOf(ref('package.json'))).toBe(ROOT);
  });

  it('у самого корня родителя нет ни в каком смысле', () => {
    expect(parentIdOf(ref('', 'directory'))).toBeNull();
  });
});

describe('сужение цели', () => {
  it('цель дерева распознаётся', () => {
    const target = resourceMenuTarget(ref('a.ts'), [ref('a.ts')], ROOT);

    expect(asResourceTarget(target)).toBe(target);
  });

  it('чужая цель и отсутствие цели дают null', () => {
    expect(asResourceTarget(undefined)).toBeNull();
    expect(asResourceTarget({ nodeId: 'root.children.0' })).toBeNull();
  });
});

describe('помощники вкладов', () => {
  it('предикат видит цель и не рисует пункт над чужой поверхностью', () => {
    const when = whenResource((target) => target.ref?.kind === 'file');

    expect(when(whenContext(), resourceMenuTarget(ref('a.ts'), [], ROOT))).toBe(true);
    expect(when(whenContext(), resourceMenuTarget(ref('src', 'directory'), [], ROOT))).toBe(false);
    // Пункт внесли в меню, у которого другая цель, — показывать его нельзя.
    expect(when(whenContext(), undefined)).toBe(false);
  });

  it('аргументы считаются по цели, а для чужой цели их нет вовсе', () => {
    const args = argsOfResource((target) => ({ ids: selectedIds(target) }));
    const target = resourceMenuTarget(ref('a.ts'), [ref('a.ts'), ref('b.ts')], ROOT);

    expect(args(target)).toEqual({ ids: ['fs:a.ts', 'fs:b.ts'] });
    expect(args(undefined)).toBeUndefined();
  });
});
