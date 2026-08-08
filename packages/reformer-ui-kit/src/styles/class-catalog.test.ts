import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLASS_GROUPS, COLOR_TOKENS, FIELD_CLASS_GROUPS } from './class-catalog';

/**
 * Страж словаря классов: он уезжает в `component-catalog.json` и оттуда в автодополнение билдера,
 * поэтому расхождение с темой стоит дорого — мёртвая подсказка (класса, который Tailwind не
 * сгенерирует) выглядит как рабочая, пока её не применят.
 *
 * Тема парсится ЗДЕСЬ, а не в генераторе каталога: сбой регулярки в генераторе дал бы молча
 * испорченный артефакт, а здесь — красный тест.
 */
const here = dirname(fileURLToPath(import.meta.url));

/** `--color-*`, объявленные в блоке `@theme inline` (только он задаёт утилиты Tailwind). */
function themeColorTokens(): Set<string> {
  const css = readFileSync(join(here, 'theme.css'), 'utf8');
  const start = css.indexOf('@theme inline');
  const end = css.indexOf(':root', start);
  expect(start, 'в theme.css нет блока @theme inline').toBeGreaterThanOrEqual(0);
  expect(end, 'в theme.css нет :root после @theme inline').toBeGreaterThan(start);
  const block = css.slice(start, end);
  return new Set([...block.matchAll(/--color-([a-z0-9-]+)\s*:/g)].map((m) => m[1]));
}

const allClasses = CLASS_GROUPS.flatMap((g) => g.classes);

describe('COLOR_TOKENS ↔ @theme inline', () => {
  const theme = themeColorTokens();

  it('в словаре нет токенов, которых нет в теме', () => {
    // Так ловится `destructive-foreground`: утилиты `text-destructive-foreground` не существует,
    // потому что `--color-destructive-foreground` в теме не объявлен.
    for (const t of COLOR_TOKENS) expect(theme, `нет в @theme inline: ${t}`).toContain(t);
  });

  it('новые токены темы не забыты в словаре', () => {
    for (const t of theme) expect(COLOR_TOKENS, `забыт в COLOR_TOKENS: ${t}`).toContain(t);
  });
});

describe('форма словаря', () => {
  it('id групп уникальны и в нижнем kebab-case', () => {
    const ids = CLASS_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it('у каждой группы есть подпись и непустой список классов', () => {
    for (const g of CLASS_GROUPS) {
      expect(g.label.length, g.id).toBeGreaterThan(0);
      expect(g.classes.length, g.id).toBeGreaterThan(0);
    }
  });

  it('классы не дублируются между группами', () => {
    // Билдер уплощает словарь и использует класс как React-ключ; раньше дубли скрывал `new Set`
    // над единым списком, теперь их некому схлопнуть на стороне данных.
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const g of CLASS_GROUPS) {
      for (const c of g.classes) {
        const prev = seen.get(c);
        if (prev) dupes.push(`${c}: ${prev} ↔ ${g.id}`);
        else seen.set(c, g.id);
      }
    }
    expect(dupes).toEqual([]);
  });

  it('словарь покрывает основные группы утилит', () => {
    expect(CLASS_GROUPS.length).toBeGreaterThanOrEqual(10);
    expect(allClasses.length).toBeGreaterThan(300);
  });

  it('FIELD_CLASS_GROUPS ссылается на существующие группы', () => {
    const ids = new Set(CLASS_GROUPS.map((g) => g.id));
    for (const id of FIELD_CLASS_GROUPS) expect(ids, id).toContain(id);
  });

  it('группа spacing — это ровно отступы: m/p/gap/space', () => {
    // Ровно то, что разрешено полям формы: расположение поля в форме, но не его вид.
    const spacing = CLASS_GROUPS.find((g) => g.id === 'spacing');
    expect(spacing).toBeDefined();
    for (const c of spacing!.classes) {
      expect(c, c).toMatch(
        /^(m|mx|my|mt|mr|mb|ml|p|px|py|pt|pr|pb|pl|gap|gap-x|gap-y|space-x|space-y)-/
      );
    }
  });
});
