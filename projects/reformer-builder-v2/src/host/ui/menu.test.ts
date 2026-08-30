import { describe, expect, it, vi } from 'vitest';

import { createCommandRegistry, type CommandContribution } from '../primitives/command';
import { createExtensionRegistry } from '../primitives/extension-point';
import { whenContext } from '../primitives/when-context';
import {
  buildMenuBar,
  hostMenuEntry,
  MAX_MENU_DEPTH,
  MenuPoint,
  sortMenuRoots,
  unknownMenuPaths,
  type MenuBarNode,
  type MenuContribution,
  type MenuEntry,
  type MenuIssue,
  type MenuNode,
} from './menu';

/**
 * Команды теста — фиктивные и бессодержательные.
 *
 * Предметных («сохранить», «отменить») здесь быть не может по той же причине, что и
 * предметных панелей в `panels.test.ts`: меню о них не знает, и тест с ними проверял бы
 * собственную выдумку, а не правило.
 */
function command(patch: Partial<CommandContribution> & { id: string }): CommandContribution {
  return { titleKey: `${patch.id}.title`, run: () => undefined, ...patch };
}

/**
 * Реестр с набором команд. Настоящий, а не подделка: `isEnabled` — часть проверяемого,
 * и `pluginId` команды проставляет он же, как в приложении.
 */
function commandsOf(list: readonly CommandContribution[]) {
  const registry = createCommandRegistry();
  for (const item of list) {
    const owner = item.id.split('.')[0];
    // Команда без точки в имени принадлежит Host: у неё нет пространства имён плагина.
    if (owner === item.id) registry.register(item);
    else registry.forPlugin(owner).register(item);
  }
  return registry;
}

/** Вклады меню от плагинов — через настоящий реестр, чтобы `pluginId` проставлял он. */
function entriesOf(
  list: readonly { plugin?: string; value: MenuContribution; order?: number; id?: string }[]
): readonly MenuEntry[] {
  const root = createExtensionRegistry();
  for (const item of list) {
    root
      .forPlugin(item.plugin ?? 'test')
      .contribute(MenuPoint, item.value, { id: item.id, order: item.order });
  }
  return root.get(MenuPoint);
}

/** Перевод теста: ключ и владелец видны в результате, поэтому промах по словарю заметен. */
const translate = (key: string, owner?: { readonly pluginId?: string }): string =>
  `${owner?.pluginId ?? 'host'}/${key}`;

function build(
  entries: readonly MenuEntry[],
  options: {
    commands?: readonly CommandContribution[];
    ctx?: ReturnType<typeof whenContext>;
    execute?: (id: string, args?: unknown) => void;
    onIssue?: (issue: MenuIssue) => void;
  } = {}
): readonly MenuBarNode[] {
  return buildMenuBar({
    entries,
    ctx: options.ctx ?? whenContext(),
    commands: commandsOf(options.commands ?? [command({ id: 'test.run' })]),
    translate,
    execute: options.execute ?? (() => undefined),
    onIssue: options.onIssue,
  });
}

function menuOf(bar: readonly MenuBarNode[], id: string): MenuBarNode {
  const node = bar.find((menu) => menu.id === id);
  if (node === undefined) throw new Error(`меню «${id}» нет в шапке`);
  return node;
}

/** Заголовки пунктов и разделители одной строкой — так читаются ожидания состава. */
function shapeOf(items: readonly MenuNode[]): readonly string[] {
  return items.map((item) => {
    if (item.kind === 'separator') return '---';
    if (item.kind === 'submenu') return `${item.title} ▸ [${shapeOf(item.items).join(', ')}]`;
    return item.title;
  });
}

describe('корни меню', () => {
  it('два корня Host: «Файл» и «Справка»', () => {
    const bar = build([]);
    expect(bar.map((menu) => menu.id)).toEqual(['file', 'help']);
    expect(bar[0].title).toBe('host/shell.menu.file');
  });

  it('корень плагина встаёт между «файлом» и «справкой»', () => {
    const bar = build(
      entriesOf([
        { plugin: 'git', value: { kind: 'root', id: 'git', titleKey: 'menu.title' } },
        { plugin: 'deploy', value: { kind: 'root', id: 'deploy', titleKey: 'menu.title' } },
      ])
    );

    expect(bar.map((menu) => menu.id)).toEqual(['file', 'git', 'deploy', 'help']);
  });

  it('заголовок корня плагина разрешается словарём этого плагина', () => {
    const bar = build(
      entriesOf([{ plugin: 'git', value: { kind: 'root', id: 'git', titleKey: 'menu.title' } }])
    );

    expect(menuOf(bar, 'git').title).toBe('git/menu.title');
  });

  it('order расставляет корни плагинов между собой, но не выносит их из зоны', () => {
    const bar = build(
      entriesOf([
        { plugin: 'b', value: { kind: 'root', id: 'b', titleKey: 't', order: 10 } },
        // Ноль — то, что получается, когда поле не заполнили: перед «Файлом» встать нельзя.
        { plugin: 'a', value: { kind: 'root', id: 'a', titleKey: 't', order: -100 } },
      ])
    );

    expect(bar.map((menu) => menu.id)).toEqual(['file', 'a', 'b', 'help']);
  });

  it('корень с именем корня Host отклоняется', () => {
    const onIssue = vi.fn();
    const bar = build(
      entriesOf([{ plugin: 'git', value: { kind: 'root', id: 'file', titleKey: 't' } }]),
      { onIssue }
    );

    expect(bar.map((menu) => menu.id)).toEqual(['file', 'help']);
    expect(onIssue).toHaveBeenCalledWith(expect.objectContaining({ kind: 'reserved-root' }));
  });

  it('второй корень с тем же именем отклоняется, первый остаётся', () => {
    const onIssue = vi.fn();
    const bar = build(
      entriesOf([
        { plugin: 'a', value: { kind: 'root', id: 'git', titleKey: 'first' } },
        { plugin: 'b', value: { kind: 'root', id: 'git', titleKey: 'second' } },
      ]),
      { onIssue }
    );

    expect(menuOf(bar, 'git').title).toBe('a/first');
    expect(onIssue).toHaveBeenCalledWith(expect.objectContaining({ kind: 'duplicate-root' }));
  });

  it('пустой корень остаётся на месте недоступным', () => {
    const bar = build([]);
    expect(menuOf(bar, 'file')).toMatchObject({ enabled: false, items: [] });
  });

  it('sortMenuRoots держит «справку» последней при любом наборе плагинов', () => {
    expect(sortMenuRoots(['file', 'help'], ['git'])).toEqual(['file', 'git', 'help']);
  });
});

describe('пункт как ссылка на команду', () => {
  it('берёт заголовок команды и её сочетание', () => {
    const bar = build(
      entriesOf([
        { plugin: 'files', value: { kind: 'item', menu: 'file', command: 'files.save' } },
      ]),
      { commands: [command({ id: 'files.save', keybinding: 'mod+s' })] }
    );

    expect(menuOf(bar, 'file').items).toEqual([
      expect.objectContaining({
        kind: 'item',
        // Владелец ключа — владелец КОМАНДЫ: заголовок принадлежит ей, а не пункту.
        title: 'files/files.save.title',
        chord: ['mod+s'],
        enabled: true,
      }),
    ]);
  });

  it('пункт с аргументами сочетания не показывает: клавиши вызывают команду без них', () => {
    const bar = build(
      entriesOf([
        {
          id: 'with-args',
          value: { kind: 'item', menu: 'file', command: 'test.panel', args: { panelId: 'files' } },
        },
        { id: 'plain', value: { kind: 'item', menu: 'file', command: 'test.panel' } },
      ]),
      { commands: [command({ id: 'test.panel', keybinding: 'mod+b' })] }
    );

    expect(menuOf(bar, 'file').items).toEqual([
      expect.objectContaining({ id: 'with-args', chord: undefined }),
      expect.objectContaining({ id: 'plain', chord: ['mod+b'] }),
    ]);
  });

  it('свой titleKey разрешается словарём того, кто внёс ПУНКТ', () => {
    const bar = build(
      entriesOf([
        {
          plugin: 'other',
          value: { kind: 'item', menu: 'file', command: 'files.save', titleKey: 'menu.save' },
        },
      ]),
      { commands: [command({ id: 'files.save' })] }
    );

    expect(shapeOf(menuOf(bar, 'file').items)).toEqual(['other/menu.save']);
  });

  it('пункт без зарегистрированной команды не рисуется вовсе', () => {
    const onIssue = vi.fn();
    const bar = build(
      entriesOf([{ value: { kind: 'item', menu: 'file', command: 'nobody.here' } }]),
      { onIssue }
    );

    expect(menuOf(bar, 'file').items).toEqual([]);
    expect(onIssue).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'unknown-command', target: 'nobody.here' })
    );
  });

  it('недоступная команда даёт серый пункт, а не отсутствующий', () => {
    const bar = build(
      entriesOf([{ value: { kind: 'item', menu: 'file', command: 'test.undo' } }]),
      { commands: [command({ id: 'test.undo', enabled: () => false })] }
    );

    expect(menuOf(bar, 'file').items).toEqual([
      expect.objectContaining({ kind: 'item', enabled: false }),
    ]);
  });

  it('запуск идёт через реестр и несёт аргументы пункта', () => {
    const execute = vi.fn();
    const bar = build(
      entriesOf([
        { value: { kind: 'item', menu: 'file', command: 'test.run', args: { panelId: 'files' } } },
      ]),
      { execute }
    );

    const item = menuOf(bar, 'file').items[0];
    if (item.kind !== 'item') throw new Error('ожидался пункт');
    item.run();

    expect(execute).toHaveBeenCalledWith('test.run', { panelId: 'files' });
  });

  it('переключатель отдаёт состояние, обычный пункт — undefined', () => {
    const bar = build(
      entriesOf([
        {
          id: 'checked',
          value: { kind: 'item', menu: 'file', command: 'test.run', toggled: () => true },
        },
        { id: 'plain', value: { kind: 'item', menu: 'file', command: 'test.run' } },
      ])
    );

    expect(menuOf(bar, 'file').items).toEqual([
      expect.objectContaining({ id: 'checked', checked: true }),
      expect.objectContaining({ id: 'plain', checked: undefined }),
    ]);
  });
});

describe('видимость', () => {
  it('when скрывает пункт, не влияя на соседей', () => {
    const entries = entriesOf([
      {
        id: 'schema',
        value: {
          kind: 'item',
          menu: 'file',
          command: 'test.run',
          when: (ctx) => ctx.activeResourceKind === 'form.schema',
        },
      },
      { id: 'always', value: { kind: 'item', menu: 'file', command: 'test.run' } },
    ]);

    expect(menuOf(build(entries), 'file').items.map((item) => item.id)).toEqual(['always']);
    expect(
      menuOf(
        build(entries, { ctx: whenContext({ activeResourceKind: 'form.schema' }) }),
        'file'
      ).items.map((item) => item.id)
    ).toEqual(['schema', 'always']);
  });

  it('упавший предикат считается запретом и сообщается', () => {
    const onIssue = vi.fn();
    const bar = build(
      entriesOf([
        {
          value: {
            kind: 'item',
            menu: 'file',
            command: 'test.run',
            when: () => {
              throw new Error('предикат сломан');
            },
          },
        },
      ]),
      { onIssue }
    );

    expect(menuOf(bar, 'file').items).toEqual([]);
    expect(onIssue).toHaveBeenCalledWith(expect.objectContaining({ kind: 'predicate-failed' }));
  });
});

describe('группы и разделители', () => {
  it('группы идут по имени, а между ними встаёт линия', () => {
    const bar = build(
      entriesOf([
        { value: { kind: 'item', menu: 'file', command: 'test.save', group: '2_save' } },
        { value: { kind: 'item', menu: 'file', command: 'test.open', group: '1_open' } },
      ]),
      { commands: [command({ id: 'test.open' }), command({ id: 'test.save' })] }
    );

    expect(shapeOf(menuOf(bar, 'file').items)).toEqual([
      'test/test.open.title',
      '---',
      'test/test.save.title',
    ]);
  });

  it('внутри группы порядок задаёт order, при равенстве — порядок регистрации', () => {
    const bar = build(
      entriesOf([
        { value: { kind: 'item', menu: 'file', command: 'test.c', group: 'g', order: 20 } },
        { value: { kind: 'item', menu: 'file', command: 'test.a', group: 'g', order: 10 } },
        { value: { kind: 'item', menu: 'file', command: 'test.b', group: 'g', order: 10 } },
      ]),
      {
        commands: [command({ id: 'test.a' }), command({ id: 'test.b' }), command({ id: 'test.c' })],
      }
    );

    expect(shapeOf(menuOf(bar, 'file').items)).toEqual([
      'test/test.a.title',
      'test/test.b.title',
      'test/test.c.title',
    ]);
  });

  it('опустевшая группа не оставляет разделителя', () => {
    const bar = build(
      entriesOf([
        { value: { kind: 'item', menu: 'file', command: 'test.run', group: '1_first' } },
        {
          value: {
            kind: 'item',
            menu: 'file',
            command: 'test.run',
            group: '2_hidden',
            when: () => false,
          },
        },
        { value: { kind: 'item', menu: 'file', command: 'test.run', group: '3_last' } },
      ])
    );

    expect(shapeOf(menuOf(bar, 'file').items)).toEqual([
      'test/test.run.title',
      '---',
      'test/test.run.title',
    ]);
  });

  it('группа, где у всех пунктов нет команды, тоже не даёт разделителя', () => {
    const bar = build(
      entriesOf([
        { value: { kind: 'item', menu: 'file', command: 'test.run', group: '1_a' } },
        { value: { kind: 'item', menu: 'file', command: 'gone', group: '2_b' } },
        { value: { kind: 'item', menu: 'file', command: 'test.run', group: '3_c' } },
      ])
    );

    expect(menuOf(bar, 'file').items.filter((item) => item.kind === 'separator')).toHaveLength(1);
  });

  it('разделитель не появляется перед первой группой', () => {
    const bar = build(
      entriesOf([{ value: { kind: 'item', menu: 'file', command: 'test.run', group: '9_last' } }])
    );

    expect(menuOf(bar, 'file').items[0].kind).toBe('item');
  });
});

describe('вложенность', () => {
  it('подменю наполняется вкладами по своему адресу — кем угодно, не только автором', () => {
    const bar = build(
      entriesOf([
        {
          plugin: 'shell',
          value: { kind: 'submenu', menu: 'file', submenu: 'file/panels', titleKey: 'panels' },
        },
        { plugin: 'files', value: { kind: 'item', menu: 'file/panels', command: 'test.run' } },
      ])
    );

    expect(shapeOf(menuOf(bar, 'file').items)).toEqual(['shell/panels ▸ [test/test.run.title]']);
  });

  it('пустое подменю не рисуется', () => {
    const bar = build(
      entriesOf([
        { value: { kind: 'submenu', menu: 'file', submenu: 'file/panels', titleKey: 'panels' } },
      ])
    );

    expect(menuOf(bar, 'file')).toMatchObject({ enabled: false, items: [] });
  });

  it('вложенность живёт до предела глубины, а лишний уровень отбрасывается', () => {
    const onIssue = vi.fn();
    const bar = build(
      entriesOf([
        { value: { kind: 'submenu', menu: 'file', submenu: 'a', titleKey: 'a' } },
        { value: { kind: 'submenu', menu: 'a', submenu: 'b', titleKey: 'b' } },
        { value: { kind: 'submenu', menu: 'b', submenu: 'c', titleKey: 'c' } },
        { value: { kind: 'item', menu: 'b', command: 'test.run' } },
        { value: { kind: 'item', menu: 'c', command: 'test.run' } },
      ]),
      { onIssue }
    );

    // Глубина считается путями от корня: `view` → `a` → `b` укладываются в предел,
    // а `c` за ним — вместе со всем, что в него внесли.
    expect(MAX_MENU_DEPTH).toBe(3);
    expect(shapeOf(menuOf(bar, 'file').items)).toEqual([
      'test/a ▸ [test/b ▸ [test/test.run.title]]',
    ]);
    expect(onIssue).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'too-deep', target: 'c' })
    );
  });

  it('подменю, ссылающееся на предка, обрывается вместо зацикливания', () => {
    const onIssue = vi.fn();
    const bar = build(
      entriesOf([
        { value: { kind: 'submenu', menu: 'file', submenu: 'loop', titleKey: 'loop' } },
        { value: { kind: 'submenu', menu: 'loop', submenu: 'file', titleKey: 'back' } },
        { value: { kind: 'item', menu: 'loop', command: 'test.run' } },
      ]),
      { onIssue }
    );

    expect(shapeOf(menuOf(bar, 'file').items)).toEqual(['test/loop ▸ [test/test.run.title]']);
    expect(onIssue).toHaveBeenCalledWith(expect.objectContaining({ kind: 'cycle' }));
  });
});

describe('динамические группы', () => {
  it('пункты собираются при построении и несут готовые заголовки', () => {
    const bar = build(
      entriesOf([
        {
          value: {
            kind: 'dynamic',
            menu: 'file',
            items: () => [
              { id: 'files', command: 'test.run', title: 'Файлы', toggled: true },
              { id: 'problems', command: 'test.run', title: 'Проблемы', toggled: false },
            ],
          },
        },
      ])
    );

    expect(menuOf(bar, 'file').items).toEqual([
      expect.objectContaining({ title: 'Файлы', checked: true }),
      expect.objectContaining({ title: 'Проблемы', checked: false }),
    ]);
  });

  it('поставщик видит контекст применимости', () => {
    const items = vi.fn(() => []);
    build(entriesOf([{ value: { kind: 'dynamic', menu: 'file', items } }]), {
      ctx: whenContext({ activeEditorId: 'form.json' }),
    });

    // Вторым аргументом идёт цель щелчка: у меню шапки её нет, у контекстного — есть.
    expect(items).toHaveBeenCalledWith(
      expect.objectContaining({ activeEditorId: 'form.json' }),
      undefined
    );
  });

  it('упавший поставщик даёт пустую группу, а не пустое меню', () => {
    const onIssue = vi.fn();
    const bar = build(
      entriesOf([
        { value: { kind: 'item', menu: 'file', command: 'test.run', group: '1_a' } },
        {
          value: {
            kind: 'dynamic',
            menu: 'file',
            group: '2_b',
            items: () => {
              throw new Error('поставщик сломан');
            },
          },
        },
      ]),
      { onIssue }
    );

    expect(shapeOf(menuOf(bar, 'file').items)).toEqual(['test/test.run.title']);
    expect(onIssue).toHaveBeenCalledWith(expect.objectContaining({ kind: 'predicate-failed' }));
  });
});

describe('встроенные записи оболочки', () => {
  it('заголовок записи без владельца разрешается словарём Host', () => {
    const bar = build(
      [hostMenuEntry('shell.help.about', { kind: 'item', menu: 'help', command: 'about' })],
      { commands: [command({ id: 'about' })] }
    );

    expect(shapeOf(menuOf(bar, 'help').items)).toEqual(['host/about.title']);
  });

  it('встроенные и внесённые записи складываются в одно меню', () => {
    const entries = [
      hostMenuEntry('shell.view.palette', {
        kind: 'item',
        menu: 'file',
        command: 'test.run',
        group: '1_shell',
      }),
      ...entriesOf([
        {
          plugin: 'preview',
          value: { kind: 'item', menu: 'file', command: 'test.run', group: '2_plugins' },
        },
      ]),
    ];

    // Оба заголовка от владельца КОМАНДЫ: чья запись поставила пункт — на имя не влияет.
    expect(shapeOf(menuOf(build(entries), 'file').items)).toEqual([
      'test/test.run.title',
      '---',
      'test/test.run.title',
    ]);
  });
});

describe('unknownMenuPaths', () => {
  it('находит вклад, промахнувшийся мимо всех объявленных адресов', () => {
    const issues = unknownMenuPaths(
      entriesOf([
        { plugin: 'git', value: { kind: 'item', menu: 'vieww', command: 'test.run' } },
        { value: { kind: 'item', menu: 'file', command: 'test.run' } },
      ])
    );

    expect(issues).toEqual([
      expect.objectContaining({ kind: 'unknown-menu', target: 'vieww', pluginId: 'git' }),
    ]);
  });

  it('адрес подменю и корень плагина считаются объявленными', () => {
    const issues = unknownMenuPaths(
      entriesOf([
        { value: { kind: 'submenu', menu: 'file', submenu: 'file/panels', titleKey: 't' } },
        { value: { kind: 'item', menu: 'file/panels', command: 'test.run' } },
        { value: { kind: 'root', id: 'git', titleKey: 't' } },
        { value: { kind: 'item', menu: 'git', command: 'test.run' } },
      ])
    );

    expect(issues).toEqual([]);
  });
});
