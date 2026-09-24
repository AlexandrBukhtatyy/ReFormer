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
 * `dictionaries.ts`, `json-wizard.tsx`), разбираются по смыслу, а не отвергаются как «неизвестный
 * файл».
 *
 * Источник истины о каноне — `FORM_LAYOUT_CANON` и `STEP_LAYOUT_CANON` из генератора: одна
 * таблица на весь сервер, чтобы валидатор, манифест `generate_form` и документация не разошлись
 * снова.
 */

import {
  FORM_LAYOUT_CANON,
  STEP_LAYOUT_CANON,
  STEPS_DIR,
  renderStepLayoutNote,
  type LayoutFileSpec,
} from '../generate/builders.js';
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
  'Проверяется плоский minimalist-канон (§1) вместе с раскладкой шагов `steps/<slug>/`. Раскладка `folders` для крупных форм (§3) этой проверкой не покрыта; что папки шагов совпадают со списком в `steps/index.ts`, не сверяется.',
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
 * и `renderBehavior` — одно намерение и один ответ, а `form.render` (канон) остаётся
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
  // `mcp-layout-check-json/api.ts` прочитается как нарушение плоской раскладки. Каталог шагов
  // не снимается никогда: набор из одних `steps/...` — это шаги, а не модуль в папке `steps`.
  let cur = [...new Set(cleaned)];
  for (;;) {
    const firsts = cur.map((p) => (p.includes('/') ? p.slice(0, p.indexOf('/')) : null));
    const head = firsts[0];
    if (head === null || head === undefined || head === STEPS_DIR) return cur;
    if (!firsts.every((f) => f === head)) return cur;
    cur = cur.map((p) => p.slice(head.length + 1));
  }
}

// ---------------------------------------------------------------------------
// Концерны
// ---------------------------------------------------------------------------

/**
 * Концерн — роль файла, не зависящая от таргета и от места (корень или папка шага). Имя файла
 * у роли менялось (`renderer.schema.ts` → `form.schema.ts`), сама роль — нет.
 */
function concernOf(canonPath: string): string {
  const stem = stemOf(baseOf(canonPath));
  if (canonPath === `${STEPS_DIR}/index.ts`) return 'steps-index';
  if (stem === 'form.schema' || stem === 'renderer.schema') return 'schema';
  if (stem === 'form.behavior') return 'form-behavior';
  if (stem === 'form.render' || stem === 'renderer.behavior') return 'render-behavior';
  if (stem === 'wizard' || stem === 'renderer.wizard') return 'wizard';
  if (stem === 'form.validation' || stem === 'validation') return 'validation';
  return stem;
}

const CONCERN_TITLE: Record<string, string> = {
  index: 'точка входа',
  types: 'типы и константы',
  model: 'модель и начальные значения',
  schema: 'схема разметки',
  'form-behavior': 'поведение модели',
  'render-behavior': 'поведение разметки',
  validation: 'валидация',
  'data-sources': 'справочники и загрузчики',
  api: 'загрузка и submit',
  registry: 'реестр компонентов',
  wizard: 'шим wizard-а',
  'steps-index': 'агрегатор шагов',
};

/**
 * Прежние канонические имена → концерн.
 *
 * До выравнивания канона слой рендера назывался `renderer.*` (`renderer.schema.ts`,
 * `renderer.behavior.ts`, `renderer.wizard.tsx`), а валидация — `validation.ts` без префикса. Формы с такими именами написаны по прежнему
 * правилу, а не с ошибкой, поэтому они всегда дают ПРЕДУПРЕЖДЕНИЕ «переименуйте», а не ошибку:
 * работающую форму ради имени ломать незачем. Проверяются ДО `ALIASES` — иначе прежний канон
 * читался бы как промах агента.
 */
const LEGACY_STEMS: Record<string, string> = {
  rendererschema: 'schema',
  rendererbehavior: 'render-behavior',
  rendererbehaviour: 'render-behavior',
  rendererwizard: 'wizard',
  // `validation.ts` был каноном без префикса, пока правило `form.<роль>` не распространили на
  // валидацию: написанные по нему формы рабочие, поэтому — тоже предупреждение, а не ошибка.
  validation: 'validation',
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
  render: 'render-behavior',
  formrender: 'render-behavior',
  formrenderer: 'render-behavior',
  renderbehavior: 'render-behavior',
  renderbehaviour: 'render-behavior',
  viewbehavior: 'render-behavior',
  uibehavior: 'render-behavior',
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
  rendererformwizard: 'wizard',
};

/** Куда сворачивать файл, роли которого в этом таргете не существует. */
function foldHint(concern: string, target: LayoutTarget): string {
  switch (concern) {
    case 'render-behavior':
      return 'У `core` слоя рендера нет: поведение модели идёт в `form.behavior.ts`, всё остальное — в `index.tsx`.';
    case 'registry':
      return 'Реестр `$component(...)` нужен только `renderer-json`; здесь компоненты подставляются в схему напрямую.';
    case 'wizard':
      return 'Шим нужен только `renderer-json` (библиотека `RendererFormWizard` не экспортирует); в этом таргете wizard собирается прямо в `index.tsx`.';
    default:
      return `Роли «${CONCERN_TITLE[concern] ?? concern}» в наборе target=${target} нет — сверните файл в один из канонических.`;
  }
}

/** Где держать шаги wizard-а — одна формулировка на все подсказки. */
const STEPS_HINT =
  'Шаги wizard-а — инлайном в `index.tsx` ИЛИ по папке на шаг `steps/<slug>/` ' +
  '(kebab-слаг заголовка без номера; внутри — `form.validation.ts`, `form.render.ts`, `form.schema.*`) ' +
  'с агрегатором `steps/index.ts`.';

/** Куда сворачивать файл, роли которого канон вообще не знает. */
function extraHint(base: string): string {
  const n = norm(stemOf(base));
  const ext = extOf(base);
  if (ext === 'md' || ext === 'mdx' || n === 'readme') {
    return 'Документация в набор модуля не входит — держите её вне каталога формы.';
  }
  if (n.startsWith('step') || n === 'sections') {
    return STEPS_HINT;
  }
  if (['utils', 'util', 'helpers', 'helper', 'lib', 'common', 'shared'].includes(n)) {
    return 'Вспомогательные функции держите рядом с единственным потребителем — в `index.tsx` или в `form.validation.ts`.';
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

/** Слаг папки шага: kebab-case, без ведущего номера (`01-dannye`, `1_contacts` — нет). */
const STEP_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NUMBERED_SLUG_RE = /^\d+[-_.]/;

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

/** Догадка о таргете: сам таргет, на чём она основана и уверенная ли она. */
export interface LayoutTargetGuess {
  target: LayoutTarget;
  /** Файл(ы), по которым принято решение, — одной фразой для отчёта. */
  basis: string;
  /**
   * `false` — различающих файлов в наборе нет, таргет выбран по умолчанию. После выравнивания
   * имён (`form.schema.*` у всех таргетов) по одной схеме таргет больше не определяется.
   */
  certain: boolean;
}

/**
 * Догадка о таргете по составу файлов — на случай вызова без `target`.
 *
 * Отказать было бы формально честнее, но бесполезно: агент приходит сюда уже с написанными
 * файлами. Догадка всегда проговаривается в отчёте вслух, чтобы её можно было опровергнуть.
 *
 * Различают таргеты только файлы, которых у других нет: `registry.ts`, `wizard.tsx`,
 * `form.schema.json` — у renderer-json; `form.render.ts` без реестра — у renderer-react.
 * Набор без них (есть только общие `form.schema.ts`, `form.behavior.ts`, …) принимается за
 * `core` с пометкой «наугад». `null` — в наборе нет ни одного файла модуля формы.
 */
export function inferLayoutTarget(files: readonly string[]): LayoutTargetGuess | null {
  const rootFiles = normalizePaths(files).filter((p) => !p.includes('/'));
  const bases = rootFiles.map((p) => baseOf(p));
  const keyed = bases.map((b) => ({ base: b, key: norm(stemOf(b)), ext: extOf(b) }));
  const find = (pred: (f: (typeof keyed)[number]) => boolean) => keyed.find(pred)?.base;

  const jsonMarker = find(
    (f) =>
      [
        'registry',
        'componentregistry',
        'wizard',
        'rendererwizard',
        'jsonwizard',
        'jsonschema',
      ].includes(f.key) ||
      ((f.key === 'formschema' || f.key === 'rendererschema') && f.ext === 'json')
  );
  if (jsonMarker) {
    return { target: 'renderer-json', basis: `есть \`${jsonMarker}\``, certain: true };
  }

  const renderMarker = find((f) =>
    ['formrender', 'rendererbehavior', 'renderbehavior', 'rendererschema', 'renderschema'].includes(
      f.key
    )
  );
  if (renderMarker) {
    return {
      target: 'renderer-react',
      basis: `есть \`${renderMarker}\` (слой рендера), а реестра \`registry.ts\` нет`,
      certain: true,
    };
  }

  const moduleFile = find((f) =>
    ['formschema', 'formbehavior', 'formvalidation', 'validation', 'model'].includes(f.key)
  );
  if (moduleFile) {
    return {
      target: 'core',
      basis:
        'различающих файлов (`registry.ts`, `wizard.tsx`, `form.render.ts`, `form.schema.json`) ' +
        'в наборе нет',
      certain: false,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Проверка
// ---------------------------------------------------------------------------

function acceptedExts(spec: LayoutFileSpec): string[] {
  return [...new Set([spec.path, ...(spec.variants ?? [])].map((p) => extOf(p)))];
}

function canonicalNames(spec: LayoutFileSpec, prefix = ''): string {
  const variants = spec.variants ?? [];
  return variants.length === 0
    ? `\`${prefix}${spec.path}\``
    : `\`${prefix}${spec.path}\` (или ${variants.map((v) => `\`${prefix}${v}\``).join(', ')})`;
}

/** Каноничное имя того же расширения, если оно допустимо: `renderer.schema.json` → `form.schema.json`. */
function renamedTo(spec: LayoutFileSpec, ext: string): string {
  return [spec.path, ...(spec.variants ?? [])].find((p) => extOf(p) === ext) ?? spec.path;
}

/** Таблицы канона таргета, разложенные по ключам поиска. */
interface CanonIndex {
  byConcern: Map<string, LayoutFileSpec>;
  byStem: Map<string, LayoutFileSpec>;
}

function indexCanon(specs: readonly LayoutFileSpec[]): CanonIndex {
  const byConcern = new Map<string, LayoutFileSpec>();
  const byStem = new Map<string, LayoutFileSpec>();
  for (const spec of specs) {
    byConcern.set(concernOf(spec.path), spec);
    for (const p of [spec.path, ...(spec.variants ?? [])]) byStem.set(norm(stemOf(p)), spec);
  }
  return { byConcern, byStem };
}

/**
 * Сверить список файлов модуля с каноном таргета.
 *
 * Severity: имя вне канона у ОБЯЗАТЕЛЬНОГО концерна — ошибка (чинится переименованием), у
 * опционального (`wizard.tsx`) — предупреждение; прежнее каноническое имя (`renderer.*`) —
 * всегда предупреждение; отсутствие обязательного файла — ошибка; файл сверх набора —
 * предупреждение с указанием, куда его свернуть. Вложенность допустима ровно одна —
 * `steps/index.ts` и `steps/<slug>/<файл шага>`; любая другая — ошибка.
 */
export function validateLayout(files: readonly string[], target: LayoutTarget): LayoutCheckResult {
  const canon = FORM_LAYOUT_CANON[target];
  const stepCanon = STEP_LAYOUT_CANON[target];
  const diagnostics: Diagnostic[] = [];

  const root = indexCanon(canon);
  const step = indexCanon(stepCanon.filter((s) => s.scope === 'step'));
  const stepsIndex = stepCanon.find((s) => s.scope !== 'step');

  /** Роль покрыта — в том числе файлом с неверным именем: про такой уже сказано отдельно. */
  const covered = new Set<string>();
  /** Каноничные попадания по ролям — чтобы поймать дубли и подсказать «слейте». */
  const canonicalHits = new Map<string, string[]>();
  let hasStepsIndex = false;
  let stepFiles = 0;
  const badSlugs = new Set<string>();

  const nestedError = (rel: string, suggestion: string) =>
    diagnostics.push({
      code: 'RF011',
      severity: 'error',
      message:
        'вложенный каталог вне канона: единственная допустимая вложенность — `steps/index.ts` и ' +
        '`steps/<slug>/<файл шага>`.',
      path: rel,
      suggestion,
    });

  for (const rel of normalizePaths(files)) {
    if (IGNORED_DIR_RE.test(rel)) continue;
    const base = baseOf(rel);
    if (IGNORED_FILE_RE.test(base)) continue;

    const ext = extOf(base);
    const key = norm(stemOf(base));
    const parts = rel.split('/');

    // --- steps/index.ts ------------------------------------------------------------------
    if (parts.length === 2 && parts[0] === STEPS_DIR && key === 'index' && stepsIndex) {
      hasStepsIndex = true;
      if (!acceptedExts(stepsIndex).includes(ext)) {
        diagnostics.push({
          code: 'RF011',
          severity: 'warning',
          message: `расширение вне канона — агрегатор шагов называется \`${stepsIndex.path}\`.`,
          path: rel,
          suggestion: `Переименуйте \`${rel}\` → \`${stepsIndex.path}\` (${stepsIndex.role}).`,
        });
      }
      continue;
    }

    // --- steps/<slug>/<файл шага> -----------------------------------------------------------
    if (parts.length === 3 && parts[0] === STEPS_DIR) {
      stepFiles += 1;
      const slug = parts[1];
      const at = `${STEPS_DIR}/${slug}/`;
      if ((!STEP_SLUG_RE.test(slug) || NUMBERED_SLUG_RE.test(slug)) && !badSlugs.has(slug)) {
        badSlugs.add(slug);
        diagnostics.push({
          code: 'RF011',
          severity: 'warning',
          message: `папка шага \`${slug}\` вне канона: имя папки — kebab-слаг заголовка шага без номера.`,
          path: at,
          suggestion:
            'Переименуйте папку в kebab-слаг заголовка (`Контактные данные` → `kontaktnye-dannye`); ' +
            'порядок шагов задаёт `steps/index.ts`, номер в имени папки не нужен.',
        });
      }

      const stepSpec = step.byStem.get(key);
      if (stepSpec) {
        if (!acceptedExts(stepSpec).includes(ext)) {
          diagnostics.push({
            code: 'RF011',
            severity: 'warning',
            message: `расширение вне канона — этот файл шага называется ${canonicalNames(stepSpec, at)}.`,
            path: rel,
            suggestion: `Переименуйте \`${base}\` → \`${stepSpec.path}\` (${stepSpec.role}).`,
          });
        }
        continue;
      }

      const legacy = LEGACY_STEMS[key];
      const legacySpec = legacy ? step.byConcern.get(legacy) : undefined;
      if (legacySpec) {
        diagnostics.push({
          code: 'RF011',
          severity: 'warning',
          message: `устаревшее имя: роль «${CONCERN_TITLE[legacy] ?? legacy}» теперь называется ${canonicalNames(legacySpec, at)}.`,
          path: rel,
          suggestion: `Переименуйте \`${base}\` → \`${renamedTo(legacySpec, ext)}\` (${legacySpec.role}).`,
        });
        continue;
      }

      // Корневое каноническое имя (`model.ts`, `api.ts`) в папке шага — тоже роль, а не
      // «неизвестный файл»: ответ «держите в корне» полезнее общей подсказки.
      const rootHit = root.byStem.get(key);
      const concern = legacy ?? ALIASES[key] ?? (rootHit ? concernOf(rootHit.path) : undefined);
      const aliasSpec = concern ? step.byConcern.get(concern) : undefined;
      diagnostics.push({
        code: 'RF011',
        severity: 'error',
        message: aliasSpec
          ? `имя вне канона: роль «${CONCERN_TITLE[concern!] ?? concern}» в папке шага называется ${canonicalNames(aliasSpec, at)}.`
          : `файл вне канона папки шага: в \`${at}\` target=${target} живут только ` +
            `${[...new Set(stepCanon.filter((s) => s.scope === 'step').map((s) => `\`${s.path}\``))].join(', ')}.`,
        path: rel,
        suggestion: aliasSpec
          ? `Переименуйте \`${base}\` → \`${aliasSpec.path}\` (${aliasSpec.role}).`
          : concern
            ? `Роль «${CONCERN_TITLE[concern] ?? concern}» — общая для формы: держите её в корне модуля. ` +
              (root.byConcern.get(concern)
                ? `Слейте содержимое в корневой \`${root.byConcern.get(concern)!.path}\`.`
                : foldHint(concern, target))
            : extraHint(base),
      });
      continue;
    }

    // --- любая другая вложенность -----------------------------------------------------------
    if (parts.length > 1) {
      const rootSpec = root.byStem.get(key);
      const concern = rootSpec ? concernOf(rootSpec.path) : (LEGACY_STEMS[key] ?? ALIASES[key]);
      const spec = rootSpec ?? (concern ? root.byConcern.get(concern) : undefined);
      if (concern && spec) covered.add(concern);
      const underSteps = parts.slice(0, -1).some((p) => /^steps?$/i.test(p));
      nestedError(
        rel,
        underSteps || key.startsWith('step')
          ? STEPS_HINT
          : spec
            ? `Раскладка плоская — без \`lib/\` / \`schema/\` / \`components/\`. Перенесите в \`${renamedTo(spec, ext)}\` в корне модуля формы.`
            : `Раскладка плоская — без \`lib/\` / \`schema/\` / \`components/\`. ${extraHint(base)}`
      );
      continue;
    }

    // --- корень модуля ----------------------------------------------------------------------
    const canonSpec = root.byStem.get(key);
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

      canonicalHits.set(concern, [...(canonicalHits.get(concern) ?? []), base]);

      if (concern === 'schema' && ext === 'json') {
        diagnostics.push({
          code: 'RF011',
          severity: 'warning',
          message: `допустимый вариант, но ${JSON_SCHEMA_NOTE}.`,
          path: rel,
          suggestion:
            'Дефолт канона — `form.schema.ts` с `defineJsonSchema<T>`; `.json` оставляйте осознанно.',
        });
      }
      continue;
    }

    const legacy = LEGACY_STEMS[key];
    if (legacy) {
      const spec = root.byConcern.get(legacy);
      if (spec) {
        covered.add(legacy);
        const renamed = renamedTo(spec, ext);
        diagnostics.push({
          code: 'RF011',
          severity: 'warning',
          message:
            `устаревшее имя: роль «${CONCERN_TITLE[legacy] ?? legacy}» теперь называется ` +
            `${canonicalNames(spec)} (правило имён \`form.<роль>\` — одно на все таргеты).`,
          path: rel,
          suggestion: `Переименуйте \`${base}\` → \`${renamed}\` (${spec.role}); прежнее имя пока работает.`,
        });
      } else {
        diagnostics.push({
          code: 'RF013',
          severity: 'warning',
          message: `файл сверх набора (устаревшее имя): роли «${CONCERN_TITLE[legacy] ?? legacy}» в раскладке target=${target} нет.`,
          path: rel,
          suggestion: foldHint(legacy, target),
        });
      }
      continue;
    }

    const concern = ALIASES[key];
    const spec = concern ? root.byConcern.get(concern) : undefined;

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
          ? `\`${already}\` уже есть — слейте содержимое \`${base}\` в него и удалите файл.`
          : `Переименуйте \`${base}\` → \`${spec.path}\` (${spec.role}).`,
      });
      continue;
    }

    if (concern) {
      diagnostics.push({
        code: 'RF013',
        severity: 'warning',
        message: `файл сверх набора: роли «${CONCERN_TITLE[concern] ?? concern}» в раскладке target=${target} нет.`,
        path: rel,
        suggestion: foldHint(concern, target),
      });
      continue;
    }

    diagnostics.push({
      code: 'RF013',
      severity: 'warning',
      message: `файл сверх канонического набора target=${target}.`,
      path: rel,
      suggestion: extraHint(base),
    });
  }

  for (const [concern, hits] of canonicalHits) {
    if (hits.length > 1) {
      const spec = root.byConcern.get(concern);
      diagnostics.push({
        code: 'RF013',
        severity: 'warning',
        message: `${hits.map((h) => `\`${h}\``).join(' и ')} — два файла на одну роль «${CONCERN_TITLE[concern] ?? concern}».`,
        suggestion: `Оставьте один: канон печатает \`${spec?.path ?? hits[0]}\`.`,
      });
    }
  }

  if (stepFiles > 0 && !hasStepsIndex && stepsIndex) {
    diagnostics.push({
      code: 'RF012',
      severity: 'warning',
      message: `Шаги разнесены по \`${STEPS_DIR}/<slug>/\`, но нет \`${stepsIndex.path}\` — ${stepsIndex.role}.`,
      suggestion:
        `Создайте \`${stepsIndex.path}\`: он задаёт порядок шагов и собирает их модули для ` +
        'корневых `form.validation.ts` / `form.render.ts`.',
    });
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
  lines.push(renderStepLayoutNote(target));
  lines.push('');
  lines.push(
    'Модуль плоский: без `lib/` / `schema/` / `components/`; единственная вложенность — шаги ' +
      '`steps/<slug>/`. Правило имён: `form.<роль>` — артефакт формы, суффикс называет роль ' +
      '(`schema` — разметка, `behavior` — поведение модели, `render` — поведение разметки, ' +
      '`validation` — валидация); остальные файлы без префикса. Прежние `renderer.schema.*` / ' +
      '`renderer.behavior.ts` / `renderer.wizard.tsx` / `validation.ts` принимаются ' +
      'с предупреждением. Полное правило — `find_recipe directory-layout`.'
  );
  return lines.join('\n');
}
