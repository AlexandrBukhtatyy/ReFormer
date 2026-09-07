import { describe, expect, it } from 'vitest';

import { compileWhen, WHEN_TRUE } from '@/shell/platform/primitives/when-expr';
import {
  applyRemovals,
  buildKeybindingIndex,
  compareRules,
  findConflicts,
  rulesFromCommands,
  type KeybindingLayer,
  type KeybindingRule,
} from './keybinding-rules';

let seq = 0;

/** Правило с заполненными обязательными полями: в тесте значимы один-два признака, не все. */
function rule(patch: Partial<KeybindingRule> & { commandId: string }): KeybindingRule {
  return {
    id: `rule:${patch.commandId}:${String(seq)}`,
    chord: ['delete'],
    when: WHEN_TRUE,
    layer: 'host',
    allowInEditable: false,
    seq: seq++,
    ...patch,
  };
}

function index(
  rules: readonly KeybindingRule[],
  removals: Parameters<typeof applyRemovals>[1] = []
) {
  return buildKeybindingIndex(rules, removals, 'ctrl');
}

/** Кто выигрывает на этом сочетании. */
function winner(rules: readonly KeybindingRule[], binding = 'delete'): string | undefined {
  return index(rules).rulesFor(binding)[0]?.commandId;
}

describe('разрешение: слой → специфичность → порядок', () => {
  it('слой человека бьёт слой плагина при равной специфичности', () => {
    // Переназначение, проигравшее правилу плагина, было бы переназначением, которое
    // не сработало, — и объяснить это человеку нечем.
    const plugin = rule({ commandId: 'plugin.action', layer: 'catalog-plugin' });
    const user = rule({ commandId: 'user.action', layer: 'user' });

    expect(winner([plugin, user])).toBe('user.action');
    expect(winner([user, plugin])).toBe('user.action');
  });

  it('слой человека бьёт даже БОЛЕЕ специфичное правило плагина', () => {
    // Специфичность разрешает спор внутри слоя, а не между слоями: иначе переназначение
    // молча проигрывало бы тому, кто написал условие подробнее.
    const plugin = rule({
      commandId: 'plugin.action',
      layer: 'catalog-plugin',
      when: compileWhen('focus == canvas && hasSelection'),
    });
    const user = rule({ commandId: 'user.action', layer: 'user' });

    expect(winner([plugin, user])).toBe('user.action');
  });

  it('при равном слое выигрывает более специфичное условие', () => {
    const broad = rule({ commandId: 'broad', when: WHEN_TRUE });
    const narrow = rule({ commandId: 'narrow', when: compileWhen('focus == tree') });

    expect(winner([broad, narrow])).toBe('narrow');
    expect(winner([narrow, broad])).toBe('narrow');
  });

  it('при полном равенстве выигрывает зарегистрированный ПОСЛЕДНИМ', () => {
    // Последний критерий и последняя надежда: до него доходят только неразличимые правила.
    const first = rule({ commandId: 'first' });
    const second = rule({ commandId: 'second' });

    expect(winner([first, second])).toBe('second');
  });

  it('порядок слоёв: человек, плагин каталога, встроенный плагин, оболочка', () => {
    const layers: readonly KeybindingLayer[] = ['host', 'builtin-plugin', 'catalog-plugin', 'user'];
    const rules = layers.map((layer) => rule({ commandId: layer, layer }));

    expect(
      rules
        .slice()
        .sort(compareRules)
        .map((r) => r.commandId)
    ).toEqual(['user', 'catalog-plugin', 'builtin-plugin', 'host']);
  });
});

describe('указатель', () => {
  it('ключуется сочетанием, УЖЕ разрешённым по платформе', () => {
    // На macOS `mod+s` обязан лежать под `meta+s`: разворачивать `mod` на каждое нажатие
    // для каждого правила — работа ни за чем, платформа за сессию не меняется.
    const save = rule({ commandId: 'files.save', chord: ['mod+s'] });

    expect(buildKeybindingIndex([save], [], 'ctrl').rulesFor('ctrl+s')).toHaveLength(1);
    expect(buildKeybindingIndex([save], [], 'meta').rulesFor('meta+s')).toHaveLength(1);
    expect(buildKeybindingIndex([save], [], 'meta').rulesFor('ctrl+s')).toHaveLength(0);
  });

  it('незанятое сочетание даёт пустой список, а не отказ', () => {
    expect(index([]).rulesFor('ctrl+q')).toEqual([]);
  });

  it('первая ступень аккорда видна как префикс, но сама командой не является', () => {
    // Иначе `mod+k` выполнял бы команду вместо того, чтобы ждать вторую клавишу.
    const chord = rule({ commandId: 'keys.open', chord: ['mod+k', 'mod+s'] });
    const built = index([chord]);

    expect(built.isChordPrefix('ctrl+k')).toBe(true);
    expect(built.rulesFor('ctrl+k')).toEqual([]);
    expect(built.rulesAfter(['ctrl+k'], 'ctrl+s').map((r) => r.commandId)).toEqual(['keys.open']);
    expect(built.rulesAfter(['ctrl+k'], 'ctrl+p')).toEqual([]);
  });

  it('обычное сочетание префиксом не считается', () => {
    expect(index([rule({ commandId: 'a', chord: ['mod+s'] })]).isChordPrefix('ctrl+s')).toBe(false);
  });
});

describe('снятия', () => {
  it('снятие убирает совпадающее правило нижнего слоя и само не срабатывает', () => {
    const plugin = rule({ commandId: 'plugin.duplicate', layer: 'builtin-plugin' });
    const built = index(
      [plugin],
      [{ chord: ['delete'], commandId: 'plugin.duplicate', layer: 'user', seq: 99 }]
    );

    expect(built.rulesFor('delete')).toEqual([]);
  });

  it('снятие без имени команды освобождает клавишу целиком', () => {
    const a = rule({ commandId: 'a', layer: 'builtin-plugin' });
    const b = rule({ commandId: 'b', layer: 'host' });
    const built = index([a, b], [{ chord: ['delete'], commandId: null, layer: 'user', seq: 99 }]);

    expect(built.rulesFor('delete')).toEqual([]);
  });

  it('снятие не трогает правило ВЫШЕ своего слоя', () => {
    // Иначе плагин мог бы снять переназначение человека — то есть отменить его решение.
    const user = rule({ commandId: 'user.action', layer: 'user' });
    const built = index(
      [user],
      [{ chord: ['delete'], commandId: null, layer: 'builtin-plugin', seq: 99 }]
    );

    expect(built.rulesFor('delete').map((r) => r.commandId)).toEqual(['user.action']);
  });

  it('снятие адресуется парой «сочетание + команда»', () => {
    const kept = rule({ commandId: 'kept' });
    const dropped = rule({ commandId: 'dropped' });
    const built = index(
      [kept, dropped],
      [{ chord: ['delete'], commandId: 'dropped', layer: 'user', seq: 99 }]
    );

    expect(built.rulesFor('delete').map((r) => r.commandId)).toEqual(['kept']);
  });
});

describe('правила из команд', () => {
  const whenOf = (command: { readonly when?: string }) =>
    command.when === undefined ? WHEN_TRUE : compileWhen(command.when);

  it('команда без условия получает «всегда» и нулевую специфичность', () => {
    // Одна эта строка и держит обратную совместимость: привязка без условия ведёт себя
    // ровно как до появления правил.
    const [made] = rulesFromCommands([{ id: 'a.save', keybinding: 'mod+s' }], { whenOf });

    expect(made.when).toBe(WHEN_TRUE);
    expect(made.when.specificity).toBe(0);
  });

  it('команда без сочетания правилом не становится', () => {
    expect(rulesFromCommands([{ id: 'a.only-palette' }], { whenOf })).toEqual([]);
  });

  it('слой берётся у владельца: без владельца — оболочка, с владельцем — плагин', () => {
    const made = rulesFromCommands(
      [
        { id: 'shell.toggle', keybinding: 'mod+b' },
        { id: 'files.save', keybinding: 'mod+s', pluginId: 'files' },
      ],
      { whenOf }
    );

    expect(made.map((r) => r.layer)).toEqual(['host', 'builtin-plugin']);
  });

  it('композиция может назвать плагин каталожным', () => {
    // Оболочка не знает, кто пришёл из проекта, а кто встроен, — и знать не должна.
    const made = rulesFromCommands([{ id: 'acme.insert', keybinding: 'mod+i', pluginId: 'acme' }], {
      whenOf,
      layerOf: (pluginId) => (pluginId === 'acme' ? 'catalog-plugin' : 'host'),
    });

    expect(made[0].layer).toBe('catalog-plugin');
  });

  it('порядок регистрации становится порядковым номером', () => {
    const made = rulesFromCommands(
      [
        { id: 'a', keybinding: 'mod+1' },
        { id: 'b', keybinding: 'mod+2' },
      ],
      { whenOf }
    );

    expect(made.map((r) => r.seq)).toEqual([0, 1]);
  });
});

describe('поиск конфликтов', () => {
  it('пара одного слоя с равной специфичностью и пересекающимися условиями — конфликт', () => {
    const a = rule({ commandId: 'a', when: compileWhen('hasSelection') });
    const b = rule({ commandId: 'b', when: compileWhen('previewMode') });

    const found = findConflicts(index([a, b]));

    expect(found).toHaveLength(1);
    expect(found[0].rules.map((r) => r.commandId).sort()).toEqual(['a', 'b']);
  });

  it('разные значения одного ключа конфликтом НЕ считаются', () => {
    // Прямая проверка миграции: `delete` в дереве против `delete` на канвасе — это
    // разведённые клавиши, а не спор.
    const inTree = rule({ commandId: 'files.delete', when: compileWhen('focus == tree') });
    const onCanvas = rule({ commandId: 'schema.delete', when: compileWhen('focus == canvas') });

    expect(findConflicts(index([inTree, onCanvas]))).toEqual([]);
  });

  it('разные слои конфликтом не считаются: их разрешает слой', () => {
    const host = rule({ commandId: 'host.a', layer: 'host' });
    const user = rule({ commandId: 'user.a', layer: 'user' });

    expect(findConflicts(index([host, user]))).toEqual([]);
  });

  it('разная специфичность конфликтом не считается', () => {
    const broad = rule({ commandId: 'broad', when: WHEN_TRUE });
    const narrow = rule({ commandId: 'narrow', when: compileWhen('focus == tree') });

    expect(findConflicts(index([broad, narrow]))).toEqual([]);
  });

  it('конфликт называет победителя', () => {
    const a = rule({ commandId: 'a', when: compileWhen('hasSelection') });
    const b = rule({ commandId: 'b', when: compileWhen('previewMode') });

    const [found] = findConflicts(index([a, b]));

    expect(found.winner).toBe(found.rules[0].id);
    // Победитель тот же, кого выберет диспетчер, — иначе предупреждение говорило бы
    // не о том, что происходит.
    expect(found.rules[0].commandId).toBe(index([a, b]).rulesFor('delete')[0].commandId);
  });

  it('разные сочетания не сравниваются между собой', () => {
    const a = rule({ commandId: 'a', chord: ['mod+1'] });
    const b = rule({ commandId: 'b', chord: ['mod+2'] });

    expect(findConflicts(index([a, b]))).toEqual([]);
  });
});
