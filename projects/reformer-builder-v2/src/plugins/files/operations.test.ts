import { describe, expect, it, vi } from 'vitest';

import type { WhenContext } from '@/sdk';
import type { FilesBatchResult, FilesHost, FilesResourceOperations } from './host';
import {
  COPY_COMMAND_ID,
  CUT_COMMAND_ID,
  DELETE_COMMAND_ID,
  NEW_FILE_COMMAND_ID,
  NEW_FOLDER_COMMAND_ID,
  PASTE_COMMAND_ID,
  RENAME_COMMAND_ID,
  filesContextMenuItems,
  filesOperationCommands,
  nameOf,
  nameValidator,
  parseArgs,
} from './operations';

const ROOT = 'fs:';

function ref(path: string, kind: 'file' | 'directory' = 'file') {
  return {
    id: `fs:${path}`,
    sourceId: 'fs',
    path,
    name: path.slice(path.lastIndexOf('/') + 1),
    kind,
    mediaType: kind === 'directory' ? 'inode/directory' : 'text/plain',
  } as const;
}

/** Контекст применимости: по умолчанию фокус в дереве — иначе команды дерева недоступны. */
function context(focus: WhenContext['focus'] = 'tree'): WhenContext {
  return {
    focus,
    activeEditorId: null,
    activeResourceKind: null,
    hasSelection: false,
    previewMode: null,
  };
}

interface Harness {
  readonly commands: ReturnType<typeof filesOperationCommands>;
  readonly operations: FilesResourceOperations & {
    readonly calls: { name: string; args: unknown[] }[];
  };
  readonly prompt: {
    input: ReturnType<typeof vi.fn>;
    confirm: ReturnType<typeof vi.fn>;
    current: () => null;
    resolve: () => void;
    cancelAll: () => void;
    observe: () => { dispose: () => void };
  };
  readonly clipboard: {
    copy: ReturnType<typeof vi.fn>;
    cut: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    get: () => { mode: 'copy' | 'cut'; items: readonly string[] };
    size: () => number;
    observe: () => { dispose: () => void };
  };
  readonly errors: string[];
  command(id: string): ReturnType<typeof filesOperationCommands>[number];
}

function harness(
  options: {
    selection?: readonly ReturnType<typeof ref>[];
    hasProject?: boolean;
    clipboardState?: { mode: 'copy' | 'cut'; items: readonly string[] };
    answer?: string | null;
    agreed?: boolean;
    batch?: FilesBatchResult;
  } = {}
): Harness {
  const calls: { name: string; args: unknown[] }[] = [];
  const batch = options.batch ?? { done: [], failed: [] };
  const operations = {
    calls,
    createFile: (...args: unknown[]) => {
      calls.push({ name: 'createFile', args });
      return Promise.resolve('fs:new.ts');
    },
    createDirectory: (...args: unknown[]) => {
      calls.push({ name: 'createDirectory', args });
      return Promise.resolve('fs:new');
    },
    rename: (...args: unknown[]) => {
      calls.push({ name: 'rename', args });
      return Promise.resolve('fs:renamed.ts');
    },
    move: (...args: unknown[]) => {
      calls.push({ name: 'move', args });
      return Promise.resolve('fs:moved.ts');
    },
    remove: (...args: unknown[]) => {
      calls.push({ name: 'remove', args });
      return Promise.resolve(batch);
    },
    copy: (...args: unknown[]) => {
      calls.push({ name: 'copy', args });
      return Promise.resolve(batch);
    },
    refresh: (...args: unknown[]) => {
      calls.push({ name: 'refresh', args });
      return Promise.resolve();
    },
  } as unknown as Harness['operations'];

  const state = options.clipboardState ?? { mode: 'copy' as const, items: [] };
  const clipboard = {
    copy: vi.fn(),
    cut: vi.fn(),
    clear: vi.fn(),
    get: () => state,
    size: () => state.items.length,
    observe: () => ({ dispose: () => undefined }),
  };

  const prompt = {
    input: vi.fn(() => Promise.resolve(options.answer === undefined ? 'ответ' : options.answer)),
    confirm: vi.fn(() => Promise.resolve(options.agreed ?? true)),
    current: () => null,
    resolve: () => undefined,
    cancelAll: () => undefined,
    observe: () => ({ dispose: () => undefined }),
  };

  const errors: string[] = [];
  const host = {
    hasProject: () => options.hasProject ?? true,
    resources: () => ((options.hasProject ?? true) ? operations : null),
    treeSelection: () => options.selection ?? [],
    treeRoot: () => ROOT,
  } as unknown as FilesHost;

  const commands = filesOperationCommands({
    host,
    prompt: prompt as never,
    clipboard: clipboard as never,
    notifications: {
      error: (key: string) => {
        errors.push(key);
        return { id: key, dismiss: () => undefined };
      },
      info: () => ({ id: 'i', dismiss: () => undefined }),
    } as never,
    writeSystemClipboard: () => Promise.resolve(),
  });

  return {
    commands,
    operations,
    prompt,
    clipboard,
    errors,
    command: (id) => {
      const found = commands.find((item) => item.id === id);
      if (found === undefined) throw new Error(`нет команды ${id}`);
      return found;
    },
  };
}

describe('разбор аргументов', () => {
  it('чужая форма — то же, что их отсутствие', () => {
    expect(parseArgs('строка')).toEqual({});
    expect(parseArgs(null)).toEqual({});
    expect(parseArgs({ ids: 'нет', dir: 5 })).toEqual({ ids: undefined, dir: undefined });
  });

  it('адреса и каталог читаются как есть', () => {
    expect(parseArgs({ ids: ['fs:a.ts'], dir: 'fs:src' })).toEqual({
      ids: ['fs:a.ts'],
      dir: 'fs:src',
    });
  });
});

describe('имя из адреса', () => {
  it('берётся последний сегмент пути', () => {
    expect(nameOf('fs:src/forms/schema.json')).toBe('schema.json');
    expect(nameOf('fs:package.json')).toBe('package.json');
  });
});

describe('проверка имени в поле ввода', () => {
  it('годное имя проходит, негодное отвечает ключом словаря плагина', () => {
    const validate = nameValidator();

    expect(validate('schema.json')).toBeNull();
    expect(validate('')).toBe('ops.name.empty');
    expect(validate('a/b')).toBe('ops.name.separator');
  });
});

describe('создание', () => {
  it('спрашивает имя и создаёт в каталоге, который назвал пункт меню', async () => {
    const h = harness();

    await h.command(NEW_FILE_COMMAND_ID).run({ dir: 'fs:src/forms' });

    expect(h.prompt.input).toHaveBeenCalledTimes(1);
    expect(h.operations.calls).toEqual([{ name: 'createFile', args: ['fs:src/forms', 'ответ'] }]);
  });

  it('без аргументов берёт каталог выделенной записи, а для файла — его родителя', async () => {
    const h = harness({ selection: [ref('src/forms/schema.json')] });

    await h.command(NEW_FOLDER_COMMAND_ID).run();

    expect(h.operations.calls[0]?.args[0]).toBe('fs:src/forms');
  });

  it('отмена диалога ничего не создаёт', async () => {
    const h = harness({ answer: null });

    await h.command(NEW_FILE_COMMAND_ID).run({ dir: ROOT });

    expect(h.operations.calls).toEqual([]);
  });

  it('без проекта команда недоступна и сообщает об этом, а не молчит', async () => {
    const h = harness({ hasProject: false });

    expect(h.command(NEW_FILE_COMMAND_ID).enabled?.(context())).toBe(false);
    await h.command(NEW_FILE_COMMAND_ID).run({ dir: ROOT });
    expect(h.errors).toContain('files.notify.noProject');
  });
});

describe('переименование', () => {
  it('предлагает текущее имя и переименовывает выбранную запись', async () => {
    const h = harness({ selection: [ref('src/util.ts')] });

    await h.command(RENAME_COMMAND_ID).run();

    expect(h.prompt.input).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'util.ts', select: 'stem' })
    );
    expect(h.operations.calls).toEqual([{ name: 'rename', args: ['fs:src/util.ts', 'ответ'] }]);
  });

  it('доступно только при фокусе в дереве: F2 в редакторе схемы означает другое', () => {
    const h = harness({ selection: [ref('a.ts')] });
    const command = h.command(RENAME_COMMAND_ID);

    expect(command.keybinding).toBe('f2');
    expect(command.enabled?.(context('tree'))).toBe(true);
    expect(command.enabled?.(context('canvas'))).toBe(false);
  });
});

describe('удаление', () => {
  it('спрашивает согласие и удаляет весь набор', async () => {
    const h = harness({ selection: [ref('a.ts'), ref('b.ts')] });

    await h.command(DELETE_COMMAND_ID).run();

    expect(h.prompt.confirm).toHaveBeenCalledTimes(1);
    expect(h.operations.calls).toEqual([{ name: 'remove', args: [['fs:a.ts', 'fs:b.ts']] }]);
  });

  it('отказ в диалоге не удаляет ничего', async () => {
    const h = harness({ selection: [ref('a.ts')], agreed: false });

    await h.command(DELETE_COMMAND_ID).run();

    expect(h.operations.calls).toEqual([]);
  });

  it('частичный отказ сообщается человеком, а не консолью', async () => {
    const h = harness({
      selection: [ref('a.ts')],
      batch: { done: [], failed: [{ id: 'fs:a.ts', error: new Error('нет прав') }] },
    });

    await h.command(DELETE_COMMAND_ID).run();

    expect(h.errors).toContain('files.notify.delete.failed');
  });
});

describe('буфер', () => {
  it('копирование кладёт адреса набора', async () => {
    const h = harness({ selection: [ref('a.ts'), ref('b.ts')] });

    await h.command(COPY_COMMAND_ID).run();

    expect(h.clipboard.copy).toHaveBeenCalledWith(['fs:a.ts', 'fs:b.ts']);
  });

  it('вставка копированием зовёт копирование в каталог', async () => {
    const h = harness({ clipboardState: { mode: 'copy', items: ['fs:a.ts'] } });

    await h.command(PASTE_COMMAND_ID).run({ dir: 'fs:src' });

    expect(h.operations.calls).toEqual([{ name: 'copy', args: [['fs:a.ts'], 'fs:src'] }]);
  });

  it('вставка вырезанного переносит и очищает буфер: второй раз переносить нечего', async () => {
    const h = harness({ clipboardState: { mode: 'cut', items: ['fs:a.ts'] } });

    await h.command(PASTE_COMMAND_ID).run({ dir: 'fs:src' });

    expect(h.operations.calls).toEqual([{ name: 'move', args: ['fs:a.ts', 'fs:src'] }]);
    expect(h.clipboard.clear).toHaveBeenCalledTimes(1);
  });

  it('пустой буфер гасит вставку: пункт, обещающий вставку пустоты, не исполнится', () => {
    const empty = harness({ clipboardState: { mode: 'copy', items: [] } });
    const full = harness({ clipboardState: { mode: 'copy', items: ['fs:a.ts'] } });

    expect(empty.command(PASTE_COMMAND_ID).enabled?.(context())).toBe(false);
    expect(full.command(PASTE_COMMAND_ID).enabled?.(context())).toBe(true);
  });

  it('копирование и вырезание объявлены сочетаниями, привычными по файловым менеджерам', () => {
    const h = harness();

    expect(h.command(COPY_COMMAND_ID).keybinding).toBe('mod+c');
    expect(h.command(CUT_COMMAND_ID).keybinding).toBe('mod+x');
    expect(h.command(PASTE_COMMAND_ID).keybinding).toBe('mod+v');
  });
});

describe('пункты контекстного меню', () => {
  const items = filesContextMenuItems();

  it('все вносятся в контекстное меню дерева и ссылаются на команды', () => {
    for (const item of items) {
      expect(item.value).toMatchObject({ kind: 'item', menu: 'resource/context' });
    }
    const commands = items.map((item) => (item.value.kind === 'item' ? item.value.command : null));
    expect(commands).toContain(RENAME_COMMAND_ID);
    expect(commands).toContain(DELETE_COMMAND_ID);
  });

  it('пункты над строкой скрыты при щелчке по пустому месту, а создание — нет', () => {
    const rename = items.find((item) => item.id === 'files.context.rename');
    const newFile = items.find((item) => item.id === 'files.context.newFile');
    const overNothing = { ref: null, dir: ROOT, selection: [], rootId: ROOT };

    expect(rename?.value.kind === 'item' ? rename.value.when?.(context(), overNothing) : null).toBe(
      false
    );
    expect(newFile?.value.kind === 'item' ? (newFile.value.when ?? null) : null).toBeNull();
  });

  it('аргументы пункта несут выделение и каталог щелчка', () => {
    const remove = items.find((item) => item.id === 'files.context.delete');
    const target = {
      ref: ref('src/a.ts'),
      dir: 'fs:src',
      selection: [ref('src/a.ts'), ref('src/b.ts')],
      rootId: ROOT,
    };

    const args = remove?.value.kind === 'item' ? remove.value.argsOf?.(target) : null;
    expect(args).toEqual({ ids: ['fs:src/a.ts', 'fs:src/b.ts'], dir: 'fs:src' });
  });

  it('разрушительное лежит в отдельной группе — линия перед ним появится сама', () => {
    const remove = items.find((item) => item.id === 'files.context.delete');
    const copy = items.find((item) => item.id === 'files.context.copy');

    expect(remove?.value.kind === 'item' ? remove.value.group : null).toBe('9_danger');
    expect(copy?.value.kind === 'item' ? copy.value.group : null).toBe('2_edit');
  });
});
