#!/usr/bin/env tsx
/**
 * Генерирует `component-catalog.json` — каталог ВСЕХ компонентов ui-kit по контракту билдера
 * (`component-catalog.schema.json`, живёт в reformer-builder). Клиент (ui-kit) поставляет валидный
 * JSON со списком компонентов; билдер грузит его в палитру/инспектор. Цель — «все компоненты
 * доступны в билдере»: в каталог попадает КАЖДЫЙ визуальный компонент из `src/components/*`.
 *
 * Три уровня записей:
 *  - **rich** — есть variant props.ts (`x-registryName`): props-схема отражает реальные пропсы.
 *    Каждый вариант = ОТДЕЛЬНЫЙ компонент (разные registryName). Field-роль (seam
 *    `x-runtimeProps.value`) мержится с враппером (`mergeFieldPropsSchema`) → label/required/… в инспекторе.
 *  - **minimal** — props.ts ещё нет: запись `{ name: PascalCase(dir), role: 'container', propsSchema: {} }`,
 *    компонент виден в палитре, инспектор пуст. Добавление props.ts автоматически повышает до rich.
 *  - **part** — часть compound-компонента (`AlertTitle`, `CardHeader`, `TabsList`…): несёт
 *    `compoundParent` — имя корня, из которого она собирается. Без частей корень вроде `Alert`
 *    (grid `grid-cols-[0_1fr]`) собрать в билдере нечем: голый текст падает анонимным grid item
 *    в колонку нулевой ширины и рассыпается по словам. Отбор — {@link PART_NAME_SKIP}/{@link NO_PARTS_DIRS},
 *    props — {@link partPropsSchema}.
 *
 * Категорию и синтетические `$html`/array-записи добавляет билдер.
 *
 * Помимо компонентов файл несёт блок `kit.styles` со словарём классов ({@link CLASS_GROUPS}) —
 * из него билдер строит автодополнение `className`, своего списка у него нет.
 *
 * Запуск: `npm run generate:catalog` (в цепочке `generate:barrels` после `generate:meta`).
 *
 * @module reformer-ui-kit/scripts/generate-catalog
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import * as meta from '../src/meta';
import { mergeFieldPropsSchema, type PropsSchema } from '../src/fields/props-schema';
import { CLASS_GROUPS, FIELD_CLASS_GROUPS } from '../src/styles/class-catalog';

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
  'list',
  'sonner',
]);

/**
 * Каталоги, чьи части в палитру НЕ идут: оверлеи и меню. Их корень билдер и так рисует стабом
 * («предпросмотр ограничен», см. render-policy) — набор из десятков `*Portal`/`*Content`/`*Item`
 * дал бы шум без пользы. Части ЭТИХ компонентов добавим отдельной задачей, если понадобятся.
 */
const NO_PARTS_DIRS = new Set([
  'dialog',
  'alert-dialog',
  'sheet',
  'drawer',
  'dropdown-menu',
  'context-menu',
  'menubar',
  'navigation-menu',
  'command',
  'sidebar',
  'popover',
  'hover-card',
  'tooltip',
  'chart',
]);

/**
 * Суффиксы служебных экспортов, которые частями компонента НЕ являются: cva-функции (`alertVariants`),
 * field-обёртки (покрыты rich-записями), провайдеры/порталы/оверлеи (рантайм-инфра без своего визуала).
 */
const PART_NAME_SKIP = /(Variants|BaseField|Field|Provider|Portal|Overlay|Style)$/;

/**
 * Пропсы частей, без которых часть не работает (Radix-`value`, ссылки, источники картинок). Знание
 * о собственных компонентах принадлежит ui-kit, поэтому карта живёт здесь, а не в билдере. Остальные
 * части получают только `className` ({@link partPropsSchema}); полноценные `props.ts` — по мере надобности.
 */
const PART_PROPS: Record<string, Record<string, PropsSchema>> = {
  AccordionItem: { value: str('Значение секции — по нему Accordion её открывает.') },
  TabsTrigger: { value: str('Значение вкладки — связывает кнопку с TabsContent.') },
  TabsContent: { value: str('Значение вкладки, содержимое которой показывает панель.') },
  AvatarImage: { src: str('URL изображения.'), alt: str('Альтернативный текст.') },
  BreadcrumbLink: { href: str('URL ссылки.') },
  PaginationLink: {
    href: str('URL страницы.'),
    isActive: {
      type: 'boolean',
      description: 'Текущая страница (подсвечена).',
      'x-doc': { group: 'State', type: 'boolean', kind: 'boolean' },
    },
  },
  InputGroupAddon: {
    align: {
      type: 'string',
      enum: ['inline-start', 'inline-end', 'block-start', 'block-end'],
      default: 'inline-start',
      description: 'Сторона, с которой аддон прижат к контролу.',
      'x-doc': {
        group: 'Control',
        type: "'inline-start' | 'inline-end' | 'block-start' | 'block-end'",
        kind: 'enum',
      },
    },
  },
};

/** Строковый проп части с описанием (сахар для {@link PART_PROPS}). */
function str(description: string): PropsSchema {
  return { type: 'string', description, 'x-doc': { group: 'Control', type: 'string' } };
}

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
  compoundParent?: string;
};

/** Именованные value-экспорты `index.ts` (типы отбрасываются): `export { Alert, AlertTitle } from …`. */
function namedExports(indexFile: string): string[] {
  const src = readFileSync(indexFile, 'utf8');
  const out: string[] = [];
  const re = /export\s+(type\s+)?\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m[1]) continue; // export type { … }
    for (const raw of m[2].split(',')) {
      // `X as Y` → экспортируемое имя Y.
      const name = raw
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name && /^[A-Z]/.test(name)) out.push(name);
    }
  }
  return out;
}

/** Props-схема части: класс контейнера + критичные пропсы из {@link PART_PROPS}, если объявлены. */
function partPropsSchema(name: string): object {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      className: {
        type: 'string',
        description: 'CSS-класс части (Tailwind).',
        'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
      },
      ...(PART_PROPS[name] ?? {}),
    },
  };
}

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

// ── part: части compound-компонентов (AlertTitle, CardHeader, TabsList…) ─────
// Корень compound'а собирается ТОЛЬКО из своих частей: у Alert это grid `grid-cols-[0_1fr]`, куда
// голый текст падает в колонку нулевой ширины. Части берём из именованных экспортов `index.ts`
// каталога компонента — тот же источник, что и barrel, поэтому имя всегда резолвится в превью.
const rootRoleByName = new Map([...rich, ...minimal].map((r) => [r.name, r.role]));
const parts: Record[] = dirs
  .filter((d) => !NON_PALETTE_DIRS.has(d) && !NO_PARTS_DIRS.has(d))
  .flatMap((d) => {
    const indexFile = join(componentsDir, d, 'index.ts');
    if (!existsSync(indexFile)) return [];
    const parent = pascalCase(d);
    // Части form-control'ов (SelectItem, RadioGroupItem, NativeSelectOption…) в палитру не идут:
    // варианты выбора задаются пропом `options`/`$dataSource`, а не детьми узла.
    if (rootRoleByName.get(parent) === 'field') return [];
    return namedExports(indexFile)
      .filter((n) => n !== parent && n.startsWith(parent) && !PART_NAME_SKIP.test(n))
      .filter((n) => !seen.has(n) && !rootRoleByName.has(n))
      .map(
        (name): Record => ({
          name,
          role: 'container',
          propsSchema: partPropsSchema(name),
          compoundParent: parent,
        })
      );
  });

const components = [...rich, ...minimal, ...parts].sort((a, b) => a.name.localeCompare(b.name));
// $schema — ссылка на контракт билдера (владелец схемы) для валидации/подсказок в IDE.
// Относительный путь от расположения этого файла (packages/reformer-ui-kit/) до схемы.
const SCHEMA_REF = '../../projects/reformer-builder/src/catalog/component-catalog.schema.json';
// Блок `kit` — то, что кит рассказывает о себе сам. Пока это только стили: словарь классов для
// автодополнения `className` в билдере (своего списка билдер НЕ держит) и дефолт «чем разрешено
// стилизовать» по роли — полю можно править расположение в форме, но не вид. Остальные поля
// дескриптора (id/resolve/infra/…) намеренно не пишем: билдер достраивает их своими дефолтами,
// и дублировать их здесь значило бы завести второй источник правды.
const kit = {
  styles: {
    classNames: CLASS_GROUPS,
    classGroupsByRole: { field: FIELD_CLASS_GROUPS, container: '*', array: '*' },
  },
};
// Версия контракта, а не пакета: `2.0` = файл использует блок `kit` и per-record поля 2.0.
const catalog = { $schema: SCHEMA_REF, version: '2.0', kit, components };

const cfg = await resolveConfig(outFile);
const json = await format(JSON.stringify(catalog, null, 2), { ...cfg, parser: 'json' });
writeFileSync(outFile, json);

const classCount = CLASS_GROUPS.reduce((n, g) => n + g.classes.length, 0);
console.log(
  `component-catalog.json: ${components.length} компонентов (rich: ${rich.length}, minimal: ${minimal.length}, частей compound: ${parts.length}); ` +
    `словарь классов: ${CLASS_GROUPS.length} групп / ${classCount} классов, полям разрешено: ${FIELD_CLASS_GROUPS.join(', ')}`
);
