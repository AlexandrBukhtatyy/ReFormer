/**
 * Шаблоны в контекстном меню дерева: снимок списка, пункты и раскладка в названный каталог.
 *
 * Порт подставной — тот же двойник, что у операций. Проверяется то, чем владеет плагин:
 * что он показывает в подменю, при какой цели пункт доступен и куда ложится форма.
 *
 * @module plugins/templates/commands/context-menu.test
 */

import { describe, expect, it, vi } from 'vitest';
import type { ResourceId } from '@/sdk';
import type { FormTemplate, TemplateStore } from '../contract';
import {
  createTemplateSnapshot,
  templatesContextMenuItems,
  templatesMenuCommands,
  GENERATE_FORM_COMMAND_ID,
  TEMPLATES_CONTEXT_SUBMENU,
  type TemplateSnapshot,
} from './context-menu';
import { createFakeTemplatesHost } from '../testing';

const DIR = 'fake:src/forms' as ResourceId;

function template(patch: Partial<FormTemplate> = {}): FormTemplate {
  return {
    id: 'builtin-simple-form',
    name: 'Простая форма',
    source: 'builtin',
    files: [
      {
        path: 'renderer.schema.json',
        content: '{"version":"1.0","root":{"component":"$html(div)"}}',
      },
      { path: 'model.ts', content: 'export const model = {};\n' },
    ],
    ...patch,
  };
}

/** Снимок с готовым списком: ждать загрузки в тестах меню нечего — она проверяется отдельно. */
function readySnapshot(list: readonly FormTemplate[]): TemplateSnapshot {
  return {
    list: () => list,
    refresh: () => undefined,
    onDidChange: () => ({ dispose: () => undefined }),
  };
}

describe('снимок списка шаблонов', () => {
  const noStores = (): readonly TemplateStore[] => [];

  it('до первого чтения пуст: заголовок, открывающийся в пустоту, хуже отсутствующего', () => {
    expect(createTemplateSnapshot(noStores).list()).toEqual([]);
  });

  it('после чтения отдаёт список и будит подписчиков', async () => {
    const list = [template()];
    const snapshot = createTemplateSnapshot(noStores, () => Promise.resolve(list));
    const woken = vi.fn();
    snapshot.onDidChange(woken);

    snapshot.refresh();
    await vi.waitFor(() => {
      expect(snapshot.list()).toEqual(list);
    });
    expect(woken).toHaveBeenCalledTimes(1);
  });

  it('снятая подписка больше не будится', async () => {
    const snapshot = createTemplateSnapshot(noStores, () => Promise.resolve([template()]));
    const woken = vi.fn();
    snapshot.onDidChange(woken).dispose();

    snapshot.refresh();
    await vi.waitFor(() => {
      expect(snapshot.list()).toHaveLength(1);
    });
    expect(woken).not.toHaveBeenCalled();
  });
});

describe('вклады меню', () => {
  const items = templatesContextMenuItems(readySnapshot([template()]));

  it('заголовок гаснет на файле, а не исчезает: создают внутрь папок', () => {
    const submenu = items[0].value;
    if (submenu.kind !== 'submenu') throw new Error('первым вкладом обязан быть заголовок');
    const at = (ref: { kind: string } | null): boolean =>
      submenu.enabledWhen?.({} as never, { ref, dir: DIR, selection: [], rootId: DIR }) ?? true;

    expect(at({ kind: 'directory' })).toBe(true);
    expect(at(null)).toBe(true);
    expect(at({ kind: 'file' })).toBe(false);
  });

  it('«шаблон из каталога» по-прежнему СКРЫТ на файле: пункт не про эту цель', () => {
    const item = items[2].value;
    if (item.kind !== 'item') throw new Error('третьим вкладом обязан быть пункт');

    const at = (ref: { kind: string } | null): boolean =>
      item.when?.({} as never, { ref, dir: DIR, selection: [], rootId: DIR }) ?? true;

    expect(at({ kind: 'directory' })).toBe(true);
    expect(at({ kind: 'file' })).toBe(false);
    expect(item.enabledWhen).toBeUndefined();
  });

  it('шаблоны приходят готовыми строками: их имена придумывает человек', () => {
    const dynamic = items[1].value;
    if (dynamic.kind !== 'dynamic') throw new Error('шаблоны обязаны быть динамической группой');

    expect(dynamic.items({} as never, { ref: null, dir: DIR, selection: [], rootId: DIR })).toEqual(
      [
        {
          id: 'builtin-simple-form',
          command: GENERATE_FORM_COMMAND_ID,
          args: { dir: DIR, templateId: 'builtin-simple-form' },
          title: 'Простая форма',
        },
      ]
    );
    expect(dynamic.menu).toBe(TEMPLATES_CONTEXT_SUBMENU);
  });

  it('без снимка группа пуста, и подменю не рисуется вовсе', () => {
    const dynamic = templatesContextMenuItems()[1].value;
    if (dynamic.kind !== 'dynamic') throw new Error('шаблоны обязаны быть динамической группой');

    expect(dynamic.items({} as never, { ref: null, dir: DIR, selection: [], rootId: DIR })).toEqual(
      []
    );
  });
});

describe('раскладка шаблона в каталог', () => {
  function deps(snapshot: TemplateSnapshot, name: string | null = 'credit') {
    const host = createFakeTemplatesHost();
    const notified: string[] = [];
    const command = templatesMenuCommands(
      {
        host,
        stores: () => [],
        prompt: {
          input: () => Promise.resolve(name),
          confirm: () => Promise.resolve(true),
          current: () => null,
          resolve: () => undefined,
          cancelAll: () => undefined,
          observe: () => ({ dispose: () => undefined }),
        },
        notifications: {
          success: (key: string) => notified.push(key),
          error: (key: string) => notified.push(key),
        } as never,
      },
      snapshot
    ).find((item) => item.id === GENERATE_FORM_COMMAND_ID);
    if (command === undefined) throw new Error('команда раскладки не зарегистрирована');
    return { host, notified, command };
  }

  it('кладёт форму ВНУТРЬ щёлкнутого каталога, под её именем', async () => {
    const { host, command, notified } = deps(readySnapshot([template()]));

    await expect(command.run({ dir: DIR, templateId: 'builtin-simple-form' })).resolves.toBe(true);

    expect([...host.files.keys()].sort()).toEqual([
      `${DIR}/credit/model.ts`,
      `${DIR}/credit/renderer.schema.json`,
    ]);
    expect(notified).toEqual(['templates.notify.generated']);
  });

  it('отказ от имени ничего не пишет', async () => {
    const { host, command } = deps(readySnapshot([template()]), null);

    await expect(command.run({ dir: DIR, templateId: 'builtin-simple-form' })).resolves.toBe(false);
    expect(host.files.size).toBe(0);
  });

  it('исчезнувший шаблон назван, а список перечитывается', async () => {
    const refresh = vi.fn();
    const { command, notified } = deps({ ...readySnapshot([]), refresh });

    await expect(command.run({ dir: DIR, templateId: 'gone' })).resolves.toBe(false);
    expect(notified).toEqual(['templates.notify.gone']);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('без адреса каталога или шаблона команда отказывается', async () => {
    const { command, host } = deps(readySnapshot([template()]));

    await expect(command.run({ templateId: 'builtin-simple-form' })).resolves.toBe(false);
    await expect(command.run({ dir: DIR })).resolves.toBe(false);
    expect(host.files.size).toBe(0);
  });
});
