import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
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

  it('компоненты не используют цвет «-foreground», которого нет в теме [ReFormer-ayc]', () => {
    // Tailwind v4 не генерирует утилиту без токена: класс молча ничего не красит. Так кнопки удаления
    // массива рисовали текст `text-destructive-foreground` цветом по умолчанию.
    const components = join(here, '../components');
    const unknown = new Set<string>();
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
          const code = readFileSync(path, 'utf8');
          for (const [, token] of code.matchAll(
            /\b(?:text|bg|border|ring|fill|stroke)-([a-z][a-z-]*-foreground)\b/g
          )) {
            if (!theme.has(token)) unknown.add(`${relative(components, path)}: ${token}`);
          }
        }
      }
    };
    walk(components);
    expect([...unknown]).toEqual([]);
  });
});

describe('значения токенов темы', () => {
  const css = readFileSync(join(here, 'theme.css'), 'utf8');
  // Блоки значений — с начала строки: `.dark` встречается ещё в шапке и в `@custom-variant`.
  const lightStart = css.search(/^:root \{/m);
  const darkStart = css.search(/^\.dark,/m);
  /** Переменные блока темы: `--имя: значение;`. */
  const variables = (block: string): Set<string> =>
    new Set([...block.matchAll(/--([a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const light = variables(css.slice(lightStart, darkStart));
  const dark = variables(css.slice(darkStart));

  it('у каждого цветового токена есть значение в светлой и в тёмной теме', () => {
    // `--color-x: var(--x)` без самого `--x` даёт утилиту с пустым цветом — молча.
    expect(lightStart).toBeGreaterThan(0);
    expect(darkStart).toBeGreaterThan(lightStart);
    for (const t of themeColorTokens()) {
      expect(light, `нет значения в :root: --${t}`).toContain(t);
      expect(dark, `нет значения в тёмной теме: --${t}`).toContain(t);
    }
  });

  it('токен предупреждения объявлен — им красится замечание-предупреждение под полем', () => {
    expect(themeColorTokens()).toContain('warning');
    expect(allClasses).toEqual(expect.arrayContaining(['text-warning', 'bg-warning']));
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
