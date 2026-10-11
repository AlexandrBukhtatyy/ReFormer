import { describe, expect, it } from 'vitest';
import { builtinKit, foreignKit } from './__fixtures__/kit';
import { resolveComponent } from './components';

describe('резолв компонента', () => {
  it('символ берётся из каталога кита, а не из имени записи', () => {
    // `Checkbox` в `@reformer/ui-kit` экспортируется как `CheckboxWithLabel` — это и должно
    // попасть в сгенерированный импорт.
    expect(resolveComponent('Checkbox', builtinKit()).symbol).toBe('CheckboxWithLabel');
    // Без `exportName` символ равен имени записи.
    expect(resolveComponent('Input', builtinKit()).symbol).toBe('Input');
  });

  it('ЧУЖОЙ кит даёт ЧУЖИЕ символы: захардкоженного ui-kit больше нет', () => {
    const resolution = resolveComponent('Input', foreignKit());
    expect(resolution.symbol).toBe('HexInput');
    expect(resolution.placeholder).toBe(false);
  });

  it('оверлей помечается заглушкой с причиной из дескриптора', () => {
    const resolution = resolveComponent('Dialog', builtinKit());
    expect(resolution.placeholder).toBe(true);
    expect(resolution.reason).toContain('оверлей');
  });

  it('компонент за подпутём — символ с подпутём, а не заглушка', () => {
    // Прежде запись с подпутём уходила в заглушку с причиной `subpath-only`: подпуть читался как
    // «не резолвится». Он значит только «откуда импортируется» — и приезжает вместе с символом.
    expect(resolveComponent('Command', builtinKit())).toEqual({
      name: 'Command',
      symbol: 'Command',
      subpath: 'command',
      placeholder: false,
      shim: false,
    });
    // Поля, ради которых это делалось: комбобокс и выбор даты встроенного кита.
    expect(resolveComponent('Combobox', builtinKit())).toMatchObject({
      symbol: 'Combobox',
      subpath: 'combobox',
      placeholder: false,
    });
    expect(resolveComponent('ComboboxMulti', builtinKit()).subpath).toBe('combobox');
    expect(resolveComponent('DatePicker', builtinKit())).toMatchObject({
      symbol: 'DatePicker',
      subpath: 'date-picker',
      placeholder: false,
    });
  });

  it('символ за подпутём называет каталог: имя записи и имя экспорта расходятся и там', () => {
    // Под именами `Chart` и `Calendar` кит ничего не экспортирует: корень графика —
    // `ChartContainer`, поле календаря — `CalendarSingle`. Импорт имени записи не собрался бы.
    expect(resolveComponent('Chart', builtinKit())).toMatchObject({
      symbol: 'ChartContainer',
      subpath: 'chart',
      placeholder: false,
    });
    expect(resolveComponent('Calendar', builtinKit())).toMatchObject({
      symbol: 'CalendarSingle',
      subpath: 'calendar',
    });
  });

  it('у записи из главного входа подпути нет', () => {
    expect(resolveComponent('Input', builtinKit())).not.toHaveProperty('subpath');
    expect(resolveComponent('Input', foreignKit())).not.toHaveProperty('subpath');
  });

  it('запрет живого рендера сильнее подпутя: оверлей за подпутём остаётся заглушкой', () => {
    // Подпуть заглушкой не делает, но и запрета не снимает: запись, объявившая и то и другое,
    // импортировать нельзя по той же причине, что любой оверлей.
    const base = foreignKit();
    const kit = {
      ...base,
      kit: {
        ...base.kit,
        subpaths: new Map([['Box', 'layout']]),
        previewPolicy: new Map([['Box', { mode: 'limited' as const, reason: 'оверлей' }]]),
      },
    };
    expect(resolveComponent('Box', kit)).toMatchObject({
      symbol: null,
      placeholder: true,
      reason: 'оверлей',
    });
    expect(resolveComponent('Box', kit)).not.toHaveProperty('subpath');
  });

  it('визард уходит в шим, а не в импорт из кита', () => {
    expect(resolveComponent('Wizard', builtinKit())).toMatchObject({
      shim: true,
      placeholder: false,
      symbol: null,
    });
  });

  it('имя вне каталога называет кит, а не «ui-kit»', () => {
    const resolution = resolveComponent('НетТакого', foreignKit());
    expect(resolution.placeholder).toBe(true);
    expect(resolution.reason).toContain('HexaUI');
  });
});
