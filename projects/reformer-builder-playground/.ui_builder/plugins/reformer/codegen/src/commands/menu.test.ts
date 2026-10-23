/**
 * Подраздел «ReFormer» подменю «Сгенерировать»: заголовок, «Весь модуль», цели стека.
 *
 * @module plugins/reformer/codegen/commands/menu.test
 */

import { describe, expect, it } from 'vitest';
import { RESOURCE_GENERATE_MENU, type ResourceId } from '@reformer/builder-plugin-api';
import { codegenContextMenuItems, CODEGEN_CONTEXT_SUBMENU, GENERATE_INTO_COMMAND_ID } from './menu';
import { BUILTIN_TARGETS } from '../pipeline/targets';

const DIR = 'fake:forms/credit' as ResourceId;

const targets = () => BUILTIN_TARGETS;

describe('вклады подменю', () => {
  const items = codegenContextMenuItems(targets);

  it('заголовок — подраздел «ReFormer» общего «Сгенерировать», а не своё подменю в корне', () => {
    expect(items[0].value).toMatchObject({
      kind: 'submenu',
      menu: RESOURCE_GENERATE_MENU,
      submenu: CODEGEN_CONTEXT_SUBMENU,
      titleKey: 'menu.generate.reformer',
    });
    // Адрес подраздела лежит ПОД общим: иначе пункты стека встали бы рядом с подразделами.
    expect(CODEGEN_CONTEXT_SUBMENU.startsWith(`${RESOURCE_GENERATE_MENU}/`)).toBe(true);
  });

  it('заголовок гаснет на файле и доступен на каталоге', () => {
    const submenu = items[0].value;
    if (submenu.kind !== 'submenu') throw new Error('первым вкладом обязан быть заголовок');
    const ctx = {} as never;

    const at = (ref: { kind: string } | null): boolean =>
      submenu.enabledWhen?.(ctx, { ref, dir: DIR, selection: [], rootId: DIR }) ?? true;

    expect(at({ kind: 'directory' })).toBe(true);
    expect(at(null)).toBe(true);
    expect(at({ kind: 'file' })).toBe(false);
  });

  it('цели приходят динамической группой: их состав известен только в рантайме', () => {
    const dynamic = items[2].value;
    if (dynamic.kind !== 'dynamic') throw new Error('цели обязаны быть динамической группой');

    const built = dynamic.items({} as never, {
      ref: { id: DIR, name: 'credit', kind: 'directory' },
      dir: DIR,
      selection: [],
      rootId: DIR,
    });

    expect(built).toHaveLength(BUILTIN_TARGETS.length);
    expect(built[0]).toMatchObject({
      command: GENERATE_INTO_COMMAND_ID,
      titleKey: 'target.schema',
      args: { dir: DIR, targetId: 'codegen.schema', formName: 'credit', stack: 'reformer' },
    });
  });

  it('чужая цель без ключа подписывается именем файла', () => {
    const foreign = codegenContextMenuItems(() => [
      { id: 'foreign.one', path: 'foreign.ts', cls: 'user', emit: () => '' },
    ])[2].value;
    if (foreign.kind !== 'dynamic') throw new Error('цели обязаны быть динамической группой');

    expect(foreign.items({} as never, { ref: null, dir: DIR, selection: [], rootId: DIR })).toEqual(
      [expect.objectContaining({ title: 'foreign.ts', titleKey: undefined })]
    );
  });

  it('папка schema формой не называется: имя формы возьмётся из каталога модуля', () => {
    const dynamic = items[2].value;
    if (dynamic.kind !== 'dynamic') throw new Error('цели обязаны быть динамической группой');
    const schemaDir = `${DIR}/schema` as ResourceId;

    const built = dynamic.items({} as never, {
      ref: { id: schemaDir, name: 'schema', kind: 'directory' },
      dir: schemaDir,
      selection: [],
      rootId: DIR,
    });

    // Каталог передан как есть (корень модуля найдёт команда), а имя формы — нет.
    expect(built[0]).toMatchObject({ args: { dir: schemaDir, formName: undefined } });
  });

  it('«Весь модуль» называет стек — команда хозяина ищет форму его `find`', () => {
    const all = items[1].value;
    if (all.kind !== 'item') throw new Error('вторым вкладом обязан быть пункт');
    expect(all.command).toBe(GENERATE_INTO_COMMAND_ID);
    expect(
      all.argsOf?.({
        ref: { id: DIR, name: 'credit', kind: 'directory' },
        dir: DIR,
        selection: [],
        rootId: DIR,
      })
    ).toEqual({ dir: DIR, formName: 'credit', stack: 'reformer' });
  });

  it('пункты вносятся в подменю, а не в корень контекстного меню', () => {
    expect(items[1].value).toMatchObject({ menu: CODEGEN_CONTEXT_SUBMENU });
    expect(items[2].value).toMatchObject({ menu: CODEGEN_CONTEXT_SUBMENU });
  });
});
