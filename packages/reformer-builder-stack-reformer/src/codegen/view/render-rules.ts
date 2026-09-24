/**
 * Правила render-слоя — разобранные по видам и превращённые в строки БЕЗ отступа.
 *
 * ## Почему разбор здесь, а не в шаблоне
 *
 * Вид правила выбирает форму строки целиком: `hideWhen` — одна строка, `patchProps` — вызов
 * с литералом пропсов, `onEvent` — блок из четырёх и более. А внутри `patchProps` ещё одно
 * решение, которое шаблон принять не может в принципе: `$expr(...)` вставляется ВЫРАЖЕНИЕМ,
 * всё остальное — JSON. Без него строку `"form.total.value.value"` не отличить от намерения
 * подставить это значение, и правило, которое выглядит правильно, молча кладёт в проп текст.
 *
 * ## Почему строки без отступа
 *
 * В эмиттере отступ был вписан в каждую ветку литералами `'    '` и `'      '`, то есть
 * глубина вложенности хранилась в четырёх местах. Здесь строки относительные, а глубину
 * ставит шаблон одним `indent(lines, 4)` — там, где она видна вместе с окружающим кодом.
 *
 * @module @reformer/builder-stack-reformer/codegen/view/render-rules
 */

import type { RenderRuleIntent } from '../../form-model/rules';
import type { EmitContext } from '../context';
import type { StepInfo } from '../steps';

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

/** Строки одного правила, относительно своего блока. */
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

/** Поведение render-слоя глазами шаблона. */
export interface RenderBehaviorView {
  /** Визард отправляет форму сам и требует инъекции `form` — отсюда две ветки обвязки. */
  readonly isWizard: boolean;
  /**
   * Звать ли render-файлы шагов (`stepRenders` из `steps/index.ts`). Истинно у раскладки визарда:
   * правила и заготовки узлов шага лежат в его папке, корень их только вызывает.
   */
  readonly callSteps: boolean;
  /** Имя локальной переменной узла отправки: `wizard` либо `submit`. */
  readonly target: string;
  /** Символы `@reformer/renderer-react` для импорта: по алфавиту и только нужные. */
  readonly imports: readonly string[];
  /**
   * Нужна ли строка `void hideWhen;`.
   *
   * Сгенерированный модуль собирается с `noUnusedLocals`: импорт, которым не воспользовались,
   * стал бы ошибкой компиляции У ПОЛЬЗОВАТЕЛЯ, а не у нас.
   */
  readonly voidHideWhen: boolean;
  /** Правила по порядку; строки внутри — без отступа. */
  readonly rules: readonly { readonly lines: readonly string[] }[];
  readonly scaffold: readonly ScaffoldSectionView[];
}

/** Render-слой шага: правила и заготовки узлов его поддерева. */
export interface StepRenderView {
  /** Символы `@reformer/renderer-react` для импорта (только нужные). */
  readonly imports: readonly string[];
  readonly rules: readonly { readonly lines: readonly string[] }[];
  readonly scaffold: readonly ScaffoldSectionView[];
}

/** Селекторы, которыми владеют шаги визарда. Пусто у простой формы. */
function stepOwned(ctx: EmitContext): ReadonlySet<string> {
  return new Set(ctx.layout.steps.flatMap((step) => step.selectors));
}

export function renderBehaviorView(ctx: EmitContext): RenderBehaviorView {
  const owned = stepOwned(ctx);
  const rules = ctx.rules.render.filter((rule) => !owned.has(rule.selector));
  const hidden = new Set(
    ctx.rules.render.filter((rule) => rule.kind === 'hideWhen').map((rule) => rule.selector)
  );
  const isWizard = ctx.selectors.submitEvent === 'onSubmit';
  const usesHideWhen = rules.some((rule) => rule.kind === 'hideWhen');

  return {
    isWizard,
    callSteps: ctx.layout.kind === 'wizard',
    target: isWizard ? 'wizard' : 'submit',
    imports: ['hideWhen', 'onComponentEvent', ...(isWizard ? ['onInit'] : [])].sort(),
    voidHideWhen: !usesHideWhen,
    rules: rules.map((rule) => ({ lines: ruleLines(rule) })),
    scaffold: ctx.selectors.sections
      .filter((section) => !hidden.has(section.selector) && !owned.has(section.selector))
      .map((section) => ({ selector: section.selector, label: section.label })),
  };
}

/**
 * Render-слой одного шага: правила, чей селектор лежит в поддереве шага, и заготовки `hideWhen`
 * для его секций. Импортируется только то, чем файл пользуется: у шага без правил и секций
 * импортов нет вовсе (`noUnusedLocals`).
 */
export function stepRenderView(ctx: EmitContext, step: StepInfo): StepRenderView {
  const own = new Set(step.selectors);
  const rules = ctx.rules.render.filter((rule) => own.has(rule.selector));
  const hidden = new Set(
    rules.filter((rule) => rule.kind === 'hideWhen').map((rule) => rule.selector)
  );
  const kinds = new Set(rules.map((rule) => rule.kind));
  const imports: string[] = [];
  if (kinds.has('hideWhen')) imports.push('hideWhen');
  if (kinds.has('onEvent')) imports.push('onComponentEvent');
  return {
    imports: imports.sort(),
    rules: rules.map((rule) => ({ lines: ruleLines(rule) })),
    scaffold: step.sections
      .filter((section) => !hidden.has(section.selector))
      .map((section) => ({ selector: section.selector, label: section.label })),
  };
}
