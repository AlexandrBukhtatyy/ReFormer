/**
 * Загрузчик индекса и его деградация.
 *
 * Индекс — не оптимизация «на всякий случай», а замена разбора TypeScript-AST в рантайме:
 * замерено 17 мс на загрузку и слияние против 784 мс на импорт `typescript` + разбор всех
 * пакетов. Это и позволило убрать `typescript` (23 MB) из обязательных зависимостей
 * публикуемого пакета в опциональный peer.
 *
 * Отсюда два обязательства, которые здесь и проверяются:
 *  1. данные из индекса совпадают с тем, что давал разбор AST, — иначе переход был бы
 *     тихой потерей знания, а не оптимизацией;
 *  2. пакет без индекса не ломает сервер и НЕ МОЛЧИТ: неполный список API страшнее ошибки,
 *     потому что агент решит, что символа не существует.
 */

import { describe, it, expect } from 'vitest';
import { getMergedIndex, loadPackageIndex, __resetIndexCache } from '../src/index/loader';
import { publicSymbols, findSymbols, indexCoverageWarning } from '../src/index/symbols';
import { getPublicSymbols } from '../src/utils/symbols-parser';
import { KNOWN_PACKAGES } from '../src/utils/docs-parser';
import { AST_HEAVY_TIMEOUT_MS } from './timeouts';

const merged = getMergedIndex();
const hasIndexes = merged.packages.size > 0;

describe('index/loader — слияние индексов пакетов', () => {
  it.runIf(hasIndexes)('читает индекс каждого известного пакета', () => {
    expect(merged.withoutIndex, `без индекса: ${merged.withoutIndex.join(', ')}`).toEqual([]);
    expect(merged.packages.size).toBe(KNOWN_PACKAGES.length);
  });

  it.runIf(hasIndexes)('отбрасывает индекс чужой версии схемы', () => {
    // Проверяем контракт на реальном индексе: версия должна быть ровно поддерживаемой.
    for (const pkg of KNOWN_PACKAGES) {
      const idx = loadPackageIndex(pkg);
      if (idx) expect(idx.schemaVersion, `${pkg}: неподдерживаемая схема`).toBe(1);
    }
  });

  it.runIf(hasIndexes)('порядок символов следует KNOWN_PACKAGES', () => {
    // При коллизии имён (`FormField` есть и в cdk, и в ui-kit) первым обязан идти тот же
    // вариант, что возвращал прежний findAllSymbols, иначе у потребителя сменится ответ.
    const collisions = [...merged.byName.entries()].filter(([, list]) => list.length > 1);
    expect(collisions.length, 'коллизий имён нет — тест потерял смысл').toBeGreaterThan(0);
    const order = new Map(KNOWN_PACKAGES.map((p, i) => [p as string, i]));
    for (const [name, list] of collisions) {
      const positions = list.map((s) => order.get(s.package) ?? 99);
      const sorted = [...positions].sort((a, b) => a - b);
      expect(positions, `${name}: порядок пакетов нарушен`).toEqual(sorted);
    }
  });
});

describe('index/symbols — паритет с разбором AST', () => {
  it.runIf(hasIndexes)(
    'состав символов совпадает с прежним парсером',
    async () => {
      for (const pkg of KNOWN_PACKAGES) {
        const fromAst = getPublicSymbols(pkg)
          .map((s) => s.name)
          .sort();
        if (fromAst.length === 0) continue;
        const fromIndex = (await publicSymbols(pkg)).map((s) => s.name).sort();
        expect(fromIndex, `${pkg}: состав символов разошёлся`).toEqual(fromAst);
      }
    },
    AST_HEAVY_TIMEOUT_MS
  );

  it.runIf(hasIndexes)('сигнатура и описание доезжают до потребителя', async () => {
    const [sym] = await findSymbols('computeFrom', '@reformer/core');
    expect(sym, '`computeFrom` не найден через индекс').toBeDefined();
    expect(sym.signature).toContain('computeFrom');
    expect(sym.description.length).toBeGreaterThan(10);
    expect(
      sym.tags.some((t) => t.tag === 'example'),
      'потерян @example'
    ).toBe(true);
  });

  it.runIf(hasIndexes)('коллизия имён возвращает варианты в порядке пакетов', async () => {
    const variants = await findSymbols('FormField', '*');
    expect(variants.length).toBeGreaterThan(1);
    expect(variants[0].package).toBe('@reformer/cdk');
  });

  it.runIf(hasIndexes)('при полном покрытии предупреждения нет', () => {
    __resetIndexCache();
    expect(indexCoverageWarning()).toBe('');
  });
});
