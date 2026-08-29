/**
 * Тесты сведения «свод ресурса → метки на узлах канваса».
 *
 * @module plugins/editor-schema/node-diagnostics.test
 */

import { SEVERITY_RANK } from '@/sdk';
import { describe, expect, it } from 'vitest';

import type { Diagnostic, DiagnosticSeverity } from '@/sdk';
import {
  indexNodeDiagnostics,
  nodeFixes,
  nodeProblemTitle,
  NO_NODE_DIAGNOSTICS,
  unplacedCount,
} from './node-diagnostics';

function onNode(
  nodeId: string,
  severity: DiagnosticSeverity,
  code: string,
  params?: Record<string, unknown>
): Diagnostic {
  return { source: 'validator.schema', severity, code, params, target: { kind: 'node', nodeId } };
}

const onRange: Diagnostic = {
  source: 'validator.schema',
  severity: 'error',
  code: 'schema.parse-failed',
  target: { kind: 'range', range: { start: 0, end: 4 } },
};

const onResource: Diagnostic = {
  source: 'validator.schema',
  severity: 'error',
  code: 'schema.not-a-form',
  target: { kind: 'resource' },
};

describe('указатель находок по узлам', () => {
  it('кладёт находку на её узел', () => {
    const index = indexNodeDiagnostics([onNode('ab12cd34', 'error', 'schema.unknown-component')]);

    expect(index.get('ab12cd34')).toMatchObject({ worst: 'error', total: 1 });
  });

  it('несколько находок одного узла складываются в одну метку', () => {
    const index = indexNodeDiagnostics([
      onNode('ab12cd34', 'warning', 'structure.tab-without-panel'),
      onNode('ab12cd34', 'error', 'schema.unknown-component'),
    ]);

    expect(index.get('ab12cd34')).toMatchObject({ worst: 'error', total: 2 });
  });

  it('вид метки задаёт САМАЯ СТРОГАЯ находка, а не последняя', () => {
    const index = indexNodeDiagnostics([
      onNode('ab12cd34', 'error', 'schema.unknown-component'),
      onNode('ab12cd34', 'warning', 'structure.tab-without-panel'),
    ]);

    expect(index.get('ab12cd34')?.worst).toBe('error');
  });

  it('находка без узлового адреса на узел не вешается: любой узел был бы выдумкой', () => {
    const index = indexNodeDiagnostics([onRange, onResource]);

    expect(index.size).toBe(0);
  });

  it('чистый свод отдаёт ОБЩУЮ пустую карту: сравнение по ссылке дешевле новой', () => {
    expect(indexNodeDiagnostics([])).toBe(NO_NODE_DIAGNOSTICS);
    expect(indexNodeDiagnostics([onRange])).toBe(NO_NODE_DIAGNOSTICS);
  });

  it('узлы не смешиваются', () => {
    const index = indexNodeDiagnostics([
      onNode('aaaa1111', 'error', 'schema.unknown-component'),
      onNode('bbbb2222', 'warning', 'structure.tab-without-panel'),
    ]);

    expect(index.get('aaaa1111')?.worst).toBe('error');
    expect(index.get('bbbb2222')?.worst).toBe('warning');
  });

  it('старшинство строгости: ошибка строже предупреждения, то — сообщения', () => {
    expect(SEVERITY_RANK.error).toBeGreaterThan(SEVERITY_RANK.warning);
    expect(SEVERITY_RANK.warning).toBeGreaterThan(SEVERITY_RANK.info);
  });
});

describe('находки, которым места на канвасе нет', () => {
  it('считаются, а не теряются молча', () => {
    expect(unplacedCount([onRange, onResource, onNode('ab12cd34', 'error', 'x')])).toBe(2);
  });

  it('на чистом своде их ноль', () => {
    expect(unplacedCount([onNode('ab12cd34', 'error', 'x')])).toBe(0);
  });
});

describe('подпись метки узла', () => {
  const message = (code: string, params?: Record<string, unknown>): string =>
    params === undefined ? code : `${code}(${String(params.name)})`;

  it('перечисляет все находки узла, по одной в строке', () => {
    const index = indexNodeDiagnostics([
      onNode('ab12cd34', 'error', 'schema.unknown-component', { name: 'Foo' }),
      onNode('ab12cd34', 'warning', 'structure.tab-without-panel'),
    ]);

    expect(nodeProblemTitle(index.get('ab12cd34')!, message)).toBe(
      'schema.unknown-component(Foo)\nstructure.tab-without-panel'
    );
  });

  it('строгие идут первыми, а внутри строгости порядок свода сохраняется', () => {
    const index = indexNodeDiagnostics([
      onNode('ab12cd34', 'warning', 'first-warning'),
      onNode('ab12cd34', 'error', 'the-error'),
      onNode('ab12cd34', 'warning', 'second-warning'),
    ]);

    expect(nodeProblemTitle(index.get('ab12cd34')!, message).split('\n')).toEqual([
      'the-error',
      'first-warning',
      'second-warning',
    ]);
  });

  it('перевод делает ТОТ, КТО ЗНАЕТ словарь: сюда он приходит функцией', () => {
    const index = indexNodeDiagnostics([onNode('ab12cd34', 'error', 'schema.unknown-component')]);

    expect(nodeProblemTitle(index.get('ab12cd34')!, () => 'Компонента нет в каталоге')).toBe(
      'Компонента нет в каталоге'
    );
  });
});

/**
 * Исправления на строке узла.
 *
 * Главное здесь — не «кнопка есть», а «кнопки нет, когда команды нет». Именно так выглядел
 * дефект, ради которого отбор и заводился: исправление называет команду строкой, а строка
 * может указывать в пустоту — на выключенный плагин или на опечатку в идентификаторе.
 */
describe('исправления узла', () => {
  const fix = { titleKey: 'quickfix.replace-component', commandId: 'schema.set-component' };
  const withFix: Diagnostic = {
    ...onNode('ab12cd34', 'error', 'schema.unknown-component'),
    fixes: [fix],
  };

  it('отдаёт исправление, чья команда зарегистрирована', () => {
    const node = indexNodeDiagnostics([withFix]).get('ab12cd34')!;
    expect(nodeFixes(node, (id) => id === fix.commandId)).toEqual([fix]);
  });

  it('молчит, когда команды нет: кнопка-обманка хуже её отсутствия', () => {
    const node = indexNodeDiagnostics([withFix]).get('ab12cd34')!;
    expect(nodeFixes(node, () => false)).toEqual([]);
  });

  it('собирает исправления всех находок узла, а не только первой', () => {
    const second = {
      titleKey: 'quickfix.rename-property',
      commandId: 'schema.rename-prop',
    };
    const node = indexNodeDiagnostics([
      withFix,
      { ...onNode('ab12cd34', 'error', 'schema.unknown-property'), fixes: [second] },
    ]).get('ab12cd34')!;

    expect(nodeFixes(node, () => true)).toEqual([fix, second]);
  });

  it('находка без исправлений не даёт ни одной кнопки', () => {
    const node = indexNodeDiagnostics([onNode('ab12cd34', 'error', 'schema.parse-failed')]).get(
      'ab12cd34'
    )!;
    expect(nodeFixes(node, () => true)).toEqual([]);
  });
});
