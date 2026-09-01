/**
 * Проверка КЛАВИАТУРЫ СОБРАННОГО приложения, а не отдельных её правил.
 *
 * Каждый плагин объявляет сочетания сам и про соседей не знает — так и задумано. Но сумма
 * их объявлений — это раскладка, которую получает человек, и у неё есть свойства, которых
 * нет ни у одного слагаемого. Проверить их можно только там, где плагины встречаются, то есть
 * здесь.
 *
 * Дефект, ради которого файл заведён, был настоящим: `delete` объявляли ДВОЕ — дерево файлов
 * («удалить файл») и редактор схемы («удалить узел»), — и разводил их только порядок
 * регистрации. Порядок активации плагинов по контракту рантайма (`plugin/registry.test.ts`)
 * не значит ничего, то есть исход зависел от случайности. То же самое было у `mod+d`, `mod+g`
 * и у стрелок с модификатором: их предикаты вообще не смотрели на фокус.
 *
 * Сеть ловит возвращение этого класса ошибок: если кто-то добавит клавишу, уже занятую в
 * другом месте, и не скажет условием, чем его случай отличается, — тест покраснеет.
 *
 * @module app/keybindings-wiring.test
 */

import { describe, expect, it, vi } from 'vitest';
import { createCommandRegistry, whenOf } from '@/shell/platform/primitives/command';
import type { CommandContribution } from '@/shell/platform/primitives/command';
import { createEventBus } from '@/shell/platform/primitives/event';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import { createServiceRegistry } from '@/shell/platform/primitives/service';
import { createPluginRegistry } from '@/shell/platform/plugin/registry';
import { createMemoryStorageBackend } from '@/shell/platform/plugin/storage';
import { normalizeKeybinding } from '@/shell/platform/primitives/command';
import { provablyDisjoint } from '@/shell/platform/primitives/when-expr';
import { readWhenContext } from '@/shell/platform/services/context-keys';
import { shouldDispatch } from '@/shell/platform/ui/keybindings';
import { whenContext } from '@/shell/platform/primitives/when-context';
import { createFocusRegistry } from '@/plugins/editor-monaco';
import { createBuiltinPlugins } from './plugins';

/**
 * Порты-пустышки. Тот же приём и та же причина, что в `plugins.test.ts`: здесь проверяется
 * СОСТАВ объявленных сочетаний, а не поведение портов.
 */
function stubHost(): never {
  return new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'then') return undefined;
        return typeof prop === 'string' && prop.startsWith('use')
          ? function useStub(): unknown {
              return () => '';
            }
          : () => null;
      },
    }
  ) as never;
}

/** Команды всех встроенных плагинов — ровно те, что получит собранное приложение. */
function builtinCommands(): readonly CommandContribution[] {
  const commands = createCommandRegistry();
  const plugins = createPluginRegistry({
    services: createServiceRegistry(),
    extensions: createExtensionRegistry(),
    commands,
    events: createEventBus(),
    storage: createMemoryStorageBackend(),
    onError: vi.fn(),
  });

  plugins.registerAll(
    createBuiltinPlugins({
      files: stubHost(),
      monaco: stubHost(),
      monacoFocus: createFocusRegistry(),
      monacoI18n: undefined,
      markdown: stubHost(),
      markdownI18n: undefined,
      schema: stubHost(),
      schemaI18n: undefined,
      ai: stubHost(),
      aiI18n: undefined,
      preview: stubHost(),
      previewI18n: undefined,
      codegen: stubHost(),
      codegenI18n: undefined,
      templates: stubHost(),
      templatesI18n: undefined,
      printTemplate: () => Promise.resolve([]),
      kits: { translate: (key: string) => key },
    })
  );
  plugins.activateAll();
  return commands.getAll();
}

/** Команды с сочетаниями, сгруппированные по каноническому написанию сочетания. */
function byKeybinding(
  commands: readonly CommandContribution[]
): ReadonlyMap<string, readonly CommandContribution[]> {
  const groups = new Map<string, CommandContribution[]>();
  for (const command of commands) {
    if (command.keybinding === undefined) continue;
    const binding = normalizeKeybinding(command.keybinding);
    const group = groups.get(binding) ?? [];
    group.push(command);
    groups.set(binding, group);
  }
  return groups;
}

describe('раскладка собранного приложения', () => {
  it('у каждой пары на одном сочетании условия ДОКАЗУЕМО не пересекаются', () => {
    // Несущий тест файла. «Доказуемо» — это `provablyDisjoint`, и он намеренно неполон:
    // доказывает только сравнение одного ключа с разными литералами. Поэтому пройти его
    // нельзя хитростью — только назвав место, где клавиша работает.
    const groups = byKeybinding(builtinCommands());
    const collisions: string[] = [];

    for (const [binding, group] of groups) {
      for (let i = 0; i < group.length; i += 1) {
        for (let j = i + 1; j < group.length; j += 1) {
          const [a, b] = [group[i], group[j]];
          if (provablyDisjoint(whenOf(a), whenOf(b))) continue;
          collisions.push(
            `${binding}: «${a.id}» (when: ${a.when ?? '—'}) против «${b.id}» (when: ${b.when ?? '—'})`
          );
        }
      }
    }

    expect(collisions).toEqual([]);
  });

  it('сочетание delete разведено между деревом файлов и канвасом схемы', () => {
    // Именно тот дефект, ради которого всё делалось, — проверяется поимённо, а не только
    // через общее правило выше: общее правило пройдёт и если обе команды исчезнут.
    const group = byKeybinding(builtinCommands()).get('delete') ?? [];
    const ids = group.map((command) => command.id);

    expect(ids).toContain('files.delete');
    expect(ids).toContain('editor-schema.delete');

    const inTree = whenContext({ focus: 'tree' });
    const onCanvas = whenContext({ focus: 'canvas' });
    const fires = (command: CommandContribution, ctx: ReturnType<typeof whenContext>): boolean =>
      shouldDispatch(
        'delete',
        ctx,
        { ...command, enabled: undefined },
        {
          read: readWhenContext(ctx),
        }
      );

    const file = group.find((command) => command.id === 'files.delete');
    const node = group.find((command) => command.id === 'editor-schema.delete');
    expect(file && fires(file, inTree)).toBe(true);
    expect(file && fires(file, onCanvas)).toBe(false);
    expect(node && fires(node, onCanvas)).toBe(true);
    expect(node && fires(node, inTree)).toBe(false);
  });

  it('клавиши канваса не срабатывают из дерева файлов', () => {
    // До условий у этих команд предикат смотрел только на выделение: `mod+d` в дереве
    // дублировал узел схемы, если в схеме что-то оставалось выделенным.
    const commands = builtinCommands();
    const inTree = whenContext({ focus: 'tree' });

    const canvasKeys = ['mod+d', 'mod+g', 'mod+arrowup', 'alt+shift+arrowdown'];
    for (const key of canvasKeys) {
      const group = byKeybinding(commands).get(normalizeKeybinding(key)) ?? [];
      expect(group.length, `сочетание ${key} должно быть объявлено`).toBeGreaterThan(0);
      for (const command of group) {
        expect(
          shouldDispatch(
            normalizeKeybinding(key),
            inTree,
            { ...command, enabled: undefined },
            {
              read: readWhenContext(inTree),
            }
          ),
          `${command.id} не должна срабатывать при фокусе в дереве`
        ).toBe(false);
      }
    }
  });

  it('отмена схемы не рассматривается на вкладке другого вида', () => {
    const commands = builtinCommands();
    const undo = commands.find((command) => command.id === 'editor-schema.undo');
    expect(undo).toBeDefined();
    if (undo === undefined) return;

    const onSchema = whenContext({ activeResourceKind: 'form.schema' });
    const onMarkdown = whenContext({ activeResourceKind: 'text/markdown' });
    const fires = (ctx: ReturnType<typeof whenContext>): boolean =>
      shouldDispatch(
        'ctrl+z',
        ctx,
        { ...undo, enabled: undefined },
        { read: readWhenContext(ctx) }
      );

    expect(fires(onSchema)).toBe(true);
    expect(fires(onMarkdown)).toBe(false);
  });

  it('все объявленные условия разбираются', () => {
    // Реестр проверяет условие на регистрации и отказал бы раньше, поэтому тест
    // страхует не от опечатки, а от условия, которое разбирается во что-то пустое:
    // «всегда» у команды, которая его написала, — это промах, а не значение.
    for (const command of builtinCommands()) {
      if (command.when === undefined) continue;
      expect(whenOf(command).source, `условие «${command.id}» пусто`).not.toBe('');
    }
  });
});
