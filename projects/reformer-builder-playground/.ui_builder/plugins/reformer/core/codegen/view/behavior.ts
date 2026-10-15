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
 * ## Области: корень, строки массивов и части документа
 *
 * Области схемы изолированы. Корневое поведение видит через `schema.node(…)` только узлы
 * корневого дерева; узлы шаблона строки массива живут в области СТРОКИ и адресуются из её
 * поведения — `applyEach(model.$.items, поведениеСтроки)`. Там же другая модель: `model` в
 * поведении строки — модель одной строки, а не всей формы. Правило узла, напечатанное не в своей
 * области, не делает ничего (ядро пишет об этом предупреждение), а его условие читает не ту
 * модель. Поэтому по схеме строятся области, правило уходит в поведение области своего узла, а
 * родительская область подключает поведение вложенной. Поведение вложенной области печатается
 * только там, где правила есть у неё самой или у области, вложенной в неё.
 *
 * Именованная часть документа (`parts`) — такая же область, только ОБЩАЯ: её разметка одна, а
 * подключений сколько угодно. Поведение части печатается один раз и подключается оттуда, где часть
 * смонтирована:
 *
 * ```text
 * { model: '$model(home)', part: '$part(address)' }      apply(model.$.home, addressPart)
 * две подформы одной части в одной области               apply([model.$.home, model.$.work], addressPart)
 * { model: '$model(guests)', item: '$part(guest)' }      applyEach(model.$.guests, guestPart)
 * ```
 *
 * Тип области части берётся от ПЕРВОГО подключения (`Форма['home']`): тип формы вписывает части
 * структурно, и все подключения одной части дают один и тот же тип. Из-за общих областей граф
 * областей — не дерево: часть может подключать саму себя (дерево категорий), и тогда поведение
 * части подключает само себя.
 *
 * Правило по селектору, которого нет ни в корневом дереве, ни в достижимых из него областях
 * (опечатка либо узел части, которая нигде не подключена), печатается в корне, как и раньше.
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
  isPartNode,
  parseOperator,
  type JsonFormSchema,
  type JsonNode,
} from '@reformer/renderer-json';
import { isNodeLike } from '../../form-model/node-kind';
import { documentParts, partNameOf, rowTemplateOf } from '../../form-model/query';
import { hasBehaviorRules, type RenderRuleIntent } from '../../form-model/rules';
import type { EmitContext } from '../context';
import { behaviorFromRules } from '../emit/rules-bridge';
import { camel, pascal } from '../naming';
import {
  formatBody,
  formatStatement,
  parseExpression,
  printChainCall,
  propertyKey,
  quote,
  valueNode,
  type JsNode,
} from '../print/js';

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

/**
 * Глубина, на которой строки правил лягут в файл: тело функции поведения и тело поведения строки
 * — один уровень. Под неё строки и укладываются по ширине.
 */
const BODY_INDENT = 2;

/** Литерал пропсов для `patchProps`: `$expr(...)` — выражением, остальное — значением. */
function propsNode(props: Record<string, unknown>): Extract<JsNode, { kind: 'object' }> {
  return {
    kind: 'object',
    expanded: false,
    props: Object.entries(props).map(([key, value]) => ({
      key: propertyKey(key),
      value:
        typeof value === 'string' && value.startsWith('$expr(') && value.endsWith(')')
          ? parseExpression(value.slice('$expr('.length, -1))
          : valueNode(value),
    })),
  };
}

/**
 * Строки одного правила узла, относительно своего блока.
 *
 * Уложены под ширину строки ({@link BODY_INDENT}): длинное правило рвётся по аргументам так же,
 * как его порвал бы prettier. Условие и тело обработчика — текст человека: он печатается как
 * есть и внутри не рвётся.
 */
function ruleLines(rule: RenderRuleIntent): readonly string[] {
  const node = `schema.node(${quote(rule.selector)})`;
  const options = { indent: BODY_INDENT };
  switch (rule.kind) {
    case 'hideWhen':
      return formatStatement(`hideWhen(${node}, () => ${rule.condition});`, options).split('\n');
    case 'onEvent': {
      const head = rule.async === true ? 'async (...args: unknown[])' : '(...args: unknown[])';
      // `void args` обязателен: сгенерированный модуль собирается с `noUnusedParameters`,
      // и обработчик, не использующий аргументы, стал бы ошибкой компиляции у пользователя.
      const code = [
        `onComponentEvent(${node}, ${quote(rule.event)}, ${head} => {`,
        '  void args;',
        ...rule.body.split('\n').map((line) => `  ${line}`),
        '});',
      ].join('\n');
      return formatStatement(code, options).split('\n');
    }
    case 'patchProps':
      return printChainCall(`${node}.patchProps`, propsNode(rule.props), options).split('\n');
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
 * Поведение вложенной области — строки массива либо именованной части документа: правила её узлов
 * и подключение областей, вложенных в неё.
 *
 * Печатается константой до корневой функции; вложенная область — раньше внешней, чтобы константа
 * была объявлена к моменту использования. Поведение части печатается ОДИН раз, сколько бы раз
 * часть ни была подключена.
 */
export interface RowBehaviorView {
  /** Вид области: строка массива с шаблоном, вписанным в узел, либо часть документа. */
  readonly kind: 'row' | 'part';
  /** Имя части документа — у области части; у строки `null`. */
  readonly part: string | null;
  /** Имя константы поведения: `referencesRow`, у части — `addressPart`. */
  readonly name: string;
  /** Имя типа области: `ReferencesRow`, у части — `AddressPart`. */
  readonly typeName: string;
  /**
   * Выражение типа области от типа родительской: `ContactForm['references'][number]`. У части — от
   * ПЕРВОГО подключения: `ContactForm['registrationAddress']` (подформа) либо
   * `ContactForm['coBorrowers'][number]` (шаблон строки).
   */
  readonly typeExpr: string;
  /**
   * Путь от корня формы — для комментария: `references`, `references[].phones`. У части — путь её
   * первого подключения.
   */
  readonly path: string;
  /** Параметры области, которыми пользуется тело. */
  readonly scope: readonly string[];
  /** Правила узлов области по порядку; строки внутри — без отступа. */
  readonly rules: readonly { readonly lines: readonly string[] }[];
  /** Закомментированные заготовки `hideWhen` для секций области без правила видимости. */
  readonly scaffold: readonly ScaffoldSectionView[];
  /**
   * Подключение поведений вложенных областей: `applyEach(model.$.phones, referencesPhonesRow);`,
   * `apply(model.$.address, addressPart);`.
   */
  readonly applies: readonly string[];
  /** Есть ли среди {@link RowBehaviorView.applies} подключения частей документа. */
  readonly appliesParts: boolean;
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
  /**
   * Поведения вложенных областей — строк массивов и частей документа — в порядке объявления
   * (вложенные раньше внешних).
   */
  readonly rows: readonly RowBehaviorView[];
  /**
   * Подключение вложенных областей из корня: `applyEach(model.$.references, referencesRow);`,
   * `apply([model.$.registrationAddress, model.$.residenceAddress], addressPart);`.
   */
  readonly applies: readonly string[];
  /** Есть ли среди {@link BehaviorView.applies} подключения строк массивов. */
  readonly appliesRows: boolean;
  /** Есть ли среди {@link BehaviorView.applies} подключения частей документа. */
  readonly appliesParts: boolean;
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

/** Область схемы: селекторы её узлов и подключения вложенных областей. */
interface Scope {
  /** `root` — дерево корня, `row` — шаблон строки, вписанный в узел-массив, `part` — часть. */
  readonly kind: 'root' | 'row' | 'part';
  /** Имя части документа — у области части. */
  readonly part: string | null;
  readonly selectors: Set<string>;
  /** Подключения вложенных областей — в порядке обхода разметки. */
  readonly links: ScopeLink[];
}

/** Подключение вложенной области к родительской. */
interface ScopeLink {
  /** Путь от модели родительской области (`model.$.<path>`). */
  readonly path: string;
  /** `rows` — строки массива (`applyEach`), `group` — подформа под группой модели (`apply`). */
  readonly via: 'rows' | 'group';
  readonly scope: Scope;
}

/**
 * Дерево областей схемы: селекторы корневого дерева, области строк массивов и области частей.
 *
 * Сам узел-массив и узел-подформа принадлежат РОДИТЕЛЬСКОЙ области (их рисует она), а шаблон
 * строки и разметка части — уже вложенной. Область части одна на документ, сколько бы раз часть ни
 * подключалась: поэтому это не дерево, а граф, и часть, подключающая саму себя, даёт в нём цикл.
 * Ссылка на часть, которой в документе нет, области не даёт. Массив без разбираемой привязки
 * области тоже не даёт — подключить её было бы не к чему, и узлы шаблона остаются в родительской.
 */
function scopesOf(schema: JsonFormSchema): Scope {
  const parts = documentParts(schema);
  const partScopes = new Map<string, Scope>();
  const top: Scope = { kind: 'root', part: null, selectors: new Set(), links: [] };

  const visit = (node: JsonNode, scope: Scope): void => {
    const raw = node as { selector?: unknown; wrapper?: unknown };
    if (typeof raw.selector === 'string' && raw.selector !== '') scope.selectors.add(raw.selector);
    if (isNodeLike(raw.wrapper)) visit(raw.wrapper, scope);

    if (isArrayNode(node)) {
      const parsed = parseOperator(node.model);
      const name = partNameOf(node.item);
      if (name !== undefined) {
        const target = partScope(name);
        if (target !== undefined && parsed?.op === 'model') {
          scope.links.push({ path: parsed.arg, via: 'rows', scope: target });
        }
        return;
      }
      const template = rowTemplateOf(node, parts)?.node;
      if (template === undefined) return;
      if (parsed?.op !== 'model') {
        visit(template, scope);
        return;
      }
      const row: Scope = { kind: 'row', part: null, selectors: new Set(), links: [] };
      scope.links.push({ path: parsed.arg, via: 'rows', scope: row });
      visit(template, row);
      return;
    }
    if (isPartNode(node)) {
      const parsed = parseOperator(node.model);
      const name = partNameOf(node.part);
      const target = name === undefined ? undefined : partScope(name);
      if (target !== undefined && parsed?.op === 'model') {
        scope.links.push({ path: parsed.arg, via: 'group', scope: target });
      }
      return;
    }
    if (isContainerNode(node)) {
      for (const child of node.children ?? []) if (isNodeLike(child)) visit(child, scope);
    }
  };

  /** Область части: строится при первой ссылке и дальше отдаётся та же. */
  function partScope(name: string): Scope | undefined {
    const known = partScopes.get(name);
    if (known !== undefined) return known;
    const markup = parts.get(name);
    if (markup === undefined) return undefined;
    const scope: Scope = { kind: 'part', part: name, selectors: new Set(), links: [] };
    // Заносится ДО обхода разметки: часть, подключающая себя, получит эту же область, а не
    // бесконечную цепочку новых.
    partScopes.set(name, scope);
    visit(markup, scope);
    return scope;
  }

  if (isNodeLike(schema.root)) visit(schema.root, top);
  return top;
}

/** Области, до которых корень дотягивается подключениями, — без него самого, в порядке обхода. */
function nestedScopes(root: Scope): readonly Scope[] {
  const seen = new Set<Scope>([root]);
  const out: Scope[] = [];
  const walk = (scope: Scope): void => {
    for (const link of scope.links) {
      if (seen.has(link.scope)) continue;
      seen.add(link.scope);
      out.push(link.scope);
      walk(link.scope);
    }
  };
  walk(root);
  return out;
}

/** Обращение к типу по пути модели: `['путь']['группы']`. */
function typeAccess(path: string): string {
  return path
    .split('.')
    .map((segment) => `['${segment}']`)
    .join('');
}

/** Имя, свободное среди занятых: `row`, `row2`, `row3`… */
function unique(base: string, taken: Set<string>): string {
  let name = base;
  for (let i = 2; taken.has(name); i += 1) name = `${base}${i}`;
  taken.add(name);
  return name;
}

/** Вложенная область, уже получившая имена: ими её подключают родители. */
interface Declared {
  readonly name: string;
  readonly typeName: string;
}

/** Область глазами тех, кого она подключает: её тип, слова имени и путь для комментария. */
interface Parent {
  readonly typeName: string;
  readonly words: readonly string[];
  /** Префикс пути вложенных областей: пусто у корня, `references[].` у строки массива. */
  readonly prefix: string;
}

/**
 * Собрать модель файла поведения.
 *
 * Зовётся лениво (см. `RulesView` в `./index`): связи печатает билдер `@reformer/mcp`, и его
 * отказ обязан остаться отказом одной цели, а не сборки вида.
 */
export function behaviorView(ctx: EmitContext): BehaviorView {
  const emitted = hasBehaviorRules(ctx.rules)
    ? behaviorFromRules(ctx.rules, ctx.names)
    : { operators: [], lines: [] };
  // Билдер связей печатает каждую одной строкой — под ширину их укладываем здесь.
  const links = {
    operators: emitted.operators,
    lines: formatBody(emitted.lines, { indent: BODY_INDENT }),
  };

  const render = ctx.rules.render;
  const hidden = new Set(
    render.filter((rule) => rule.kind === 'hideWhen').map((rule) => rule.selector)
  );
  const owned = new Set(ctx.layout.steps.flatMap((step) => step.selectors));

  // Вложенные области: строки массивов и части документа. Правило уходит в поведение области
  // своего узла; поведение области печатается, только если правила есть у неё самой или у области,
  // вложенной в неё.
  const root = scopesOf(ctx.schema);
  const nested = nestedScopes(root);
  const inNested = new Set<string>();
  for (const scope of nested) for (const selector of scope.selectors) inNested.add(selector);
  const ownRules = (scope: Scope): readonly RenderRuleIntent[] =>
    render.filter((rule) => scope.selectors.has(rule.selector));

  // «Есть что печатать» — достижимость области с правилами. Считается неподвижной точкой, а не
  // рекурсией: граф областей бывает с циклом (часть подключает саму себя).
  const active = new Set<Scope>(nested.filter((scope) => ownRules(scope).length > 0));
  for (let grown = true; grown; ) {
    grown = false;
    for (const scope of nested) {
      if (active.has(scope) || !scope.links.some((link) => active.has(link.scope))) continue;
      active.add(scope);
      grown = true;
    }
  }

  const rows: RowBehaviorView[] = [];
  const taken = new Set<string>(['behaviorRules', 'formBehavior', ctx.names.TypeName]);
  const declared = new Map<Scope, Declared>();
  const operators = new Set<string>();

  /**
   * Занять имена строки, которая не печатается, и строк, вложенных в неё.
   *
   * Имя строки зависит от её места, а не от того, есть ли у неё правила: иначе первое же правило
   * в соседнем массиве с тем же путём переименовало бы уже напечатанную константу.
   */
  const reserve = (link: ScopeLink, parentWords: readonly string[]): void => {
    if (link.scope.part !== null) return;
    const words = [...parentWords, ...link.path.split('.')];
    unique(`${camel(words.join('-'))}Row`, taken);
    unique(`${pascal(words.join('-'))}Row`, taken);
    for (const child of link.scope.links) reserve(child, words);
  };

  /**
   * Объявить область по её ПЕРВОМУ подключению и отдать её имена. Область части объявляется один
   * раз: следующие подключения (и подключение частью самой себя) получают те же имена.
   */
  const declare = (link: ScopeLink, parent: Parent): Declared => {
    const known = declared.get(link.scope);
    if (known !== undefined) return known;

    const { scope } = link;
    const words = scope.part === null ? [...parent.words, ...link.path.split('.')] : [scope.part];
    const suffix = scope.part === null ? 'Row' : 'Part';
    // Имена занимаются до вложенных: у внешней области оно короче и читается первым.
    const self: Declared = {
      name: unique(`${camel(words.join('-'))}${suffix}`, taken),
      typeName: unique(`${pascal(words.join('-'))}${suffix}`, taken),
    };
    declared.set(scope, self);

    const path = `${parent.prefix}${link.path}`;
    const applies = appliesOf(scope, {
      typeName: self.typeName,
      words,
      prefix: link.via === 'rows' ? `${path}[].` : `${path}.`,
    });
    const rules = ownRules(scope).map((rule) => ({ lines: ruleLines(rule) }));
    rows.push({
      kind: scope.part === null ? 'row' : 'part',
      part: scope.part,
      name: self.name,
      typeName: self.typeName,
      typeExpr: `${parent.typeName}${typeAccess(link.path)}${link.via === 'rows' ? '[number]' : ''}`,
      path,
      scope: scopeParamsOf([...rules.flatMap((rule) => rule.lines), ...applies.lines]),
      rules,
      scaffold: ctx.selectors.sections
        .filter((section) => scope.selectors.has(section.selector) && !hidden.has(section.selector))
        .map((section) => ({ selector: section.selector, label: section.label })),
      applies: applies.lines,
      appliesParts: applies.parts,
    });
    return self;
  };

  /**
   * Строки подключения вложенных областей — в порядке разметки, только области с правилами.
   *
   * Подформы одной части в одной области подключаются ОДНИМ вызовом со списком групп — на месте
   * первой из них. Повтор того же пути (два узла на одну группу либо на один массив) второй раз
   * не подключается: поведение применилось бы к той же модели дважды.
   */
  function appliesOf(
    scope: Scope,
    self: Parent
  ): { readonly lines: readonly string[]; readonly rows: boolean; readonly parts: boolean } {
    const lines: string[] = [];
    const done = new Set<string>();
    let hasRows = false;
    let hasParts = false;
    const push = (statement: string): void => {
      lines.push(...formatStatement(statement, { indent: BODY_INDENT }).split('\n'));
    };
    scope.links.forEach((link, index) => {
      if (!active.has(link.scope)) {
        reserve(link, self.words);
        return;
      }
      const { name } = declare(link, self);
      if (link.scope.part === null) hasRows = true;
      else hasParts = true;

      if (link.via === 'rows') {
        // Шаблон, вписанный в узел, у каждого массива свой; часть — общая, и её повтор отсекается.
        const key = `rows:${link.scope.part ?? index}:${link.path}`;
        if (done.has(key)) return;
        done.add(key);
        operators.add('applyEach');
        push(`applyEach(model.$.${link.path}, ${name});`);
        return;
      }
      const key = `group:${link.scope.part}`;
      if (done.has(key)) return;
      done.add(key);
      const targets = [
        ...new Set(
          scope.links
            .filter((other) => other.via === 'group' && other.scope === link.scope)
            .map((other) => `model.$.${other.path}`)
        ),
      ];
      operators.add('apply');
      push(
        targets.length === 1
          ? `apply(${targets[0]}, ${name});`
          : `apply([${targets.join(', ')}], ${name});`
      );
    });
    return { lines, rows: hasRows, parts: hasParts };
  }

  const applies = appliesOf(root, { typeName: ctx.names.TypeName, words: [], prefix: '' });

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
      render.filter((rule) => !owned.has(rule.selector) && !inNested.has(rule.selector)),
      ctx.selectors.sections.filter(
        (section) => !owned.has(section.selector) && !inNested.has(section.selector)
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

  // Параметры области корня — по коду КОРНЯ: тело вложенной области читает свою, а не корневую.
  const code = [
    ...links.lines,
    ...groups.flatMap((g) => g.rules.flatMap((rule) => rule.lines)),
    ...applies.lines,
  ];
  for (const name of [...links.operators, ...nodeOperators(render)]) operators.add(name);

  return {
    imports: [...operators, 'defineFormBehavior'].sort(),
    scope: scopeParamsOf(code),
    links: links.lines,
    groups,
    rows,
    applies: applies.lines,
    appliesRows: applies.rows,
    appliesParts: applies.parts,
    hasCode: code.length > 0,
  };
}
