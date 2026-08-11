#!/usr/bin/env tsx
/**
 * Гейт: `component-catalog.json` не разошёлся с типами компонентов.
 *
 * Каталог — файл одновременно генерируемый и правимый руками: набор пропсов выводится из TS-типов
 * ({@link './introspect-props'}), а русские описания и секции инспектора живут прямо в нём и
 * переносятся генератором из прошлой версии. Отсюда два риска, которые и стережёт этот скрипт:
 *
 *  - **ошибка**: в каталоге есть проп, которого у компонента нет. Значит либо кто-то дописал проп
 *    руками (набор задаётся типами, а не рукой), либо проп удалили/переименовали, а каталог не
 *    перегенерировали. Именно так каталог и отставал: 377 пропсов при 1 651 реальном.
 *  - **предупреждение**: у пропа нет описания — он попадёт в инспектор безымянным, с дефолтной
 *    секцией `Behavior`.
 *
 * Пропсы ручного оверлея (`*.props.ts`, `PART_PROPS`) ошибкой не считаются: это HTML-атрибуты,
 * которые политика намеренно не разворачивает (`Input.placeholder`, `BreadcrumbLink.href`,
 * `AvatarImage.src`) — они существуют у компонента, просто не выводятся из типов по политике.
 *
 * Запуск: `npm run check:catalog` (после `npm run generate:catalog` расхождений быть не должно).
 *
 * @module reformer-ui-kit/scripts/check-catalog-drift
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { introspectProps } from './introspect-props';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

interface CatalogRecord {
  name: string;
  propsSchema?: {
    properties?: Record<string, { description?: string }>;
    'x-runtimeProps'?: object;
  };
}

const catalog: { components: CatalogRecord[] } = JSON.parse(
  readFileSync(join(pkgRoot, 'component-catalog.json'), 'utf8')
);
const introspected = introspectProps();
/** Запись каталога ↔ экспорт: имя записи (`Chart`) часто это `x-registryName`, а не имя экспорта. */
const byRegistryName = new Map<
  string,
  ReturnType<typeof introspectProps> extends Map<string, infer V> ? V : never
>();
for (const c of introspected.values()) {
  if (!c.registryName) continue;
  if (!byRegistryName.has(c.registryName) || c.name === c.registryName)
    byRegistryName.set(c.registryName, c);
}
const introFor = (name: string) => introspected.get(name) ?? byRegistryName.get(name);

const undocumented: string[] = [];
const orphanRecords: string[] = [];
let totalProps = 0;

for (const record of catalog.components) {
  const props = record.propsSchema?.properties ?? {};
  totalProps += Object.keys(props).length;
  const intro = introFor(record.name);
  // Записи без экспорта в ките: синтетические/агрегатные — не ошибка, но стоит знать.
  if (!intro && Object.keys(props).length > 0) orphanRecords.push(record.name);
  for (const [prop, schema] of Object.entries(props))
    if (!schema.description) undocumented.push(`${record.name}.${prop}`);
}

const exportsWithProps = [...introspected.values()].filter((c) => c.props.length > 0);
const inCatalog = new Set(catalog.components.map((c) => c.name));
const missingExports = exportsWithProps.filter((c) => !inCatalog.has(c.name));

console.log(
  `component-catalog.json: ${catalog.components.length} записей, ${totalProps} пропсов; ` +
    `экспортов кита с пропсами: ${exportsWithProps.length}, из них в каталоге: ${exportsWithProps.length - missingExports.length}`
);
if (undocumented.length)
  console.log(
    `⚠ без описания: ${undocumented.length}\n   ${undocumented.slice(0, 15).join('\n   ')}${undocumented.length > 15 ? '\n   …' : ''}`
  );
if (orphanRecords.length) console.log(`⚠ записи без экспорта в ките: ${orphanRecords.join(', ')}`);

if (missingExports.length) {
  console.error(
    `\n✗ у ${missingExports.length} экспортов кита есть пропсы, но записи в каталоге нет:\n` +
      missingExports.map((c) => `   ${c.name} (${c.props.length} пропсов, ${c.dir})`).join('\n') +
      `\n\nПерегенерируйте каталог: npm run generate:catalog`
  );
  process.exit(1);
}
