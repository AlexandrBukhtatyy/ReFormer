/**
 * Тесты правил показа диагностики: пометка на файле и список панели проблем.
 *
 * @module plugins/files/diagnostics.test
 */

import { SEVERITY_RANK } from '@/sdk';
import { describe, expect, it } from 'vitest';

import type { Diagnostic, DiagnosticSeverity } from '@/sdk';
import { diagnosticDecoration, groupProblems, summarize, totalCounts } from './diagnostics';

const schema = 'fs:forms/credit/schema.json';
const other = 'fs:forms/credit/rules.json';

function at(severity: DiagnosticSeverity, code: string, source = 'validator.schema'): Diagnostic {
  return { source, severity, code, target: { kind: 'node', nodeId: 'ab12cd34' } };
}

describe('свод ресурса сжимается до того, что рисуется', () => {
  it('чистый ресурс — это null, а не «ноль ошибок»', () => {
    // Разница видна пользователю: у первого пометки нет вовсе, у второго был бы значок «0».
    expect(summarize([])).toBeNull();
  });

  it('тон задаёт САМАЯ СТРОГАЯ находка, а не самая частая', () => {
    const summary = summarize([
      at('warning', 'structure.tab-without-panel'),
      at('warning', 'structure.panel-without-tab'),
      at('error', 'schema.unknown-component'),
    ]);

    expect(summary?.worst).toBe('error');
  });

  it('счётчик считает всё, а не только ошибки', () => {
    const summary = summarize([
      at('error', 'schema.unknown-component'),
      at('warning', 'structure.tab-without-panel'),
      at('info', 'schema.unknown-locale-key'),
    ]);

    expect(summary?.total).toBe(3);
    expect(summary?.counts).toEqual({ error: 1, warning: 1, info: 1 });
  });

  it('старшинство строгости — ошибка строже предупреждения, то — сообщения', () => {
    expect(SEVERITY_RANK.error).toBeGreaterThan(SEVERITY_RANK.warning);
    expect(SEVERITY_RANK.warning).toBeGreaterThan(SEVERITY_RANK.info);
  });

  it('складывает своды нескольких ресурсов и терпит чистые среди них', () => {
    const counts = totalCounts([
      summarize([at('error', 'a'), at('warning', 'b')]),
      summarize([]),
      summarize([at('error', 'c')]),
    ]);

    expect(counts).toEqual({ error: 2, warning: 1, info: 0 });
  });
});

describe('пометка на файле', () => {
  it('файл без находок пометки не получает', () => {
    expect(diagnosticDecoration([])).toBeNull();
  });

  it('значок — число находок, тон — по худшей', () => {
    const decoration = diagnosticDecoration([
      at('warning', 'structure.tab-without-panel'),
      at('error', 'schema.unknown-component'),
    ]);

    expect(decoration).toMatchObject({ badge: '2', tone: 'danger' });
  });

  it('предупреждения без ошибок красным не красятся', () => {
    expect(diagnosticDecoration([at('warning', 'structure.tab-without-panel')])?.tone).toBe(
      'warning'
    );
  });

  it('счётчик уходит ПАРАМЕТРОМ подсказки, а не вклеивается в строку', () => {
    // Иначе перевод случился бы здесь, а не в момент показа, и смена локали оставила бы
    // на экране прежний язык.
    const decoration = diagnosticDecoration([at('error', 'a'), at('error', 'b')]);

    expect(decoration?.tooltipKey).toBe('tree.problems.error');
    expect(decoration?.tooltipParams).toEqual({ count: 2 });
  });
});

describe('список панели проблем', () => {
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

  it('закрытый документ показывается адресом: спросить имя не у кого', () => {
    const [, group] = groupProblems([schema, other], read, naming);

    expect(group.name).toBe(other);
    expect(group.path).toBeNull();
  });

  it('открытый документ показывается именем файла, а путь уходит в подсказку', () => {
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
 * Исправления в строках панели.
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
