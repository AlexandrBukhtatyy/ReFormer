/**
 * Сочетания клавиш редактора схемы — от нажатия до правки документа.
 *
 * Файл существует потому, что «команда есть» и «клавиша работает» — разные утверждения,
 * и первое проверяется без браузера, а второе нет. Между ними лежит целая цепочка: событие
 * всплывает до `document`, диспетчер сопоставляет его с сочетанием, разворачивает `mod`
 * в платформенный модификатор, спрашивает `enabled` и только потом зовёт команду. Порвись
 * она в любом месте — человек увидит ровно одно: «клавиша не работает».
 *
 * Проверяются те сочетания, о которых спросили: группировка (она была и раньше, но её
 * работоспособность никто не подтверждал) и перемещение (его не было вовсе).
 *
 * @module app/schema-keys.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { useCallback, useMemo, useSyncExternalStore, type ReactElement } from 'react';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { DEFAULT_COL_CLASS } from '@/lib/form-model/mutate';
import { getAt } from '@/lib/form-model/paths';
import type { CatalogEntry } from '@/lib/catalog/types';
import { renderReact } from '@/testing/render';
import { createCommandRegistry } from '@/host/primitives/command';
import { installKeybindings } from '@/host/ui/keybindings';
import { createKeymapService } from '../host/ui/keymap';
import type { WhenContext } from '@/host/primitives/when-context';
import { schemaEditorCommands, type CommandAccess } from '@/plugins/editor-schema/commands';
import { createQuickAddStore, type QuickAddStore } from '@/plugins/editor-schema/quick-add-store';
import { QuickAddDialog } from '@/plugins/editor-schema/ui/QuickAddDialog';
import { createDragSession } from '@/plugins/editor-schema/drag-session';
import { indexNodes } from '@/plugins/editor-schema/node-index';
import { createSessionRegistry, type SessionRegistry } from '@/plugins/editor-schema/sessions';
import { createFakeSchemaHost } from '@/plugins/editor-schema/testing';
import { SchematicView } from '@/plugins/editor-schema/ui/SchematicView';
import { useActiveSession, useSessionState } from '@/plugins/editor-schema/ui/useSession';

const DOCUMENT = 'fake:form.json';

/** Столбец из трёх полей — на нём видно и группировку, и перестановку. */
function schema(): JsonFormSchema {
  return {
    version: '1.0',
    root: {
      component: '$html(div)',
      componentProps: { className: DEFAULT_COL_CLASS },
      children: [
        { value: '$model(first)', component: '$component(Input)' },
        { value: '$model(second)', component: '$component(Input)' },
        { value: '$model(third)', component: '$component(Input)' },
      ],
    },
  } as unknown as JsonFormSchema;
}

const NO_COMMANDS: CommandAccess = { has: () => false, run: () => undefined };

/** Каталог диалога: одной записи хватает — здесь проверяется путь клавиши, а не выдача. */
const QUICK_ADD_CATALOG = [
  {
    name: 'Input',
    role: 'field',
    category: 'Поля ввода',
    propsSchema: { type: 'object', properties: {} },
    makeNode: () => ({ value: '$model(new)', component: '$component(Input)' }),
  },
] as unknown as CatalogEntry[];

function Harness({
  registry,
  quickAdd,
}: {
  registry: SessionRegistry;
  quickAdd: QuickAddStore | null;
}): ReactElement {
  const session = useActiveSession(registry);
  const state = useSessionState(registry, session);
  const drag = useMemo(() => createDragSession(), []);
  const subscribe = useCallback(
    (listener: () => void) => {
      if (quickAdd === null) return () => undefined;
      const subscription = quickAdd.subscribe(listener);
      return () => {
        subscription.dispose();
      };
    },
    [quickAdd]
  );
  const snapshot = useCallback(() => quickAdd?.isOpen() ?? false, [quickAdd]);
  const dialogOpen = useSyncExternalStore(subscribe, snapshot, snapshot);
  if (session === null || state === null) return <div>сеанса нет</div>;
  return (
    <div style={{ width: 520 }}>
      <SchematicView
        session={session}
        state={state}
        t={(key) => key}
        commands={NO_COMMANDS}
        drag={drag}
      />
      {quickAdd !== null && (
        <QuickAddDialog
          open={dialogOpen}
          onClose={quickAdd.close}
          session={session}
          state={state}
          t={(key) => key}
          catalog={QUICK_ADD_CATALOG}
        />
      )}
    </div>
  );
}

async function mount(options: { quickAdd?: boolean } = {}) {
  const host = createFakeSchemaHost({ documentId: DOCUMENT, text: JSON.stringify(schema()) });
  const registry = createSessionRegistry({ host });
  const session = registry.open(DOCUMENT);
  if (session === null) throw new Error('сеанс не открылся');

  // Настоящий реестр и настоящий диспетчер: подделка проверяла бы подделку.
  const commands = createCommandRegistry();
  const quickAdd = options.quickAdd === true ? createQuickAddStore() : null;
  const disposables = schemaEditorCommands(registry, host, quickAdd).map((command) =>
    commands.register(command)
  );
  const context: WhenContext = {
    focus: 'canvas',
    activeEditorId: DOCUMENT,
    activeResourceKind: 'form.schema',
    hasSelection: true,
    previewMode: null,
  };
  const keymap = createKeymapService({ commands, modifier: 'ctrl' });
  const keys = installKeybindings(document, { commands, keymap, getContext: () => context });

  const mounted = renderReact(<Harness registry={registry} quickAdd={quickAdd} />);
  await vi.waitFor(() => {
    if (mounted.container.querySelector('[data-node-id]') === null) {
      throw new Error('коробки ещё не отрисованы');
    }
  });

  const model = (): JsonFormSchema => session.get().model;
  return {
    model,
    idAt: (path: readonly (string | number)[]): string => {
      const id = indexNodes(model()).idAt(path);
      if (id === undefined) throw new Error(`нет адреса по пути ${path.join('/')}`);
      return id;
    },
    select: (ids: readonly string[]) => {
      session.setSelection([...ids]);
    },
    selection: (): readonly string[] => session.get().selection,
    unmount: () => {
      mounted.unmount();
      keys.dispose();
      for (const item of disposables) item.dispose();
    },
  };
}

function bindings(model: JsonFormSchema, path: readonly (string | number)[]): unknown[] {
  const list = getAt(model, path);
  if (!Array.isArray(list)) throw new Error('по этому пути не массив');
  return (list as { value?: string; component?: string }[]).map(
    (node) => node.value ?? node.component
  );
}

const FIRST = ['root', 'children', 0] as const;
const SECOND = ['root', 'children', 1] as const;

describe('сочетания клавиш над схемой', () => {
  it('Ctrl+G группирует выделенное — команда была, но путь до неё никто не проверял', async () => {
    const fixture = await mount();
    fixture.select([fixture.idAt(FIRST), fixture.idAt(SECOND)]);

    await userEvent.keyboard('{Control>}g{/Control}');

    await expect
      .poll(() => bindings(fixture.model(), ['root', 'children']))
      .toEqual(['$html(div)', '$model(third)']);
    fixture.unmount();
  });

  it('Ctrl+стрелка переставляет узел среди соседей', async () => {
    const fixture = await mount();
    fixture.select([fixture.idAt(FIRST)]);

    await userEvent.keyboard('{Control>}{ArrowDown}{/Control}');

    await expect
      .poll(() => bindings(fixture.model(), ['root', 'children']))
      .toEqual(['$model(second)', '$model(first)', '$model(third)']);
    fixture.unmount();
  });

  it('Backspace удаляет так же, как Delete', async () => {
    const fixture = await mount();
    fixture.select([fixture.idAt(SECOND)]);

    await userEvent.keyboard('{Backspace}');

    await expect
      .poll(() => bindings(fixture.model(), ['root', 'children']))
      .toEqual(['$model(first)', '$model(third)']);
    fixture.unmount();
  });

  it('Ctrl+Shift+L переворачивает направление контейнера', async () => {
    const fixture = await mount();
    fixture.select([fixture.idAt(['root'])]);

    await userEvent.keyboard('{Control>}{Shift>}l{/Shift}{/Control}');

    await expect
      .poll(() => {
        const root = fixture.model().root as { componentProps?: { className?: string } };
        return root.componentProps?.className ?? '';
      })
      .not.toContain('flex-col');
    fixture.unmount();
  });
});

describe('стрелка и стрелка с модификатором — разные действия', () => {
  it('Ctrl+стрелка двигает узел и НЕ уводит с него курсор', async () => {
    const fixture = await mount();
    const first = fixture.idAt(FIRST);
    fixture.select([first]);

    await userEvent.keyboard('{Control>}{ArrowDown}{/Control}');

    // Узел уехал вниз...
    await expect
      .poll(() => bindings(fixture.model(), ['root', 'children']))
      .toEqual(['$model(second)', '$model(first)', '$model(third)']);
    // ...а выделение осталось на нём: канвас на стрелку с модификатором курсор не двигает,
    // иначе одно нажатие делало бы два дела сразу.
    expect(fixture.selection()).toEqual([first]);
  });

  it('стрелка без модификатора двигает только курсор', async () => {
    const fixture = await mount();
    const before = JSON.stringify(fixture.model());
    // Щелчком, а не программно: курсор двигает САМ канвас, и до его обработчика событие
    // доходит только когда фокус внутри вида. Команды же работают и без фокуса на канвасе —
    // именно поэтому остальные проверки этого файла обходятся без щелчка.
    const box = document.querySelector<HTMLElement>(`[data-node-id="${fixture.idAt(FIRST)}"]`);
    if (box === null) throw new Error('коробки нет на экране');
    await userEvent.click(box);

    await userEvent.keyboard('{ArrowDown}');

    await expect.poll(() => fixture.selection()).toEqual([fixture.idAt(SECOND)]);
    expect(JSON.stringify(fixture.model())).toBe(before);
  });

  it('Alt+Shift+стрелка дублирует в направлении', async () => {
    const fixture = await mount();
    fixture.select([fixture.idAt(FIRST)]);

    await userEvent.keyboard('{Alt>}{Shift>}{ArrowDown}{/Shift}{/Alt}');

    await expect
      .poll(() => bindings(fixture.model(), ['root', 'children']))
      .toEqual(['$model(first)', '$model(first)', '$model(second)', '$model(third)']);
  });

  it('Escape схлопывает выделение до одного узла, потом поднимает к родителю', async () => {
    const fixture = await mount();
    const second = fixture.idAt(SECOND);
    fixture.select([fixture.idAt(FIRST), second]);

    await userEvent.keyboard('{Escape}');
    await expect.poll(() => fixture.selection()).toEqual([second]);

    await userEvent.keyboard('{Escape}');
    await expect.poll(() => fixture.selection()).toEqual([fixture.idAt(['root'])]);
  });
});

describe('быстрое добавление', () => {
  it('Enter на канвасе открывает диалог, а стрелки в нём не двигают курсор канваса', async () => {
    const fixture = await mount({ quickAdd: true });
    const first = fixture.idAt(FIRST);
    fixture.select([first]);

    await userEvent.keyboard('{Enter}');
    await vi.waitFor(() => {
      if (document.querySelector('[data-quick-search]') === null) {
        throw new Error('диалог не открылся');
      }
    });

    // Стрелка ушла в сетку диалога: выделение на канвасе осталось прежним.
    await userEvent.keyboard('{ArrowDown}');
    expect(fixture.selection()).toEqual([first]);
    fixture.unmount();
  });
});
