/**
 * Тесты выбора провайдера модели.
 *
 * Проверяется не «функция вернула объект», а два свойства, которые при наивной реализации
 * ломаются молча: провайдер выбирается ПО ПОРЯДКУ вкладов (а не по случайности регистрации),
 * и один упавший провайдер не делает файл неоткрываемым.
 *
 * @module host/workspace/model/provider.test
 */

import { describe, expect, it, vi } from 'vitest';

import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import {
  makeResourceId,
  mediaTypeFor,
  type ResourceRef,
} from '@/shell/platform/primitives/resource';
import {
  createEditorProbe,
  DocumentModelPoint,
  isSyncEditorProbe,
  resolveModelProvider,
  type DocumentModelProvider,
} from './provider';
import { createLinesProvider } from './testing';

function refOf(path: string): ResourceRef {
  return {
    id: makeResourceId('mem', path),
    sourceId: 'mem',
    path,
    name: path.slice(path.lastIndexOf('/') + 1),
    kind: 'file',
    mediaType: mediaTypeFor(path),
  };
}

/** Провайдер, который берётся за всё и ничего не умеет: нужен только для выбора. */
function stubProvider(id: string, applies: boolean): DocumentModelProvider<unknown> {
  return {
    id,
    applies: () => applies,
    parse: (text) => text,
    print: (model) => String(model),
    apply: (model) => ({ model, inverse: { type: 'noop' } }),
  };
}

describe('проба содержимого', () => {
  it('отдаёт один и тот же текст синхронно и промисом', async () => {
    const probe = createEditorProbe('n1 alpha');

    expect(probe.peek()).toBe('n1 alpha');
    await expect(probe.text()).resolves.toBe('n1 alpha');
  });

  it('переиспользует один промис на всех кандидатов', () => {
    const probe = createEditorProbe('n1 alpha');

    // Не оптимизация: `text()` спрашивает каждый кандидат, и новая работа на каждого — это
    // ровно то, ради отсутствия чего проба и существует.
    expect(probe.text()).toBe(probe.text());
  });
});

describe('выбор провайдера', () => {
  it('без вкладов не находит никого — документ останется текстовым', () => {
    const registry = createExtensionRegistry();

    const provider = resolveModelProvider(registry, refOf('form.lines'), createEditorProbe(''));

    expect(provider).toBeUndefined();
  });

  it('берёт того, кто вызвался на этот ресурс', () => {
    const registry = createExtensionRegistry();
    registry.forPlugin('lines').contribute(DocumentModelPoint, createLinesProvider());

    expect(resolveModelProvider(registry, refOf('form.lines'), createEditorProbe(''))?.id).toBe(
      'test.lines'
    );
    expect(
      resolveModelProvider(registry, refOf('readme.md'), createEditorProbe(''))
    ).toBeUndefined();
  });

  it('при нескольких кандидатах побеждает меньший order, а не порядок регистрации', () => {
    const registry = createExtensionRegistry();
    const view = registry.forPlugin('p');
    view.contribute(DocumentModelPoint, stubProvider('общий', true), { order: 10 });
    view.contribute(DocumentModelPoint, stubProvider('точный', true), { order: 1 });

    expect(resolveModelProvider(registry, refOf('a.json'), createEditorProbe(''))?.id).toBe(
      'точный'
    );
  });

  it('упавший applies пропускается, а не срывает открытие файла', () => {
    const registry = createExtensionRegistry();
    const view = registry.forPlugin('p');
    const broken: DocumentModelProvider<unknown> = {
      ...stubProvider('битый', true),
      applies: () => {
        throw new Error('плагин сломан');
      },
    };
    view.contribute(DocumentModelPoint, broken, { order: 1 });
    view.contribute(DocumentModelPoint, stubProvider('целый', true), { order: 2 });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const provider = resolveModelProvider(registry, refOf('a.json'), createEditorProbe(''));

    expect(provider?.id).toBe('целый');
    // Молчать нельзя: иначе плагин ломается, а видно это только по тому, что «не тот редактор».
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it('провайдер получает ссылку на ресурс и пробу с содержимым', () => {
    const registry = createExtensionRegistry();
    const seen: { ref: ResourceRef; text: string }[] = [];
    registry.forPlugin('p').contribute(DocumentModelPoint, {
      ...stubProvider('пробующий', true),
      applies: (ref, probe) => {
        // Синхронный `applies` и асинхронная `probe.text()` уживаются только так: проба
        // над уже прочитанным текстом отдаёт его без промиса.
        seen.push({ ref, text: isSyncEditorProbe(probe) ? probe.peek() : '' });
        return true;
      },
    });
    const ref = refOf('form.lines');

    resolveModelProvider(registry, ref, createEditorProbe('n1 alpha'));

    expect(seen).toEqual([{ ref, text: 'n1 alpha' }]);
  });
});
