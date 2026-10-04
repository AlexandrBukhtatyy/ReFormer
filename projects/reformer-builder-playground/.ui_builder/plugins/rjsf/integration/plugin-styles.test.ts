/**
 * Стили плагинов домена RJSF: недостающие утилиты Tailwind плагин везёт сам.
 *
 * Таблицу везёт редактор; классы рендера целиком покрыты CSS билдера, и своей таблицы у него
 * нет. Это совпадение, а не обещание: первый же класс вне исходников билдера останется без
 * правила — и молча. Проверка ловит этот момент и называет плагин, которому пора подключить
 * генератор (`.shared/plugin-styles.mjs`, как у плагинов домена ReFormer), — а равно и тот,
 * чья таблица опустела.
 *
 * @module plugins/rjsf/integration/plugin-styles.test
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
    expect(report.length).toBeGreaterThanOrEqual(2);

    expect(named(report.filter((item) => item.rules > 0 && !item.declared))).toEqual([]);
    expect(named(report.filter((item) => item.declared && !item.generated))).toEqual([]);
    expect(named(report.filter((item) => item.declared && item.rules === 0))).toEqual([]);
  });
});
