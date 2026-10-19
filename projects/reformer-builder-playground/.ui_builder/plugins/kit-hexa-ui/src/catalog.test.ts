import { fileURLToPath } from 'node:url';
import { checkKitCatalog, formatCatalogDiff } from '@reformer/builder-plugin-cli/catalog';
import { describe, expect, it } from 'vitest';

/** Каталог пакета кита — там `catalog.config.mjs` и `catalog.json`. */
const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url));

describe('каталог кита HexaUI', () => {
  // Каталог генерируется из типов входа кита (`npm run catalog`) и лежит в репозитории. Обновили
  // HexaUI или TypeScript, поменяли обёртку поля — и набор пропсов в типах ушёл от файла: тест
  // падает с диффом, каталог перегенерируют осознанно. Запас по времени: компилятор читает
  // объявления типов HexaUI — больше тысячи файлов.
  it('catalog.json совпадает с тем, что дают типы кита (catalog:check)', async () => {
    const result = await checkKitCatalog({ dir: PACKAGE_DIR });

    const problems = result.ok
      ? []
      : [
          ...result.findings.map((finding) => `${finding.code}: ${finding.message}`),
          ...formatCatalogDiff(result.diff),
        ];
    expect(problems).toEqual([]);
  }, 120_000);
});
