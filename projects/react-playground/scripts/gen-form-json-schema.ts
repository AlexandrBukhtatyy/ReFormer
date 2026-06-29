/**
 * gen-form-json-schema — генератор IDE-схемы + валидатор JSON-формы кредитной заявки.
 *
 * Делает две вещи (запуск: `npx tsx scripts/gen-form-json-schema.ts` из react-playground):
 *  1. Из реестра (`createCreditApplicationRegistry`) строит КОНКРЕТНУЮ мета-схему
 *     (`buildFormSchemaMetaSchema` с enum имён компонентов) и пишет её в
 *     `…/complex-multy-step-form-renderer-json/form-schema.schema.json`. На неё ссылается
 *     `json-schema.json` через `"$schema"` → VSCode подсвечивает структуру/синтаксис/имена `$component`.
 *  2. Валидирует реальную `json-schema.json` через `validateFormSchema(..., { registry })`
 *     (структура + синтаксис операторов + имена `$component`/`$dataSource`). Невалидно → exit 1
 *     (годится как CI-гейт).
 *
 * Имена `$model`-путей не проверяются (динамичны). См. `@reformer/renderer-json/validate`.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFormSchemaMetaSchema, getComponentNames } from '@reformer/renderer-json';
import { validateFormSchema } from '@reformer/renderer-json/validate';
import { createCreditApplicationRegistry } from '../src/pages/examples/complex-multy-step-form-renderer-json/registry';

const here = dirname(fileURLToPath(import.meta.url));
const exampleDir = resolve(here, '../src/pages/examples/complex-multy-step-form-renderer-json');
const jsonSchemaPath = resolve(exampleDir, 'json-schema.json');
const outPath = resolve(exampleDir, 'form-schema.schema.json');

const registry = createCreditApplicationRegistry();
const componentNames = getComponentNames(registry);

// 1) Конкретная мета-схема для IDE (enum имён компонентов)
const concrete = buildFormSchemaMetaSchema({ componentNames });
writeFileSync(outPath, JSON.stringify(concrete, null, 2) + '\n', 'utf8');
console.log(
  `✓ form-schema.schema.json written (${componentNames.length} component names enumerated)`
);

// 2) Валидация реальной схемы (CI-гейт)
const raw = JSON.parse(readFileSync(jsonSchemaPath, 'utf8'));
const { valid, errors } = validateFormSchema(raw, { registry });
if (!valid) {
  console.error(`\n❌ json-schema.json is INVALID (${errors.length}):`);
  for (const e of errors) console.error(`   - ${e}`);
  process.exit(1);
}
console.log('✓ json-schema.json is valid against the form-DSL meta-schema');
