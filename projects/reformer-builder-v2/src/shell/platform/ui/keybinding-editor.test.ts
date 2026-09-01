import { describe, expect, it } from 'vitest';

import { createCommandRegistry, MAX_CHORD_STEPS } from '@/shell/platform/primitives/command';
import type { CommandContribution } from '@/shell/platform/primitives/command';
import { compileWhen, WHEN_TRUE } from '@/shell/platform/primitives/when-expr';
import {
  beginRecording,
  conflictsOf,
  editorRows,
  pushKey,
  withRebinding,
  withReset,
  withUnbinding,
} from './keybinding-editor';
import { createKeymapService } from './keymap';
import type { UserKeybinding } from './keymap';

const command = (patch: Partial<CommandContribution> & { id: string }): CommandContribution => ({
  titleKey: patch.id,
  run: () => undefined,
  ...patch,
});

function setup(commands: readonly CommandContribution[]) {
  const registry = createCommandRegistry();
  for (const item of commands) registry.register(item);
  const keymap = createKeymapService({ commands: registry, modifier: 'ctrl' });
  return { registry, keymap };
}

function rows(commands: readonly CommandContribution[], query?: string) {
  const { keymap } = setup(commands);
  return editorRows(keymap.index(), {
    translate: (key) => key,
    commands,
    ...(query === undefined ? {} : { query }),
  });
}

describe('строки редактора', () => {
  it('строка есть у КАЖДОЙ команды, включая ту, у которой сочетания нет', () => {
    // Иначе назначить клавишу тому, у чего её пока нет, было бы негде — а это половина
    // смысла экрана.
    const result = rows([
      command({ id: 'a.bound', keybinding: 'mod+s' }),
      command({ id: 'a.unbound' }),
    ]);

    expect(result.map((row) => row.commandId).sort()).toEqual(['a.bound', 'a.unbound']);
    expect(result.find((row) => row.commandId === 'a.unbound')?.chord).toEqual([]);
  });

  it('строка без сочетания не имеет слоя', () => {
    // Слоя у несуществующего правила не бывает, и подставлять сюда «оболочку» значило бы
    // сказать, что сочетание назначено ею.
    const result = rows([command({ id: 'a.unbound' })]);

    expect(result[0].layer).toBeNull();
  });

  it('показывает ДЕЙСТВУЮЩЕЕ сочетание, а не объявленное', () => {
    const registry = createCommandRegistry();
    registry.register(command({ id: 'a.duplicate', keybinding: 'mod+d' }));
    const keymap = createKeymapService({
      commands: registry,
      modifier: 'ctrl',
      settings: {
        get: <T>(): T => [{ key: 'ctrl+alt+d', command: 'a.duplicate' }] as T,
        set: () => Promise.resolve(),
        onDidChange: () => ({ dispose: () => undefined }),
      },
    });

    const result = editorRows(keymap.index(), {
      translate: (key) => key,
      commands: registry.getAll(),
    });

    expect(result.find((row) => row.commandId === 'a.duplicate')?.chord).toEqual(['ctrl+alt+d']);
  });

  it('порядок — по заголовку, а не по наличию сочетания', () => {
    // Разделение на две группы заставило бы человека искать действие в двух местах.
    const result = rows([
      command({ id: 'z.bound', titleKey: 'Арбуз', keybinding: 'mod+s' }),
      command({ id: 'a.unbound', titleKey: 'Яблоко' }),
    ]);

    expect(result.map((row) => row.title)).toEqual(['Арбуз', 'Яблоко']);
  });

  it('поиск идёт по заголовку, идентификатору и сочетанию', () => {
    const commands = [
      command({ id: 'files.save', titleKey: 'Сохранить', keybinding: 'mod+s' }),
      command({ id: 'files.delete', titleKey: 'Удалить', keybinding: 'delete' }),
    ];

    expect(rows(commands, 'Сохран').map((r) => r.commandId)).toEqual(['files.save']);
    expect(rows(commands, 'files.delete').map((r) => r.commandId)).toEqual(['files.delete']);
    expect(rows(commands, 'delete').map((r) => r.commandId)).toEqual(['files.delete']);
    expect(
      rows(commands, '')
        .map((r) => r.commandId)
        .sort()
    ).toEqual(['files.delete', 'files.save']);
  });

  it('условие показывается как написано', () => {
    const result = rows([command({ id: 'a', keybinding: 'delete', when: 'focus == tree' })]);

    expect(result[0].when).toBe('focus == tree');
  });
});

describe('запись нажатия', () => {
  it('нажатие одного модификатора игнорируется', () => {
    // Разбор события даёт `null` на голом Shift; запиши мы его — получилось бы сочетание,
    // которое потом не совпадёт ни с чем.
    const state = pushKey(beginRecording(), null);

    expect(state.steps).toEqual([]);
  });

  it('собирает аккорд из двух ступеней', () => {
    let state = beginRecording();
    state = pushKey(state, 'ctrl+k');
    state = pushKey(state, 'ctrl+s');

    expect(state.steps).toEqual(['ctrl+k', 'ctrl+s']);
    expect(state.full).toBe(true);
  });

  it('третью ступень не принимает', () => {
    let state = beginRecording();
    state = pushKey(state, 'ctrl+k');
    state = pushKey(state, 'ctrl+s');
    state = pushKey(state, 'ctrl+x');

    expect(state.steps).toHaveLength(MAX_CHORD_STEPS);
  });
});

describe('конфликт до записи', () => {
  it('называет правило, которое уже заняло сочетание', () => {
    // Показать заранее дешевле, чем дать назначить клавишу и молча проиграть чужому правилу.
    const { keymap } = setup([command({ id: 'a.save', keybinding: 'mod+s' })]);

    const found = conflictsOf(keymap.index(), ['ctrl+s'], WHEN_TRUE);

    expect(found.map((rule) => rule.commandId)).toEqual(['a.save']);
  });

  it('свободное сочетание конфликтов не даёт', () => {
    const { keymap } = setup([command({ id: 'a.save', keybinding: 'mod+s' })]);

    expect(conflictsOf(keymap.index(), ['ctrl+q'], WHEN_TRUE)).toEqual([]);
  });

  it('правило с другим условием клавишу не отнимает', () => {
    const { keymap } = setup([
      command({ id: 'files.delete', keybinding: 'delete', when: 'focus == tree' }),
    ]);

    expect(conflictsOf(keymap.index(), ['delete'], compileWhen('focus == canvas'))).toEqual([]);
  });
});

describe('правка раскладки человека', () => {
  const existing: readonly UserKeybinding[] = [{ key: 'mod+i', command: 'a.other' }];

  it('переназначение добавляет запись и не трогает чужие', () => {
    const next = withRebinding(existing, 'a.duplicate', ['ctrl+alt+d']);

    expect(next).toEqual([
      { key: 'mod+i', command: 'a.other' },
      { key: 'ctrl+alt+d', command: 'a.duplicate' },
    ]);
  });

  it('повторное переназначение ЗАМЕЩАЕТ прошлое, а не копит записи', () => {
    // Две записи одной команды на разные клавиши — это не «две клавиши», а неоднозначность,
    // которую человек не заказывал.
    const once = withRebinding(existing, 'a.duplicate', ['ctrl+alt+d']);
    const twice = withRebinding(once, 'a.duplicate', ['ctrl+alt+x']);

    expect(twice.filter((rule) => rule.command === 'a.duplicate')).toHaveLength(1);
    expect(twice.at(-1)?.key).toBe('ctrl+alt+x');
  });

  it('переназначение с условием сохраняет условие', () => {
    const next = withRebinding([], 'a.delete', ['delete'], 'focus == tree');

    expect(next[0]).toEqual({ key: 'delete', command: 'a.delete', when: 'focus == tree' });
  });

  it('снятие записывается явной строкой с минусом', () => {
    // Убрать можно только СВОЮ запись; сочетание, объявленное командой, живёт в коде,
    // и перекрыть его нечем, кроме снятия.
    const next = withUnbinding(existing, 'a.duplicate', ['ctrl+d']);

    expect(next.at(-1)).toEqual({ key: 'ctrl+d', command: '-a.duplicate' });
  });

  it('возврат к исходному — это ОТСУТСТВИЕ записей о команде', () => {
    // Записать «как было» значило бы заморозить то значение, которое было на момент нажатия
    // кнопки: изменись оно в новой версии приложения — человек остался бы со старым.
    const rebound = withRebinding(existing, 'a.duplicate', ['ctrl+alt+d']);
    const unbound = withUnbinding(rebound, 'a.duplicate', ['ctrl+d']);

    expect(withReset(unbound, 'a.duplicate')).toEqual(existing);
  });
});
