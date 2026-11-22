/**
 * Тесты правил вида «Проблемы»: список по ресурсам, счёт для значка, исправления в строке.
 *
 * @module plugins/base/journal/problems.test
 */

import { summarizeDiagnostics } from '@reformer/builder-plugin-api';
import { describe, expect, it } from 'vitest';

import type { Diagnostic, DiagnosticSeverity } from '@reformer/builder-plugin-api';
import { groupProblems, totalCounts } from './problems';

const schema = 'fs:forms/credit/schema.json';
const other = 'fs:forms/credit/rules.json';

function at(severity: DiagnosticSeverity, code: string, source = 'validator.schema'): Diagnostic {
  return { source, severity, code, target: { kind: 'node', nodeId: 'ab12cd34' } };
}

describe('общий счёт', () => {
  it('складывает своды нескольких ресурсов и терпит чистые среди них', () => {
    const counts = totalCounts([
      summarizeDiagnostics([at('error', 'a'), at('warning', 'b')]),
      summarizeDiagnostics([]),
      summarizeDiagnostics([at('error', 'c')]),
    ]);

    expect(counts).toEqual({ error: 2, warning: 1, info: 0 });
  });

  it('без находок — нули', () => {
    expect(totalCounts([])).toEqual({ error: 0, warning: 0, info: 0 });
  });
});

describe('список вида «Проблемы»', () => {
  const swod: Record<string, readonly Diagnostic[]> = {
    [schema]: [
      at('warning', 'structure.tab-without-panel'),
      at('error', 'schema.unknown-component'),
      at('warning', 'structure.panel-without-tab'),
    ],
    [other]: [at('error', 'rules.validation-target-missing')],
  };
  const read = (id: string): readonly Diagnostic[] => swod[id] ?? [];
  const naming = (id: string): { name: string; path: string } | null =>
    id === schema ? { name: 'schema.json', path: 'forms/credit/schema.json' } : null;

  it('группирует по ресурсу, сохраняя порядок, в котором их отдала служба', () => {
    const groups = groupProblems([schema, other], read, naming);

    expect(groups.map((group) => group.resource)).toEqual([schema, other]);
  });

  it('ошибки идут первыми, а внутри одной строгости порядок свода сохраняется', () => {
    const [group] = groupProblems([schema], read, naming);

    expect(group.rows.map((row) => row.code)).toEqual([
      'schema.unknown-component',
      'structure.tab-without-panel',
      'structure.panel-without-tab',
    ]);
  });

  it('ресурс без находок в список не попадает', () => {
    const groups = groupProblems([schema, 'fs:clean.json'], read, naming);

    expect(groups).toHaveLength(1);
  });

  it('ресурс, который нечем назвать, показывается адресом', () => {
    const [, group] = groupProblems([schema, other], read, naming);

    expect(group.name).toBe(other);
    expect(group.path).toBeNull();
  });

  it('названный ресурс показывается именем файла, а путь уходит в подсказку', () => {
    const [group] = groupProblems([schema], read, naming);

    expect(group.name).toBe('schema.json');
    expect(group.path).toBe('forms/credit/schema.json');
  });

  it('ключ строки устойчив: он адрес плюс место в своде, а не индекс после сортировки', () => {
    const keys = groupProblems([schema], read, naming)[0].rows.map((row) => row.key);

    expect(keys).toEqual([`${schema}#1`, `${schema}#0`, `${schema}#2`]);
    expect(new Set(keys).size).toBe(3);
  });

  it('цель находки доезжает до строки: без неё переходить некуда', () => {
    const [group] = groupProblems([schema], read, naming);

    expect(group.rows[0].target).toEqual({ kind: 'node', nodeId: 'ab12cd34' });
  });
});

/**
 * Исправления в строках.
 *
 * Отбор идёт ВТОРОЙ раз — после того, как его уже сделал валидатор при публикации. Причина
 * не в недоверии: список пересобирается на каждой отрисовке, а плагин, владеющий командой,
 * могли выключить между публикацией находки и этим кадром.
 */
describe('исправления в строке', () => {
  const fix = { titleKey: 'quickfix.replace-component', commandId: 'schema.set-component' };

  function withFix(): Diagnostic {
    return { ...at('error', 'schema.unknown-component'), fixes: [fix] };
  }

  const named = (): { name: string; path: string } => ({
    name: 'schema.json',
    path: 'forms/credit/schema.json',
  });

  function rowsOf(items: readonly Diagnostic[], isRegistered?: (id: string) => boolean) {
    return groupProblems([schema], () => items, named, isRegistered)[0].rows;
  }

  it('отдаёт исправление, чья команда зарегистрирована', () => {
    expect(rowsOf([withFix()], (id) => id === fix.commandId)[0].fixes).toEqual([fix]);
  });

  it('не отдаёт исправление, чьей команды нет', () => {
    expect(rowsOf([withFix()], () => false)[0].fixes).toEqual([]);
  });

  it('без реестра команд исправлений нет вовсе: сверять не с чем', () => {
    expect(rowsOf([withFix()])[0].fixes).toEqual([]);
  });

  it('находка без исправлений остаётся строкой без кнопок', () => {
    expect(rowsOf([at('error', 'schema.parse-failed')], () => true)[0].fixes).toEqual([]);
  });
});
