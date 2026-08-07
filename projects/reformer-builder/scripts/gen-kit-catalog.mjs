#!/usr/bin/env node
/**
 * Генератор каталога компонентов для кита, который его НЕ поставляет.
 *
 * Зачем: `@reformer/ui-kit` начал экспортировать `./catalog` только с 12.x. Для более ранних
 * мажоров (и для чужих дизайн-систем, собранных по конвенциям ReFormer) каталог приходится
 * выводить из того, что пакет отдаёт наружу. Реестр китов обязан уметь брать каталог out-of-band —
 * ровно поэтому дескриптор кита и реестр китов разведены (план §3.4).
 *
 * Источники, по убыванию надёжности:
 *   1. `<pkg>/meta` → `defaultPropSchemas` — «rich»-записи с настоящими props-схемами;
 *   2. `package.json#exports` → список компонентных subpath'ов — «minimal»-записи (в палитре есть,
 *      инспектор пуст);
 *   3. именованные экспорты каждого subpath'а → части compound'ов (`AlertTitle` → `Alert`).
 *
 * Всё, что не импортируется (тяжёлый компонент за неустановленным optional peer-dep), деградирует
 * до minimal-записи без частей, а не роняет генерацию.
 *
 * Использование:
 *   node scripts/gen-kit-catalog.mjs <pkg> <kitId> [--label <label>] [--out <file>]
 * Пример:
 *   node scripts/gen-kit-catalog.mjs @reformer/ui-kit-v11 reformer-ui-kit-11 \
 *     --label "ReFormer UI Kit 11" --out src/kits/generated/reformer-ui-kit-11.catalog.json
 */
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Найти package.json пакета. Через `require.resolve('<pkg>/package.json')` нельзя: ui-kit@11 такого
 * subpath'а в `exports` не объявляет (появился позже), и Node отвечает ERR_PACKAGE_PATH_NOT_EXPORTED.
 * Поэтому резолвим главный вход и поднимаемся вверх до манифеста с нужным `name`.
 */
async function findManifest(pkg) {
  let dir = dirname(fileURLToPath(await import.meta.resolve(pkg)));
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, 'package.json');
    try {
      await access(candidate);
      const manifest = JSON.parse(await readFile(candidate, 'utf8'));
      // У вложенных dist-манифестов имени нет — поднимаемся дальше.
      if (manifest.name) return { manifest, root: dir };
    } catch {
      /* поднимаемся выше */
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`не найден package.json пакета ${pkg}`);
}

/** Subpath'ы, которые не являются компонентами. */
const NON_COMPONENT_SUBPATHS = new Set(['.', './meta', './fields', './styles', './catalog']);

/**
 * Именованные экспорты, которые НЕ являются частями compound'а: варианты полей, инфраструктура
 * Radix и cva-хелперы. Совпадает по смыслу с PART_NAME_SKIP генератора самого ui-kit.
 */
const PART_SKIP = /(Variants|BaseField|Field|Provider|Portal|Overlay|Style|Context|Trigger$)/;

/** `date-picker` → `DatePicker`, `input-otp` → `InputOTP` (частный случай аббревиатур ниже). */
function pascalCase(dir) {
  const base = dir
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
  return base.replace(/Otp$/, 'OTP');
}

/** Роль записи: наличие seam `value` в `x-runtimeProps` означает form-control. */
function roleOf(schema) {
  const runtime = schema?.['x-runtimeProps'];
  return runtime != null && 'value' in runtime ? 'field' : 'container';
}

function parseArgs(argv) {
  const [pkg, kitId, ...rest] = argv;
  if (!pkg || !kitId) {
    console.error('Использование: gen-kit-catalog.mjs <pkg> <kitId> [--label L] [--out F]');
    process.exit(1);
  }
  const opts = { pkg, kitId, label: null, out: null };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--label') opts.label = rest[++i];
    else if (rest[i] === '--out') opts.out = rest[++i];
  }
  opts.label ??= kitId;
  opts.out ??= `src/kits/generated/${kitId}.catalog.json`;
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const { manifest } = await findManifest(opts.pkg);
  const exportsMap = manifest.exports ?? {};

  // ── Namespace главного barrel: по нему решаем, нужен ли записи `subpath`. ────────────────────
  let barrel = {};
  try {
    barrel = await import(opts.pkg);
  } catch (err) {
    console.warn(`! barrel ${opts.pkg} не импортируется: ${err.message.split('\n')[0]}`);
  }

  // ── Rich-схемы. ─────────────────────────────────────────────────────────────────────────────
  let defaultPropSchemas = {};
  let mergeFieldPropsSchema = (s) => s;
  try {
    const meta = await import(`${opts.pkg}/meta`);
    defaultPropSchemas = meta.defaultPropSchemas ?? {};
    if (typeof meta.mergeFieldPropsSchema === 'function') {
      mergeFieldPropsSchema = meta.mergeFieldPropsSchema;
    }
  } catch (err) {
    console.warn(`! ${opts.pkg}/meta недоступен: ${err.message.split('\n')[0]}`);
  }

  const componentSubpaths = Object.keys(exportsMap)
    .filter((k) => !NON_COMPONENT_SUBPATHS.has(k) && k.startsWith('./'))
    .map((k) => k.slice(2));

  const records = [];
  const seen = new Set();
  const skipped = [];

  /** Добавить запись, не допуская дублей по имени. */
  const push = (record) => {
    if (seen.has(record.name)) return;
    seen.add(record.name);
    records.push(record);
  };

  for (const dir of componentSubpaths) {
    const name = pascalCase(dir);
    const schema = defaultPropSchemas[name];
    const inBarrel = name in barrel || `${name}Field` in barrel;

    let namedExports = [];
    try {
      namedExports = Object.keys(await import(`${opts.pkg}/${dir}`));
    } catch (err) {
      // Тяжёлый компонент за неустановленным optional peer-dep — не повод падать.
      skipped.push(`${dir} (${err.message.split('\n')[0].slice(0, 60)})`);
    }

    const role = schema ? roleOf(schema) : 'container';
    push({
      name,
      role,
      propsSchema: schema
        ? role === 'field'
          ? mergeFieldPropsSchema(schema)
          : schema
        : { type: 'object', additionalProperties: true },
      // Отмечаем subpath только когда символа нет в barrel: тогда билдер сможет объяснить,
      // почему компонент не отрисовался, вместо общего «не резолвится».
      ...(inBarrel ? {} : { subpath: dir }),
    });

    // Части compound'а: экспорты, начинающиеся с имени корня.
    for (const exp of namedExports) {
      if (exp === name || !exp.startsWith(name) || PART_SKIP.test(exp)) continue;
      push({
        name: exp,
        role: 'container',
        propsSchema: { type: 'object', additionalProperties: true },
        compoundParent: name,
        ...(exp in barrel ? {} : { subpath: dir }),
      });
    }
  }

  // Варианты полей (`InputMask`, `InputPassword`…) живут в meta, но своего subpath не имеют.
  for (const [name, schema] of Object.entries(defaultPropSchemas)) {
    const role = roleOf(schema);
    push({
      name,
      role,
      propsSchema: role === 'field' ? mergeFieldPropsSchema(schema) : schema,
      ...(schema['x-variantGroup'] ? { variantGroup: schema['x-variantGroup'] } : {}),
      ...(schema['x-variant'] ? { variant: schema['x-variant'] } : {}),
    });
  }

  // ── Дескриптор кита. ────────────────────────────────────────────────────────────────────────
  const infra = {};
  if ('FormField' in barrel) infra.fieldWrapper = 'FormField';
  if ('AsyncBoundary' in barrel) infra.asyncBoundary = 'AsyncBoundary';
  if ('List' in barrel) infra.list = 'List';

  let wizard = null;
  if (componentSubpaths.includes('form-wizard')) {
    try {
      const ns = await import(`${opts.pkg}/form-wizard`);
      if ('FormWizard' in ns) wizard = { symbol: 'FormWizard', subpath: 'form-wizard' };
    } catch {
      /* адаптера визарда у этого кита нет — записи Wizard/Step деградируют в стаб */
    }
  }

  const catalog = {
    $schema: '../../catalog/component-catalog.schema.json',
    version: '2.0',
    kit: {
      id: opts.kitId,
      label: opts.label,
      package: manifest.name,
      version: manifest.version,
      ...(manifest.peerDependencies ? { peerRanges: manifest.peerDependencies } : {}),
      resolve: { fieldSuffix: 'Field' },
      ...(Object.keys(infra).length ? { infra } : {}),
      adapters: { wizard, step: null },
      styles: { mode: 'tokens' },
      codegen: { importSpecifier: manifest.name },
    },
    components: records.sort((a, b) => (a.name < b.name ? -1 : 1)),
  };

  const outPath = resolve(process.cwd(), opts.out);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(catalog, null, 2)}\n`);

  const rich = records.filter((r) => !r.propsSchema.additionalProperties).length;
  console.log(
    `${manifest.name}@${manifest.version} → ${opts.out}\n` +
      `  записей: ${records.length} (rich ${rich}, частей ${records.filter((r) => r.compoundParent).length})\n` +
      `  infra: ${JSON.stringify(infra)}  wizard: ${wizard ? wizard.symbol : 'нет'}`
  );
  if (skipped.length)
    console.log(
      `  не импортировались (${skipped.length}): ${skipped.slice(0, 5).join(', ')}${skipped.length > 5 ? ' …' : ''}`
    );
}

await main();
