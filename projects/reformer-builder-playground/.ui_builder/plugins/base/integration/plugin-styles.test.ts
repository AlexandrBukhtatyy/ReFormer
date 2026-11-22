/**
 * Стили плагинов домена base: недостающие утилиты Tailwind плагин везёт сам.
 *
 * Пока плагины жили в билдере, его Tailwind сканировал их исходники. Уехав, они из-под сканера
 * вышли, и класс без правила молчит: вёрстка не падает, а теряет отступ или цвет. Проверка
 * называет плагин, которому пора подключить генератор (`.shared/plugin-styles.mjs`), — а равно
 * и тот, чья таблица опустела.
 *
 * @module plugins/base/integration/plugin-styles.test
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { pluginStyles } from '../../.shared/plugin-styles.mjs';
import { pluginStylesReport } from '../../.shared/plugin-styles-report';

const DOMAIN = fileURLToPath(new URL('..', import.meta.url));

describe('стили плагинов домена', { timeout: 120_000 }, () => {
  it('плагин везёт таблицу стилей тогда и только тогда, когда выходит за CSS билдера', async () => {
    const report = await pluginStylesReport(DOMAIN);
    const named = (items: typeof report): string[] => items.map((item) => item.plugin);

    // Без этого пустой обход дал бы зелёный прогон на пустом множестве.
    expect(report.length).toBeGreaterThanOrEqual(3);

    expect(named(report.filter((item) => item.rules > 0 && !item.declared))).toEqual([]);
    expect(named(report.filter((item) => item.declared && !item.generated))).toEqual([]);
    // Пустая таблица — лишняя, если только сборка не дописывает в неё CSS сторонней
    // библиотеки: редактор кода своих правил Tailwind не везёт, а стили Monaco — везёт.
    expect(
      named(report.filter((item) => item.declared && item.rules === 0 && !item.codeCss))
    ).toEqual([]);
    expect(named(report.filter((item) => item.codeCss))).toEqual(['monaco-editor']);
    // CSS из кода без объявленной таблицы сборка не примет — но узнать об этом лучше здесь.
    expect(named(report.filter((item) => item.codeCss && !item.declared))).toEqual([]);
  });

  it('правила плагина Tailwind лежат слоем ниже утилит, палитра — после них', async () => {
    // Оболочка дописывает к селектору контейнер плагина, и типографика становится сильнее
    // утилиты, оставшейся у билдера: `max-w-none` перестаёт снимать ширину колонки. Слой ниже
    // утилит возвращает «утилита сильнее типографики» каскадом. Палитра подсветки стоит в том
    // же слое ПОСЛЕ типографики — иначе `color: inherit` у `pre code` стёр бы цвет блока.
    const plugin = join(DOMAIN, 'markdown-editor');
    const { css } = await pluginStyles(plugin, {
      plugins: ['@tailwindcss/typography'],
      includes: [join(plugin, 'src', 'highlight.css')],
    });

    const layers = [...css.matchAll(/^@layer (\w+) \{$/gm)].map((match) => ({
      name: match[1],
      at: match.index,
    }));
    const layerOf = (needle: string): string | undefined => {
      const at = css.indexOf(needle);
      expect(at, `в таблице нет «${needle}»`).toBeGreaterThanOrEqual(0);
      return layers.filter((layer) => layer.at < at).at(-1)?.name;
    };

    expect(layerOf('  .prose {')).toBe('components');
    expect(layerOf('  .dark\\:prose-invert {')).toBe('components');
    expect(layerOf('  .hljs {')).toBe('components');
    expect(css.indexOf('  .hljs {')).toBeGreaterThan(css.indexOf('  .prose {'));
    // Обычная утилита плагина остаётся утилитой.
    expect(layers.map((layer) => layer.name)).toContain('utilities');
  });

  it('постоянный блок со ссылкой на переменную темы Tailwind не принимается', async () => {
    // `--color-chart-2` билдер объявляет, только пока сам на неё ссылается; токен кита
    // `--chart-2` есть всегда. Ссылка на необъявленную переменную молчит: правило на месте,
    // цвет унаследован — так палитра подсветки кода потерялась при переезде плагина markdown.
    const dir = mkdtempSync(join(tmpdir(), 'plugin-styles-'));
    try {
      const fragile = join(dir, 'fragile.css');
      const stable = join(dir, 'stable.css');
      writeFileSync(fragile, '.mark {\n  color: var(--color-chart-2);\n}\n');
      writeFileSync(stable, '.mark {\n  color: var(--chart-2);\n}\n');
      const plugin = join(DOMAIN, 'markdown-editor');

      await expect(pluginStyles(plugin, { includes: [fragile] })).rejects.toThrow(
        /--color-chart-2 → var\(--chart-2\)/
      );
      const { css } = await pluginStyles(plugin, { includes: [stable] });
      expect(css).toContain('color: var(--chart-2);');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
