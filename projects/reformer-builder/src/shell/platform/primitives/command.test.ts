import { describe, expect, it, vi } from 'vitest';

import {
  CommandError,
  createCommandRegistry,
  MAX_CHORD_STEPS,
  normalizeChord,
  normalizeKeybinding,
} from './command';
import type { CommandContribution } from './command';
import { NEUTRAL_WHEN_CONTEXT, whenContext } from './when-context';
import type { WhenContext } from './when-context';

/** Команда с заполненными обязательными полями — в тесте значим один-два аргумента, не все. */
const command = (patch: Partial<CommandContribution> & { id: string }): CommandContribution => ({
  titleKey: 'test.command.title',
  run: () => undefined,
  ...patch,
});

function expectCommandError(fn: () => unknown): CommandError {
  try {
    fn();
  } catch (error) {
    if (error instanceof CommandError) return error;
    throw error;
  }
  throw new Error('ожидался CommandError, но вызов прошёл без отказа');
}

async function expectRejectedWith(promise: Promise<unknown>): Promise<CommandError> {
  const error: unknown = await promise.then(
    () => null,
    (reason: unknown) => reason
  );
  if (error instanceof CommandError) return error;
  throw new Error('ожидался CommandError, но вызов прошёл без отказа');
}

describe('register', () => {
  it('регистрирует команду и отдаёт её по идентификатору', () => {
    const registry = createCommandRegistry();
    const save = command({ id: 'workspace.save' });

    registry.register(save);

    expect(registry.get('workspace.save')).toBe(save);
    expect(registry.get('workspace.open')).toBeUndefined();
  });

  it('перечисляет команды в порядке регистрации', () => {
    const registry = createCommandRegistry();
    registry.register(command({ id: 'a' }));
    registry.register(command({ id: 'b' }));
    registry.register(command({ id: 'c' }));

    expect(registry.getAll().map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('dispose снимает команду', () => {
    // На этом держится выключение плагина: без снятия его команды остаются в реестре навсегда.
    const registry = createCommandRegistry();
    const subscription = registry.register(command({ id: 'plugin.action' }));

    subscription.dispose();

    expect(registry.get('plugin.action')).toBeUndefined();
    expect(registry.getAll()).toHaveLength(0);
  });

  it('после снятия идентификатор свободен', () => {
    const registry = createCommandRegistry();
    registry.register(command({ id: 'a' })).dispose();

    const second = command({ id: 'a' });
    expect(() => registry.register(second)).not.toThrow();
    expect(registry.get('a')).toBe(second);
  });

  it('повторный dispose безвреден', () => {
    const registry = createCommandRegistry();
    const subscription = registry.register(command({ id: 'a' }));

    subscription.dispose();
    expect(() => subscription.dispose()).not.toThrow();
  });

  it('отказывает на занятом идентификаторе, а не подменяет молча', () => {
    // Молчаливая подмена означала бы, что пользователь получил не ту команду, которую ждал,
    // и виновника пришлось бы искать чтением всех плагинов сразу.
    const registry = createCommandRegistry();
    registry.register(command({ id: 'workspace.save' }));

    const error = expectCommandError(() => registry.register(command({ id: 'workspace.save' })));

    expect(error.kind).toBe('duplicate');
    expect(error.params).toEqual({ commandId: 'workspace.save' });
  });

  it('отказывает на пустом идентификаторе', () => {
    const registry = createCommandRegistry();

    expect(expectCommandError(() => registry.register(command({ id: '' }))).kind).toBe(
      'invalid-id'
    );
    expect(expectCommandError(() => registry.register(command({ id: '   ' }))).kind).toBe(
      'invalid-id'
    );
  });

  it('проверяет сочетание на регистрации, а не при первом нажатии', () => {
    const registry = createCommandRegistry();

    const error = expectCommandError(() =>
      registry.register(command({ id: 'a', keybinding: 'mod+' }))
    );

    expect(error.kind).toBe('invalid-keybinding');
    expect(error.params).toEqual({ commandId: 'a', keybinding: 'mod+' });
    expect(error.cause).toBeInstanceOf(CommandError);
    expect(registry.get('a')).toBeUndefined();
  });
});

describe('isEnabled', () => {
  it('команда без предиката доступна всегда', () => {
    const registry = createCommandRegistry();
    registry.register(command({ id: 'a' }));

    expect(registry.isEnabled('a')).toBe(true);
  });

  it('незнакомый идентификатор — false, а не отказ', () => {
    // Палитра спрашивает про то, что сама же перечислила; отказ ей здесь не нужен.
    const registry = createCommandRegistry();

    expect(registry.isEnabled('нет такой')).toBe(false);
  });

  it('без поставщика контекста предикат получает нейтральный контекст', () => {
    const registry = createCommandRegistry();
    const seen: WhenContext[] = [];
    registry.register(
      command({
        id: 'a',
        enabled: (ctx) => {
          seen.push(ctx);
          return true;
        },
      })
    );

    registry.isEnabled('a');

    expect(seen).toEqual([NEUTRAL_WHEN_CONTEXT]);
  });

  it('берёт контекст у поставщика реестра', () => {
    // Контекст обязан быть один на приложение: иначе палитра, диспетчер и ассистент
    // разойдутся в том, что считается текущим состоянием.
    let context = whenContext({ focus: 'editable' });
    const registry = createCommandRegistry({ getContext: () => context });
    registry.register(command({ id: 'a', enabled: (ctx) => ctx.focus === 'canvas' }));

    expect(registry.isEnabled('a')).toBe(false);

    context = whenContext({ focus: 'canvas', previewMode: 'select' });
    expect(registry.isEnabled('a')).toBe(true);
  });

  it('явно переданный контекст важнее поставщика', () => {
    const registry = createCommandRegistry({ getContext: () => whenContext({ focus: 'none' }) });
    registry.register(command({ id: 'a', enabled: (ctx) => ctx.hasSelection }));

    expect(registry.isEnabled('a', whenContext({ hasSelection: true }))).toBe(true);
  });

  it('упавший предикат считается запретом, а ошибка уходит в канал', () => {
    // Охранное условие, которое не смогло ответить, тем более не должно пропускать действие.
    const onError = vi.fn();
    const registry = createCommandRegistry({ onError });
    const failure = new Error('предикат сломан');
    registry.register(
      command({
        id: 'a',
        enabled: () => {
          throw failure;
        },
      })
    );

    expect(registry.isEnabled('a')).toBe(false);
    expect(onError).toHaveBeenCalledWith(failure, { commandId: 'a', phase: 'enabled' });
  });
});

describe('execute', () => {
  it('вызывает run и возвращает его результат', async () => {
    const registry = createCommandRegistry();
    registry.register(command({ id: 'a', run: () => 42 }));

    await expect(registry.execute('a')).resolves.toBe(42);
  });

  it('передаёт аргументы и дожидается асинхронного run', async () => {
    const registry = createCommandRegistry();
    registry.register(command({ id: 'a', run: (args) => Promise.resolve({ echo: args }) }));

    await expect(registry.execute('a', { path: 'schema.json' })).resolves.toEqual({
      echo: { path: 'schema.json' },
    });
  });

  it('вызывает run синхронно: асинхронен результат, а не само действие', async () => {
    // Иначе команда не может участвовать в контуре правки и укладываться в одну запись отмены.
    const registry = createCommandRegistry();
    let ran = false;
    registry.register(
      command({
        id: 'a',
        run: () => {
          ran = true;
        },
      })
    );

    const promise = registry.execute('a');

    expect(ran).toBe(true);
    await promise;
  });

  it('пробрасывает отказ самой команды', async () => {
    const registry = createCommandRegistry();
    const failure = new Error('команда сломалась');
    registry.register(
      command({
        id: 'a',
        run: () => {
          throw failure;
        },
      })
    );

    await expect(registry.execute('a')).rejects.toBe(failure);
  });

  it('незнакомая команда — осмысленный отказ, а не тихое ничто', async () => {
    const registry = createCommandRegistry();

    const error = await expectRejectedWith(registry.execute('нет такой'));

    expect(error.kind).toBe('not-found');
    expect(error.params).toEqual({ commandId: 'нет такой' });
  });

  it('неприменимая команда отказывает и не выполняется', async () => {
    const registry = createCommandRegistry();
    const run = vi.fn();
    registry.register(command({ id: 'a', run, enabled: () => false }));

    const error = await expectRejectedWith(registry.execute('a'));

    expect(error.kind).toBe('disabled');
    expect(run).not.toHaveBeenCalled();
  });

  it('отказ из-за упавшего предиката сохраняет причину', async () => {
    const registry = createCommandRegistry({ onError: () => {} });
    const failure = new Error('предикат сломан');
    registry.register(
      command({
        id: 'a',
        enabled: () => {
          throw failure;
        },
      })
    );

    const error = await expectRejectedWith(registry.execute('a'));

    expect(error.kind).toBe('disabled');
    expect(error.cause).toBe(failure);
  });

  it('проверяет применимость в переданном контексте', async () => {
    const registry = createCommandRegistry({ getContext: () => whenContext({ focus: 'panel' }) });
    registry.register(
      command({ id: 'a', run: () => 'ok', enabled: (ctx) => ctx.focus === 'tree' })
    );

    await expect(registry.execute('a', undefined, whenContext({ focus: 'tree' }))).resolves.toBe(
      'ok'
    );
    await expect(registry.execute('a')).rejects.toBeInstanceOf(CommandError);
  });
});

describe('agentCommands', () => {
  it('отдаёт только команды с блоком agent', () => {
    const registry = createCommandRegistry();
    registry.register(command({ id: 'ui.only' }));
    registry.register(
      command({
        id: 'workspace.save',
        agent: { description: 'Save the active document', schema: { type: 'object' } },
      })
    );

    expect(registry.agentCommands().map((item) => item.id)).toEqual(['workspace.save']);
  });

  it('не фильтрует по применимости', () => {
    // Набор инструментов уходит в каждый запрос к модели: если он меняется от фокуса
    // пользователя, префикс запроса перестаёт кэшироваться. Применимость проверяет execute.
    const registry = createCommandRegistry();
    registry.register(
      command({
        id: 'workspace.save',
        enabled: () => false,
        agent: { description: 'Save the active document', schema: {} },
      })
    );

    expect(registry.agentCommands()).toHaveLength(1);
    expect(registry.isEnabled('workspace.save')).toBe(false);
  });

  it('снятая команда уходит и из поверхности ассистента', () => {
    const registry = createCommandRegistry();
    const subscription = registry.register(
      command({ id: 'plugin.action', agent: { description: 'Do it', schema: {} } })
    );

    subscription.dispose();

    expect(registry.agentCommands()).toHaveLength(0);
  });
});

describe('normalizeKeybinding', () => {
  const canonical: readonly (readonly [string, string])[] = [
    ['mod+s', 'mod+s'],
    ['mod+shift+K', 'mod+shift+k'],
    ['Shift+Mod+k', 'mod+shift+k'],
    ['  mod + alt + V  ', 'mod+alt+v'],
    ['CmdOrCtrl+S', 'mod+s'],
    ['Cmd+S', 'meta+s'],
    ['Control+Alt+Delete', 'ctrl+alt+delete'],
    ['option+Left', 'alt+arrowleft'],
    ['Esc', 'escape'],
    ['F6', 'f6'],
    ['mod++', 'mod++'],
    ['mod+plus', 'mod++'],
    ['mod+shift+/', 'mod+shift+/'],
  ];

  for (const [input, expected] of canonical) {
    it(`«${input}» → «${expected}»`, () => {
      expect(normalizeKeybinding(input)).toBe(expected);
    });
  }

  it('порядок модификаторов не влияет на результат', () => {
    // Ради этого функция и существует: иначе диспетчер не найдёт команду, записанную наоборот.
    expect(normalizeKeybinding('alt+mod+shift+k')).toBe(normalizeKeybinding('shift+mod+alt+K'));
  });

  it('КАЖДОЕ существующее написание после normalizeChord даёт ровно одну ту же ступень', () => {
    // Гарантия, что переход реестра на аккорды не изменил написание ни одного из уже
    // работающих сочетаний. Разъедься они — клавиша молча перестала бы работать.
    for (const [input, expected] of canonical) {
      expect(normalizeChord(input), input).toEqual([expected]);
    }
  });

  it('идемпотентна', () => {
    const once = normalizeKeybinding('Shift+Mod+K');
    expect(normalizeKeybinding(once)).toBe(once);
  });

  it('не разрешает mod в платформенный модификатор — это дело диспетчера', () => {
    expect(normalizeKeybinding('mod+s')).not.toBe(normalizeKeybinding('ctrl+s'));
    expect(normalizeKeybinding('mod+s')).not.toBe(normalizeKeybinding('meta+s'));
  });

  const broken: readonly string[] = ['', '   ', 'mod+', 'mod', 'mod+shift', 'mod+a+b', 'mod+mod+s'];

  for (const input of broken) {
    it(`отказывает на «${input}»`, () => {
      const error = expectCommandError(() => normalizeKeybinding(input));
      expect(error.kind).toBe('invalid-keybinding');
      expect(error.params).toEqual({ keybinding: input });
    });
  }
});

describe('вид реестра для плагина', () => {
  it('проставляет владельца сам', () => {
    const registry = createCommandRegistry();
    const view = registry.forPlugin('editor-schema');

    view.register({ id: 'editor-schema.delete', titleKey: 'command.delete', run: () => {} });

    expect(registry.get('editor-schema.delete')?.pluginId).toBe('editor-schema');
  });

  it('игнорирует владельца, написанного в объявлении', () => {
    // Иначе плагин регистрировал бы команду от чужого имени, просто написав чужой
    // идентификатор, — а весь смысл штампа реестра в том, что этого пути нет.
    const registry = createCommandRegistry();

    registry.forPlugin('editor-schema').register({
      id: 'editor-schema.delete',
      titleKey: 'command.delete',
      pluginId: 'files',
      run: () => {},
    });

    expect(registry.get('editor-schema.delete')?.pluginId).toBe('editor-schema');
  });

  it('у команды оболочки владельца нет', () => {
    const registry = createCommandRegistry();

    registry.register({ id: 'workspace.save', titleKey: 'shell.save', run: () => {} });

    expect(registry.get('workspace.save')?.pluginId).toBeUndefined();
  });

  it('хранилище общее: команды видов и оболочки лежат в одном списке', () => {
    // Будь у вида свой список, палитра показывала бы только команды оболочки, а команды
    // плагинов пришлось бы собирать обходом видов — то есть знать про них заранее.
    const registry = createCommandRegistry();
    registry.register({ id: 'workspace.save', titleKey: 'shell.save', run: () => {} });
    registry.forPlugin('files').register({ id: 'files.open', titleKey: 'open', run: () => {} });

    expect(registry.getAll().map((c) => c.id)).toEqual(['workspace.save', 'files.open']);
  });

  it('повторный вызов отдаёт тот же объект', () => {
    const registry = createCommandRegistry();
    expect(registry.forPlugin('files')).toBe(registry.forPlugin('files'));
  });

  it('пустой идентификатор плагина — отказ', () => {
    const registry = createCommandRegistry();
    expect(() => registry.forPlugin('  ')).toThrow(/идентификатор плагина/);
  });

  it('снятие через вид уносит именно свою команду', () => {
    const registry = createCommandRegistry();
    const view = registry.forPlugin('files');
    const off = view.register({ id: 'files.open', titleKey: 'open', run: () => {} });

    off.dispose();

    expect(registry.get('files.open')).toBeUndefined();
  });
});

/**
 * Набор команд складывается ПОСЛЕ первой отрисовки — эффектами компонентов и активацией
 * плагинов, — поэтому у реестра есть событие. Без него меню, построенное на первом кадре,
 * навсегда осталось бы без палитры и справки; ровно это и случилось при первом запуске.
 */
describe('уведомление об изменении набора', () => {
  it('зовёт наблюдателей при регистрации и при снятии', () => {
    const registry = createCommandRegistry();
    const seen = vi.fn();
    registry.onDidChange(seen);

    const off = registry.register({ id: 'a.run', titleKey: 'a', run: () => {} });
    expect(seen).toHaveBeenCalledTimes(1);

    off.dispose();
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it('регистрация через вид плагина видна подписчику корневого реестра', () => {
    const registry = createCommandRegistry();
    const seen = vi.fn();
    registry.onDidChange(seen);

    registry.forPlugin('files').register({ id: 'files.open', titleKey: 'open', run: () => {} });

    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('снятая подписка больше не зовётся', () => {
    const registry = createCommandRegistry();
    const seen = vi.fn();
    registry.onDidChange(seen).dispose();

    registry.register({ id: 'a.run', titleKey: 'a', run: () => {} });

    expect(seen).not.toHaveBeenCalled();
  });

  it('устаревшее снятие не уведомляет: оно ничего и не изменило', () => {
    const registry = createCommandRegistry();
    const off = registry.register({ id: 'a.run', titleKey: 'a', run: () => {} });
    off.dispose();
    registry.register({ id: 'a.run', titleKey: 'второй', run: () => {} });

    const seen = vi.fn();
    registry.onDidChange(seen);
    off.dispose();

    expect(seen).not.toHaveBeenCalled();
    expect(registry.get('a.run')?.titleKey).toBe('второй');
  });
});

/**
 * Снимок обязан быть той же ссылкой между изменениями: `useSyncExternalStore` сравнивает
 * результат `getSnapshot` по ссылке и уходит в бесконечную перерисовку, получая каждый раз
 * новый массив. Ту же ошибку в этом проекте уже ловил реестр вкладов.
 */
describe('getAll как снимок', () => {
  it('между изменениями возвращает ту же ссылку', () => {
    const registry = createCommandRegistry();
    registry.register({ id: 'a.run', titleKey: 'a', run: () => {} });

    expect(registry.getAll()).toBe(registry.getAll());
  });

  it('после регистрации ссылка новая', () => {
    const registry = createCommandRegistry();
    const before = registry.getAll();

    registry.register({ id: 'a.run', titleKey: 'a', run: () => {} });

    expect(registry.getAll()).not.toBe(before);
    expect(registry.getAll().map((command) => command.id)).toEqual(['a.run']);
  });
});

describe('normalizeChord', () => {
  it('делит аккорд по пробелу между ступенями', () => {
    expect(normalizeChord('mod+k mod+s')).toEqual(['mod+k', 'mod+s']);
  });

  it('пробел У «плюса» — украшение, пробел МЕЖДУ ступенями — разделитель', () => {
    // Ловушка, ради которой правило и сформулировано: наивное деление по пробелам сломало бы
    // существующее написание «mod + alt + V», которое закреплено тестом выше.
    expect(normalizeChord('  mod + alt + V  ')).toEqual(['mod+alt+v']);
    expect(normalizeChord('mod + k   mod + s')).toEqual(['mod+k', 'mod+s']);
  });

  it('клавиша «плюс» переживает разбор аккорда', () => {
    expect(normalizeChord('mod++')).toEqual(['mod++']);
    expect(normalizeChord('mod+ +')).toEqual(['mod++']);
  });

  it('ступеней больше двух не бывает', () => {
    // Аккорд из трёх нажатий человек не воспроизводит по памяти: такая клавиша существует
    // только в списке.
    const error = expectCommandError(() => normalizeChord('mod+k mod+s mod+x'));
    expect(error.kind).toBe('invalid-keybinding');
    expect(MAX_CHORD_STEPS).toBe(2);
  });

  it('неразбираемая ступень отвергает весь аккорд', () => {
    expect(expectCommandError(() => normalizeChord('mod+k mod+')).kind).toBe('invalid-keybinding');
  });
});
