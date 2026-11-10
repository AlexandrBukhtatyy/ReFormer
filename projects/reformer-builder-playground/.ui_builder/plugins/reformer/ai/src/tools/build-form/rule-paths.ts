/**
 * Пути правил intent против полей собранной формы — до того, как правила уйдут в `set_form_rules`.
 *
 * ## Зачем
 *
 * `set_form_rules` отказывает на первом же пути без поля одной строкой: `No field bound to
 * "total_guests".` Внутри `build_form` этот отказ отменял всю сборку — поля, раскладку и прочие
 * правила, — и ход кончался «ни одна правка не применилась» (ReFormer-t4fr). Случаи из живых
 * ходов:
 *
 * - **вычисляемое поле не объявлено.** Модель описывает `total_guests` связью `compute`, а в
 *   `fields` его не ставит: вычисляемое поле она полем не считает. Четыре повтора подряд — с
 *   подсказкой «did you mean guests?», которая вела к массиву гостей, а не к объявлению поля;
 * - **имя из образца грамматики.** `enableWhen` с `sources: ["kind"]` — источник из примера
 *   грамматики, а не из формы пользователя;
 * - **поле группы названо коротким именем.** Поле объявлено `guests.total_guests`, правило пишет
 *   `total_guests`.
 *
 * ## Что здесь делается
 *
 * Сверка идёт с черновиком, в который сборка уже поставила узлы, — ровно с тем, что увидит
 * `set_form_rules` (тем же {@link isBoundPath}). Поэтому сверка не строже инструмента правил.
 *
 * - Короткое имя, которому в форме отвечает ровно одно поле группы (`guests.total_guests`),
 *   заменяется полным путём, и ответ об этом говорит. Это не догадка: другого поля с таким именем
 *   нет. Двум кандидатам замена не делается — выбрать между ними может только модель.
 * - Правило, у которого путь без поля остался, **не ставится**, а остальное собирается: поля,
 *   раскладка, прочие правила. Ответ перечисляет отложенные правила все разом, с починкой для
 *   каждого. Отказ всей сборке из-за одной связи оставлял человека без формы: небольшая модель
 *   правила не чинила, а сборку повторяла с той же ошибкой.
 *
 * Пути строк массива (`each`) не чинятся: короткое имя там — путь от строки, и он законен.
 *
 * @module plugins/reformer/ai/tools/build-form/rule-paths
 */

import { similarNames } from '@reformer/builder-toolkit';
import {
  isBoundPath,
  rowFull,
  type BehaviorParam,
  type Params,
  type ValidationParam,
} from '../set-form-rules';

/** Итог сверки: правила, которые можно ставить, что починено и что отложено. */
export interface RulePathCheck {
  /** Правила с починенными путями — без отложенных. */
  readonly params: Params;
  /** Замены коротких имён полными путями — для ответа модели. */
  readonly notes: readonly string[];
  /** Отложенные правила: по строке на путь без поля, с починкой. */
  readonly dropped: readonly string[];
}

export interface RulePathOptions {
  /** Имя из образца грамматики — у такого пути починка говорит, откуда он взялся. */
  readonly isSample?: (name: string) => boolean;
}

/** Связи, чья цель — значение, которое форма вычисляет сама: такую цель модель забывает объявить. */
const COMPUTED_KINDS: ReadonlySet<string> = new Set(['compute', 'computeFrom']);

/** Сколько похожих имён назвать в строке. */
const SIMILAR_LIMIT = 3;

/**
 * Сверить пути правил с полями формы.
 *
 * @param known - Пути модели черновика, в который сборка уже поставила узлы.
 */
export function checkRulePaths(
  params: Params,
  known: readonly string[],
  options: RulePathOptions = {}
): RulePathCheck {
  const notes: string[] = [];
  const dropped: string[] = [];

  /** Путь как есть, полный путь поля группы вместо короткого имени — или `null`. */
  const resolve = (
    written: string,
    each: string | undefined,
    where: string,
    computed = false
  ): string | null => {
    if (isBoundPath(rowFull(written, each), known)) return written;
    if (each === undefined) {
      const tails = known.filter((path) => path.endsWith(`.${written}`));
      if (tails.length === 1) {
        notes.push(`${where} "${written}" read as "${tails[0]}": a group field has a dotted name`);
        return tails[0];
      }
    }
    dropped.push(`${where} "${written}": ${fixOf(written, known, computed, options)}`);
    return null;
  };

  const validation: ValidationParam[] = [];
  for (const rule of params.validation ?? []) {
    const target = resolve(rule.target, rule.each, 'validation');
    if (target !== null) validation.push(target === rule.target ? rule : { ...rule, target });
  }

  const behavior: BehaviorParam[] = [];
  for (const link of params.behavior ?? []) {
    // У итога по строкам цель — сам массив: `each` к его пути не приписывается.
    const each = link.kind === 'aggregateInto' ? undefined : link.each;
    const target = resolve(link.target, each, `${link.kind} target`, COMPUTED_KINDS.has(link.kind));
    // Источники сверяются все, даже при битой цели: модель чинит их одним заходом.
    const sources = (link.sources ?? []).map((source) =>
      resolve(source, each, `${link.kind} source`)
    );
    if (target === null || sources.some((source) => source === null)) continue;
    behavior.push({
      ...link,
      target,
      ...(link.sources === undefined ? {} : { sources: sources as string[] }),
    });
  }

  return {
    params: {
      ...(params.mode === undefined ? {} : { mode: params.mode }),
      ...(params.dataSources === undefined ? {} : { dataSources: params.dataSources }),
      ...(validation.length > 0 ? { validation } : {}),
      ...(behavior.length > 0 ? { behavior } : {}),
    },
    notes,
    dropped,
  };
}

/** Есть ли что ставить: правила или значения источников. */
export function hasRuleParams(params: Params): boolean {
  return (
    (params.validation?.length ?? 0) > 0 ||
    (params.behavior?.length ?? 0) > 0 ||
    Object.keys(params.dataSources ?? {}).length > 0
  );
}

/**
 * Как починить путь без поля.
 *
 * У цели вычисления первым идёт «объяви поле»: похожее имя рядом с ней — чаще всего массив, из
 * которого считают (`guests` для `total_guests`), и подсказка «did you mean guests?» уводила модель
 * от объявления поля четыре повтора подряд.
 */
function fixOf(
  written: string,
  known: readonly string[],
  computed: boolean,
  options: RulePathOptions
): string {
  const declare = `{"name":"${written}","component":"…","label":"…"}`;
  if (computed) {
    return (
      `not declared. A computed field is a field too: add ${declare} to "fields" (and to the ` +
      'layout, if the intent has one).'
    );
  }
  const similar = similarNames(written, known, SIMILAR_LIMIT);
  if (similar.length > 0) return `no such field; did you mean ${similar.join(', ')}?`;
  // Имя образца — только когда в форме ничего похожего нет: `email` законно в любой анкете, и при
  // `contact.email` рядом пометка «из образца» была бы неправдой.
  const sample =
    options.isSample?.(written) === true
      ? 'a name from the grammar example, not from this form; '
      : '';
  return `${sample}not declared: add ${declare} to "fields", or use a declared name.`;
}

/** Строки ответа сборки об отложенных правилах. */
export function droppedRulesText(dropped: readonly string[]): string {
  return (
    'Not applied — rules name fields the form does not have:\n' +
    dropped.map((line) => `- ${line}`).join('\n') +
    '\nThe rest is built. Fix these: rebuild with the corrected intent, or declare the fields ' +
    'and add the rules with set_form_rules.'
  );
}
