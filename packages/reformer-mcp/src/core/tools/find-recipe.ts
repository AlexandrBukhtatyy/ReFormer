import { KNOWN_PACKAGES, normalizePackage, type ReformerPackage } from '../docs/packages.js';
import { findOneSymbol, publicSymbols } from '../index/symbols.js';
import {
  findDocFile,
  listRecipeNames,
  pickBestDocFile,
  scoreDocFileMatch,
} from '../docs/recipes.js';
import type { Knowledge } from '../knowledge.js';
import { searchSections, renderSectionHits } from './search-docs.js';
import { rankSymbolsForQuery, renderSymbolHits } from '../index/search.js';
import { invalidCall } from './tool-result.js';

export const findRecipeToolDefinition = {
  name: 'find_recipe',
  description:
    'A worked recipe for a scenario keyword ("wizard", "form-array", "copy-from", "json-schema") or the @example of a symbol. An unknown topic falls through to full-text search, so it returns candidates rather than nothing.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      topic: {
        type: 'string',
        description:
          'Topic keyword. Matches docs/llms/ filenames (with or without NN- prefix), `## ` section headings inside those files, or a public symbol name across all @reformer/* packages.',
      },
      package: {
        type: 'string',
        description:
          'Restrict to one package: core | cdk | ui-kit | renderer-react | renderer-json (full name or short). Omit for all.',
      },
    },
    required: ['topic'],
  },
};

export interface FindRecipeArgs {
  topic: string;
  package?: string;
}

/**
 * Common user-typed keywords → canonical recipe filename stems.
 * Handles cases where the obvious search term doesn't match the actual
 * filename (e.g. user types "form-array" but file is "10-arrays.md").
 *
 * Add aliases here when sub-agents repeatedly hit "no recipe found" for
 * intuitive keywords. Each alias maps to a list of candidate stems
 * (without NN- prefix); first match wins.
 */
const RECIPE_ALIASES: Record<string, string[]> = {
  // computed fields
  'compute-from': ['compute-vs-watch'],
  computed: ['compute-vs-watch'],
  derived: ['compute-vs-watch'],
  // arrays
  // `field-array` — имя файлов cdk и ui-kit (02-field-array.md, 08-field-array-section.md): до
  // переименования компонента ключ сценария `form-array` совпадал с ними сам.
  'form-array': ['field-array', 'arrays', 'array-operations', 'array-cleanup'],
  'field-array': ['arrays', 'array-operations', 'array-cleanup'],
  array: ['arrays'],
  // Точка входа. Топик `start-here` попадал в секцию «Prompts» и отсылал к механизму,
  // которого у агентного консумента нет вовсе (клиенты prompts не выставляют). Рабочая
  // точка входа — методика M1, она же лежит в ресурсе `reformer://guide`.
  'start-here': ['m1-workflow'],
  'getting-started': ['m1-workflow'],
  workflow: ['m1-workflow'],
  // multi-step / wizard.
  // `form-navigation` — имя файла cdk (03-form-navigation.md, h1 «FormWizard»): без него
  // топик `wizard` с фильтром package попадал в шаг 2 каскада (совпадение по заголовку
  // секции) и отдавал случайный кусок вместо рецепта — например, в renderer-react приезжал
  // один параграф «прокинуть конфиг в wizard-узел», без формы самого узла.
  'form-wizard': ['multi-step', 'form-navigation'],
  wizard: ['multi-step', 'form-navigation'],
  'multi-step': ['form-navigation'],
  // Уровень формы: поток шагов, проверка и отправка (core 38-form-flow.md).
  flow: ['form-flow'],
  'step-flow': ['form-flow'],
  'steps-flow': ['form-flow'],
  'submit-result': ['form-flow'],
  'validate-step': ['form-flow'],
  // Тексты замечаний по коду (core 36-issue-messages.md); общий i18n — запасной.
  messages: ['issue-messages', 'i18n'],
  'error-messages': ['issue-messages', 'i18n'],
  'validation-messages': ['issue-messages', 'i18n'],
  'message-dictionary': ['issue-messages', 'i18n'],
  // Скомпилированная схема: виды узлов, идентификаторы, области (core 37-compiled-schema.md).
  'compile-schema': ['compiled-schema'],
  'schema-compiler': ['compiled-schema'],
  'node-id': ['compiled-schema'],
  // async
  'async-validator': ['async-validator-debounce', 'async-watchfield', 'async-preload'],
  async: ['async-watchfield', 'async-preload'],
  // ui-kit визуальная раскладка: отступы, сетка, группировка (11-form-layout.md).
  // Стем `form-layout` матчится сам (точное совпадение), `layout` намеренно НЕ алиасим:
  // resolveAliases пробует исходный топик первым, и он уже уходит в 04-layout-and-buttons.
  spacing: ['form-layout'],
  styling: ['form-layout'],
  grouping: ['form-layout'],
  grid: ['form-layout'],
  // ui-kit form-field
  'form-field': ['form-field-integration'],
  'field-component': ['form-field-integration'],
  formfield: ['form-field-integration'],
  // cycles (behaviors / arrays)
  cycle: ['cycle-detection'],
  circular: ['cycle-detection', 'array-cleanup'],
  'cycle-detection': ['cycle-detection'],
  // copy / sync (value propagation between fields — NOT cross-field validation)
  sync: ['sync-fields'],
  copy: ['copy-from'],
  // conditional value ops
  reset: ['reset-when'],
  transform: ['transform-value'],
  revalidate: ['revalidate-when'],
  // submit lifecycle
  submit: ['submit-and-reset'],
  submission: ['submit-and-reset', 'form-flow'],
  // async options / preload
  preload: ['async-preload'],
  options: ['async-options-loading'],
  // form directory / project layout. Canonical cross-target guide is
  // form-directory-layout (@reformer/mcp). @reformer/core keeps its own
  // project-structure section (core-only slice), kept consistent with the
  // guide — safe as a fallback for core-only consumers without the mcp package.
  'directory-layout': ['form-directory-layout', 'project-structure'],
  'directory-structure': ['form-directory-layout', 'project-structure'],
  'project-structure': ['form-directory-layout', 'project-structure'],
  'folder-structure': ['form-directory-layout', 'project-structure'],
  'file-organization': ['form-directory-layout', 'project-structure'],
  colocation: ['form-directory-layout', 'project-structure'],
  // Топики, которые агент пишет, когда СОБИРАЕТСЯ ДЕЛАТЬ форму, а не когда ищет её раскладку
  // по имени. Замерено: `create-form` — самая естественная формулировка на старте работы —
  // резолвился секцией `### createForm API` пакета core (шаг 2 каскада) и уводил на API,
  // а раскладку и имена файлов агент дальше придумывал сам. `naming` уходил в
  // core/common-patterns, `form-files` — в cdk/typed-item-access. Все четыре теперь ведут в
  // тот же гайд, что и `directory-layout`.
  //
  // Прицельно про сам символ спрашивают `get_symbol_docs createForm` — этот маршрут не
  // затронут; секция `## 18. create-form` (описание одноимённого prompt'а сервера) была
  // недостижима и до алиаса: шаг 2 идёт по пакетам от core, и core перехватывал раньше.
  'create-form': ['form-directory-layout', 'project-structure'],
  'file-naming': ['form-directory-layout', 'project-structure'],
  naming: ['form-directory-layout', 'project-structure'],
  'form-files': ['form-directory-layout', 'project-structure'],
  // conditional fields — visibility/availability (enableWhen, compute/copyFrom { when }),
  // conditional validation (validateWhen), JSX hiding. Falls back to
  // api-signatures for the raw signatures if the recipe is somehow unavailable.
  conditional: ['conditional-fields', 'api-signatures'],
  'conditional-fields': ['conditional-fields', 'api-signatures'],
  'conditional-rendering': ['conditional-fields', 'api-signatures'],
  'enable-when': ['conditional-fields', 'api-signatures'],
  enablewhen: ['conditional-fields', 'api-signatures'],
  'validate-when': ['validation', 'conditional-fields'],
  'conditional-validation': ['validation', 'conditional-fields'],
  // validation contract (@reformer/core/validation): validate/validateAsync/validateWhen/apply/applyEach, cross of the scope
  // + external runner validateModel(model, schema). Maps to the renderer 06-validation recipe and
  // core multi-step; async → async-validator-debounce; cross-field → common-patterns.
  validation: ['validation', 'multi-step'],
  validate: ['validation', 'multi-step'],
  validator: ['validation'],
  'validate-model': ['validation', 'multi-step'],
  'validate-async': ['validation', 'async-validator-debounce'],
  'async-validation': ['validation', 'async-validator-debounce'],
  cross: ['validation', 'common-patterns'],
  'cross-field': ['validation', 'common-patterns'],
  // Локализация. Общий рецепт — core 34-i18n.md. Замерено: `translation` давал «No recipe
  // found» и ~3.5k символов списка, `locale` — секцию одного символа (`bundledLocaleSource`),
  // `localization` — раздел локали cdk вместо локали ядра.
  locale: ['i18n'],
  locales: ['i18n'],
  localization: ['i18n'],
  localisation: ['i18n'],
  l10n: ['i18n'],
  translation: ['i18n'],
  translations: ['i18n'],
  translate: ['i18n'],
  language: ['i18n'],
  // Разбор проблем: файлы `troubleshooting` есть у каждого библиотечного пакета, частые ошибки
  // ядра — в 05-common-mistakes.md. `anti-patterns` без алиаса попадал в первый попавшийся
  // одноимённый раздел.
  faq: ['troubleshooting'],
  debugging: ['troubleshooting'],
  pitfalls: ['common-mistakes', 'troubleshooting'],
  gotchas: ['common-mistakes', 'troubleshooting'],
  'anti-patterns': ['common-mistakes', 'troubleshooting'],
  antipatterns: ['common-mistakes', 'troubleshooting'],
  // Установка и входы пакета — в обзоре (у ядра — 39-overview.md, у остальных — 01-overview.md).
  install: ['overview'],
  installation: ['overview'],
  setup: ['overview'],
  // Имя пакета как топик — обзор ЭТОГО пакета. Без алиаса `renderer-json` и `renderer-react`
  // уходили в одноимённый раздел ui-kit, а `mcp` и `form-registry` — в шапку llms.txt (~150
  // символов без содержания). Кандидат `<пакет>/<имя>` ищется только в своём пакете.
  core: ['core/overview'],
  cdk: ['cdk/overview'],
  'ui-kit': ['ui-kit/overview'],
  'renderer-react': ['renderer-react/overview'],
  'renderer-json': ['renderer-json/overview'],
  'form-registry': ['form-registry/overview'],
  'micro-frontend': ['form-registry/overview'],
  microfrontend: ['form-registry/overview'],
  mcp: ['mcp/guide'],
  // Источник опций списочных полей (cdk 11-option-source.md): `ResourceConfig`, стратегии.
  // Голый `resource` не алиасится: он по праву уходит в ресурсы сервера (mcp 04-resources.md).
  'resource-config': ['option-source'],
  'async-select': ['option-source', 'async-options-loading'],
  'server-search': ['option-source'],
};

/**
 * Оценка имени файла, начиная с которой попадание точное: 100 — имя целиком, 90 — то же без
 * дефисов и регистра.
 */
const EXACT_MATCH = 90;

/** Ниже — попадание подстрокой («validate» внутри «revalidate-when»). */
const WEAK_MATCH = 60;

function resolveAliases(topic: string): string[] {
  const key = topic.toLowerCase();
  const aliases = RECIPE_ALIASES[key];
  return aliases && aliases.length > 0 ? [topic, ...aliases] : [topic];
}

interface FileHit {
  pkg: ReformerPackage;
  fileName: string;
  score: number;
}

/**
 * Лучший файл рецепта для одного кандидата среди пакетов.
 *
 * Порядок пакетов — приоритет (ядро первым), с одним исключением: точное имя файла в позднем
 * пакете бьёт частичное в раннем. Без него `validation` отдавал core/33-validation-strategy.md
 * (про МОМЕНТ запуска проверки) вместо рецепта правил `06-validation.md`: ядро шло первым и
 * совпадало по слову в имени. Внутри пакета то же правило уже действует (дефект 78).
 *
 * Кандидат вида `<пакет>/<имя>` (`cdk/overview`) ищется только в своём пакете — так алиас
 * называет файл, имя которого повторяется в нескольких пакетах.
 */
function bestFileHit(
  k: Knowledge,
  candidate: string,
  targets: readonly ReformerPackage[]
): FileHit | null {
  let topic = candidate;
  let scope = targets;
  const scoped = candidate.match(/^([a-z][a-z-]*)\/([^/]+)$/i);
  if (scoped) {
    const pkg = normalizePackage(scoped[1]);
    if (!pkg) return null;
    if (!targets.includes(pkg)) return null;
    topic = scoped[2];
    scope = [pkg];
  }

  let hit: FileHit | null = null;
  for (const pkg of scope) {
    const fileName = pickBestDocFile(
      k.recipes.list(pkg).filter((f) => f.endsWith('.md')),
      topic
    );
    if (!fileName) continue;
    const score = scoreDocFileMatch(fileName, topic);
    if (!hit || (score >= EXACT_MATCH && hit.score < EXACT_MATCH)) hit = { pkg, fileName, score };
  }
  return hit;
}

/**
 * Какой кандидат отвечает на топик именем файла.
 *
 * Сам топик идёт первым, как и раньше. Исключение — когда он совпал лишь подстрокой, а алиас
 * совпадает точно: `validate` иначе уходил в `27-revalidate-when.md` по буквам «validate» внутри
 * «revalidate». Алиас, совпавший тоже частично, такого топика не перебивает.
 */
function pickRecipeCandidate(
  k: Knowledge,
  candidates: string[],
  targets: readonly ReformerPackage[]
): { candidate: string; hit: FileHit } | null {
  const [own, ...aliases] = candidates.map((candidate) => ({
    candidate,
    hit: bestFileHit(k, candidate, targets),
  }));
  if (own.hit && own.hit.score >= WEAK_MATCH) return { candidate: own.candidate, hit: own.hit };
  const exactAlias = aliases.find((a) => a.hit && a.hit.score >= EXACT_MATCH);
  if (exactAlias?.hit) return { candidate: exactAlias.candidate, hit: exactAlias.hit };
  if (own.hit) return { candidate: own.candidate, hit: own.hit };
  const anyAlias = aliases.find((a) => a.hit);
  return anyAlias?.hit ? { candidate: anyAlias.candidate, hit: anyAlias.hit } : null;
}

export async function findRecipeTool(
  args: FindRecipeArgs,
  k: Knowledge
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  // MCP Server не валидирует args по inputSchema — обязательный `topic` может прийти
  // отсутствующим/не-строкой. Защищаемся до .trim(), иначе — необработанный TypeError
  // (ср. паттерн в check-behaviors.ts).
  if (typeof args.topic !== 'string') {
    return invalidCall('Argument "topic" is required and must be a non-empty string.');
  }
  const topic = args.topic.trim();
  if (!topic) {
    return invalidCall('Argument "topic" is required and must be non-empty.');
  }
  const only = normalizePackage(args.package);
  const targets: ReformerPackage[] = only ? [only] : [...KNOWN_PACKAGES];

  const candidates = resolveAliases(topic);

  // 1. Match by docs/llms/ filename (with or without NN- prefix).
  //    The original topic first, then registered aliases (see pickRecipeCandidate).
  const picked = pickRecipeCandidate(k, candidates, targets);
  // Полное имя файла с номером совпадает только с самим файлом (оценка 100).
  const file = picked
    ? findDocFile(k.recipes, picked.hit.pkg, picked.hit.fileName.replace(/\.md$/i, ''))
    : null;
  if (picked && file) {
    const { candidate } = picked;
    const { pkg } = picked.hit;
    const body = file.body;
    const aliasNote =
      candidate !== topic
        ? `\n\n> _Note: searched for \`${topic}\`, matched alias → \`${candidate}\`. ` +
          `Use \`${candidate}\` directly to suppress this hint._`
        : '';
    // Рецепт возвращался ЦЕЛИКОМ, без потолка: замерено 17 130 символов (~4 283 токена)
    // у `cookbook`. Это ответ инструмента, а не явный `resources/read`, — агент получает
    // его не глядя, поэтому потолок обязателен. Обрезка всегда помечена и говорит, где
    // дочитать: молча усечённый рецепт агент дописал бы сам.
    const { text: bodyText, truncated, dropped } = capRecipe(body.trim(), RECIPE_MAX_CHARS);
    const droppedNote =
      dropped.length > 0 ? ` Не поместились разделы: ${dropped.join(' · ')}.` : '';
    const more = truncated
      ? `\n\n> _Рецепт обрезан по бюджету.${droppedNote} Полный текст — \`reformer://docs/${pkg.replace(/^@reformer\//, '')}\` ` +
        `или \`docs/llms/${file.fileName}\` в пакете._`
      : '';
    return text(
      `# Recipe: ${file.title}\n\n` +
        `**Source:** ${pkg} · \`docs/llms/${file.fileName}\`${aliasNote}\n\n` +
        bodyText +
        more
    );
  }

  // 2. Match by `## ` section heading.
  for (const pkg of targets) {
    const section = k.docs.section(topic, pkg);
    if (!section.startsWith('Section "') /* "...not found" sentinel */) {
      return text(
        `# Recipe section: ${topic}\n\n` +
          `**Source:** ${pkg} · matched by section heading\n\n` +
          section
      );
    }
  }

  // 3. Match by public symbol — return its @example block(s).
  const sym = await findOneSymbol(k, topic, args.package ?? '*');
  if (sym) {
    const examples = sym.tags.filter((t) => t.tag === 'example');
    if (examples.length > 0) {
      return text(
        `# Symbol example: ${sym.name} (${sym.kind}) — ${sym.package}\n\n` +
          `**Source:** ${sym.package} · \`${sym.sourcePath}\`\n\n` +
          examples.map((e) => e.text).join('\n\n---\n\n')
      );
    }
  }

  // 4. Каскад в полнотекстовый поиск. Раньше здесь был сразу шаг 5 (список алиасов), и
  //    это был тупик: замерено на 25 естественных формулировках («dependent field»,
  //    «hide field», «phone mask», «server validation», …) — 17 из 25 (68%) не резолвились
  //    ни файлом, ни секцией, ни символом, и агент платил ~693 токена за подсказку без
  //    ответа. Те же 17 из 17 находит `search_docs` — соседний tool ЭТОГО ЖЕ сервера.
  //    Поэтому промах алиасов больше не терминален: отдаём ранжированных кандидатов.
  const hits = searchSections(k, topic, args.package, 5);
  if (hits.length > 0) {
    const top = hits[0];
    // Инлайним тело только при попадании в ЗАГОЛОВОК секции: там скоринг надёжен
    // (совпадение в title весит 10×), а тело — обозримого размера. В остальных случаях
    // отдаём кандидатов с URI, чтобы не потратить 4k токенов на секцию мимо задачи.
    // (Полноценное ранжирование — отдельная работа, см. план v7, фаза «индекс».)
    const body =
      top.titleMatch && top.bodyLength <= INLINE_SECTION_LIMIT
        ? k.docs.sectionBySlug(top.pkg, top.slug)
        : null;

    if (body) {
      const rest = hits.slice(1);
      return text(
        `# Recipe section: ${top.title}\n\n` +
          `**Source:** ${top.pkg} · \`${top.uri}\` · matched by full-text search for \`${topic}\`\n\n` +
          body +
          (rest.length > 0
            ? `\n\n---\n\n_Other candidates:_\n${rest.map((h) => `- \`${h.uri}\` — ${h.title}`).join('\n')}`
            : '')
      );
    }

    // Плюс канонические имена API из найденных секций — то, ради чего агент и спрашивал.
    const symbols = rankSymbolsForQuery(k, topic, hits, args.package, 4);
    const apiBlock = symbols.length > 0 ? `\n\n## Relevant API\n${renderSymbolHits(symbols)}` : '';
    return text(
      `No curated recipe is registered for "${topic}", but full-text search found related sections:\n\n` +
        renderSectionHits(hits) +
        apiBlock +
        `\n\n_Read one via resources/read on its \`reformer://docs/…\` URI._`
    );
  }

  // 5. Fallback: list available recipes and a sample of public symbols.
  return text(await buildFallbackHint(k, topic, targets));
}

/**
 * Максимальный размер секции, которую каскад отдаёт телом, а не ссылкой (~1.5k токенов).
 * Выше порога дешевле вернуть URI: секции доходят до 149k символов (`## API Reference` cdk).
 */
const INLINE_SECTION_LIMIT = 6000;

/** Потолок для файлового рецепта (~2.5k токенов). Крупнейший — `cookbook`, 17 130 символов. */
const RECIPE_MAX_CHARS = 10000;

/**
 * Обрезать рецепт по границе раздела, а не посреди строки.
 *
 * Режем по последнему заголовку, поместившемуся в лимит: обрывок раздела вводит в
 * заблуждение сильнее, чем его отсутствие. Незакрытый код-фенс закрываем — иначе у клиента
 * поедет вся остальная разметка ответа.
 */
function capRecipe(
  body: string,
  maxChars: number
): { text: string; truncated: boolean; dropped: string[] } {
  if (body.length <= maxChars) return { text: body, truncated: false, dropped: [] };
  const lines = body.split('\n');
  const kept: string[] = [];
  let used = 0;
  let lastHeading = -1;
  let inFence = false;
  for (const line of lines) {
    if (used + line.length + 1 > maxChars) break;
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (!inFence && /^#{2,4}\s/.test(line)) lastHeading = kept.length;
    kept.push(line);
    used += line.length + 1;
  }
  // Отрезаем хвост до последнего целого раздела, если он не в самом начале.
  const cut = lastHeading > 5 ? kept.slice(0, lastHeading) : kept;
  const fences = cut.filter((l) => /^\s*```/.test(l)).length;
  if (fences % 2 === 1) cut.push('```');

  // Заголовки, оставшиеся за границей. Без них потеря анонимна: агент видит «обрезан по
  // бюджету» и не знает, лишился он раздела про миграцию или половины документа. На гайде
  // раскладки за границей оказывалось до 47% текста — пять разделов из шести.
  const keptCount = cut.length;
  const dropped: string[] = [];
  let tailFence = false;
  for (const line of lines.slice(keptCount)) {
    if (/^\s*```/.test(line)) tailFence = !tailFence;
    if (tailFence) continue;
    const m = line.match(/^#{2,4}\s+(.+?)\s*$/);
    if (m) dropped.push(m[1].replace(/\s*\{\s*#[\w-]+\s*\}\s*$/, ''));
  }

  return { text: cut.join('\n').trimEnd(), truncated: true, dropped };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function text(message: string): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: message }] };
}

async function buildFallbackHint(
  k: Knowledge,
  topic: string,
  targets: ReformerPackage[]
): Promise<string> {
  const recipes: string[] = [];
  for (const pkg of targets) {
    for (const name of listRecipeNames(k.recipes, pkg)) {
      recipes.push(`${pkg.replace('@reformer/', '')}/${name}`);
    }
  }

  const symbols = (await Promise.all(targets.map((p) => publicSymbols(k, p))))
    .flat()
    .map((s) => s.name)
    .slice(0, 20);

  // Список алиасов — только фактически резолвящиеся против доступных пакетов: раньше
  // печатались все ключи RECIPE_ALIASES, и сервер рекламировал темы, которых у потребителя
  // нет (docs/llms не был опубликован). Хвост алиаса резолвится → это и есть «известная тема».
  const resolvableAliases = Object.keys(RECIPE_ALIASES)
    .filter((key) =>
      resolveAliases(key).some(
        (cand) =>
          bestFileHit(k, cand, targets) !== null ||
          targets.some((pkg) => !k.docs.section(cand, pkg).startsWith('Section "'))
      )
    )
    .sort();

  const aliasLine = resolvableAliases.length
    ? `Known topic aliases: ${resolvableAliases.join(', ')}.\n\n`
    : '';

  // `recipes.length === 0` означает, что файловый источник пуст (под npx без опубликованных
  // docs/llms) — но ресурсы (`resources/list`) всё равно отдают весь llms.txt по секциям.
  const noFilesNote =
    recipes.length === 0
      ? 'No file-based recipes are reachable here (docs/llms not published in this install). ' +
        'The full documentation is still available as MCP resources — call `resources/list` ' +
        '(reformer://docs/{core,cdk,ui-kit,renderer-react,renderer-json}[/section]).\n\n'
      : `Available recipes (${recipes.length}):\n${recipes.map((r) => `  - ${r}`).join('\n')}\n\n`;

  return (
    `No recipe found for "${topic}".\n\n` +
    noFilesNote +
    aliasLine +
    `Or pass a public symbol name. Sample symbols: ${symbols.join(', ')}, ...`
  );
}

// Ранжирование имён файлов рецептов переехало в ядро (`core/docs/recipes`), но точкой
// импорта остаётся этот модуль: тесты дефектов 78/79 проверяют именно поверхность
// `find_recipe`, и переписывание их импортов проверяло бы не то.
export { scoreDocFileMatch, pickBestDocFile };
