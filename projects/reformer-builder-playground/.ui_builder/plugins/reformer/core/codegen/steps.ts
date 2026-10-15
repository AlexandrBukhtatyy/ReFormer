/**
 * Раскладка модуля: простая форма или визард, и если визард — его шаги.
 *
 * ## Вид формы решает СХЕМА, а не кит
 *
 * «Это визард» отвечает один признак: в схеме есть узел с шагами. От кита зависит только то, чем
 * узел визарда регистрируется в реестре (символом адаптера либо заглушкой): поток шагов и правила
 * по шагам печатаются и у формы, чей кит адаптера визарда не поставляет.
 *
 * ## Имя шага и папка шага
 *
 * У шага два имени, и почти всегда они совпадают:
 *
 * - **папка** (`dir`) — где лежит файл схемы шага у разбитого визарда
 *   (`schema/steps/<dir>/form.schema.json`). Правило — `kebab(заголовка)` из `form-model/step-dir`:
 *   его же спрашивает разбиение схемы по шагам. У шага, вынесенного в файл, папку задаёт ссылка;
 * - **имя** (`slug`) — под ним лежит код шага: `validation/<slug>.ts`. Оно не может совпасть с
 *   файлом правил формы (`validation/form.ts`), поэтому `form` — занятое имя.
 *
 * Расходятся они в одном случае: шаг вынесен в папку `steps/form/`. Папку менять нельзя (на неё
 * ссылается корень), а файл правил получает разведённое имя — `validation/form-2.ts`.
 *
 * @module plugins/reformer/core/codegen/steps
 */

import {
  isArrayNode,
  isContainerNode,
  isFieldNode,
  isPartNode,
  normalizeStepRef,
  parseOperator,
  type JsonFormSchema,
  type JsonNode,
} from '@reformer/renderer-json';
import { isNodeLike } from '../form-model/node-kind';
import { firstWizardStepRefs, stepDirOfRef, type SplitFormSchema } from '../form-model/composite';
import { isOperatorText, stepDirName, uniqueStepDir } from '../form-model/step-dir';
import { wizardStepsOf, type Collected } from './collect';
import {
  DEFAULT_SCHEMA_PATH,
  RESERVED_STEP_NAMES,
  schemaDirOf,
  stepSchemaPath,
  stepValidationPath,
} from './layout';
import { stepRulesAlias } from './naming';
import type { SelectorInfo } from './selectors';

/** Шаг визарда глазами раскладки. */
export interface StepInfo {
  /** Номер шага, с единицы. */
  readonly index: number;
  /** Папка шага (`kontakty`) — в ней лежит файл его схемы у разбитого визарда. */
  readonly dir: string;
  /**
   * Имя шага в путях кода (`validation/<slug>.ts`). Совпадает с {@link StepInfo.dir}, кроме шага,
   * чья папка из ссылки заняла зарезервированное имя (`form`).
   */
  readonly slug: string;
  /** Заголовок шага как в схеме (для комментариев), либо `Шаг N`. */
  readonly title: string;
  /**
   * Селектор узла шага (после `assignSelectors`) — он же `id` шага в потоке. `null` только у
   * схемы, по которой селекторы не проставляли.
   */
  readonly selector: string | null;
  /** `$nodeId` узла шага — задел для переноса файлов при переименовании шага. */
  readonly nodeId: string | null;
  /** Обязательные поля шага — пути `$model`. */
  readonly required: readonly string[];
  /** Все пути `$model` полей и массивов шага — по ним правила валидации делятся по шагам. */
  readonly fields: readonly string[];
  /** Все селекторы поддерева шага, включая сам шаг, — по ним делятся правила узлов. */
  readonly selectors: readonly string[];
  /** Секции шага (кандидаты на `hideWhen`), включая сам шаг. */
  readonly sections: readonly { readonly selector: string; readonly label: string }[];
  /** Короткое имя шага для локальных имён в коде: `step1`, `step2`, … */
  readonly alias: string;
  /** Псевдоним правил шага в потоке: `kontaktyRules`. Уникален среди шагов. */
  readonly rulesAlias: string;
  /**
   * Спецификатор файла схемы шага из `$ref` корня — у шага, вынесенного в свой файл; иначе `null`.
   */
  readonly schemaRef: string | null;
  /** Пути файлов шага от корня модуля. */
  readonly files: {
    /** Правила шага: `validation/<slug>.ts`. */
    readonly validation: string;
    /**
     * Файл схемы шага — только у вынесенного шага, лежащего по канону
     * `steps/<dir>/form.schema.json` рядом с корневым документом; файл в другом месте кодоген
     * не печатает — он остаётся, где был.
     */
    readonly schema: string | null;
    /**
     * Файл, на который указывает ссылка корня, — где бы он ни лежал: его импортирует сборка
     * (`application/create.ts`). `null` у шага, не вынесенного в файл.
     */
    readonly schemaSource: string | null;
  };
}

export interface ModuleLayout {
  readonly kind: 'simple' | 'wizard';
  /** Шаги визарда по порядку; пусто у простой формы. */
  readonly steps: readonly StepInfo[];
}

/**
 * Собрать пути `$model` и селекторы поддерева шага одним обходом.
 *
 * Подформа (`{ model, part }`) — поле шага своей ГРУППОЙ: правило на `registrationAddress.city`
 * относится к шагу, где группа `registrationAddress` смонтирована (пути сверяются с вложенностью,
 * см. `stepOfRule`). В разметку части обход не идёт: её узлы живут в области части, и правила по
 * их селекторам печатаются в поведении части, а не в группе шага.
 */
function scan(step: JsonNode): { fields: string[]; selectors: string[] } {
  const fields: string[] = [];
  const selectors: string[] = [];
  const visit = (node: JsonNode): void => {
    const selector = (node as { selector?: unknown }).selector;
    if (typeof selector === 'string' && selector !== '') selectors.push(selector);
    if (isArrayNode(node) || isPartNode(node) || isFieldNode(node)) {
      const parsed = parseOperator(node.model);
      if (parsed?.op === 'model') fields.push(parsed.arg);
      return;
    }
    if (isContainerNode(node)) {
      // Вложенный визард держит шаги в тех же `children`.
      node.children?.forEach((child) => {
        if (isNodeLike(child)) visit(child);
      });
    }
  };
  visit(step);
  return { fields: [...new Set(fields)], selectors: [...new Set(selectors)] };
}

/** Имя, свободное среди занятых: `base`, `base2`, `base3`… Найденное сразу занимается. */
function uniqueAlias(base: string, taken: Set<string>): string {
  let name = base;
  for (let n = 2; taken.has(name); n += 1) name = `${base}${n}`;
  taken.add(name);
  return name;
}

/**
 * Раскладка модуля по схеме С ПРОСТАВЛЕННЫМИ селекторами.
 *
 * Селекторы нужны уже проставленные: имя шага, у которого нет заголовка, берётся из его
 * селектора, и оно обязано совпадать с тем, что уйдёт в документ формы.
 *
 * У шага, вынесенного в файл, папка — та, где лежит его схема (`composition`), а не слаг
 * заголовка: переименование шага не разводит код шага и его схему по разным именам. Такие папки
 * занимаются первыми, остальные разводятся с ними и с зарезервированными именами.
 *
 * @param schemaPath - Путь корневого документа внутри модуля: от него считается место файлов шагов.
 */
export function layoutOf(
  schema: JsonFormSchema,
  collected: Collected,
  selectors: SelectorInfo,
  composition: SplitFormSchema | null = null,
  schemaPath: string = DEFAULT_SCHEMA_PATH
): ModuleLayout {
  const nodes = isNodeLike(schema.root) ? wizardStepsOf(schema.root) : [];
  if (nodes.length === 0) return { kind: 'simple', steps: [] };

  const refs = composition === null ? [] : firstWizardStepRefs(composition.skeleton);
  const refDirs = refs.map((ref) => (ref === null ? null : stepDirOfRef(ref)));
  const taken = new Set<string>([
    ...RESERVED_STEP_NAMES,
    ...refDirs.filter((dir): dir is string => dir !== null),
  ]);
  // Имя шага из ссылки — его папка; занявшая зарезервированное имя разводится суффиксом ДО
  // остальных шагов, чтобы шаг с заголовком не успел забрать `form-2` первым.
  const refSlugs = refDirs.map((dir) =>
    dir === null ? null : RESERVED_STEP_NAMES.includes(dir) ? uniqueStepDir(dir, taken) : dir
  );
  const aliases = new Set<string>();
  const schemaDir = schemaDirOf(schemaPath);

  const steps = nodes.map((node, i): StepInfo => {
    const index = i + 1;
    const raw = node as {
      selector?: unknown;
      $nodeId?: unknown;
      componentProps?: { title?: unknown };
    };
    const selector = typeof raw.selector === 'string' && raw.selector !== '' ? raw.selector : null;
    const title = raw.componentProps?.title;

    const refDir = refDirs[i] ?? null;
    const dir = refDir ?? uniqueStepDir(stepDirName(index, title, selector), taken);
    const slug = refSlugs[i] ?? dir;
    const schemaRef = refs[i] ?? null;

    const { fields, selectors: subtree } = scan(node);
    const own = new Set(subtree);
    return {
      index,
      dir,
      slug,
      title:
        typeof title === 'string' && title !== '' && !isOperatorText(title)
          ? title
          : `Шаг ${index}`,
      selector,
      nodeId: typeof raw.$nodeId === 'string' ? raw.$nodeId : null,
      required: [...new Set(collected.steps[i]?.required ?? [])],
      fields,
      selectors: subtree,
      sections: selectors.sections.filter((section) => own.has(section.selector)),
      alias: `step${index}`,
      rulesAlias: uniqueAlias(stepRulesAlias(slug), aliases),
      schemaRef,
      files: {
        validation: stepValidationPath(slug),
        schema: refDir === null ? null : stepSchemaPath(schemaPath, refDir),
        schemaSource: schemaRef === null ? null : `${schemaDir}${normalizeStepRef(schemaRef)}`,
      },
    };
  });
  return { kind: 'wizard', steps };
}
