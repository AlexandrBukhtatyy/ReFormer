import { describe, expect, it, vi } from 'vitest';

import { createCommandRegistry } from '@/shell/platform/primitives/command';
import type { CommandContribution } from '@/shell/platform/primitives/command';
import { compileWhen, WHEN_TRUE } from '@/shell/platform/primitives/when-expr';
import { createKeymapService, KEYMAP_SETTINGS_KEY } from './keymap';

const command = (patch: Partial<CommandContribution> & { id: string }): CommandContribution => ({
  titleKey: 'test.command.title',
  run: () => undefined,
  ...patch,
});

function setup(options: { onBuild?: () => void } = {}) {
  const commands = createCommandRegistry();
  const keymap = createKeymapService({
    commands,
    modifier: 'ctrl',
    ...(options.onBuild === undefined ? {} : { onBuild: options.onBuild }),
  });
  return { commands, keymap };
}

describe('сборка указателя', () => {
  it('пересобирается ЛЕНИВО: двадцать регистраций дают одну сборку', () => {
    // Требование, а не аккуратность: активация плагина регистрирует до двух десятков команд
    // одним синхронным проходом, и жадная стратегия дала бы двадцать полных пересборок
    // за время запуска. Снаружи ленивость иначе не проверить — результат у обеих стратегий
    // одинаков, различается только число сборок.
    const onBuild = vi.fn();
    const { commands, keymap } = setup({ onBuild });

    for (let i = 0; i < 20; i += 1) {
      commands.register(command({ id: `a.${String(i)}`, keybinding: `mod+${String(i % 10)}` }));
    }
    keymap.index();

    expect(onBuild).toHaveBeenCalledTimes(1);
  });

  it('повторное чтение без изменений не пересобирает', () => {
    const onBuild = vi.fn();
    const { keymap } = setup({ onBuild });

    keymap.index();
    keymap.index();

    expect(onBuild).toHaveBeenCalledTimes(1);
  });

  it('после регистрации новой команды указатель отдаёт её правило', () => {
    // Обратная сторона ленивости и самый неприятный из возможных отказов: забытый сброс
    // кэша выглядит как «клавиша молча перестала работать после включения плагина».
    const { commands, keymap } = setup();
    expect(keymap.index().rulesFor('ctrl+s')).toEqual([]);

    commands.register(command({ id: 'files.save', keybinding: 'mod+s' }));

    expect(
      keymap
        .index()
        .rulesFor('ctrl+s')
        .map((r) => r.commandId)
    ).toEqual(['files.save']);
  });

  it('снятая команда уходит из указателя', () => {
    const { commands, keymap } = setup();
    const subscription = commands.register(command({ id: 'files.save', keybinding: 'mod+s' }));
    expect(keymap.index().rulesFor('ctrl+s')).toHaveLength(1);

    subscription.dispose();

    expect(keymap.index().rulesFor('ctrl+s')).toEqual([]);
  });

  it('условие команды становится условием правила', () => {
    const { commands, keymap } = setup();
    commands.register(command({ id: 'files.delete', keybinding: 'delete', when: 'focus == tree' }));

    expect(keymap.index().rulesFor('delete')[0].when.source).toBe('focus == tree');
  });
});

describe('внешние источники правил', () => {
  it('правило источника попадает в указатель и выигрывает по слою', () => {
    const { commands, keymap } = setup();
    commands.register(command({ id: 'plugin.action', keybinding: 'mod+i' }));

    keymap.registerRules('user', 'user', [
      { chord: ['mod+i'], commandId: 'user.action', when: WHEN_TRUE },
    ]);

    expect(keymap.index().rulesFor('ctrl+i')[0].commandId).toBe('user.action');
  });

  it('повторная регистрация ЗАМЕЩАЕТ набор источника целиком', () => {
    // Форма и довод те же, что у публикации диагностик: источник приносит «всё, что у меня
    // есть сейчас». Иначе снятие пришлось бы делать вторым вызовом, и первый же забытый
    // оставил бы клавишу от плагина, которого больше нет.
    const { keymap } = setup();
    keymap.registerRules('acme', 'catalog-plugin', [
      { chord: ['mod+i'], commandId: 'acme.first', when: WHEN_TRUE },
    ]);

    keymap.registerRules('acme', 'catalog-plugin', [
      { chord: ['mod+j'], commandId: 'acme.second', when: WHEN_TRUE },
    ]);

    expect(keymap.index().rulesFor('ctrl+i')).toEqual([]);
    expect(
      keymap
        .index()
        .rulesFor('ctrl+j')
        .map((r) => r.commandId)
    ).toEqual(['acme.second']);
  });

  it('снятие источника убирает его правила', () => {
    const { keymap } = setup();
    const subscription = keymap.registerRules('acme', 'catalog-plugin', [
      { chord: ['mod+i'], commandId: 'acme.insert', when: WHEN_TRUE },
    ]);

    subscription.dispose();

    expect(keymap.index().rulesFor('ctrl+i')).toEqual([]);
  });

  it('снятие устаревшей подписки не уносит правила, зарегистрированные тем же источником позже', () => {
    const { keymap } = setup();
    const stale = keymap.registerRules('acme', 'catalog-plugin', [
      { chord: ['mod+i'], commandId: 'acme.old', when: WHEN_TRUE },
    ]);
    keymap.registerRules('acme', 'catalog-plugin', [
      { chord: ['mod+i'], commandId: 'acme.new', when: WHEN_TRUE },
    ]);

    stale.dispose();

    expect(
      keymap
        .index()
        .rulesFor('ctrl+i')
        .map((r) => r.commandId)
    ).toEqual(['acme.new']);
  });

  it('правило источника несёт аргументы вызова', () => {
    const { keymap } = setup();
    keymap.registerRules('acme', 'catalog-plugin', [
      { chord: ['mod+i'], commandId: 'acme.insert', when: WHEN_TRUE, args: { kind: 'field' } },
    ]);

    expect(keymap.index().rulesFor('ctrl+i')[0].args).toEqual({ kind: 'field' });
  });
});

describe('уведомления', () => {
  it('регистрация команды уведомляет подписчиков раскладки', () => {
    // На этом держатся меню и таблица клавиш: они строятся из действующих правил.
    const { commands, keymap } = setup();
    const seen = vi.fn();
    keymap.onDidChange(seen);

    commands.register(command({ id: 'a.save', keybinding: 'mod+s' }));

    expect(seen).toHaveBeenCalled();
  });

  it('подписка снимается', () => {
    const { commands, keymap } = setup();
    const seen = vi.fn();
    keymap.onDidChange(seen).dispose();

    commands.register(command({ id: 'a.save', keybinding: 'mod+s' }));

    expect(seen).not.toHaveBeenCalled();
  });
});

describe('конфликты', () => {
  it('пара, которую нечем разрешить, попадает в список', () => {
    const { commands, keymap } = setup();
    commands.register(command({ id: 'a.one', keybinding: 'mod+k', when: 'hasSelection' }));
    commands.register(command({ id: 'a.two', keybinding: 'mod+k', when: 'previewMode' }));

    const found = keymap.conflicts();

    expect(found).toHaveLength(1);
    expect(found[0].rules.map((r) => r.commandId).sort()).toEqual(['a.one', 'a.two']);
  });

  it('разведённые условиями клавиши конфликтом не считаются', () => {
    const { commands, keymap } = setup();
    commands.register(command({ id: 'files.delete', keybinding: 'delete', when: 'focus == tree' }));
    commands.register(
      command({ id: 'schema.delete', keybinding: 'delete', when: 'focus == canvas' })
    );

    expect(keymap.conflicts()).toEqual([]);
  });

  it('список пересчитывается после изменения набора', () => {
    const { commands, keymap } = setup();
    commands.register(command({ id: 'a.one', keybinding: 'mod+k' }));
    expect(keymap.conflicts()).toEqual([]);

    commands.register(command({ id: 'a.two', keybinding: 'mod+k' }));

    expect(keymap.conflicts()).toHaveLength(1);
  });
});

describe('освобождение', () => {
  it('dispose снимает подписку на реестр команд', () => {
    // Брошенная подписка пережила бы оболочку: раскладка создаётся и на каждый тест,
    // и на каждое монтирование Shell без композиции.
    const { commands, keymap } = setup();
    keymap.dispose();

    expect(() => commands.register(command({ id: 'a.save', keybinding: 'mod+s' }))).not.toThrow();
  });
});

describe('условие правила из команды разбирается один раз', () => {
  it('одна и та же строка у разных команд даёт равные условия', () => {
    const { commands, keymap } = setup();
    commands.register(command({ id: 'a.one', keybinding: 'mod+1', when: 'focus == tree' }));
    commands.register(command({ id: 'a.two', keybinding: 'mod+2', when: 'focus == tree' }));

    const built = keymap.index();

    expect(built.rulesFor('ctrl+1')[0].when.specificity).toBe(
      built.rulesFor('ctrl+2')[0].when.specificity
    );
    expect(built.rulesFor('ctrl+1')[0].when.ast).toEqual(compileWhen('focus == tree').ast);
  });
});

/** Настройки-двойник: раскладка человека приходит из них и в них же уходит. */
function settingsStub(initial?: unknown) {
  let value = initial;
  const listeners = new Set<(key: string) => void>();
  return {
    get: <T>(): T | undefined => value as T | undefined,
    set: async (_key: string, next: unknown): Promise<void> => {
      value = next;
      for (const listener of [...listeners]) listener(KEYMAP_SETTINGS_KEY);
      await Promise.resolve();
    },
    onDidChange: (cb: (key: string) => void) => {
      listeners.add(cb);
      return { dispose: () => listeners.delete(cb) };
    },
  };
}

describe('раскладка человека', () => {
  it('переопределяет сочетание команды и выигрывает по слою', () => {
    const commands = createCommandRegistry();
    commands.register(command({ id: 'editor-schema.duplicate', keybinding: 'mod+d' }));
    const keymap = createKeymapService({
      commands,
      modifier: 'ctrl',
      settings: settingsStub([{ key: 'ctrl+alt+d', command: 'editor-schema.duplicate' }]),
    });

    expect(keymap.index().rulesFor('ctrl+alt+d')[0].commandId).toBe('editor-schema.duplicate');
    expect(keymap.index().rulesFor('ctrl+alt+d')[0].layer).toBe('user');
  });

  it('ведущий минус СНИМАЕТ привязку команды к клавише', () => {
    const commands = createCommandRegistry();
    commands.register(command({ id: 'editor-schema.duplicate', keybinding: 'mod+d' }));
    const keymap = createKeymapService({
      commands,
      modifier: 'ctrl',
      settings: settingsStub([{ key: 'mod+d', command: '-editor-schema.duplicate' }]),
    });

    expect(keymap.index().rulesFor('ctrl+d')).toEqual([]);
  });

  it('одинокий минус освобождает клавишу целиком', () => {
    const commands = createCommandRegistry();
    commands.register(command({ id: 'a.one', keybinding: 'mod+d' }));
    commands.register(command({ id: 'a.two', keybinding: 'mod+d' }));
    const keymap = createKeymapService({
      commands,
      modifier: 'ctrl',
      settings: settingsStub([{ key: 'mod+d', command: '-' }]),
    });

    expect(keymap.index().rulesFor('ctrl+d')).toEqual([]);
  });

  it('снятие не трогает другие записи самого человека', () => {
    // Иначе порядок строк в его файле стал бы значимым.
    const commands = createCommandRegistry();
    commands.register(command({ id: 'a.one', keybinding: 'mod+d' }));
    const keymap = createKeymapService({
      commands,
      modifier: 'ctrl',
      settings: settingsStub([
        { key: 'mod+d', command: '-' },
        { key: 'mod+d', command: 'a.other' },
      ]),
    });

    expect(
      keymap
        .index()
        .rulesFor('ctrl+d')
        .map((r) => r.commandId)
    ).toEqual(['a.other']);
  });

  it('испорченная запись отбрасывается ПОЭЛЕМЕНТНО, остальные применяются', () => {
    // В настройках лежит то, что положили прошлые версии приложения. Отказ загрузки запер бы
    // человека снаружи: чинят раскладку именно в приложении.
    const commands = createCommandRegistry();
    const keymap = createKeymapService({
      commands,
      modifier: 'ctrl',
      settings: settingsStub([
        { key: 'mod+', command: 'a.broken' },
        { key: 'mod+i', command: 'a.good' },
      ]),
    });

    expect(
      keymap
        .index()
        .rulesFor('ctrl+i')
        .map((r) => r.commandId)
    ).toEqual(['a.good']);
    expect(keymap.issues()).toHaveLength(1);
    expect(keymap.issues()[0]).toMatchObject({ kind: 'invalid-key', at: 0 });
  });

  it('неразбираемое условие отбрасывает запись, а не применяет её без условия', () => {
    // Применить «как есть» значило бы дать клавише работать везде — то есть сделать
    // не то, о чём просил человек.
    const keymap = createKeymapService({
      commands: createCommandRegistry(),
      modifier: 'ctrl',
      settings: settingsStub([{ key: 'mod+i', command: 'a.good', when: 'focus ==' }]),
    });

    expect(keymap.index().rulesFor('ctrl+i')).toEqual([]);
    expect(keymap.issues()[0].kind).toBe('invalid-when');
  });

  it('условие записи разбирается и работает', () => {
    const keymap = createKeymapService({
      commands: createCommandRegistry(),
      modifier: 'ctrl',
      settings: settingsStub([{ key: 'mod+i', command: 'a.good', when: 'focus == tree' }]),
    });

    expect(keymap.index().rulesFor('ctrl+i')[0].when.source).toBe('focus == tree');
  });

  it('правило на команду, которой нет, остаётся — плагин может вернуться', () => {
    // Удаление потеряло бы работу человека при первом же запуске с выключенным плагином.
    const keymap = createKeymapService({
      commands: createCommandRegistry(),
      modifier: 'ctrl',
      settings: settingsStub([{ key: 'mod+i', command: 'acme.insert' }]),
    });

    expect(
      keymap
        .index()
        .rulesFor('ctrl+i')
        .map((r) => r.commandId)
    ).toEqual(['acme.insert']);
  });

  it('запись раскладки пересобирает указатель', () => {
    const commands = createCommandRegistry();
    const keymap = createKeymapService({ commands, modifier: 'ctrl', settings: settingsStub([]) });
    expect(keymap.index().rulesFor('ctrl+i')).toEqual([]);

    void keymap.setUserRules([{ key: 'mod+i', command: 'a.good' }]);

    expect(
      keymap
        .index()
        .rulesFor('ctrl+i')
        .map((r) => r.commandId)
    ).toEqual(['a.good']);
  });

  it('без службы настроек слой человека пуст, а запись отказывает внятно', async () => {
    const keymap = createKeymapService({ commands: createCommandRegistry(), modifier: 'ctrl' });

    expect(keymap.userRules()).toEqual([]);
    await expect(keymap.setUserRules([{ key: 'mod+i', command: 'a' }])).rejects.toThrow(
      /служба настроек/
    );
  });
});
