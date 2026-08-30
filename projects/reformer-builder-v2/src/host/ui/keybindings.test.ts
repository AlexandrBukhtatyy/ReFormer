import { describe, expect, it, vi } from 'vitest';

import { createCommandRegistry, normalizeKeybinding } from '../primitives/command';
import { whenContext } from '../primitives/when-context';
import { createChordState } from './chords';
import { createKeymapService } from './keymap';
import {
  detectPlatformModifier,
  dispatchKeydown,
  eventToKeybinding,
  formatKeybinding,
  installKeybindings,
  resolvePlatformKeybinding,
  shouldDispatch,
  type DispatchableEvent,
  type KeyEventLike,
  type KeydownTarget,
} from './keybindings';

/** Событие клавиатуры в объёме, который читает диспетчер. DOM здесь нет — окружение `node`. */
function keyEvent(patch: Partial<KeyEventLike> & { key: string }): KeyEventLike {
  return { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...patch };
}

/** То же самое плюс запись факта `preventDefault`. */
function dispatchable(patch: Partial<KeyEventLike> & { key: string }): DispatchableEvent & {
  prevented: boolean;
} {
  return {
    ...keyEvent(patch),
    prevented: false,
    preventDefault() {
      this.prevented = true;
    },
  };
}

describe('eventToKeybinding', () => {
  it('строит сочетание в том же написании, в каком его регистрируют', () => {
    // Главное свойство модуля: обе стороны идут через `normalizeKeybinding`. Разъедься они —
    // клавиша молча перестала бы работать, а это самая дорогая из поломок.
    expect(eventToKeybinding(keyEvent({ key: 'P', ctrlKey: true, shiftKey: true }))).toBe(
      normalizeKeybinding('Ctrl+Shift+P')
    );
    expect(eventToKeybinding(keyEvent({ key: 'ArrowLeft', altKey: true }))).toBe(
      normalizeKeybinding('option+left')
    );
  });

  it('снимает регистр и разворачивает пробел', () => {
    expect(eventToKeybinding(keyEvent({ key: 'S', ctrlKey: true }))).toBe('ctrl+s');
    expect(eventToKeybinding(keyEvent({ key: ' ', ctrlKey: true }))).toBe('ctrl+space');
  });

  it('выстраивает модификаторы в каноническом порядке независимо от их набора', () => {
    expect(
      eventToKeybinding(keyEvent({ key: 'k', shiftKey: true, altKey: true, metaKey: true }))
    ).toBe('meta+alt+shift+k');
  });

  it('сочетание с модификатором берёт ФИЗИЧЕСКУЮ клавишу: Ctrl+C в русской раскладке', () => {
    // В русской раскладке key — кириллическая «с», и по нему mod+c не совпало бы ни с чем.
    expect(eventToKeybinding(keyEvent({ key: 'с', code: 'KeyC', ctrlKey: true }))).toBe('ctrl+c');
    expect(eventToKeybinding(keyEvent({ key: 'м', code: 'KeyV', ctrlKey: true }))).toBe('ctrl+v');
  });

  it('БЕЗ модификатора раскладка не подменяется: набирают то, что нажали', () => {
    expect(eventToKeybinding(keyEvent({ key: 'ы', code: 'KeyS' }))).toBe('ы');
  });

  it('код нераспознанной клавиши ввод не подменяет', () => {
    expect(eventToKeybinding(keyEvent({ key: '/', code: 'Slash', ctrlKey: true }))).toBe('ctrl+/');
  });

  it('нажатие самого модификатора сочетанием не является', () => {
    // Иначе каждое нажатие Shift запускало бы перебор команд по сочетанию `shift+shift`.
    for (const key of ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']) {
      expect(eventToKeybinding(keyEvent({ key, shiftKey: true }))).toBeNull();
    }
  });

  it('набор через IME принадлежит вводу целиком', () => {
    expect(eventToKeybinding({ ...keyEvent({ key: 'Enter' }), isComposing: true })).toBeNull();
  });

  it('нечитаемое событие даёт null, а не исключение', () => {
    expect(eventToKeybinding(keyEvent({ key: '' }))).toBeNull();
  });

  it('клавиша «плюс» остаётся клавишей', () => {
    expect(eventToKeybinding(keyEvent({ key: '+', ctrlKey: true }))).toBe('ctrl++');
  });
});

describe('resolvePlatformKeybinding', () => {
  it('разворачивает mod в платформенный модификатор', () => {
    expect(resolvePlatformKeybinding('mod+s', 'ctrl')).toBe('ctrl+s');
    expect(resolvePlatformKeybinding('mod+s', 'meta')).toBe('meta+s');
  });

  it('сочетание без mod не трогает, но канонизирует', () => {
    expect(resolvePlatformKeybinding('Ctrl+Shift+K', 'meta')).toBe('ctrl+shift+k');
  });

  it('совпадение mod с уже указанным модификатором не ошибка, а слияние', () => {
    // `mod+ctrl+k` на Windows — это `ctrl+k`: там `mod` и есть `ctrl`. Повторная
    // нормализация здесь отвергла бы результат как «модификатор повторён».
    expect(resolvePlatformKeybinding('mod+ctrl+k', 'ctrl')).toBe('ctrl+k');
    expect(resolvePlatformKeybinding('mod+meta+k', 'meta')).toBe('meta+k');
  });

  it('сохраняет канонический порядок при вставке', () => {
    expect(resolvePlatformKeybinding('mod+ctrl+shift+k', 'meta')).toBe('ctrl+meta+shift+k');
  });

  it('клавиша «плюс» переживает разворот', () => {
    expect(resolvePlatformKeybinding('mod++', 'ctrl')).toBe('ctrl++');
  });
});

describe('detectPlatformModifier', () => {
  it('на macOS mod — это Cmd, на остальных — Ctrl', () => {
    expect(detectPlatformModifier('MacIntel')).toBe('meta');
    expect(detectPlatformModifier('iPhone')).toBe('meta');
    expect(detectPlatformModifier('Win32')).toBe('ctrl');
    expect(detectPlatformModifier('Linux x86_64')).toBe('ctrl');
  });
});

describe('formatKeybinding', () => {
  it('подписывает сочетание надписями с клавиш', () => {
    expect(formatKeybinding('mod+shift+p', 'ctrl')).toBe('Ctrl+Shift+P');
    expect(formatKeybinding('mod+shift+p', 'meta')).toBe('Cmd+Shift+P');
    expect(formatKeybinding('alt+left', 'ctrl')).toBe('Alt+←');
    expect(formatKeybinding('esc', 'ctrl')).toBe('Esc');
  });

  it('неразбираемое сочетание возвращает как есть', () => {
    expect(formatKeybinding('ctrl+', 'ctrl')).toBe('ctrl+');
  });
});

describe('shouldDispatch', () => {
  const save = { keybinding: 'mod+s', allowInEditable: true };
  const del = { keybinding: 'delete' };

  it('сопоставляет сочетание с разрешением mod', () => {
    expect(shouldDispatch('ctrl+s', whenContext(), save, { modifier: 'ctrl' })).toBe(true);
    expect(shouldDispatch('ctrl+s', whenContext(), save, { modifier: 'meta' })).toBe(false);
    expect(shouldDispatch('meta+s', whenContext(), save, { modifier: 'meta' })).toBe(true);
  });

  it('команда без сочетания не вызывается никогда', () => {
    expect(shouldDispatch('ctrl+s', whenContext(), { keybinding: undefined })).toBe(false);
  });

  it('фокус в поле ввода пропускает сочетание', () => {
    // Тот самый охранный случай, из-за которого обработчик клавиш v1 не разбирается
    // на части: без него Delete в поле ввода удалял бы узел схемы.
    expect(shouldDispatch('delete', whenContext({ focus: 'editable' }), del)).toBe(false);
    expect(shouldDispatch('delete', whenContext({ focus: 'canvas' }), del)).toBe(true);
  });

  it('allowInEditable — исключение из этого правила, и оно работает', () => {
    expect(shouldDispatch('ctrl+s', whenContext({ focus: 'editable' }), save)).toBe(true);
  });

  it('пробел и Enter принадлежат сфокусированной кнопке', () => {
    const activate = { keybinding: 'space' };
    expect(shouldDispatch('space', whenContext({ focus: 'control' }), activate)).toBe(false);
    expect(shouldDispatch('space', whenContext({ focus: 'canvas' }), activate)).toBe(true);
    // С модификатором кнопка нажатие не обрабатывает — значит оно свободно.
    expect(
      shouldDispatch('ctrl+space', whenContext({ focus: 'control' }), { keybinding: 'mod+space' })
    ).toBe(true);
  });

  it('спрашивает enabled и верит ему', () => {
    const command = {
      keybinding: 'mod+z',
      enabled: (ctx: ReturnType<typeof whenContext>) => ctx.hasSelection,
    };
    expect(shouldDispatch('ctrl+z', whenContext({ hasSelection: true }), command)).toBe(true);
    expect(shouldDispatch('ctrl+z', whenContext({ hasSelection: false }), command)).toBe(false);
  });

  it('упавший предикат считается запретом и сообщается', () => {
    const boom = new Error('предикат сломан');
    const onError = vi.fn();
    const command = {
      keybinding: 'mod+z',
      enabled: () => {
        throw boom;
      },
    };
    expect(shouldDispatch('ctrl+z', whenContext(), command, { onError })).toBe(false);
    expect(onError).toHaveBeenCalledWith(boom);
  });
});

describe('shouldDispatch — условие when', () => {
  it('условие ложно — команда не срабатывает, даже если enabled истинно', () => {
    const command = { keybinding: 'delete', when: 'focus == tree', enabled: () => true };

    expect(shouldDispatch('delete', whenContext({ focus: 'tree' }), command)).toBe(true);
    expect(shouldDispatch('delete', whenContext({ focus: 'canvas' }), command)).toBe(false);
  });

  it('enabled ложно — команда не срабатывает, даже если условие истинно', () => {
    // Проверки независимы. Мутация, снимающая любую из них, роняет ровно один из двух тестов.
    const command = { keybinding: 'delete', when: 'focus == tree', enabled: () => false };

    expect(shouldDispatch('delete', whenContext({ focus: 'tree' }), command)).toBe(false);
  });

  it('одно сочетание разводится условиями по месту фокуса', () => {
    // Ровно тот случай, ради которого условие и заведено: `delete` зарегистрирован дважды —
    // деревом файлов и редактором схемы, — и до условий их разводил только порядок
    // регистрации, который по контракту рантайма плагинов ничего не значит.
    const removeFile = { keybinding: 'delete', when: 'focus == tree' };
    const removeNode = { keybinding: 'delete', when: 'focus == canvas' };
    const inTree = whenContext({ focus: 'tree' });
    const onCanvas = whenContext({ focus: 'canvas' });

    expect(shouldDispatch('delete', inTree, removeFile)).toBe(true);
    expect(shouldDispatch('delete', inTree, removeNode)).toBe(false);
    expect(shouldDispatch('delete', onCanvas, removeFile)).toBe(false);
    expect(shouldDispatch('delete', onCanvas, removeNode)).toBe(true);
  });

  it('без условия команда ведёт себя ровно как раньше', () => {
    // Обратная совместимость одной строкой: отсутствие условия — это «всегда», и ни одна
    // из шестнадцати существующих привязок не меняет поведения.
    expect(
      shouldDispatch('delete', whenContext({ focus: 'canvas' }), { keybinding: 'delete' })
    ).toBe(true);
  });

  it('условие читает ключи вне пяти полей, когда дан читатель', () => {
    // Ключи плагинов и области в WhenContext не входят и входить не должны — их приносит
    // отдельный читатель, а тип из пяти полей заставил бы складывать их в контракт.
    const command = { keybinding: 'mod+d', when: 'schemaEditor.nodeSelected' };
    const read = (key: string): unknown => (key === 'schemaEditor.nodeSelected' ? true : undefined);

    expect(shouldDispatch('ctrl+d', whenContext(), command, { read })).toBe(true);
    expect(shouldDispatch('ctrl+d', whenContext(), command)).toBe(false);
  });

  it('условие, ссылающееся на ключ выключенного плагина, просто не совпадает', () => {
    expect(
      shouldDispatch('ctrl+d', whenContext(), { keybinding: 'mod+d', when: 'acme.ready' })
    ).toBe(false);
  });
});

describe('dispatchKeydown', () => {
  function setup() {
    const ctx = { current: whenContext() };
    const commands = createCommandRegistry({ getContext: () => ctx.current });
    // Настоящая раскладка над тем же реестром: подделка проверяла бы подделку, а правило
    // «кто выигрывает» живёт именно в ней.
    const keymap = createKeymapService({ commands, modifier: 'ctrl' });
    return {
      ctx,
      commands,
      keymap,
      options: { commands, keymap, getContext: () => ctx.current, modifier: 'ctrl' as const },
    };
  }

  it('выполняет команду и отменяет действие браузера', async () => {
    const { commands, options } = setup();
    const run = vi.fn();
    commands.register({ id: 'a.save', titleKey: 'a.save', keybinding: 'mod+s', run });

    const event = dispatchable({ key: 's', ctrlKey: true });
    expect(dispatchKeydown(event, options)).toBe('a.save');
    expect(event.prevented).toBe(true);
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('молчит, когда сочетание никому не принадлежит', () => {
    const { commands, options } = setup();
    commands.register({ id: 'a.save', titleKey: 'a.save', keybinding: 'mod+s', run: vi.fn() });

    const event = dispatchable({ key: 'q', ctrlKey: true });
    expect(dispatchKeydown(event, options)).toBeNull();
    // Действие браузера не отменяется: событие нам не принадлежало.
    expect(event.prevented).toBe(false);
  });

  it('в поле ввода пропускает всё, кроме помеченного', async () => {
    const { commands, options, ctx } = setup();
    const remove = vi.fn();
    const save = vi.fn();
    commands.register({ id: 'a.delete', titleKey: 'a.delete', keybinding: 'delete', run: remove });
    commands.register({
      id: 'a.save',
      titleKey: 'a.save',
      keybinding: 'mod+s',
      allowInEditable: true,
      run: save,
    });
    ctx.current = whenContext({ focus: 'editable' });

    expect(dispatchKeydown(dispatchable({ key: 'Delete' }), options)).toBeNull();
    expect(dispatchKeydown(dispatchable({ key: 's', ctrlKey: true }), options)).toBe('a.save');
    await Promise.resolve();
    expect(remove).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('снятая команда перестаёт отвечать на своё сочетание', () => {
    const { commands, options } = setup();
    const subscription = commands.register({
      id: 'a.save',
      titleKey: 'a.save',
      keybinding: 'mod+s',
      run: vi.fn(),
    });
    expect(dispatchKeydown(dispatchable({ key: 's', ctrlKey: true }), options)).toBe('a.save');
    subscription.dispose();
    expect(dispatchKeydown(dispatchable({ key: 's', ctrlKey: true }), options)).toBeNull();
  });

  it('при полном равенстве выигрывает ПОСЛЕДНЯЯ зарегистрированная', () => {
    // Правило изменилось намеренно. Раньше выигрывала первая, то есть исход зависел от
    // порядка активации плагинов, — а он по контракту рантайма (`plugin/registry.test.ts`)
    // не значит ничего. Теперь порядок стоит последним критерием после слоя и специфичности
    // и доходит до дела только у правил, неразличимых по всему остальному.
    const { commands, options } = setup();
    commands.register({ id: 'a.first', titleKey: 'a', keybinding: 'mod+k', run: vi.fn() });
    commands.register({ id: 'a.second', titleKey: 'b', keybinding: 'ctrl+k', run: vi.fn() });
    expect(dispatchKeydown(dispatchable({ key: 'k', ctrlKey: true }), options)).toBe('a.second');
  });

  it('более специфичное условие бьёт менее специфичное независимо от порядка', () => {
    // А это и есть то, ради чего порядок ушёл на третье место: клавиша достаётся тому,
    // кто точнее назвал место, а не тому, кто раньше загрузился.
    const { ctx, commands, options } = setup();
    commands.register({ id: 'a.broad', titleKey: 'a', keybinding: 'delete', run: vi.fn() });
    commands.register({
      id: 'a.narrow',
      titleKey: 'b',
      keybinding: 'delete',
      when: 'focus == tree',
      run: vi.fn(),
    });

    ctx.current = whenContext({ focus: 'tree' });
    expect(dispatchKeydown(dispatchable({ key: 'Delete' }), options)).toBe('a.narrow');

    // Вне дерева узкое правило не подходит, и клавиша достаётся широкому.
    ctx.current = whenContext({ focus: 'panel' });
    expect(dispatchKeydown(dispatchable({ key: 'Delete' }), options)).toBe('a.broad');
  });

  it('сообщает об отказе команды, но не бросает', async () => {
    const { commands, options } = setup();
    const onError = vi.fn();
    const boom = new Error('команда сломана');
    commands.register({
      id: 'a.save',
      titleKey: 'a.save',
      keybinding: 'mod+s',
      run: () => Promise.reject(boom),
    });

    expect(
      dispatchKeydown(dispatchable({ key: 's', ctrlKey: true }), { ...options, onError })
    ).toBe('a.save');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onError).toHaveBeenCalledWith(boom, { commandId: 'a.save', phase: 'execute' });
  });

  it('контекст читается один раз на нажатие', () => {
    const { commands } = setup();
    const getContext = vi.fn(() => whenContext());
    commands.register({
      id: 'a.one',
      titleKey: 'a',
      keybinding: 'mod+1',
      enabled: () => false,
      run: vi.fn(),
    });
    commands.register({
      id: 'a.two',
      titleKey: 'b',
      keybinding: 'mod+2',
      enabled: () => false,
      run: vi.fn(),
    });
    dispatchKeydown(dispatchable({ key: '1', ctrlKey: true }), {
      commands,
      keymap: createKeymapService({ commands, modifier: 'ctrl' }),
      getContext,
      modifier: 'ctrl',
    });
    // Иначе два предиката отвечали бы про разные состояния — и «команда доступна»
    // зависело бы от того, какой она по счёту в реестре.
    expect(getContext).toHaveBeenCalledTimes(1);
  });
});

describe('dispatchKeydown — аккорды', () => {
  function chordSetup() {
    const ctx = { current: whenContext() };
    const commands = createCommandRegistry({ getContext: () => ctx.current });
    const keymap = createKeymapService({ commands, modifier: 'ctrl' });
    // Планировщик-двойник: настоящий таймер стоил бы прогону пяти секунд.
    let pending: (() => void) | null = null;
    const chords = createChordState({
      schedule: (fn) => {
        pending = fn;
        return 1;
      },
      cancelScheduled: () => {
        pending = null;
      },
    });
    return {
      ctx,
      commands,
      chords,
      fireTimeout: () => {
        const fn = pending;
        pending = null;
        fn?.();
      },
      options: {
        commands,
        keymap,
        chords,
        getContext: () => ctx.current,
        modifier: 'ctrl' as const,
      },
    };
  }

  it('первая ступень гасит умолчание браузера и переводит в ожидание', () => {
    // `preventDefault` обязателен: иначе, пока мы ждём вторую клавишу, `mod+k` уже увёл
    // фокус в адресную строку браузера.
    const { commands, chords, options } = chordSetup();
    commands.register({ id: 'keys.open', titleKey: 'a', keybinding: 'mod+k mod+s', run: vi.fn() });

    const event = dispatchable({ key: 'k', ctrlKey: true });
    expect(dispatchKeydown(event, options)).toBeNull();
    expect(event.prevented).toBe(true);
    expect(chords.get().prefix).toEqual(['ctrl+k']);
  });

  it('вторая ступень выполняет команду и снимает ожидание', async () => {
    const { commands, chords, options } = chordSetup();
    const run = vi.fn();
    commands.register({ id: 'keys.open', titleKey: 'a', keybinding: 'mod+k mod+s', run });

    dispatchKeydown(dispatchable({ key: 'k', ctrlKey: true }), options);
    expect(dispatchKeydown(dispatchable({ key: 's', ctrlKey: true }), options)).toBe('keys.open');

    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(1);
    expect(chords.get().prefix).toEqual([]);
  });

  it('непопавшая вторая ступень отменяет аккорд и НЕ выполняет ничего', async () => {
    // Самое важное правило ветки. Переразбор ступени как самостоятельного сочетания означал
    // бы, что `mod+k`, а затем `mod+s` молча сохраняет файл, — человек получил бы действие,
    // которого не просил.
    const { commands, chords, options } = chordSetup();
    const save = vi.fn();
    commands.register({ id: 'files.save', titleKey: 'a', keybinding: 'mod+s', run: save });
    commands.register({ id: 'keys.open', titleKey: 'b', keybinding: 'mod+k mod+p', run: vi.fn() });

    dispatchKeydown(dispatchable({ key: 'k', ctrlKey: true }), options);
    const second = dispatchable({ key: 's', ctrlKey: true });
    expect(dispatchKeydown(second, options)).toBeNull();

    await Promise.resolve();
    expect(save).not.toHaveBeenCalled();
    expect(second.prevented).toBe(true);
    expect(chords.get().prefix).toEqual([]);
  });

  it('Escape отменяет ожидание', () => {
    const { commands, chords, options } = chordSetup();
    commands.register({ id: 'keys.open', titleKey: 'a', keybinding: 'mod+k mod+s', run: vi.fn() });

    dispatchKeydown(dispatchable({ key: 'k', ctrlKey: true }), options);
    const escape = dispatchable({ key: 'Escape' });
    expect(dispatchKeydown(escape, options)).toBeNull();

    expect(chords.get().prefix).toEqual([]);
    expect(escape.prevented).toBe(true);
  });

  it('таймаут отменяет ожидание, и следующее нажатие снова обычное', async () => {
    const { commands, chords, fireTimeout, options } = chordSetup();
    const save = vi.fn();
    commands.register({ id: 'files.save', titleKey: 'a', keybinding: 'mod+s', run: save });
    commands.register({ id: 'keys.open', titleKey: 'b', keybinding: 'mod+k mod+p', run: vi.fn() });

    dispatchKeydown(dispatchable({ key: 'k', ctrlKey: true }), options);
    fireTimeout();
    expect(chords.get().prefix).toEqual([]);

    expect(dispatchKeydown(dispatchable({ key: 's', ctrlKey: true }), options)).toBe('files.save');
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('пока аккорд ждёт, обычные сочетания не рассматриваются', () => {
    // Ожидание — отдельная ветка, а не ещё одно условие в общем отборе.
    const { commands, options } = chordSetup();
    commands.register({ id: 'files.save', titleKey: 'a', keybinding: 'mod+s', run: vi.fn() });
    commands.register({ id: 'keys.open', titleKey: 'b', keybinding: 'mod+k mod+s', run: vi.fn() });

    dispatchKeydown(dispatchable({ key: 'k', ctrlKey: true }), options);

    // `mod+s` здесь — вторая ступень аккорда, а не самостоятельное сохранение.
    expect(dispatchKeydown(dispatchable({ key: 's', ctrlKey: true }), options)).toBe('keys.open');
  });

  it('без состояния аккордов первая ступень просто не срабатывает', () => {
    // Законная сборка: аккорды — возможность, а не обязанность оболочки.
    const { commands, options } = chordSetup();
    commands.register({ id: 'keys.open', titleKey: 'a', keybinding: 'mod+k mod+s', run: vi.fn() });
    const withoutChords = { ...options, chords: undefined };

    expect(dispatchKeydown(dispatchable({ key: 'k', ctrlKey: true }), withoutChords)).toBeNull();
  });
});

describe('installKeybindings', () => {
  it('ставит один обработчик и снимает его по dispose', () => {
    const listeners = new Set<(event: KeyboardEvent) => void>();
    const target: KeydownTarget = {
      addEventListener: (_type, listener) => listeners.add(listener),
      removeEventListener: (_type, listener) => listeners.delete(listener),
    };
    const commands = createCommandRegistry();
    const run = vi.fn();
    commands.register({ id: 'a.save', titleKey: 'a', keybinding: 'mod+s', run });

    const subscription = installKeybindings(target, {
      commands,
      keymap: createKeymapService({ commands, modifier: 'ctrl' }),
      getContext: () => whenContext(),
      modifier: 'ctrl',
    });
    expect(listeners.size).toBe(1);

    const event = dispatchable({ key: 's', ctrlKey: true });
    for (const listener of listeners) listener(event as unknown as KeyboardEvent);
    expect(event.prevented).toBe(true);

    subscription.dispose();
    expect(listeners.size).toBe(0);
  });
});
