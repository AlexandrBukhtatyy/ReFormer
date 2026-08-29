/**
 * Словарь классов и политика групп. В v1 тестовый кит подсовывался через `setActiveDescriptor`, а
 * файл был обязан сначала прогреть `getCatalog()` (иначе первая сборка каталога затирала подмену)
 * и сбрасывать мемо после каждого случая. Здесь дескриптор — аргумент: подменять нечего, греть
 * нечего, сбрасывать нечего.
 *
 * @module reformer-builder/lib/catalog/class-names.test
 */

import { describe, expect, it } from 'vitest';
import { classNamesFor, knownClassNames, suggestClasses, unknownClasses } from './class-names';
import { toDescriptor } from '../kits/descriptor';
import { builtinCatalog } from './__fixtures__/builtin-catalog';
import type { CatalogJson, CatalogRecord } from './types';

const GROUPS = [
  { id: 'spacing', label: 'Отступы', classes: ['gap-2', 'gap-4', 'p-4'] },
  { id: 'color', label: 'Цвета', classes: ['bg-muted', 'text-foreground'] },
  { id: 'layout', label: 'Раскладка', classes: ['flex', 'gap-2'] },
];

function record(name: string, extra: Partial<CatalogRecord> = {}): CatalogRecord {
  return { name, role: 'container', propsSchema: { type: 'object' }, ...extra };
}

/** Дескриптор тестового кита. */
function kit(json: Partial<CatalogJson> & Pick<CatalogJson, 'components'>) {
  return toDescriptor({ version: '2.0', ...json });
}

describe('classNamesFor: словарь кита и политика групп', () => {
  it('без ограничений — весь словарь в порядке групп, дубли схлопнуты', () => {
    const d = kit({ components: [record('Box')], kit: { styles: { classNames: GROUPS } } });
    // `gap-2` есть и в spacing, и в layout: класс — React-ключ выпадашки, дубль недопустим.
    expect(classNamesFor(d, 'Box')).toEqual([
      'gap-2',
      'gap-4',
      'p-4',
      'bg-muted',
      'text-foreground',
      'flex',
    ]);
  });

  it('ограничение оставляет только разрешённые группы', () => {
    const d = kit({
      components: [record('Input', { role: 'field', classGroups: ['spacing'] })],
      kit: { styles: { classNames: GROUPS } },
    });
    expect(classNamesFor(d, 'Input')).toEqual(['gap-2', 'gap-4', 'p-4']);
  });

  it('правило роли действует на записи без собственного classGroups', () => {
    const d = kit({
      components: [record('Input', { role: 'field' }), record('Box')],
      kit: { styles: { classNames: GROUPS, classGroupsByRole: { field: ['color'] } } },
    });
    expect(classNamesFor(d, 'Input')).toEqual(['bg-muted', 'text-foreground']);
    expect(classNamesFor(d, 'Box').length).toBe(6);
  });

  it('пустой classGroups — подсказывать нечего', () => {
    const d = kit({
      components: [record('Locked', { classGroups: [] })],
      kit: { styles: { classNames: GROUPS } },
    });
    expect(classNamesFor(d, 'Locked')).toEqual([]);
  });

  it('кит без словаря — подсказок нет, и это НЕ запрет', () => {
    // Важно не спутать два состояния: «кит словаря не прислал» и «кит запретил все группы».
    // Для поля результат одинаков (пусто), но приходит он разными путями, и политика тут пуста.
    const d = kit({ components: [record('Box')] });
    expect(classNamesFor(d, 'Box')).toEqual([]);
  });

  it('неизвестный id группы просто не находится, остальные разрешения работают', () => {
    const d = kit({
      components: [record('Odd', { classGroups: ['spacing', 'нет-такой'] })],
      kit: { styles: { classNames: GROUPS } },
    });
    expect(classNamesFor(d, 'Odd')).toEqual(['gap-2', 'gap-4', 'p-4']);
  });

  it('компонента нет в каталоге — ограничений нет, отдаём весь словарь', () => {
    const d = kit({ components: [record('Box')], kit: { styles: { classNames: GROUPS } } });
    expect(classNamesFor(d, 'НетТакого').length).toBe(6);
  });

  it('мемо привязано к дескриптору, а не глобально: два кита не мешают друг другу', () => {
    // Ровно та ошибка, ради которой в v1 существовал `resetClassNamesCache()`.
    const a = kit({ components: [record('Box')], kit: { styles: { classNames: GROUPS } } });
    const b = kit({ components: [record('Box')] });
    expect(classNamesFor(a, 'Box').length).toBe(6);
    expect(classNamesFor(b, 'Box')).toEqual([]);
    expect(classNamesFor(a, 'Box').length).toBe(6);
  });
});

describe('classNamesFor на реальном каталоге ui-kit', () => {
  const d = builtinCatalog().descriptor;

  it('контейнеру доступен весь словарь, полю — только отступы', () => {
    const box = classNamesFor(d, 'Box');
    const input = classNamesFor(d, 'Input');

    expect(box).toContain('gap-4');
    expect(box).toContain('bg-muted');
    expect(box).toContain('grid-cols-2');

    expect(input).toContain('gap-4');
    expect(input).toContain('mt-2');
    // Вид поля задаёт дизайн-система: цвета, типографика и размеры недоступны.
    expect(input).not.toContain('bg-muted');
    expect(input).not.toContain('text-sm');
    expect(input).not.toContain('w-full');
    expect(input.length).toBeLessThan(box.length);
  });

  it('синтетическому $html-тегу доступен весь словарь', () => {
    expect(classNamesFor(d, '$html(div)')).toEqual(classNamesFor(d, 'Box'));
  });

  it('knownClassNames шире, чем разрешено полю: это про CSS, а не про политику', () => {
    const known = knownClassNames(d);
    // Полю кит предлагает только отступы, но отрисуются ему любые классы словаря.
    expect(classNamesFor(d, 'Input')).not.toContain('md:grid-cols-2');
    expect(known).toContain('md:grid-cols-2');
    expect(known).toContain('bg-muted');
    expect(known.length).toBe(classNamesFor(d, 'Box').length);
  });
});

describe('unknownClasses', () => {
  const ALL = ['flex', 'gap-4', 'md:grid-cols-2'];

  it('отдаёт только классы вне словаря, в порядке записи и без дублей', () => {
    expect(unknownClasses(ALL, 'flex gap-4')).toEqual([]);
    expect(unknownClasses(ALL, 'flex md:foo bar md:foo')).toEqual(['md:foo', 'bar']);
  });

  it('лишние пробелы и пустое значение не создают токенов', () => {
    expect(unknownClasses(ALL, '')).toEqual([]);
    expect(unknownClasses(ALL, '   flex   gap-4  ')).toEqual([]);
  });

  it('пустой словарь выключает проверку целиком', () => {
    // Кит словаря не прислал — иначе инспектор пометил бы подозрительным вообще всё.
    expect(unknownClasses([], 'что-угодно и ещё')).toEqual([]);
  });
});

describe('suggestClasses', () => {
  const ALL = ['gap-2', 'gap-4', 'p-4', 'bg-muted', 'flex'];
  const none = new Set<string>();

  it('пустой токен списка не даёт', () => {
    expect(suggestClasses(ALL, '', none, 24)).toEqual([]);
  });

  it('фильтр по подстроке, а не по префиксу', () => {
    expect(suggestClasses(ALL, 'ap', none, 24)).toEqual(['gap-2', 'gap-4']);
    expect(suggestClasses(ALL, 'GAP-4', none, 24)).toEqual(['gap-4']);
  });

  it('уже использованные классы исключаются', () => {
    expect(suggestClasses(ALL, 'gap', new Set(['gap-2']), 24)).toEqual(['gap-4']);
  });

  it('класс, который дописывают прямо сейчас, из списка не выпадает', () => {
    // Иначе выпадашка схлопывалась бы ровно в момент, когда токен совпал с существующим классом.
    expect(suggestClasses(ALL, 'gap-2', new Set(['gap-2']), 24)).toEqual(['gap-2']);
  });

  it('лимит обрезает выдачу', () => {
    expect(suggestClasses(ALL, 'a', none, 2)).toHaveLength(2);
  });

  it('пустой словарь не падает', () => {
    expect(suggestClasses([], 'gap', none, 24)).toEqual([]);
  });
});
