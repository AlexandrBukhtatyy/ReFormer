import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { classNamesFor, resetClassNamesCache, suggestClasses } from './class-names';
import { getCatalog } from './index';
import { loadCatalogJson } from './contract';
import { setActiveDescriptor } from '../kits/active';
import { toDescriptor } from '../kits/descriptor';
import type { CatalogJson, CatalogRecord } from './types';

const GROUPS = [
  { id: 'spacing', label: 'Отступы', classes: ['gap-2', 'gap-4', 'p-4'] },
  { id: 'color', label: 'Цвета', classes: ['bg-muted', 'text-foreground'] },
  { id: 'layout', label: 'Раскладка', classes: ['flex', 'gap-2'] },
];

function record(name: string, extra: Partial<CatalogRecord> = {}): CatalogRecord {
  return { name, role: 'container', propsSchema: { type: 'object' }, ...extra };
}

/** Подменить активный кит на тестовый (мемо словаря при этом надо сбросить). */
function useKit(json: Partial<CatalogJson> & Pick<CatalogJson, 'components'>) {
  setActiveDescriptor(toDescriptor({ version: '2.0', ...json }));
  resetClassNamesCache();
}

beforeAll(() => {
  // Прогрев мемо каталога: `classNamesFor` вызывает `getCatalog()`, а тот при ПЕРВОЙ сборке кладёт
  // настоящий дескриптор — и затёр бы тестовый. После прогрева сборка больше не повторяется.
  getCatalog();
});

afterEach(() => {
  setActiveDescriptor(toDescriptor(loadCatalogJson()));
  resetClassNamesCache();
});

describe('classNamesFor: словарь кита и политика групп', () => {
  it('без ограничений — весь словарь в порядке групп, дубли схлопнуты', () => {
    useKit({ components: [record('Box')], kit: { styles: { classNames: GROUPS } } });
    // `gap-2` есть и в spacing, и в layout: класс — React-ключ выпадашки, дубль недопустим.
    expect(classNamesFor('Box')).toEqual([
      'gap-2',
      'gap-4',
      'p-4',
      'bg-muted',
      'text-foreground',
      'flex',
    ]);
  });

  it('ограничение оставляет только разрешённые группы', () => {
    useKit({
      components: [record('Input', { role: 'field', classGroups: ['spacing'] })],
      kit: { styles: { classNames: GROUPS } },
    });
    expect(classNamesFor('Input')).toEqual(['gap-2', 'gap-4', 'p-4']);
  });

  it('правило роли действует на записи без собственного classGroups', () => {
    useKit({
      components: [record('Input', { role: 'field' }), record('Box')],
      kit: { styles: { classNames: GROUPS, classGroupsByRole: { field: ['color'] } } },
    });
    expect(classNamesFor('Input')).toEqual(['bg-muted', 'text-foreground']);
    expect(classNamesFor('Box').length).toBe(6);
  });

  it('пустой classGroups — подсказывать нечего', () => {
    useKit({
      components: [record('Locked', { classGroups: [] })],
      kit: { styles: { classNames: GROUPS } },
    });
    expect(classNamesFor('Locked')).toEqual([]);
  });

  it('кит без словаря — подсказок нет, и это НЕ запрет', () => {
    // Важно не спутать два состояния: «кит словаря не прислал» и «кит запретил все группы».
    // Для поля результат одинаков (пусто), но приходит он разными путями, и политика тут пуста.
    useKit({ components: [record('Box')] });
    expect(classNamesFor('Box')).toEqual([]);
  });

  it('неизвестный id группы просто не находится, остальные разрешения работают', () => {
    useKit({
      components: [record('Odd', { classGroups: ['spacing', 'нет-такой'] })],
      kit: { styles: { classNames: GROUPS } },
    });
    expect(classNamesFor('Odd')).toEqual(['gap-2', 'gap-4', 'p-4']);
  });

  it('компонента нет в каталоге — ограничений нет, отдаём весь словарь', () => {
    useKit({ components: [record('Box')], kit: { styles: { classNames: GROUPS } } });
    expect(classNamesFor('НетТакого').length).toBe(6);
  });
});

describe('classNamesFor на реальном каталоге ui-kit', () => {
  it('контейнеру доступен весь словарь, полю — только отступы', () => {
    const box = classNamesFor('Box');
    const input = classNamesFor('Input');

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
    expect(classNamesFor('$html(div)')).toEqual(classNamesFor('Box'));
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
