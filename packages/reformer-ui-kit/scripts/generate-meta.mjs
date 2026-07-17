#!/usr/bin/env node
/**
 * Генерирует src/meta.ts глобом src/components/*&#47;variants/**&#47;*.props.ts.
 *
 * meta — React-free: реэкспорт всех props-схем вариантов + карта `defaultPropSchemas`
 * (по `x-registryName`) для renderer-json DSL-валидации и MCP. Грузится в голом Node,
 * поэтому НЕ импортирует `.tsx` (props-схемы — чистые данные).
 */
import { readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const componentsDir = join(pkgRoot, 'src', 'components');

/** Рекурсивно собрать все *.props.ts под src/components/<cmp>/variants/. */
function findPropsFiles() {
  const out = [];
  if (!existsSync(componentsDir)) return out;
  for (const cmp of readdirSync(componentsDir, { withFileTypes: true })) {
    if (!cmp.isDirectory()) continue;
    const variantsDir = join(componentsDir, cmp.name, 'variants');
    if (!existsSync(variantsDir)) continue;
    walk(variantsDir, out);
  }
  return out.sort();
}

function walk(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.props.ts')) out.push(full);
  }
}

const files = findPropsFiles();

// Импортный путь относительно src/meta.ts, без расширения, с прямыми слэшами.
const importPath = (abs) =>
  './' + relative(join(pkgRoot, 'src'), abs).replace(/\\/g, '/').replace(/\.ts$/, '');

const lines = ['// СГЕНЕРИРОВАНО scripts/generate-meta.mjs — не редактировать вручную.'];
lines.push('// eslint-disable');
lines.push("import type { PropsSchema } from './fields/props-schema';");
lines.push(
  "export type { PropDoc, PropWidget, PropsSchema, RuntimePropDoc } from './fields/props-schema';"
);
lines.push("export { mergeFieldPropsSchema } from './fields/props-schema';");
files.forEach((f, i) => lines.push(`import * as m${i} from '${importPath(f)}';`));
lines.push('');
files.forEach((f) => lines.push(`export * from '${importPath(f)}';`));
lines.push('');
lines.push(
  `const modules: Array<Record<string, unknown>> = [${files.map((_, i) => `m${i}`).join(', ')}];`
);
lines.push('');
lines.push(
  '/** Карта регистр-имя → полная props-схема дефолтного варианта (для renderer-json/MCP). */'
);
lines.push('export const defaultPropSchemas: Record<string, PropsSchema> = Object.fromEntries(');
lines.push('  modules');
lines.push('    .flatMap((m) => Object.values(m) as PropsSchema[])');
lines.push(
  "    .filter((s): s is PropsSchema => Boolean(s) && typeof s === 'object' && 'x-registryName' in s)"
);
lines.push("    .map((s) => [s['x-registryName'] as string, s])");
lines.push(');');
lines.push('');

writeFileSync(join(pkgRoot, 'src', 'meta.ts'), lines.join('\n'));
console.log(`generate-meta: ${files.length} props-схем → src/meta.ts`);
