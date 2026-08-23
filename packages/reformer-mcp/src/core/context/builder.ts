/**
 * Сборка контекста под задачу — один ответ вместо цепочки вызовов.
 *
 * Что здесь происходит и почему именно так. У сервера уже есть все части: решение
 * (`chooseApi`), ранжированные секции (`searchSections`), переход «формулировка → имя»
 * (`rankSymbolsForQuery`) и типизированная документация в индексе. Порознь агент собирал их
 * за 2-4 вызова; здесь они собираются за один, дедуплицируются и режутся по бюджету.
 *
 * Дедупликация — не украшение. Один и тот же символ приходит и из решения, и из поиска, и из
 * темы; один и тот же источник печатался бы у каждого фрагмента. Канонический факт должен
 * попасть в ответ ровно один раз, а источники — общим списком в конце.
 */

import { chooseApi } from '../decide/api-decision.js';
import { FORM_LAYOUT_CANON, renderLayoutLine } from '../generate/builders.js';
import { findOneSymbol } from '../index/symbols.js';
import type { Knowledge } from '../knowledge.js';
import { rankSymbolsForQuery } from '../index/search.js';
import { searchSections, type SectionHit } from '../tools/search-docs.js';
import type { IndexedTopic } from '../index/types.js';
import type { ReformerTargetStack } from '../generate/form-intent.js';
import { assemble, type Chunk, type AssembledContext } from './budget.js';
import { PROFILES, resolveProfile, type ContextProfile, type ContextPart } from './profiles.js';

export interface BuildContextArgs {
  /** Задача или требование своими словами. */
  task: string;
  /** Явные темы индекса (`validation`, `arrays`, …). Без них темы выводятся из найденных секций. */
  topics?: string[];
  /** Целевой стек — сужает и поиск, и выдачу. */
  target?: string;
  profile?: string;
  /** Потолок токенов; перекрывает значение профиля. */
  maxTokens?: number;
}

export interface BuiltContext extends AssembledContext {
  profile: ContextProfile;
  /** Что реально попало в ответ — для отладки и тестов. */
  parts: ContextPart[];
  /** Рекомендованные символы в порядке уверенности. */
  symbols: string[];
  /** URI секций, откуда можно дочитать. */
  sources: string[];
}

const TARGET_TO_PACKAGE: Record<string, string> = {
  core: '@reformer/core',
  cdk: '@reformer/cdk',
  'ui-kit': '@reformer/ui-kit',
  'renderer-react': '@reformer/renderer-react',
  'renderer-json': '@reformer/renderer-json',
};

/**
 * Пакет собственной документации сервера. Он не отвечает ни за один target, но несёт
 * кросс-target методику: порядок сборки формы и раскладку файлов модуля.
 */
const GUIDANCE_PACKAGE = '@reformer/mcp';

/**
 * Пакеты, релевантные цели. Граф зависимостей простой: рендерер всегда идёт вместе с ядром,
 * а ui-kit — только там, где речь о компонентах. Смысл в том, чтобы при `target=core` в
 * выдачу не лезли React-компоненты, а при `target=renderer-json` — JSX.
 *
 * `@reformer/mcp` входит при ЛЮБОМ распознанном target'е, и это не нарушает правило выше:
 * компонентов в нём нет вовсе, а есть per-target методика — «Form directory layout» с
 * поимённым набором файлов для core / renderer-react / renderer-json. Без него секции §1/§2
 * этого гайда были недостижимы через `get_context` ни при какой формулировке: фильтр вырезал
 * единственный пакет, где правило живёт (замерено — раскладка расходилась с каноном у любого
 * агента, который не читал `reformer://guide` целиком). Разнос по таргетам делает сам гайд,
 * поэтому «JSX в core-выдаче» отсюда не приходит.
 *
 * Занижение mcp в ранжировании при этом сохраняется (`OWN_DOCS_PENALTY` в `search-docs`):
 * пакет участвует, но при прочих равных уступает библиотечным.
 */
function packagesFor(target: string | undefined): string[] | null {
  if (!target) return null;
  const own = TARGET_TO_PACKAGE[target];
  if (!own) return null;
  const base = ['@reformer/core', '@reformer/cdk', GUIDANCE_PACKAGE];
  if (own === '@reformer/core') return base;
  return [...base, own];
}

/**
 * Нужно ли выдать канонические имена файлов ТЕЛОМ ответа.
 *
 * Почему не хватило включения `@reformer/mcp` в `packagesFor()`. Секции гайда попадают в
 * `get_context` только списком URI в `## Read more`: тело собирается из символов, примеров и
 * тем, поэтому правило раскладки физически не может доехать содержимым. Замер: на
 * `{task:'собрать многошаговую форму кредитной заявки', target:'renderer-json'}` в 3 926
 * символах ответа было НОЛЬ канонических имён — и `profile:'full'`, и явный
 * `topics:['form-directory-layout']` картину не меняли. Отбор секций идёт по релевантности к
 * тексту задачи, а прикладная формулировка («кредитная заявка») layout-секцию не ранжирует
 * вовсе. Поэтому имена подаются отдельным дешёвым блоком, а не через поиск.
 *
 * Условие — не «всегда при target», а два независимых признака.
 *
 * 1. Прямой вопрос о размещении («куда положить…», «как назвать файл…»). Он и без слова
 *    «форма» ни о чём другом не бывает, поэтому срабатывает сам по себе.
 * 2. Работа над модулем целиком: предмет («форма», «модуль») ПЛЮС глагол сборки. Две приметы
 *    вместо одной дают дешёвое различение с узким вопросом про оператор («поле B доступно
 *    только когда A заполнено» — предмета в нём нет, блок не появится).
 *
 * Порог намеренно низкий: лишний раз показать правило дешевле (~90 токенов), чем получить
 * самопридуманные имена файлов. Обе приметы прогнаны по `eval/corpus`: блок появляется на
 * 11 задачах из 54 — всей категории `layout` (5) и шести задачах вида «создать/собрать форму»;
 * молчит на всех 43 узких («сделать поле обязательным», «удалить строку массива»).
 */
const FILE_PLACEMENT =
  /куда полож|куда класт|куда девать|где лежит|где хранит|как назват|имена файлов|назван\w* файл|расклад|файлы модул|file name|file naming|directory layout|project structure|where to put/i;
const FORM_SUBJECT = /форм|анкет|заявк|визард|wizard|мастер|модул|form|module/i;
const WHOLE_MODULE_WORK =
  /собра|сдела|созда|напис|постро|реализ|разлож|сверст|свёрст|разработ|опис|многошагов|build|creat|implement|scaffold|assembl|generat|write|multi-?step|directory|layout/i;

function layoutTargetFor(task: string, target: string | undefined): ReformerTargetStack | null {
  // Канон живёт по таргетам, и для `cdk` / `ui-kit` модуля формы нет — там блок не о чем.
  if (!target || !Object.prototype.hasOwnProperty.call(FORM_LAYOUT_CANON, target)) return null;
  const wanted =
    FILE_PLACEMENT.test(task) || (FORM_SUBJECT.test(task) && WHOLE_MODULE_WORK.test(task));
  return wanted ? (target as ReformerTargetStack) : null;
}

/** Темы, к которым относятся найденные секции. */
function topicsForSections(
  k: Knowledge,
  hits: SectionHit[],
  explicit: string[] | undefined
): IndexedTopic[] {
  const all = k.index.topics;
  if (explicit && explicit.length > 0) {
    const wanted = new Set(explicit.map((t) => t.toLowerCase()));
    return all.filter((t) => wanted.has(t.id.toLowerCase()));
  }
  const slugs = new Set(hits.map((h) => h.slug));
  return all.filter((t) => t.sections.some((s) => slugs.has(s.slug)));
}

export async function buildContext(k: Knowledge, args: BuildContextArgs): Promise<BuiltContext> {
  const task = String(args.task ?? '').trim();
  const profile = resolveProfile(args.profile);
  const spec = PROFILES[profile];
  const maxTokens = args.maxTokens ?? spec.maxTokens;
  const allowed = spec.priority;

  const allowPackages = packagesFor(args.target);
  const ownPackage = args.target ? TARGET_TO_PACKAGE[args.target] : undefined;

  // Ищем по всем допустимым пакетам сразу, а целевому даём умеренный БУСТ.
  //
  // Первая версия делала иначе: сначала искала только в целевом пакете и расширялась, лишь
  // если нашлось меньше трёх секций. Условие по КОЛИЧЕСТВУ оказалось ловушкой — BM25 внутри
  // одного пакета всегда находит хоть что-нибудь, поэтому запрос «отрисовать строки массива»
  // при `target: core` набирал шесть посторонних core-секций (`API Reference`,
  // `SCHEMA FORMAT`, `Anti-patterns`) и до cdk, где живёт `FormArray`, дело не доходило.
  // Буст решает исходную задачу (при прочих равных ядро впереди), не отсекая соседей.
  const OWN_PACKAGE_BOOST = 1.25;
  const sectionHits = searchSections(k, task, undefined, 14)
    .filter((h) => !allowPackages || allowPackages.includes(h.pkg))
    .map((h) => (h.pkg === ownPackage ? { ...h, score: h.score * OWN_PACKAGE_BOOST } : h))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  const topics = topicsForSections(k, sectionHits, args.topics).slice(0, 3);

  // --- рекомендованные символы, дедуплицированные -----------------------------
  const decision = chooseApi(task)[0] ?? null;
  // Символы ищем по ВСЕМ допустимым пакетам, а не только по целевому: ответ на «отрисовать
  // строки массива» — `FormArray` из cdk, и при жёсткой привязке к `core` выдача заполнялась
  // случайным ядерным символом. Сужение по цели делается фильтром, а не запретом поиска.
  const ranked = rankSymbolsForQuery(k, task, sectionHits, '*', 8).filter(
    (h) => !allowPackages || allowPackages.includes(h.symbol.package)
  );
  // Хвост ранжирования — шум: у слабого кандидата счёт на порядок ниже лидера, а сигнатура
  // стоит столько же. Берём только тех, кто набрал заметную долю от лучшего.
  const topScore = ranked[0]?.score ?? 0;
  const strong = ranked.filter((h) => h.score >= topScore * 0.35);

  /**
   * Символ ДОКАЗАН, если он либо выбран правилом, либо реально упомянут в одной из найденных
   * секций. Проверка обязательна: без неё сборщик подавал догадку в той же уверенной форме,
   * что и знание. Замерено — на запрос «показать текущее количество строк массива» выдача
   * начиналась блоком `## API` с `isGroupNode`, а нужный `useArrayLength` тонул ниже. Пустой
   * блок честнее неверного: агент пойдёт читать секции, а не напишет несуществующий вызов.
   */
  const sectionText = sectionHits.map((h) => `${h.title}\n${h.body}`).join('\n');
  const groundedIn = (name: string) =>
    new RegExp(`\\b${name.replace(/[$]/g, '\\$')}\\b`).test(sectionText);

  const symbolNames: string[] = [];
  if (decision) symbolNames.push(decision.rule.recommend);
  for (const hit of strong) {
    if (symbolNames.includes(hit.symbol.name)) continue;
    if (!groundedIn(hit.symbol.name)) continue;
    symbolNames.push(hit.symbol.name);
  }
  // Две сигнатуры покрывают решение и его ближайшую альтернативу; третья почти всегда лишняя.
  const primary = symbolNames.slice(0, 2);
  /** Нет ни решения, ни подтверждённого символа — отвечаем секциями и говорим об этом прямо. */
  const lowConfidence = primary.length === 0;

  const chunks: Chunk[] = [];
  const parts: ContextPart[] = [];
  const push = (part: ContextPart, text: string, truncatable = false) => {
    let priority = allowed[part];
    if (priority === undefined || !text.trim()) return;
    // Уверенности нет — ссылки на секции поднимаются наверх: они и есть ответ, а всё
    // остальное лишь окружение. Профиль при этом не переписываем, меняем только порядок.
    if (lowConfidence && part === 'sources') priority = -1;
    chunks.push({ priority, text, truncatable });
    parts.push(part);
  };

  if (lowConfidence) {
    push(
      'decision',
      '## No decision rule matched\n' +
        'Точного соответствия «требование → оператор» не нашлось, и ни один символ не подтверждён ' +
        'найденными секциями. Ниже — разделы документации, наиболее близкие к запросу; ' +
        'переформулируйте задачу как одно конкретное поведение, чтобы получить решение.'
    );
  }

  // --- решение ---------------------------------------------------------------
  if (decision) {
    push(
      'decision',
      `## Use \`${decision.rule.recommend}\`\n` +
        `Требование читается как «${decision.rule.intent}». ${decision.rule.because}` +
        (decision.rule.alternatives?.length
          ? `\n\nНе оно, если:\n` +
            decision.rule.alternatives.map((a) => `- \`${a.symbol}\` — ${a.when}`).join('\n')
          : '')
    );
  }

  // --- раскладка модуля ------------------------------------------------------
  // Строка собирается из `FORM_LAYOUT_CANON` тем же хелпером, что печатает `plan_form`:
  // третья копия имён в сервере разошлась бы с каноном при первой же правке таблицы.
  const layoutTarget = layoutTargetFor(task, args.target);
  if (layoutTarget) push('layout', `## Module files\n${renderLayoutLine(layoutTarget, true)}`);

  // --- сигнатуры и пример ----------------------------------------------------
  const signatures: string[] = [];
  let example = '';
  for (const name of primary) {
    const sym = await findOneSymbol(k, name, '*');
    if (!sym) continue;
    signatures.push(`\`${sym.name}\` (${sym.package})\n\`\`\`typescript\n${sym.signature}\n\`\`\``);
    // Канонический пример — ОДИН, от самого уверенного символа: три примера подряд стоят
    // втрое дороже и почти всегда лишние.
    if (!example) {
      const ex = sym.tags.find((t) => t.tag === 'example');
      if (ex) example = `## Example — \`${sym.name}\`\n${ex.text.trim()}`;
    }
  }
  if (signatures.length > 0) push('signature', `## API\n${signatures.join('\n\n')}`);
  push('example', example, true);

  // --- знание темы -----------------------------------------------------------
  const seenFacts = new Set<string>();
  const dedupe = (line: string) => {
    const key = line.trim().toLowerCase();
    if (!key || seenFacts.has(key)) return false;
    seenFacts.add(key);
    return true;
  };

  const purposes = topics.map((t) => `- **${t.id}** — ${t.purpose}`).filter(dedupe);
  if (purposes.length > 0) push('purpose', `## Topics\n${purposes.join('\n')}`);

  const rules = topics
    .flatMap((t) => t.keyConcepts)
    .filter(dedupe)
    .slice(0, 6);
  if (rules.length > 0) push('rules', `## Key rules\n${rules.map((r) => `- ${r}`).join('\n')}`);

  const antiLines: string[] = [];
  for (const topic of topics) {
    for (const ap of topic.antiPatterns) {
      if (ap.why && dedupe(ap.why)) {
        antiLines.push(`- ❌ ${ap.why}${ap.correctNote ? `\n  ✅ ${ap.correctNote}` : ''}`);
      }
    }
  }
  if (antiLines.length > 0) {
    push('antiPatterns', `## Anti-patterns\n${antiLines.slice(0, 5).join('\n')}`);
  }

  const trouble = topics
    .flatMap((t) => t.troubleshooting)
    .filter(dedupe)
    .slice(0, 5);
  if (trouble.length > 0) {
    push('troubleshooting', `## Troubleshooting\n${trouble.map((t) => `- ${t}`).join('\n')}`);
  }

  // --- соседние символы ------------------------------------------------------
  const related = [...new Set(symbolNames.slice(2))];
  if (related.length > 0) {
    push('related', `## Related\n${related.map((n) => `\`${n}\``).join(', ')}`);
  }

  // --- источники одним списком ----------------------------------------------
  // Раньше `**Source:**` печатался у каждого фрагмента; при пяти фрагментах это пять
  // повторов одного и того же. Собираем в конец, один раз.
  // При низкой уверенности секции — это и есть ответ, поэтому их больше и они со сниппетами:
  // голый URI потребовал бы ещё одного вызова, чтобы понять, стоит ли вообще читать.
  const sourceHits = sectionHits.slice(0, lowConfidence ? 6 : 4);
  const sources = [...new Set(sourceHits.map((h) => h.uri))];
  if (sources.length > 0) {
    const rendered = sourceHits
      .map((h) => `- \`${h.uri}\`${lowConfidence && h.snippet ? `\n  > ${h.snippet}` : ''}`)
      .join('\n');
    push('sources', `## Read more\n${rendered}`);
  }

  const assembled = assemble(chunks, maxTokens);
  return { ...assembled, profile, parts, symbols: primary, sources };
}
