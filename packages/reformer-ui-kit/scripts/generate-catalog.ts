#!/usr/bin/env tsx
/**
 * Генерирует `component-catalog.json` — каталог ВСЕХ компонентов ui-kit по контракту билдера
 * (`component-catalog.schema.json`, живёт в reformer-builder). Клиент (ui-kit) поставляет валидный
 * JSON со списком компонентов; билдер грузит его в палитру/инспектор. Цель — «все компоненты
 * доступны в билдере»: в каталог попадает КАЖДЫЙ визуальный компонент из `src/components/*`.
 *
 * Два уровня записей:
 *  - **rich** — есть variant props.ts (`x-registryName`): props-схема отражает реальные пропсы.
 *    Каждый вариант = ОТДЕЛЬНЫЙ компонент (разные registryName). Field-роль (seam
 *    `x-runtimeProps.value`) мержится с враппером (`mergeFieldPropsSchema`) → label/required/… в инспекторе.
 *  - **minimal** — props.ts ещё нет: запись `{ name: PascalCase(dir), role: 'container', propsSchema: {} }`,
 *    компонент виден в палитре, инспектор пуст. Добавление props.ts автоматически повышает до rich.
 *
 * Категорию и синтетические `$html`/array-записи добавляет билдер.
 *
 * Запуск: `npm run generate:catalog` (в цепочке `generate:barrels` после `generate:meta`).
 *
 * @module reformer-ui-kit/scripts/generate-catalog
 */

import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import * as meta from '../src/meta';
import { mergeFieldPropsSchema, type PropsSchema } from '../src/fields/props-schema';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const componentsDir = join(pkgRoot, 'src/components');
const outFile = join(pkgRoot, 'component-catalog.json');

/**
 * Не-палитровые каталоги: провайдеры/утилиты/структурные ReFormer-обёртки — не визуальные узлы формы.
 * array/form-* обрабатываются билдером синтетически; direction/seam/async-boundary — рантайм-инфра.
 */
const NON_PALETTE_DIRS = new Set([
  'direction',
  'async-boundary',
  'example-card',
  'seam',
  'field',
  'form-field',
  'form-array',
  'form-wizard',
  'sonner',
]);

/** kebab-каталог → PascalCase имя компонента (fallback для minimal-записей без props.ts). */
function pascalCase(dir: string): string {
  return dir
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

/** Роль записи: наличие seam `x-runtimeProps.value` → form-control (field), иначе container. */
function roleOf(schema: PropsSchema): 'field' | 'container' {
  const runtime = schema['x-runtimeProps'];
  return runtime != null && 'value' in runtime ? 'field' : 'container';
}

/** Есть ли в каталоге компонента хоть один `*.props.ts` (рекурсивно по variants/**). */
function hasPropsFile(dir: string): boolean {
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const name of readdirSync(cur)) {
      const full = join(cur, name);
      if (statSync(full).isDirectory()) stack.push(full);
      else if (name.endsWith('.props.ts')) return true;
    }
  }
  return false;
}

type Record = {
  name: string;
  role: 'field' | 'container';
  propsSchema: object;
  variantGroup?: string;
  variant?: string;
};

// ── rich: variant-схемы из meta.ts (у кого есть props.ts) ────────────────────
const seen = new Set<string>();
const rich: Record[] = Object.values(meta)
  .filter(
    (v): v is PropsSchema =>
      Boolean(v) && typeof v === 'object' && 'x-registryName' in (v as object)
  )
  .map((variant) => {
    const name = variant['x-registryName'] as string;
    if (seen.has(name)) {
      throw new Error(
        `Коллизия x-registryName='${name}': два варианта делят имя — вариант должен быть отдельным компонентом с уникальным registryName.`
      );
    }
    seen.add(name);
    const role = roleOf(variant);
    const propsSchema = role === 'field' ? mergeFieldPropsSchema(variant) : variant;
    // variant-группа читается из СЫРОГО варианта: mergeFieldPropsSchema не копирует x-* в merged-схему.
    const variantGroup = variant['x-variantGroup'];
    const variantLabel = variant['x-variant'];
    return {
      name,
      role,
      propsSchema,
      ...(variantGroup ? { variantGroup } : {}),
      ...(variantLabel ? { variant: variantLabel } : {}),
    };
  });

// ── minimal: каталоги компонентов без props.ts (кроме не-палитровых) ─────────
const MINIMAL_PROPS = { type: 'object', additionalProperties: true } as const;
const dirs = readdirSync(componentsDir).filter((d) =>
  statSync(join(componentsDir, d)).isDirectory()
);
const minimal: Record[] = dirs
  .filter((d) => !NON_PALETTE_DIRS.has(d) && !hasPropsFile(join(componentsDir, d)))
  .map((d) => ({ name: pascalCase(d), role: 'container', propsSchema: { ...MINIMAL_PROPS } }))
  // registryName из rich имеет приоритет (например file-upload уже покрыт FileUpload/FileUploadAvatar)
  .filter((r) => !seen.has(r.name));

const components = [...rich, ...minimal].sort((a, b) => a.name.localeCompare(b.name));
const catalog = { version: '1.0', components };

const cfg = await resolveConfig(outFile);
const json = await format(JSON.stringify(catalog, null, 2), { ...cfg, parser: 'json' });
writeFileSync(outFile, json);

console.log(
  `component-catalog.json: ${components.length} компонентов (rich: ${rich.length}, minimal: ${minimal.length})`
);
