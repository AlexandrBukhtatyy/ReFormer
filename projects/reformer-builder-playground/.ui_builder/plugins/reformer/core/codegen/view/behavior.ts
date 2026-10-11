/**
 * Поведение формы — одна модель вида на `behavior/index.ts`.
 *
 * Поведение у формы ЕДИНСТВЕННОЕ: и связи над моделью (`compute`, `copyFrom`, `enableWhen`), и
 * правила узлов схемы (`hideWhen`, события, пропсы). Отдельного слоя рендера (`form.render.ts` и
 * `steps/<шаг>/form.render.ts`) больше нет — его правила печатаются здесь же, сгруппированные по
 * шагам комментарием.
 *
 * ## Почему разбор правил здесь, а не в шаблоне
 *
 * Вид правила выбирает форму строки целиком: `hideWhen` — одна строка, `patchProps` — вызов
 * с литералом пропсов, событие — блок из четырёх и более. А внутри `patchProps` ещё одно
 * решение, которое шаблон принять не может в принципе: `$expr(...)` вставляется ВЫРАЖЕНИЕМ,
 * всё остальное — JSON. Без него строку `"model.total"` не отличить от намерения подставить это
 * значение, и правило, которое выглядит правильно, молча кладёт в проп текст.
 *
 * ## Параметры области — по тексту тела
 *
 * Тело поведения — функция над областью `{ model, form, schema, flow }`. Модуль собирается с
 * `noUnusedParameters`, поэтому деструктурируется только то, чем тело пользуется. Условия правил —
 * свободный текст, и узнать, что он читает, можно только по самому тексту: ищется имя как слово,
 * вне строковых литералов и не как свойство (`event.model` областью не является).
 *
 * ## Области: корень и строки массивов
 *
 * Области схемы изолированы. Корневое поведение видит через `schema.node(…)` только узлы
 * корневого дерева; узлы шаблона строки массива живут в области СТРОКИ и адресуются из её
 * поведения — `applyEach(model.$.items, поведениеСтроки)`. Там же другая модель: `model` в
 * поведении строки — модель одной строки, а не всей формы. Правило узла, напечатанное не в своей
 * области, не делает ничего (ядро пишет об этом предупреждение), а его условие читает не ту
 * модель. Поэтому по схеме строится дерево областей, правило уходит в поведение области своего
 * узла, а родительская область подключает поведение строки. Поведение строки печатается только
 * там, где у строки (или у вложенной в неё) есть правила.
 *
 * Области подформ (узел `part` и массив с `item: "$part(…)"`) кодоген не строит: разметку
 * именованных частей документа он не обходит вовсе — ни типы, ни селекторы. Правило по селектору,
 * которого нет ни в корневом дереве, ни в шаблонах строк, печатается в корне, как и раньше.
 *
 * ## Строки без отступа
 *
 * Строки относительные, а глубину ставит шаблон одним `indent(lines, 2)` — там, где она видна
 * вместе с окружающим кодом.
 *
 * @module plugins/reformer/core/codegen/view/behavior
 */

import {
  isArrayNode,
  isContainerNode,
  parseOperator,
  type JsonNode,
} from '@reformer/renderer-json';
import { isNodeLike } from '../../form-model/node-kind';
import { hasBehaviorRules, type RenderRuleIntent } from '../../form-model/rules';
import type { EmitContext } from '../context';
import { behaviorFromRules } from '../emit/rules-bridge';
import { camel, pascal } from '../naming';

/** Параметры области поведения — в порядке, в котором они деструктурируются. */
const SCOPE_PARAMS = ['model', 'form', 'schema', 'flow'] as const;

/** Строковые литералы в одинарных и двойных кавычках. Шаблонные строки не трогаем: в них `${…}`. */
const QUOTED = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g;

/**
 * Читает ли код имя `name` как переменную.
 *
 * Строковые литералы вырезаются: подпись `"Contact form"` в пропсах не делает `form` читаемым.
 * Обращение к свойству (`event.model`) и часть другого имени (`formData`) — тоже не чтение.
 */
export function mentions(code: string, name: string): boolean {
  return new RegExp(`(?<![.\\w$])${name}\\b`).test(code.replace(QUOTED, "''"));
}

/** Параметры области, которыми пользуются строки кода. */
export function scopeParamsOf(lines: readonly string[]): readonly string[] {
  const code = lines.join('\n');
  return SCOPE_PARAMS.filter((name) => mentions(code, name));
}

/** Ключ объектного литерала: идентификатор — как есть, всё прочее — строкой. */
function propKey(key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
}

/** Литерал пропсов для `patchProps`: `$expr(...)` — выражением, остальное — JSON. */
function propsLiteral(props: Record<string, unknown>): string {
  const parts = Object.entries(props).map(([key, value]) => {
    if (typeof value === 'string' && value.startsWith('$expr(') && value.endsWith(')')) {
      return `${propKey(key)}: ${value.slice('$expr('.length, -1)}`;
    }
    return `${propKey(key)}: ${JSON.stringify(value)}`;
  });
  return `{ ${parts.join(', ')} }`;
}

/** Строки одного правила узла, относительно своего блока. */
function ruleLines(rule: RenderRuleIntent): readonly string[] {
  const node = `schema.node('${rule.selector}')`;
  switch (rule.kind) {
    case 'hideWhen':
      return [`hideWhen(${node}, () => ${rule.condition});`];
    case 'onEvent': {
      const head = rule.async === true ? 'async (...args: unknown[])' : '(...args: unknown[])';
      // `void args` обязателен: сгенерированный модуль собирается с `noUnusedParameters`,
      // и обработчик, не использующий аргументы, стал бы ошибкой компиляции у пользователя.
      return [
        `onComponentEvent(${node}, '${rule.event}', ${head} => {`,
        '  void args;',
        ...rule.body.split('\n').map((line) => `  ${line}`),
        '});',
      ];
    }
    case 'patchProps':
      return [`${node}.patchProps(${propsLiteral(rule.props)});`];
  }
}

/** Секция без правила видимости — ей достаётся закомментированная подсказка с реальным адресом. */
export interface ScaffoldSectionView {
  readonly selector: string;
  readonly label: string;
}

/** Группа правил узлов: узлы вне шагов либо узлы одного шага. */
export interface BehaviorGroupView {
  /** Шаг, чьи узлы обслуживает группа: заголовок для комментария. `null` — узлы вне шагов. */
  readonly step: { readonly index: number; readonly title: string } | null;
  /** Правила по порядку; строки внутри — без отступа. */
  readonly rules: readonly { readonly lines: readonly string[] }[];
  /** Закомментированные заготовки `hideWhen` для секций без правила видимости. */
  readonly scaffold: readonly ScaffoldSectionView[];
}

/**
 * Поведение строки массива: правила узлов шаблона строки и подключение вложенных строк.
 *
 * Печатается константой до корневой функции; строки вложенного массива — раньше строк внешнего,
 * чтобы константа была объявлена к моменту использования.
 */
export interface RowBehaviorView {
  /** Имя константы поведения: `referencesRow`. */
  readonly name: string;
  /** Имя типа строки: `ReferencesRow`. */
  readonly typeName: string;
  /** Выражение типа строки от типа родительской области: `ContactForm['references'][number]`. */
  readonly typeExpr: string;
  /** Путь массива от корня формы — для комментария: `references`, `references[].phones`. */
  readonly path: string;
  /** Параметры области, которыми пользуется тело. */
  readonly scope: readonly string[];
  /** Правила узлов строки по порядку; строки внутри — без отступа. */
  readonly rules: readonly { readonly lines: readonly string[] }[];
  /** Закомментированные заготовки `hideWhen` для секций строки без правила видимости. */
  readonly scaffold: readonly ScaffoldSectionView[];
  /** Подключение поведений вложенных строк: `applyEach(model.$.phones, referencesPhonesRow);`. */
  readonly applies: readonly string[];
}

/** Поведение формы глазами шаблона. */
export interface BehaviorView {
  /** Имена для импорта из `@reformer/core/behaviors`: по алфавиту и только нужные телу. */
  readonly imports: readonly string[];
  /**
   * Параметры области поведения, которыми пользуется тело (`model`, `form`, `schema`, `flow`).
   * Пусто — исполняемых строк нет, и параметр функции печатается неиспользуемым (`_scope`).
   */
  readonly scope: readonly string[];
  /** Связи над моделью из правил формы — строки без отступа. */
  readonly links: readonly string[];
  /** Правила узлов схемы: группа узлов вне шагов, затем по группе на шаг. Пустые группы опущены. */
  readonly groups: readonly BehaviorGroupView[];
  /** Поведения строк массивов — в порядке объявления (вложенные раньше внешних). */
  readonly rows: readonly RowBehaviorView[];
  /** Подключение поведений строк из корня: `applyEach(model.$.references, referencesRow);`. */
  readonly applies: readonly string[];
  /** Есть ли в теле исполняемые строки. Без них шаблон печатает заготовку с примером. */
  readonly hasCode: boolean;
}

/** Операторы узлов, которыми пользуются правила. */
function nodeOperators(rules: readonly RenderRuleIntent[]): readonly string[] {
  const kinds = new Set(rules.map((rule) => rule.kind));
  const operators: string[] = [];
  if (kinds.has('hideWhen')) operators.push('hideWhen');
  if (kinds.has('onEvent')) operators.push('onComponentEvent');
  return operators;
}

/** Область строки массива: селекторы узлов шаблона строки и вложенные области. */
interface RowScope {
  /** Путь массива от модели родительской области (`model.$.<path>`). */
  readonly path: string;
  readonly selectors: Set<string>;
  readonly children: RowScope[];
}

/**
 * Дерево областей схемы: селекторы корневого дерева и области строк массивов.
 *
 * Сам узел-массив принадлежит РОДИТЕЛЬСКОЙ области (его рисует она), а его шаблон строки — уже
 * области строки. Массив, чей `item` — ссылка на часть документа, области не даёт: разметка
 * частей не обходится. Массив без разбираемой привязки области тоже не даёт — подключить её
 * было бы не к чему, и узлы шаблона остаются в родительской.
 */
function scopesOf(root: unknown): RowScope {
  const top: RowScope = { path: '', selectors: new Set(), children: [] };
  const visit = (node: JsonNode, scope: RowScope): void => {
    const raw = node as { selector?: unknown; wrapper?: unknown };
    if (typeof raw.selector === 'string' && raw.selector !== '') scope.selectors.add(raw.selector);
    if (isNodeLike(raw.wrapper)) visit(raw.wrapper, scope);

    if (isArrayNode(node)) {
      const item: unknown = node.item;
      const template =
        typeof item === 'object' && item !== null
          ? (item as { $template?: unknown }).$template
          : undefined;
      if (!isNodeLike(template)) return;
      const parsed = parseOperator(node.model);
      if (parsed?.op !== 'model') {
        visit(template, scope);
        return;
      }
      const row: RowScope = { path: parsed.arg, selectors: new Set(), children: [] };
      scope.children.push(row);
      visit(template, row);
      return;
    }
    if (isContainerNode(node)) {
      for (const child of node.children ?? []) if (isNodeLike(child)) visit(child, scope);
    }
  };
  if (isNodeLike(root)) visit(root, top);
  return top;
}

/** Все селекторы области строки вместе с вложенными. */
function selectorsWithin(scope: RowScope, into: Set<string> = new Set()): Set<string> {
  for (const selector of scope.selectors) into.add(selector);
  for (const child of scope.children) selectorsWithin(child, into);
  return into;
}

/** Выражение типа строки: `Родитель['путь']['массива'][number]`. */
function rowTypeExpr(parentType: string, path: string): string {
  const access = path
    .split('.')
    .map((segment) => `['${segment}']`)
    .join('');
  return `${parentType}${access}[number]`;
}

/** Имя, свободное среди занятых: `row`, `row2`, `row3`… */
function unique(base: string, taken: Set<string>): string {
  let name = base;
  for (let i = 2; taken.has(name); i += 1) name = `${base}${i}`;
  taken.add(name);
  return name;
}

/**
 * Собрать модель файла поведения.
 *
 * Зовётся лениво (см. `RulesView` в `./index`): связи печатает билдер `@reformer/mcp`, и его
 * отказ обязан остаться отказом одной цели, а не сборки вида.
 */
export function behaviorView(ctx: EmitContext): BehaviorView {
  const links = hasBehaviorRules(ctx.rules)
    ? behaviorFromRules(ctx.rules, ctx.names)
    : { operators: [], lines: [] };

  const render = ctx.rules.render;
  const hidden = new Set(
    render.filter((rule) => rule.kind === 'hideWhen').map((rule) => rule.selector)
  );
  const owned = new Set(ctx.layout.steps.flatMap((step) => step.selectors));

  // Области строк массивов. Правило уходит в поведение области своего узла; поведение строки
  // печатается, только если у неё или у вложенной в неё строки есть правила.
  const scopes = scopesOf(ctx.schema.root);
  const inRows = new Set<string>();
  for (const row of scopes.children) selectorsWithin(row, inRows);
  const rows: RowBehaviorView[] = [];
  const taken = new Set<string>(['behaviorRules', 'formBehavior', ctx.names.TypeName]);

  /** Поведение строки и её вложенных строк; отдаёт строку подключения либо `null`. */
  const buildRow = (
    row: RowScope,
    parentType: string,
    parentWords: readonly string[],
    parentPath: string
  ): string | null => {
    const words = [...parentWords, ...row.path.split('.')];
    const fullPath = parentPath === '' ? row.path : `${parentPath}[].${row.path}`;
    const own = render.filter((rule) => row.selectors.has(rule.selector));
    // Имена занимаются до вложенных: у внешней строки оно короче и читается первым.
    const name = unique(`${camel(words.join('-'))}Row`, taken);
    const typeName = unique(`${pascal(words.join('-'))}Row`, taken);
    const applies = row.children
      .map((child) => buildRow(child, typeName, words, fullPath))
      .filter((line): line is string => line !== null);
    if (own.length === 0 && applies.length === 0) return null;

    const rules = own.map((rule) => ({ lines: ruleLines(rule) }));
    rows.push({
      name,
      typeName,
      typeExpr: rowTypeExpr(parentType, row.path),
      path: fullPath,
      scope: scopeParamsOf([...rules.flatMap((rule) => rule.lines), ...applies]),
      rules,
      scaffold: ctx.selectors.sections
        .filter((section) => row.selectors.has(section.selector) && !hidden.has(section.selector))
        .map((section) => ({ selector: section.selector, label: section.label })),
      applies,
    });
    return `applyEach(model.$.${row.path}, ${name});`;
  };
  const applies = scopes.children
    .map((row) => buildRow(row, ctx.names.TypeName, [], ''))
    .filter((line): line is string => line !== null);

  const groupOf = (
    step: BehaviorGroupView['step'],
    rules: readonly RenderRuleIntent[],
    sections: readonly ScaffoldSectionView[]
  ): BehaviorGroupView => ({
    step,
    rules: rules.map((rule) => ({ lines: ruleLines(rule) })),
    scaffold: sections
      .filter((section) => !hidden.has(section.selector))
      .map((section) => ({ selector: section.selector, label: section.label })),
  });

  const groups = [
    groupOf(
      null,
      render.filter((rule) => !owned.has(rule.selector) && !inRows.has(rule.selector)),
      ctx.selectors.sections.filter(
        (section) => !owned.has(section.selector) && !inRows.has(section.selector)
      )
    ),
    ...ctx.layout.steps.map((step) => {
      const own = new Set(step.selectors);
      return groupOf(
        { index: step.index, title: step.title },
        render.filter((rule) => own.has(rule.selector)),
        step.sections
      );
    }),
  ].filter((group) => group.rules.length > 0 || group.scaffold.length > 0);

  // Параметры области корня — по коду КОРНЯ: тело строки читает свою область, а не корневую.
  const code = [
    ...links.lines,
    ...groups.flatMap((g) => g.rules.flatMap((rule) => rule.lines)),
    ...applies,
  ];
  const operators = new Set<string>([...links.operators, ...nodeOperators(render)]);
  if (rows.length > 0) operators.add('applyEach');

  return {
    imports: [...operators, 'defineFormBehavior'].sort(),
    scope: scopeParamsOf(code),
    links: links.lines,
    groups,
    rows,
    applies,
    hasCode: code.length > 0,
  };
}
