/**
 * Пути правил intent против полей собранной формы — до того, как правила уйдут в `set_form_rules`.
 *
 * ## Зачем
 *
 * `set_form_rules` отказывает на первом же пути без поля одной строкой: `No field bound to
 * "total_guests".` Внутри `build_form` эта строка — весь ответ модели о сборке, которая не легла
 * целиком. Небольшая модель по ней не понимала, что чинить, бросала сборку, и ход кончался
 * «ни одна правка не применилась» (ReFormer-t4fr). Воспроизводятся два случая:
 *
 * - **вычисляемое поле не объявлено.** Модель описывает `total_guests` связью `compute`, а в
 *   `fields` его не ставит: вычисляемое поле она полем не считает;
 * - **поле группы названо коротким именем.** Поле объявлено `guests.total_guests`, а правило
 *   пишет `total_guests`.
 *
 * ## Что здесь делается
 *
 * Сверка идёт с черновиком, в который сборка уже поставила узлы, — ровно с тем, что увидит
 * `set_form_rules` (тем же {@link isBoundPath}). Поэтому проверка не строже инструмента правил:
 * всё, что она пропускает, он примет, а всё, что отвергает, он отверг бы и сам.
 *
 * - Короткое имя, которому в форме отвечает ровно одно поле группы (`guests.total_guests`),
 *   заменяется полным путём, и ответ об этом говорит. Это не догадка: другого поля с таким именем
 *   нет. Двум кандидатам замена не делается — выбрать между ними может только модель.
 * - Остальные пути без поля перечисляются ВСЕ разом, с починкой для каждого: похожие имена или
 *   «объяви его в fields». Отказ по одному пути за вызов стоил бы модели по запросу на каждый.
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

/** Итог сверки: параметры правил с починенными путями, что починено и что не нашлось. */
export interface RulePathCheck {
  readonly params: Params;
  /** Замены коротких имён полными путями — для ответа модели. */
  readonly notes: readonly string[];
  /** Пути без поля — по строке на путь, с починкой. Пусто — правила можно ставить. */
  readonly problems: readonly string[];
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
export function checkRulePaths(params: Params, known: readonly string[]): RulePathCheck {
  const notes: string[] = [];
  const problems: string[] = [];

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
    problems.push(`${where} "${written}": ${fixOf(written, known, computed)}`);
    return null;
  };

  const validation = params.validation?.map((rule): ValidationParam => {
    const target = resolve(rule.target, rule.each, 'validation');
    return target === null || target === rule.target ? rule : { ...rule, target };
  });

  const behavior = params.behavior?.map((link): BehaviorParam => {
    // У итога по строкам цель — сам массив: `each` к его пути не приписывается.
    const each = link.kind === 'aggregateInto' ? undefined : link.each;
    const target =
      resolve(link.target, each, `${link.kind} target`, COMPUTED_KINDS.has(link.kind)) ??
      link.target;
    const sources = link.sources?.map(
      (source) => resolve(source, each, `${link.kind} source`) ?? source
    );
    return {
      ...link,
      target,
      ...(sources === undefined ? {} : { sources }),
    };
  });

  return {
    params: {
      ...params,
      ...(validation === undefined ? {} : { validation }),
      ...(behavior === undefined ? {} : { behavior }),
    },
    notes,
    problems,
  };
}

/** Как починить путь без поля: похожие имена либо объявить поле. */
function fixOf(written: string, known: readonly string[], computed: boolean): string {
  const similar = similarNames(written, known, SIMILAR_LIMIT);
  if (similar.length > 0) return `no such field; did you mean ${similar.join(', ')}?`;
  const declare = `{"name":"${written}","component":"…","label":"…"}`;
  return computed
    ? `not declared. A computed field is a field too: add ${declare} to "fields" (and to the ` +
        'layout, if the intent has one).'
    : `not declared: add ${declare} to "fields", or use a declared name.`;
}

/** Отказ сборки на путях правил: все пути разом, черновик хода не тронут. */
export function rulePathsMessage(problems: readonly string[]): string {
  return (
    'Rules name fields the form does not have, nothing changed:\n' +
    problems.map((line) => `- ${line}`).join('\n')
  );
}
