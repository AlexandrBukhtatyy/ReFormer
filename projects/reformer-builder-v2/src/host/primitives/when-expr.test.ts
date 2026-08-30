import { describe, expect, it } from 'vitest';

import {
  compileWhen,
  evaluateWhen,
  parseWhen,
  provablyDisjoint,
  WHEN_TRUE,
  WhenSyntaxError,
  whenSpecificity,
} from './when-expr';
import type { WhenExpr } from './when-expr';

/** Читатель ключей из простой карты — ровно то, чем будет служба контекстных ключей. */
const reader =
  (values: Readonly<Record<string, unknown>>) =>
  (key: string): unknown =>
    values[key];

/** Вычисление условия по карте значений: в тестах значим результат, а не форма читателя. */
function evaluate(source: string, values: Readonly<Record<string, unknown>> = {}): boolean {
  return evaluateWhen(compileWhen(source), reader(values));
}

function specificity(source: string): number {
  return compileWhen(source).specificity;
}

function expectSyntaxError(source: string): WhenSyntaxError {
  try {
    compileWhen(source);
  } catch (error) {
    if (error instanceof WhenSyntaxError) return error;
    throw error;
  }
  throw new Error(`ожидался WhenSyntaxError, но «${source}» разобралось`);
}

describe('разбор: приоритеты и структура', () => {
  it('«и» связывает сильнее «или»', () => {
    // Разбор проверяется вычислением, а не формой дерева: при обратном приоритете
    // выражение стало бы истинным, потому что первая ветвь истинна.
    expect(evaluate('a || b && c', { a: false, b: true, c: false })).toBe(false);
    expect(evaluate('a || b && c', { a: true, b: false, c: false })).toBe(true);
  });

  it('скобки перекрывают приоритет', () => {
    expect(evaluate('(a || b) && c', { a: true, b: false, c: false })).toBe(false);
    expect(evaluate('(a || b) && c', { a: true, b: false, c: true })).toBe(true);
  });

  it('отрицание применяется к ближайшему ключу, а не ко всему сравнению', () => {
    // `!a == b` — это «отрицание a», сравнённое с b. Так же, как в VS Code: привычка,
    // перенесённая оттуда, не должна давать здесь другой результат.
    const expr = compileWhen('!a == b');
    expect(expr.ast).toEqual({
      kind: 'eq',
      key: 'a',
      value: 'b',
      negated: true,
    });
  });

  it('одноимённые связки схлопываются в один плоский узел', () => {
    // Иначе `(a && b) && c` и `a && (b && c)` были бы разными представлениями одного смысла.
    expect(compileWhen('a && b && c').ast).toEqual(compileWhen('(a && b) && c').ast);
  });

  it('двойное отрицание снимается, а не накапливает обёртки', () => {
    expect(compileWhen('!!a').ast).toEqual(compileWhen('a').ast);
  });

  it('неравенство и отрицание равенства дают ОДИН разбор', () => {
    // Несущее свойство: разойдись они — два одинаковых по смыслу правила получили бы разную
    // специфичность и выглядели бы разными в редакторе клавиш.
    expect(compileWhen('a != b').ast).toEqual(compileWhen('!(a == b)').ast);
  });
});

describe('разбор: правая часть сравнения', () => {
  it('голое слово справа — строка, а не ключ', () => {
    // Самая частая запись проекта. Читайся слово ключом — сравнивались бы два `undefined`,
    // условие было бы истинным ВСЕГДА, и промах выглядел бы как «клавиша работает везде».
    expect(
      evaluate('activeResourceKind == form.schema', { activeResourceKind: 'form.schema' })
    ).toBe(true);
    expect(evaluate('activeResourceKind == form.schema', { activeResourceKind: 'markdown' })).toBe(
      false
    );
    expect(evaluate('activeResourceKind == form.schema', {})).toBe(false);
  });

  it('кавычки допустимы и значения не меняют', () => {
    expect(compileWhen("focus == 'tree'").ast).toEqual(compileWhen('focus == tree').ast);
  });

  it('слова true, false и null читаются значениями, а не строками', () => {
    expect(evaluate('activeEditorId != null', { activeEditorId: null })).toBe(false);
    expect(evaluate('activeEditorId != null', { activeEditorId: 'a.json' })).toBe(true);
    expect(evaluate('hasSelection == false', { hasSelection: false })).toBe(true);
  });

  it('справа от «in» стоит КЛЮЧ, и читается коллекция по нему', () => {
    expect(evaluate('scope in scopes', { scope: 'dialog', scopes: ['palette', 'dialog'] })).toBe(
      true
    );
    expect(evaluate('scope in scopes', { scope: 'dialog', scopes: ['palette'] })).toBe(false);
    expect(evaluate('scope not in scopes', { scope: 'dialog', scopes: ['palette'] })).toBe(true);
  });

  it('шаблон сравнивается с учётом флагов', () => {
    expect(evaluate('activeEditorId =~ /\\.json$/', { activeEditorId: 'a.json' })).toBe(true);
    expect(evaluate('activeEditorId =~ /\\.JSON$/i', { activeEditorId: 'a.json' })).toBe(true);
    expect(evaluate('activeEditorId =~ /\\.json$/', { activeEditorId: 'a.md' })).toBe(false);
  });
});

describe('вычисление', () => {
  it('неизвестный ключ ложен, а не отказ', () => {
    // Условие вправе ссылаться на ключ выключенного плагина: это обычное состояние,
    // а не поломка. Правило просто перестаёт совпадать.
    expect(evaluate('schemaEditor.nodeSelected')).toBe(false);
    expect(() => evaluate('schemaEditor.nodeSelected')).not.toThrow();
  });

  it('пустые значения не считаются истиной', () => {
    expect(evaluate('activeEditorId', { activeEditorId: null })).toBe(false);
    expect(evaluate('previewMode', { previewMode: '' })).toBe(false);
    expect(evaluate('count', { count: 0 })).toBe(false);
    expect(evaluate('focus', { focus: 'tree' })).toBe(true);
  });

  it('пустое условие истинно и имеет специфичность ноль', () => {
    expect(compileWhen('')).toBe(WHEN_TRUE);
    expect(compileWhen('   ')).toBe(WHEN_TRUE);
    expect(evaluateWhen(WHEN_TRUE, reader({}))).toBe(true);
    expect(WHEN_TRUE.specificity).toBe(0);
  });
});

describe('специфичность', () => {
  it('дизъюнкция берёт МИНИМУМ ветвей, а не максимум', () => {
    // Несущий тест всей модели разрешения конфликтов. Возьми формула максимум — приписка
    // «или всегда» встала бы выше исходного условия, совпадая при этом со строго большим
    // числом состояний, и стала бы способом перебить кого угодно.
    const narrow = specificity('focus == tree');
    const widened = specificity('focus == tree || true');

    expect(widened).toBeLessThan(narrow);
    expect(widened).toBe(0);
  });

  it('конъюнкция складывает: каждый конъюнкт сужает', () => {
    expect(specificity('focus == canvas && hasSelection')).toBe(
      specificity('focus == canvas') + specificity('hasSelection')
    );
  });

  it('отрицание специфичность не обнуляет', () => {
    // Иначе «работает, когда ничего не выделено» стало бы безусловным правилом.
    expect(specificity('!hasSelection')).toBe(specificity('hasSelection'));
  });

  it('область весит больше фокуса, фокус — больше произвольного ключа', () => {
    expect(specificity('scope == dialog')).toBeGreaterThan(specificity('focus == tree'));
    expect(specificity('focus == tree')).toBeGreaterThan(specificity('acme.ready == true'));
  });

  it('сравнение уже голой проверки на истинность', () => {
    expect(specificity('focus == tree')).toBeGreaterThan(specificity('focus'));
  });

  it('специфичность считается один раз и лежит в разобранном условии', () => {
    const expr = compileWhen('focus == canvas && hasSelection');
    expect(expr.specificity).toBe(whenSpecificity(expr.ast));
  });
});

describe('читаемые ключи', () => {
  it('перечисляются все, включая правую часть «in»', () => {
    // По этому набору идёт подписка на изменения контекста: пропусти он коллекцию —
    // правило не пересчиталось бы при смене стека областей.
    expect(compileWhen('scope in scopes && focus == tree').keys).toEqual([
      'focus',
      'scope',
      'scopes',
    ]);
  });

  it('повторы схлопываются, порядок устойчив', () => {
    expect(compileWhen('focus == tree || focus == canvas').keys).toEqual(['focus']);
  });

  it('у пустого условия ключей нет', () => {
    expect(WHEN_TRUE.keys).toEqual([]);
  });
});

describe('отказы разбора', () => {
  it('ошибка несёт смещение в исходной строке', () => {
    // Смещение нужно редактору клавиш: он подсвечивает место, а не всю строку.
    const error = expectSyntaxError('focus == tree &&');
    expect(error.at).toBe('focus == tree &&'.length);
    expect(error.source).toBe('focus == tree &&');
  });

  it('незакрытая скобка отвергается', () => {
    expect(() => compileWhen('(focus == tree')).toThrow(WhenSyntaxError);
  });

  it('незакрытая строка отвергается', () => {
    expect(() => compileWhen("focus == 'tree")).toThrow(WhenSyntaxError);
  });

  it('лишнее после условия отвергается, а не отбрасывается молча', () => {
    expect(() => compileWhen('focus == tree canvas')).toThrow(WhenSyntaxError);
  });

  it('parseWhen не бросает, а возвращает отказ данными', () => {
    // Для того, что человек правит руками: манифест и раскладка. Испорченная запись
    // в файле — обычное состояние, ронять на ней загрузку нельзя.
    const result = parseWhen('focus ==');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.source).toBe('focus ==');

    const good = parseWhen('focus == tree');
    expect(good.ok).toBe(true);
  });
});

describe('доказуемая непересекаемость', () => {
  const expr = (source: string): WhenExpr => compileWhen(source);

  it('разные значения одного ключа непересекаемы', () => {
    // Ровно тот случай, ради которого функция и заведена: `delete` в дереве против
    // `delete` на канвасе — это не конфликт, и предупреждать о нём нельзя.
    expect(provablyDisjoint(expr('focus == tree'), expr('focus == canvas'))).toBe(true);
  });

  it('то же значение одного ключа непересекаемым не считается', () => {
    expect(provablyDisjoint(expr('focus == tree'), expr('focus == tree'))).toBe(false);
  });

  it('непересекаемость видна и внутри конъюнкции', () => {
    expect(
      provablyDisjoint(
        expr('focus == canvas && hasSelection'),
        expr('focus == tree && hasSelection')
      )
    ).toBe(true);
  });

  it('разные ключи непересекаемыми не считаются', () => {
    expect(provablyDisjoint(expr('focus == tree'), expr('hasSelection'))).toBe(false);
  });

  it('дизъюнкции и отрицания в доказательство не идут', () => {
    // Приближать доказательство эвристиками нельзя: цена ошибки несимметрична. Лишнее
    // предупреждение человек увидит, а молча пропущенный конфликт — нет.
    expect(provablyDisjoint(expr('focus == tree || focus == canvas'), expr('focus == tree'))).toBe(
      false
    );
    expect(provablyDisjoint(expr('focus != tree'), expr('focus == tree'))).toBe(false);
  });

  it('безусловное условие ни с чем не расходится', () => {
    expect(provablyDisjoint(WHEN_TRUE, expr('focus == tree'))).toBe(false);
    expect(provablyDisjoint(expr('focus == tree'), WHEN_TRUE)).toBe(false);
  });
});
