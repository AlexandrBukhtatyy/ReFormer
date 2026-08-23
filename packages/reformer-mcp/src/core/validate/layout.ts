/**
 * Проверка раскладки файлов модуля формы — `validate_form kind="layout"`.
 *
 * Зачем это в валидаторе, а не только в документации. Расследование
 * (`docs/plans/mcp-layout-authority.md`) показало: правило именования файлов доезжало до
 * консумента ровно одним каналом — чтением ресурса `reformer://guide` целиком. Прогон,
 * работавший точечными запросами, получил 5 совпадений с каноном из 10; прогон, прочитавший
 * guide первым действием, — 8 из 9. Доставка требует, чтобы агент СПРОСИЛ; проверка
 * срабатывает всегда — и оба прогона звали `validate_form` сами, по 3-4 раза, в конце работы.
 *
 * Поэтому диагностика построена не вокруг факта нарушения, а вокруг ПЕРЕИМЕНОВАНИЯ: агент
 * чинит раскладку одним движением, если ему назвали ожидаемое имя. Промахи, которые дал замер
 * (`schema.ts`, `json-schema.ts`, `behavior.ts`, `render-behavior.ts`, `initial-values.ts`,
 * `dictionaries.ts`, `wizard.tsx`), разбираются по смыслу, а не отвергаются как «неизвестный файл».
 *
 * Источник истины о каноне — `FORM_LAYOUT_CANON` из генератора: одна таблица на весь сервер,
 * чтобы валидатор, манифест `generate_form` и документация не разошлись снова.
 */

import { FORM_LAYOUT_CANON, type LayoutFileSpec } from '../generate/builders.js';
import type { ReformerTargetStack } from '../generate/form-intent.js';
import type { Diagnostic } from './codes.js';

export type LayoutTarget = ReformerTargetStack;

export interface LayoutCheckResult {
  diagnostics: Diagnostic[];
  limitations: string[];
}

/** Что проверка заведомо не видит — печатается всегда, в том числе при чистом отчёте. */
export const LAYOUT_LIMITATIONS = [
  'Сверяются только имена и состав файлов — содержимое не читается: файл с каноничным именем может оказаться пустым или держать чужой концерн.',
  'Тесты, stories и стили (`*.test.*`, `*.spec.*`, `*.stories.*`, `*.css`/`*.scss`) в набор не входят и не учитываются.',
  'Проверяется плоский minimalist-канон (§1). Раскладка `folders` для крупных форм (§3) этой проверкой не покрыта.',
  'App-level инфраструктура renderer-json (`src/renderer-json/`: базовый registry + мета-схема DSL) живёт вне модуля формы и в `files` не ожидается.',
];

// ---------------------------------------------------------------------------
// Разбор имён
// ---------------------------------------------------------------------------

/** Файлы, которые в набор не входят и нарушением не считаются. */
const IGNORED_DIR_RE = /(^|\/)(__tests__|__snapshots__|node_modules)\//i;
const IGNORED_FILE_RE = /\.(test|spec|stories)\.[cm]?[jt]sx?$|\.(css|scss|less|snap|map)$/i;

function stemOf(base: string): string {
  const i = base.lastIndexOf('.');
  return i <= 0 ? base : base.slice(0, i);
}

function extOf(base: string): string {
  const i = base.lastIndexOf('.');
  return i <= 0 ? '' : base.slice(i + 1).toLowerCase();
}

function baseOf(path: string): string {
  const p = path.replace(/\\/g, '/');
  return p.slice(p.lastIndexOf('/') + 1);
}

/**
 * Ключ сравнения имён: регистр и разделители съедаются.
 *
 * Это ровно то, что склеивает промахи замера между собой: `render-behavior`, `render.behavior`
 * и `renderBehavior` — одно намерение и один ответ, а `renderer.behavior` (канон) остаётся
 * отдельным ключом.
 */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Пути → относительные пути внутри модуля: слеши, `./`, общий ведущий каталог. */
function normalizePaths(files: readonly string[]): string[] {
  const cleaned = files
    .map((f) => String(f).replace(/\\/g, '/').trim())
    .map((f) => f.replace(/^\.\//, '').replace(/\/+$/, ''))
    .filter(Boolean);

  // Общий ведущий каталог — это каталог самого модуля, а не вложенность: снимаем его, иначе
  // `mcp-layout-check-json/api.ts` прочитается как нарушение плоской раскладки.
  let cur = [...new Set(cleaned)];
  for (;;) {
    const firsts = cur.map((p) => (p.includes('/') ? p.slice(0, p.indexOf('/')) : null));
    const head = firsts[0];
    if (head === null || head === undefined || !firsts.every((f) => f === head)) return cur;
    cur = cur.map((p) => p.slice(head.length + 1));
  }
}

// ---------------------------------------------------------------------------
// Концерны
// ---------------------------------------------------------------------------

/**
 * Концерн — роль файла, не зависящая от таргета. Имя файла у роли меняется
 * (`form.schema.ts` ↔ `renderer.schema.ts`), сама роль — нет.
 */
function concernOf(canonPath: string): string {
  const stem = stemOf(canonPath);
  if (stem === 'form.schema' || stem === 'renderer.schema') return 'schema';
  if (stem === 'form.behavior') return 'form-behavior';
  if (stem === 'renderer.behavior') return 'renderer-behavior';
  if (stem === 'renderer.wizard') return 'wizard';
  return stem;
}

const CONCERN_TITLE: Record<string, string> = {
  index: 'точка входа',
  types: 'типы и константы',
  model: 'модель и начальные значения',
  schema: 'схема разметки',
  'form-behavior': 'поведение модели',
  'renderer-behavior': 'поведение разметки',
  validation: 'валидация',
  'data-sources': 'справочники и загрузчики',
  api: 'загрузка и submit',
  registry: 'реестр компонентов',
  wizard: 'шим wizard-а',
};

/**
 * Неканоничные имена → концерн.
 *
 * Список не выдуман: сюда сведены имена, которые реально дали замеренные прогоны, плюс их
 * ближайшие синонимы. Ключи — в нормализованном виде (`norm`), поэтому одна строка покрывает
 * и `render-behavior`, и `render.behavior`, и `renderBehavior`.
 */
const ALIASES: Record<string, string> = {
  // точка входа
  entry: 'index',
  main: 'index',
  form: 'index',
  formindex: 'index',
  // типы
  constants: 'types',
  consts: 'types',
  enums: 'types',
  typings: 'types',
  // модель
  initialvalues: 'model',
  initialvalue: 'model',
  initial: 'model',
  defaults: 'model',
  defaultvalues: 'model',
  formmodel: 'model',
  state: 'model',
  // схема
  schema: 'schema',
  jsonschema: 'schema',
  renderschema: 'schema',
  formschema: 'schema',
  rendererschema: 'schema',
  layout: 'schema',
  layoutschema: 'schema',
  uischema: 'schema',
  // поведение модели
  behavior: 'form-behavior',
  behaviour: 'form-behavior',
  behaviors: 'form-behavior',
  behaviours: 'form-behavior',
  formbehavior: 'form-behavior',
  formbehaviour: 'form-behavior',
  modelbehavior: 'form-behavior',
  // поведение разметки
  renderbehavior: 'renderer-behavior',
  renderbehaviour: 'renderer-behavior',
  rendererbehavior: 'renderer-behavior',
  rendererbehaviour: 'renderer-behavior',
  viewbehavior: 'renderer-behavior',
  uibehavior: 'renderer-behavior',
  // валидация
  validators: 'validation',
  validations: 'validation',
  validationschema: 'validation',
  rules: 'validation',
  // справочники
  datasource: 'data-sources',
  datasources: 'data-sources',
  dictionaries: 'data-sources',
  dictionary: 'data-sources',
  options: 'data-sources',
  catalogs: 'data-sources',
  lookups: 'data-sources',
  references: 'data-sources',
  // api
  submit: 'api',
  service: 'api',
  services: 'api',
  client: 'api',
  requests: 'api',
  backend: 'api',
  // реестр
  registry: 'registry',
  componentregistry: 'registry',
  componentsregistry: 'registry',
  renderregistry: 'registry',
  rendererregistry: 'registry',
  // шим wizard-а
  wizard: 'wizard',
  jsonwizard: 'wizard',
  formwizard: 'wizard',
  wizardshim: 'wizard',
  rendererwizard: 'wizard',
  rendererformwizard: 'wizard',
};

/** Куда сворачивать файл, роли которого в этом таргете не существует. */
function foldHint(concern: string, target: LayoutTarget): string {
  switch (concern) {
    case 'renderer-behavior':
      return 'У `core` слоя рендера нет: поведение модели идёт в `form.behavior.ts`, всё остальное — в `index.tsx`.';
    case 'registry':
      return 'Реестр `$component(...)` нужен только `renderer-json`; здесь компоненты подставляются в схему напрямую.';
    case 'wizard':
      return 'Шим нужен только `renderer-json` (библиотека `RendererFormWizard` не экспортирует); в этом таргете wizard собирается прямо в `index.tsx`.';
    default:
      return `Роли «${CONCERN_TITLE[concern] ?? concern}» в наборе target=${target} нет — сверните файл в один из канонических.`;
  }
}

/** Куда сворачивать файл, роли которого канон вообще не знает. */
function extraHint(base: string): string {
  const n = norm(stemOf(base));
  const ext = extOf(base);
  if (ext === 'md' || ext === 'mdx' || n === 'readme') {
    return 'Документация в набор модуля не входит — держите её вне каталога формы.';
  }
  if (n.startsWith('step') || n === 'sections') {
    return 'Все шаги wizard-а — инлайном в `index.tsx`; отдельных файлов шагов канон не предусматривает.';
  }
  if (['utils', 'util', 'helpers', 'helper', 'lib', 'common', 'shared'].includes(n)) {
    return 'Вспомогательные функции держите рядом с единственным потребителем — в `index.tsx` или в `validation.ts`.';
  }
  if (n === 'hooks' || n.startsWith('use')) {
    return 'Локальные хуки живут в `index.tsx` рядом с формой.';
  }
  return (
    'Канон плоский и закрытый: сверните содержимое в один из файлов набора либо вынесите за пределы ' +
    'модуля формы (общая инфраструктура renderer-json — в `src/renderer-json/`).'
  );
}

/** Оговорка про чистый JSON: она стоит отдельного предупреждения, а не сноски в доках. */
const JSON_SCHEMA_NOTE =
  'чистый JSON теряет compile-time проверку путей `$model(...)` — опечатку в пути не поймает ни `tsc`, ни мета-схема';

// ---------------------------------------------------------------------------
// Таргет
// ---------------------------------------------------------------------------

const TARGET_ALIASES: Record<string, LayoutTarget> = {
  core: 'core',
  reformercore: 'core',
  rendererreact: 'renderer-react',
  react: 'renderer-react',
  reformerrendererreact: 'renderer-react',
  rendererjson: 'renderer-json',
  json: 'renderer-json',
  reformerrendererjson: 'renderer-json',
};

/** Значение аргумента → таргет. `null`, если значение не распознано. */
export function resolveLayoutTarget(value: unknown): LayoutTarget | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  return TARGET_ALIASES[norm(raw)] ?? null;
}

/**
 * Догадка о таргете по составу файлов — на случай вызова без `target`.
 *
 * Отказать было бы формально честнее, но бесполезно: агент приходит сюда уже с написанными
 * файлами. Догадка всегда проговаривается в отчёте вслух, чтобы её можно было опровергнуть.
 */
export function inferLayoutTarget(files: readonly string[]): LayoutTarget | null {
  const stems = normalizePaths(files).map((p) => norm(stemOf(baseOf(p))));
  const has = (...keys: string[]) => keys.some((k) => stems.includes(k));
  if (has('registry', 'componentregistry', 'rendererwizard', 'jsonwizard', 'jsonschema')) {
    return 'renderer-json';
  }
  if (has('rendererschema', 'rendererbehavior', 'renderbehavior', 'renderschema')) {
    return 'renderer-react';
  }
  if (has('formschema')) return 'core';
  return null;
}

// ---------------------------------------------------------------------------
// Проверка
// ---------------------------------------------------------------------------

function acceptedExts(spec: LayoutFileSpec): string[] {
  return [...new Set([spec.path, ...(spec.variants ?? [])].map((p) => extOf(p)))];
}

function canonicalNames(spec: LayoutFileSpec): string {
  const variants = spec.variants ?? [];
  return variants.length === 0
    ? `\`${spec.path}\``
    : `\`${spec.path}\` (или ${variants.map((v) => `\`${v}\``).join(', ')})`;
}

/**
 * Сверить список файлов модуля с каноном таргета.
 *
 * Severity: имя вне канона у ОБЯЗАТЕЛЬНОГО концерна — ошибка (чинится переименованием), у
 * опционального (`renderer.wizard.tsx`) — предупреждение; отсутствие обязательного файла —
 * ошибка; файл сверх набора — предупреждение с указанием, куда его свернуть.
 */
export function validateLayout(files: readonly string[], target: LayoutTarget): LayoutCheckResult {
  const canon = FORM_LAYOUT_CANON[target];
  const diagnostics: Diagnostic[] = [];

  const specByConcern = new Map<string, LayoutFileSpec>();
  const specByStem = new Map<string, LayoutFileSpec>();
  for (const spec of canon) {
    specByConcern.set(concernOf(spec.path), spec);
    for (const p of [spec.path, ...(spec.variants ?? [])]) specByStem.set(norm(stemOf(p)), spec);
  }

  /** Роль покрыта — в том числе файлом с неверным именем: про такой уже сказано отдельно. */
  const covered = new Set<string>();
  /** Каноничные попадания по ролям — чтобы поймать дубли и подсказать «слейте». */
  const canonicalHits = new Map<string, string[]>();

  for (const rel of normalizePaths(files)) {
    if (IGNORED_DIR_RE.test(rel)) continue;
    const base = baseOf(rel);
    if (IGNORED_FILE_RE.test(base)) continue;

    const nested = rel.includes('/');
    const nestedNote = nested
      ? 'Раскладка плоская — без `lib/` / `schema/` / `components/steps/`. '
      : '';
    const ext = extOf(base);
    const key = norm(stemOf(base));

    const canonSpec = specByStem.get(key);
    if (canonSpec) {
      const concern = concernOf(canonSpec.path);
      covered.add(concern);

      if (!acceptedExts(canonSpec).includes(ext)) {
        // Стем каноничный, расширение — нет: имя уже правильное, чинится одним символом.
        diagnostics.push({
          code: 'RF011',
          severity: 'warning',
          message: `расширение вне канона — этот файл называется ${canonicalNames(canonSpec)}.`,
          path: rel,
          suggestion: `Переименуйте \`${base}\` → \`${canonSpec.path}\` (${canonSpec.role}).`,
        });
        continue;
      }

      if (nested) {
        diagnostics.push({
          code: 'RF011',
          severity: 'error',
          message: 'имя каноничное, но файл лежит во вложенном каталоге.',
          path: rel,
          suggestion: `${nestedNote}Перенесите в \`${base}\` в корне модуля формы.`,
        });
        continue;
      }

      canonicalHits.set(concern, [...(canonicalHits.get(concern) ?? []), base]);

      if (concern === 'schema' && ext === 'json') {
        diagnostics.push({
          code: 'RF011',
          severity: 'warning',
          message: `допустимый вариант, но ${JSON_SCHEMA_NOTE}.`,
          path: rel,
          suggestion:
            'Дефолт канона — `renderer.schema.ts` с `defineJsonSchema<T>`; `.json` оставляйте осознанно.',
        });
      }
      continue;
    }

    const concern = ALIASES[key];
    const spec = concern ? specByConcern.get(concern) : undefined;

    if (concern && spec) {
      covered.add(concern);
      const already = canonicalHits.get(concern)?.[0];
      diagnostics.push({
        code: 'RF011',
        severity: spec.optional ? 'warning' : 'error',
        message:
          `имя вне канона: роль «${CONCERN_TITLE[concern] ?? concern}» ` +
          `в target=${target} называется ${canonicalNames(spec)}.`,
        path: rel,
        suggestion: already
          ? `${nestedNote}\`${already}\` уже есть — слейте содержимое \`${base}\` в него и удалите файл.`
          : `${nestedNote}Переименуйте \`${base}\` → \`${spec.path}\` (${spec.role}).`,
      });
      continue;
    }

    if (concern) {
      diagnostics.push({
        code: 'RF013',
        severity: 'warning',
        message: `файл сверх набора: роли «${CONCERN_TITLE[concern] ?? concern}» в раскладке target=${target} нет.`,
        path: rel,
        suggestion: nestedNote + foldHint(concern, target),
      });
      continue;
    }

    diagnostics.push({
      code: 'RF013',
      severity: 'warning',
      message: `файл сверх канонического набора target=${target}.`,
      path: rel,
      suggestion: nestedNote + extraHint(base),
    });
  }

  for (const [concern, hits] of canonicalHits) {
    if (hits.length > 1) {
      const spec = specByConcern.get(concern);
      diagnostics.push({
        code: 'RF013',
        severity: 'warning',
        message: `${hits.map((h) => `\`${h}\``).join(' и ')} — два файла на одну роль «${CONCERN_TITLE[concern] ?? concern}».`,
        suggestion: `Оставьте один: канон печатает \`${spec?.path ?? hits[0]}\`.`,
      });
    }
  }

  for (const spec of canon) {
    if (spec.optional) continue;
    const concern = concernOf(spec.path);
    if (covered.has(concern)) continue;
    diagnostics.push({
      code: 'RF012',
      severity: 'error',
      message: `Нет обязательного \`${spec.path}\` — ${spec.role}.`,
      suggestion:
        `Создайте \`${spec.path}\` в корне модуля формы. ` +
        'Если эта роль размазана по `index.tsx`, вынесите её отдельным файлом.',
    });
  }

  // Ссылка на полное правило нужна ровно один раз: повторённая у каждой диагностики, она
  // превращается в шум и перестаёт читаться как действие.
  const first = diagnostics.find((d) => d.severity === 'error') ?? diagnostics[0];
  if (first && !first.fix) {
    first.fix = { tool: 'find_recipe', arguments: { topic: 'directory-layout' } };
  }

  return { diagnostics, limitations: LAYOUT_LIMITATIONS };
}

/** Канон таргета списком — печатается в отчёте, чтобы правило доезжало вместе с претензией. */
export function renderLayoutCanon(target: LayoutTarget): string {
  const lines: string[] = [];
  lines.push(`## Канон раскладки — target=\`${target}\``);
  lines.push('');
  for (const spec of FORM_LAYOUT_CANON[target]) {
    lines.push(`- ${canonicalNames(spec)}${spec.optional ? ' — ОПЦИОНАЛЬНО:' : ' —'} ${spec.role}`);
  }
  lines.push('');
  lines.push(
    'Модуль плоский: без `lib/` / `schema/` / `components/steps/`, все шаги wizard-а инлайном в ' +
      '`index.tsx`. Точка-префикс только у слоевых концернов (`form.` — слой модели, `renderer.` — ' +
      'слой рендера), остальные файлы plain-named. Полное правило — `find_recipe directory-layout`.'
  );
  return lines.join('\n');
}
