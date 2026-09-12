/**
 * Порт превью: соседи документа, правки файлов, пространство имён кита.
 *
 * Жизненного цикла состояний здесь больше нет — он переехал к владельцу состояний,
 * в плагин (`plugins/preview/state/lifecycle`), вместе со своими тестами.
 *
 * @module shell/boot/ports/preview.test
 */

import { describe, expect, it } from 'vitest';
import type { Disposable } from '@/shell/platform/primitives/disposable';
import type { ResourceId, ResourceRef } from '@/shell/platform/primitives/resource';
import { createServiceRegistry } from '@/shell/platform/primitives/service';
import { createI18nService } from '@/shell/platform/services/i18n/i18n';
import type { ProjectHost } from '@/shell/boot/project/project';
import { createPreviewHost } from './preview';

describe('createPreviewHost: соседи документа', () => {
  /** Проект с рабочей областью, которая запоминает, какой каталог у неё спросили. */
  function projectListing(): {
    readonly project: ProjectHost;
    readonly asked: ResourceId[];
  } {
    const asked: ResourceId[] = [];
    const project = {
      get: () => ({
        workspace: {
          list: (dir: ResourceId): Promise<readonly ResourceRef[]> => {
            asked.push(dir);
            return Promise.resolve([]);
          },
        },
      }),
      subscribe: () => ({ dispose: () => undefined }),
    } as unknown as ProjectHost;
    return { project, asked };
  }

  it('спрашивает каталог документа — и для файла в корне источника тоже', async () => {
    const { project, asked } = projectListing();
    const host = createPreviewHost({
      project,
      i18n: createI18nService(),
      services: createServiceRegistry(),
    });

    await host.siblings('src:forms/credit/form.json');
    // Форма в корне: обрезка по последнему «/» давала здесь `src:form.jso`, и сайдкары
    // такой формы превью не находило вовсе.
    await host.siblings('src:form.json');

    expect(asked).toEqual(['src:forms/credit', 'src:']);
  });
});

describe('createPreviewHost: правки файлов', () => {
  it('наружу уходят адреса, чей текст изменился или исчез, — не «загрузился» и не «сохранился»', () => {
    const captured: { emit: ((event: unknown) => void) | null } = { emit: null };
    const project = {
      get: () => ({
        workspace: {
          onDidChange: (cb: (event: unknown) => void): Disposable => {
            captured.emit = cb;
            return { dispose: () => (captured.emit = null) };
          },
        },
      }),
      subscribe: () => ({ dispose: () => undefined }),
    } as unknown as ProjectHost;
    const host = createPreviewHost({
      project,
      i18n: createI18nService(),
      services: createServiceRegistry(),
    });
    const seen: (readonly ResourceId[])[] = [];
    host.onDidChangeFiles?.((changed) => {
      seen.push(changed);
    });

    captured.emit?.({
      changes: [
        { id: 'src:form/validation.ts', type: 'written' },
        { id: 'src:form/model.ts', type: 'saved' },
        { id: 'src:form/api.ts', type: 'materialized' },
        { id: 'src:form/old.ts', type: 'removed' },
      ],
    });

    expect(seen).toEqual([['src:form/validation.ts', 'src:form/old.ts']]);
  });
});
