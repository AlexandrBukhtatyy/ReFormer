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
 * ## Строки без отступа
 *
 * Строки относительные, а глубину ставит шаблон одним `indent(lines, 2)` — там, где она видна
 * вместе с окружающим кодом.
 *
 * @module plugins/reformer/core/codegen/view/behavior
 */

import { hasBehaviorRules, type RenderRuleIntent } from '../../form-model/rules';
import type { EmitContext } from '../context';
import { behaviorFromRules } from '../emit/rules-bridge';

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
      render.filter((rule) => !owned.has(rule.selector)),
      ctx.selectors.sections.filter((section) => !owned.has(section.selector))
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

  const code = [...links.lines, ...groups.flatMap((g) => g.rules.flatMap((rule) => rule.lines))];
  const operators = new Set<string>([...links.operators, ...nodeOperators(render)]);

  return {
    imports: [...operators, 'defineFormBehavior'].sort(),
    scope: scopeParamsOf(code),
    links: links.lines,
    groups,
    hasCode: code.length > 0,
  };
}
