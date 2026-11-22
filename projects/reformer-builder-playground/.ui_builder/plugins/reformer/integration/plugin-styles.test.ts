/**
 * Стили плагинов домена ReFormer: недостающие утилиты Tailwind плагин везёт сам.
 *
 * Пока домен жил внутри билдера, его Tailwind сканировал исходники плагинов и собирал правила
 * для всех их классов. Плагином проекта домен из-под сканера вышел: класс, которого нет
 * в исходниках билдера, остаётся без правила — и молчит. Разность считает генератор
 * (`.shared/plugin-styles.mjs`), а здесь стережётся, что ей есть куда попасть.
 *
 * @module plugins/reformer/integration/plugin-styles.test
 */

import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { pluginStylesReport } from '../../.shared/plugin-styles-report';

const DOMAIN = fileURLToPath(new URL('..', import.meta.url));

describe('стили плагинов домена', { timeout: 120_000 }, () => {
  it('плагин везёт таблицу стилей тогда и только тогда, когда выходит за CSS билдера', async () => {
    const report = await pluginStylesReport(DOMAIN);
    const named = (items: typeof report): string[] => items.map((item) => item.plugin);

    // Без этого пустой обход дал бы зелёный прогон на пустом множестве.
    expect(report.length).toBeGreaterThanOrEqual(6);

    // Правила нужны, а манифест таблицу не объявляет — оболочка её не подключит.
    expect(named(report.filter((item) => item.rules > 0 && !item.declared))).toEqual([]);
    // Таблица объявлена, но перед сборкой не генерируется — сборка упадёт на отсутствии файла
    // или, хуже, возьмёт вчерашний.
    expect(named(report.filter((item) => item.declared && !item.generated))).toEqual([]);
    // Таблица объявлена, а везти нечего: пустой файл в каждой сборке и лишний скоуп в документе.
    expect(named(report.filter((item) => item.declared && item.rules === 0))).toEqual([]);
  });
});
