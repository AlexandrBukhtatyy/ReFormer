#!/usr/bin/env tsx
/**
 * Генерирует `component-catalog.json` — каталог ВСЕХ компонентов ui-kit по контракту билдера
 * (`component-catalog.schema.json`, живёт в reformer-builder). Клиент (ui-kit) поставляет валидный
 * JSON со списком компонентов; билдер грузит его в палитру/инспектор. Цель — «все компоненты
 * доступны в билдере»: в каталог попадает КАЖДЫЙ визуальный компонент из `src/components/*`.
 *
 * ## Откуда берётся НАБОР пропсов
 *
 * Из TS-типов компонентов ({@link introspectProps}), а не из ручных списков. Ручной список
 * неизбежно отстаёт: до перехода каталог описывал 377 пропсов при 1 647 реальных — медиана
 * 1 проп на запись, 91 часть compound'а несла только `className`. Теперь добавили проп в
 * компонент — он появился в каталоге на следующей сборке, и разойтись они не могут.
 *
 * Ручные `*.props.ts` остаются ОВЕРЛЕЕМ поверх типов: они несут HTML-атрибуты, которые политика
 * намеренно не разворачивает (`Input.placeholder`, `BreadcrumbLink.href`, `AvatarImage.src`),
 * сужения enum'ов (`Input.type` — 7 значений вместо 22 нативных) и выверенные формулировки.
 * Описания и секции инспектора живут в самом `component-catalog.json` и переносятся из его
 * предыдущей версии ({@link readCuratedDocs}) — отдельного файла с текстами нет.
 *
 * ## Четыре вида записей
 *  - **rich** — есть variant props.ts (`x-registryName`): оверлей мержится с типами. Каждый вариант =
 *    ОТДЕЛЬНЫЙ компонент. Field-роль (seam `x-runtimeProps.value`) мержится с враппером
 *    (`mergeFieldPropsSchema`) → label/required/… в инспекторе.
 *  - **minimal** — props.ts ещё нет; набор пропсов всё равно приходит из типов.
 *  - **part** — часть compound-компонента (`AlertTitle`, `CardHeader`, `TabsList`…): несёт
 *    `compoundParent` — имя корня, из которого она собирается. Без частей корень вроде `Alert`
 *    (grid `grid-cols-[0_1fr]`) собрать в билдере нечем: голый текст падает анонимным grid item
 *    в колонку нулевой ширины и рассыпается по словам. Отбор — {@link PART_NAME_SKIP}/{@link NO_PARTS_DIRS}.
 *  - **прочие экспорты** — всё остальное, что кит экспортирует: порталы, оверлеи, провайдеры,
 *    части оверлеев и меню, инфраструктурные каталоги. Записи несут `palette: false` — данные
 *    для документации/MCP/инспектора есть, а палитру билдера они не меняют.
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
import {
  introspectProps,
  type IntrospectedComponent,
  type IntrospectedProp,
} from './introspect-props';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const componentsDir = join(pkgRoot, 'src/components');
const outFile = join(pkgRoot, 'component-catalog.json');

/**
 * Не-палитровые каталоги: провайдеры/утилиты/структурные ReFormer-обёртки — не визуальные узлы формы.
 * array/form-* обрабатываются билдером синтетически; direction/seam/async-boundary — рантайм-инфра.
 *
 * ВАЖНО: это список «не узлы палитры», а НЕ «не описывать». Их пропсы каталог всё равно несёт —
 * записями с `palette: false` (у одного `AsyncBoundary` их 17). Раньше такие компоненты выпадали
 * из файла целиком, и отсутствие записи читалось как «пропсов нет».
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
  /** Имя символа в barrel, когда оно отличается от `name` записи (`Input` → `InputField`). */
  exportName?: string;
  variantGroup?: string;
  variant?: string;
  compoundParent?: string;
  /** `false` — запись существует ради полноты пропсов, но узлом палитры не является. */
  palette?: boolean;
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

// ── слияние: набор пропсов из типов + курированные метаданные + ручной оверлей ─
//
// Разделение ответственности:
//  - НАБОР пропсов даёт интроспекция типов ({@link introspectProps}) — он не может отстать от кода;
//  - ОПИСАНИЕ и секцию инспектора несёт предыдущая версия этого же файла (типы их не выражают),
//    поэтому отдельного файла с описаниями нет — тексты переносятся round-trip'ом;
//  - ручные `*.props.ts` остаются ОВЕРЛЕЕМ и кладутся последними: они несут HTML-атрибуты, которые
//    политика намеренно не разворачивает (`Input.placeholder`, `BreadcrumbLink.href`,
//    `AvatarImage.src`), сужения enum'ов (`Input.type` — 7 значений вместо 22 нативных) и
//    выверенные формулировки. Потеря оверлея была бы регрессией: схемы частей строгие
//    (`additionalProperties: false`), и уже написанные формы перестали бы валидироваться.

/** Курированные метаданные пропа: описание и секция инспектора. */
interface PropDocEntry {
  description?: string;
  'x-doc'?: { group?: string; type?: string; kind?: string };
}

/**
 * Курирование читается из ПРЕДЫДУЩЕЙ версии самого `component-catalog.json` — отдельного файла
 * с описаниями нет. Набор пропсов каждый раз выводится из типов заново, а русские тексты и секции
 * инспектора переносятся из старой записи в новую по имени пропа: проп исчез из кода — исчезло и
 * его описание, проп появился — приходит без описания (его допишут в этом же файле).
 *
 * Обратная сторона: файл одновременно генерируемый и правимый руками. Правки описаний переживают
 * перегенерацию, правки НАБОРА пропсов — нет, они будут затёрты типами. Это и есть требуемая
 * гарантия точности: состав пропсов руками не задаётся.
 */
function readCuratedDocs(): Map<string, PropDocEntry> {
  const curated = new Map<string, PropDocEntry>();
  if (!existsSync(outFile)) return curated;
  const previous = JSON.parse(readFileSync(outFile, 'utf8')) as {
    components?: Array<{ name: string; propsSchema?: PropsSchema }>;
  };
  for (const record of previous.components ?? [])
    for (const [prop, schema] of Object.entries(record.propsSchema?.properties ?? {}))
      if (schema.description || schema['x-doc'])
        curated.set(`${record.name}.${prop}`, {
          ...(typeof schema.description === 'string' ? { description: schema.description } : {}),
          ...(schema['x-doc'] ? { 'x-doc': schema['x-doc'] as PropDocEntry['x-doc'] } : {}),
        });
  return curated;
}

const curatedDocs = readCuratedDocs();

const introspected = introspectProps();
/**
 * Запись каталога ↔ экспорт: по `x-registryName` (`Select` → `SelectAsync`), иначе по имени.
 * Один файл может объявлять несколько компонентов (`calendar-base.tsx` — `Calendar` и
 * `CalendarDayButton`), и тогда `registryName` соседнего `props.ts` относится ко ВСЕМ его экспортам.
 * Приоритет — у экспорта, чьё имя совпадает с registry-именем, иначе побеждал бы последний
 * объявленный (`Calendar` получал пропсы кнопки дня).
 */
const byRegistryName = new Map<string, IntrospectedComponent>();
for (const c of introspected.values()) {
  if (!c.registryName) continue;
  const current = byRegistryName.get(c.registryName);
  if (!current || c.name === c.registryName) byRegistryName.set(c.registryName, c);
}

/**
 * Имя символа field-записи. Каталог обязан назвать его сам: контракт билдера не задаёт правила
 * «имя записи + суффикс», а под именем записи (`Input`) barrel отдаёт БАЗОВЫЙ компонент, не
 * подключённый к форме. Форму-контрол публикует `withFormControl` под `${name}Field` — проверяем,
 * что такой экспорт действительно есть, иначе запись молча указывала бы не на тот компонент.
 */
function fieldExportName(name: string): { exportName: string } {
  const alias = `${name}Field`;
  if (!introspected.has(alias))
    throw new Error(
      `field-запись '${name}': экспорта '${alias}' нет среди экспортов кита — каталог не может назвать символ.`
    );
  return { exportName: alias };
}

/** Отображаемый TS-тип для `x-doc.type`: для enum'а — сам union, иначе тип без `| undefined`. */
function displayType(p: IntrospectedProp): string {
  if (p.enum) return p.enum.map((v) => `'${v}'`).join(' | ');
  return p.tsType
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s !== 'undefined')
    .join(' | ');
}

/**
 * Один извлечённый проп → узел JSON Schema с `x-doc`.
 *
 * Структура (`type`/`enum`/`default`) — всегда из типов, она не переносится из прошлой версии:
 * иначе устаревший вручную поправленный enum пережил бы правку компонента. Переносятся только
 * `description` и секция/виджет `x-doc`, которых в типах нет.
 */
function propToSchema(p: IntrospectedProp, doc: PropDocEntry | undefined): PropsSchema {
  const description = doc?.description ?? p.description;
  // Без `jsonType` проп не выражается в JSON (функция, React-нода, сложный объект) — инспектор
  // покажет его серым полем, но каталог о нём всё-таки сообщает.
  const kind = doc?.['x-doc']?.kind ?? (p.jsonType ? undefined : 'readonly');
  return {
    ...(p.jsonType ? { type: p.jsonType } : {}),
    ...(p.enum ? { enum: p.enum } : {}),
    ...(p.default !== undefined ? { default: p.default } : {}),
    ...(description ? { description } : {}),
    'x-doc': {
      group: doc?.['x-doc']?.group ?? 'Behavior',
      type: displayType(p),
      ...(kind ? { kind } : {}),
    },
  } as PropsSchema;
}

/**
 * `properties` записи каталога: извлечённые пропсы, поверх — ручной оверлей.
 * Швы формы (`value`/`onChange`/…) в `properties` не попадают: их дом — `x-runtimeProps`,
 * и `input.props.test.ts` стережёт непересечение этих множеств.
 */
function buildProperties(
  intro: IntrospectedComponent | undefined,
  overlay: Record<string, PropsSchema>,
  runtimeNames: Set<string>
): Record<string, PropsSchema> {
  const out: Record<string, PropsSchema> = {};
  for (const p of intro?.props ?? []) {
    if (runtimeNames.has(p.name)) continue; // шов формы живёт в `x-runtimeProps`
    out[p.name] = propToSchema(p, curatedDocs.get(`${intro!.name}.${p.name}`));
  }
  for (const [key, schema] of Object.entries(overlay)) {
    if (runtimeNames.has(key)) continue;
    out[key] = key in out ? ({ ...out[key], ...schema } as PropsSchema) : schema;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

/** Маркер `x-inherits` — что компонент принимает сверх `properties` (HTML/ARIA/события). */
function inheritsOf(intro: IntrospectedComponent | undefined): object {
  return intro?.inherits ? { 'x-inherits': intro.inherits } : {};
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
    const overlay = role === 'field' ? mergeFieldPropsSchema(variant) : variant;
    const intro = byRegistryName.get(name) ?? introspected.get(name);
    const propsSchema: PropsSchema = {
      ...overlay,
      properties: buildProperties(
        intro,
        (overlay.properties ?? {}) as Record<string, PropsSchema>,
        new Set(Object.keys(overlay['x-runtimeProps'] ?? {}))
      ),
      ...inheritsOf(intro),
    };
    // variant-группа читается из СЫРОГО варианта: mergeFieldPropsSchema не копирует x-* в merged-схему.
    const variantGroup = variant['x-variantGroup'];
    const variantLabel = variant['x-variant'];
    return {
      name,
      role,
      ...(role === 'field' ? fieldExportName(name) : {}),
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
  .map((d) => {
    // `props.ts` нет — но типы компонента есть всегда, поэтому «minimal» больше не значит «пустой».
    const intro = introspected.get(pascalCase(d));
    return {
      name: pascalCase(d),
      role: 'container' as const,
      propsSchema: {
        ...MINIMAL_PROPS,
        properties: buildProperties(intro, {}, new Set()),
        ...inheritsOf(intro),
      },
    };
  })
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
      .map((name): Record => {
        const intro = introspected.get(name);
        const overlay = partPropsSchema(name) as PropsSchema;
        return {
          name,
          role: 'container',
          propsSchema: {
            ...overlay,
            properties: buildProperties(
              intro,
              (overlay.properties ?? {}) as Record<string, PropsSchema>,
              new Set()
            ),
            ...inheritsOf(intro),
          },
          compoundParent: parent,
        };
      });
  });

// ── остальные экспорты кита: всё, что не покрыли rich/minimal/part ────────────
// Раньше каталог описывал 168 записей из 392 экспортов: за бортом оставались части оверлеев и меню
// ({@link NO_PARTS_DIRS}) и каталоги-инфраструктура ({@link NON_PALETTE_DIRS}) — 227 экспортов и
// 962 пропса, то есть БОЛЬШЕ, чем каталог содержал. Отсутствие записи означало не «этих пропсов
// нет», а «мы про них не рассказали»: у `AsyncBoundary` 17 пропсов, у `ChartTooltipContent` — 37.
// Теперь описываются все; шума в палитре это не создаёт — части несут `compoundParent`, а такие
// записи по контракту предлагаются в контексте своего корня, а не в общем списке.
const covered = new Set([...rich, ...minimal, ...parts].map((r) => r.name));
const extra: Record[] = [...introspected.values()]
  // Экспорт без единого пропа не несёт информации. Все такие — field-алиасы `withFormControl`
  // (`InputField`, `SelectField`): HOC возвращает `Record<string, unknown>`, поэтому имена пропсов
  // в типе стёрты, а сама поверхность уже описана записью базового варианта (`Input`, `Select`).
  .filter((c) => !covered.has(c.name) && c.props.length > 0)
  .map((c) => {
    const root = pascalCase(c.dir);
    const isPart = c.name !== root && c.name.startsWith(root);
    return {
      name: c.name,
      role: 'container' as const,
      propsSchema: {
        type: 'object',
        additionalProperties: false,
        properties: buildProperties(c, {}, new Set()),
        ...inheritsOf(c),
      },
      ...(isPart && covered.has(root) ? { compoundParent: root } : {}),
      // Данные — да, узел палитры — нет. Эти записи заводятся ради полноты пропсов (документация,
      // MCP, инспектор), но палитру билдера они менять не должны: среди них порталы, оверлеи,
      // провайдеры и части form-control'ов (варианты выбора задаются пропом `options`, а не детьми),
      // а имя `FormArray` вдобавок занято синтетической array-записью самого билдера.
      // Решение «показывать ли запись» принадлежит консументу — здесь мы лишь не меняем его палитру.
      palette: false,
    };
  });

const components = [...rich, ...minimal, ...parts, ...extra].sort((a, b) =>
  a.name.localeCompare(b.name)
);
// $schema — ссылка на контракт билдера (владелец схемы) для валидации/подсказок в IDE.
// Относительный путь от расположения этого файла (packages/reformer-ui-kit/) до схемы.
const SCHEMA_REF = '../../projects/reformer-builder/src/lib/catalog/component-catalog.schema.json';
// Блок `kit` — то, что кит рассказывает о себе сам. Пока это только стили: словарь классов для
// автодополнения `className` в билдере (своего списка билдер НЕ держит) и дефолт «чем разрешено
// стилизовать» по роли — полю можно править расположение в форме, но не вид. Остальные поля
// дескриптора (id/infra/…) намеренно не пишем: билдер достраивает их своими дефолтами,
// и дублировать их здесь значило бы завести второй источник правды. Имя символа — исключение:
// это данные записи (`exportName`), а не дефолт билдера, и угадать его консумент не может.
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
const propCount = components.reduce(
  (n, r) => n + Object.keys((r.propsSchema as PropsSchema).properties ?? {}).length,
  0
);
console.log(
  `component-catalog.json: ${components.length} компонентов (rich: ${rich.length}, minimal: ${minimal.length}, ` +
    `частей compound: ${parts.length}, прочих экспортов: ${extra.length}), ${propCount} пропсов; ` +
    `словарь классов: ${CLASS_GROUPS.length} групп / ${classCount} классов, полям разрешено: ${FIELD_CLASS_GROUPS.join(', ')}`
);
