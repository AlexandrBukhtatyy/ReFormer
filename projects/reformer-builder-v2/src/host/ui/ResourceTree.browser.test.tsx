/**
 * Дерево ресурсов в настоящем браузере: вид, ввод и контекстное меню.
 *
 * Правила проверяются без браузера — состав строк в [resource-tree.test.ts](resource-tree.test.ts),
 * сборка меню в [menu.test.ts](menu.test.ts), цель щелчка в
 * [resource-menu.test.ts](resource-menu.test.ts). Здесь то, чего компиляция не проверяет
 * вовсе: щелчок с модификатором, правая кнопка, портал меню Radix и клавиатура.
 *
 * @module host/ui/ResourceTree.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createCommandRegistry } from '../primitives/command';
import { createExtensionRegistry } from '../primitives/extension-point';
import {
  makeResourceId,
  mediaTypeFor,
  type ResourceId,
  type ResourceRef,
} from '../primitives/resource';
import { whenContext } from '../primitives/when-context';
import { createI18nService } from '../services/i18n/i18n';
import { renderReact } from '../../testing/render';
import { MenuPoint, type MenuContribution } from './menu';
import { RESOURCE_CONTEXT_MENU, argsOfResource, selectedIds, whenResource } from './resource-menu';
import { createResourceTreeStore, type TreeWorkspace } from './resource-tree';
import { ResourceTree } from './ResourceTree';

const MESSAGES: Readonly<Record<string, string>> = {
  'shell.tree.label': 'Ресурсы проекта',
  'shell.tree.empty': 'Здесь пусто',
  'shell.tree.menu.empty': 'Здесь нет действий',
  'command.rename': 'Переименовать…',
  'command.newFile': 'Новый файл…',
};

const ROOT = makeResourceId('mem', '');

function entry(path: string, kind: 'file' | 'directory' = 'file'): ResourceRef {
  return {
    id: makeResourceId('mem', path),
    sourceId: 'mem',
    path,
    name: path.slice(path.lastIndexOf('/') + 1),
    kind,
    mediaType: kind === 'directory' ? 'inode/directory' : mediaTypeFor(path),
  };
}

/** Уровни проекта: корень, каталог форм и его содержимое. */
const LEVELS: Readonly<Record<string, readonly ResourceRef[]>> = {
  'mem:': [entry('forms', 'directory'), entry('package.json')],
  'mem:forms': [entry('forms/credit.json'), entry('forms/loan.json')],
};

const workspace: TreeWorkspace = {
  list: (dir: ResourceId) => Promise.resolve(LEVELS[dir] ?? []),
};

interface Fixture {
  readonly opened: { id: ResourceId; preview: boolean }[];
  readonly executed: { id: string; args: unknown }[];
  readonly unmount: () => void;
}

/** Монтирует дерево с двумя пунктами меню: один только над строкой, второй — всегда. */
async function mountTree(options: { withMenu?: boolean } = {}): Promise<Fixture> {
  const extensions = createExtensionRegistry();
  const commands = createCommandRegistry({ getContext: () => whenContext({ focus: 'tree' }) });
  const executed: { id: string; args: unknown }[] = [];

  const registry = commands.forPlugin('files');
  registry.register({
    id: 'files.rename',
    titleKey: 'command.rename',
    keybinding: 'f2',
    run: (args) => {
      executed.push({ id: 'files.rename', args });
    },
  });
  registry.register({
    id: 'files.newFile',
    titleKey: 'command.newFile',
    run: (args) => {
      executed.push({ id: 'files.newFile', args });
    },
  });

  if (options.withMenu !== false) {
    const contribute = extensions.forPlugin('files');
    const rename: MenuContribution = {
      kind: 'item',
      menu: RESOURCE_CONTEXT_MENU,
      command: 'files.rename',
      group: '9_danger',
      when: whenResource((target) => target.ref !== null),
      argsOf: argsOfResource((target) => ({ ids: selectedIds(target) })),
    };
    const newFile: MenuContribution = {
      kind: 'item',
      menu: RESOURCE_CONTEXT_MENU,
      command: 'files.newFile',
      group: '3_create',
      argsOf: argsOfResource((target) => ({ dir: target.dir })),
    };
    contribute.contribute(MenuPoint, rename, { id: 'files.context.rename' });
    contribute.contribute(MenuPoint, newFile, { id: 'files.context.newFile' });
  }

  const i18n = createI18nService({
    loadHostMessages: () => Promise.resolve(MESSAGES),
    dev: false,
  });
  await i18n.setLocale('ru');
  // Заголовки команд плагина разрешаются ЕГО словарём: без этой строки в меню были бы
  // маркеры промаха, а тест бы искал текст, которого нет.
  i18n.forPlugin('files').contribute('ru', {
    'command.rename': 'Переименовать…',
    'command.newFile': 'Новый файл…',
  });

  const tree = createResourceTreeStore({ workspace, rootId: ROOT });
  const opened: { id: ResourceId; preview: boolean }[] = [];

  const mounted = renderReact(
    <div style={{ height: '400px' }}>
      <ResourceTree
        tree={tree}
        extensions={extensions}
        i18n={i18n}
        commands={commands}
        whenContext={() => whenContext({ focus: 'tree' })}
        onOpen={(id, choice) => {
          opened.push({ id, preview: choice.preview });
        }}
      />
    </div>
  );

  await vi.waitFor(() => {
    expect(mounted.container.textContent).toContain('package.json');
  });

  return { opened, executed, unmount: mounted.unmount };
}

describe('вид и открытие', () => {
  it('показывает содержимое корня строками с именами', async () => {
    const fixture = await mountTree();

    await expect.element(page.getByText('forms')).toBeVisible();
    await expect.element(page.getByText('package.json')).toBeVisible();

    fixture.unmount();
  });

  it('одиночный щелчок открывает файл временной вкладкой, двойной — закрепляет', async () => {
    const fixture = await mountTree();

    await userEvent.click(page.getByText('package.json'));
    await vi.waitFor(() => {
      expect(fixture.opened).toEqual([{ id: 'mem:package.json', preview: true }]);
    });

    await userEvent.dblClick(page.getByText('package.json'));
    await vi.waitFor(() => {
      expect(fixture.opened.at(-1)).toEqual({ id: 'mem:package.json', preview: false });
    });

    fixture.unmount();
  });

  it('щелчок по каталогу раскрывает его, а не открывает', async () => {
    const fixture = await mountTree();

    await userEvent.click(page.getByText('forms'));

    await expect.element(page.getByText('credit.json')).toBeVisible();
    expect(fixture.opened).toEqual([]);

    fixture.unmount();
  });
});

describe('множественный выбор', () => {
  it('щелчок с Ctrl набирает записи и не открывает их', async () => {
    const fixture = await mountTree();

    await userEvent.click(page.getByText('package.json'));
    fixture.opened.length = 0;
    await userEvent.keyboard('{Control>}');
    await userEvent.click(page.getByText('forms'));
    await userEvent.keyboard('{/Control}');

    // Открытия не было: человек выбирал, а не смотрел.
    expect(fixture.opened).toEqual([]);
    await vi.waitFor(() => {
      expect(document.querySelectorAll('[data-checked]').length).toBe(2);
    });

    fixture.unmount();
  });
});

describe('клавиатура', () => {
  it('стрелки перемещают выделение, вправо раскрывает каталог', async () => {
    const fixture = await mountTree();

    await userEvent.click(page.getByText('forms'));
    // Щелчок по каталогу его раскрыл; сворачиваем обратно стрелкой влево.
    await userEvent.keyboard('{ArrowLeft}');
    await vi.waitFor(() => {
      expect(document.body.textContent).not.toContain('credit.json');
    });

    await userEvent.keyboard('{ArrowRight}');
    await expect.element(page.getByText('credit.json')).toBeVisible();

    fixture.unmount();
  });

  it('Enter открывает закреплённой вкладкой, пробел — временной', async () => {
    const fixture = await mountTree();

    await userEvent.click(page.getByText('package.json'));
    fixture.opened.length = 0;

    await userEvent.keyboard('{Enter}');
    await vi.waitFor(() => {
      expect(fixture.opened).toEqual([{ id: 'mem:package.json', preview: false }]);
    });

    await userEvent.keyboard(' ');
    await vi.waitFor(() => {
      expect(fixture.opened.at(-1)).toEqual({ id: 'mem:package.json', preview: true });
    });

    fixture.unmount();
  });
});

describe('контекстное меню', () => {
  it('щелчок правой кнопкой по строке показывает пункты вкладов', async () => {
    const fixture = await mountTree();

    await page.getByText('package.json').click({ button: 'right' });

    await expect.element(page.getByText('Переименовать…')).toBeVisible();
    await expect.element(page.getByText('Новый файл…')).toBeVisible();

    fixture.unmount();
  });

  it('пункт вызывает команду и приносит ей адрес строки, по которой щёлкнули', async () => {
    const fixture = await mountTree();

    await page.getByText('package.json').click({ button: 'right' });
    await userEvent.click(page.getByText('Переименовать…'));

    await vi.waitFor(() => {
      expect(fixture.executed).toEqual([
        { id: 'files.rename', args: { ids: ['mem:package.json'] } },
      ]);
    });

    fixture.unmount();
  });

  it('щелчок мимо строк прячет пункты, которым нужна строка', async () => {
    const fixture = await mountTree();

    // Ниже последней строки: место дерева есть, строки под курсором нет. Целимся
    // во вьюпорт прокрутки — именно он принимает события в пустой части панели.
    const viewport = document.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
    expect(viewport).not.toBeNull();
    await page
      .elementLocator(viewport as HTMLElement)
      .click({ button: 'right', position: { x: 40, y: 300 } });

    await expect.element(page.getByText('Новый файл…')).toBeVisible();
    expect(document.body.textContent).not.toContain('Переименовать…');

    fixture.unmount();
  });

  it('без вкладов меню честно сообщает, что действий нет', async () => {
    const fixture = await mountTree({ withMenu: false });

    await page.getByText('package.json').click({ button: 'right' });

    await expect.element(page.getByText('Здесь нет действий')).toBeVisible();

    fixture.unmount();
  });
});
