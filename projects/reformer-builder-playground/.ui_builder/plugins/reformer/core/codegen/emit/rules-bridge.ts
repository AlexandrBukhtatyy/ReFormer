/**
 * Мост к билдерам `@reformer/mcp`: тела правил валидации и связей поведения ИЗ ПРАВИЛ формы.
 *
 * Правила в код превращают чужие билдеры — там это уже умеют, там же живут проверка циклов и
 * кросс-проверки. Второй комплект эмиттеров для того же самого разошёлся бы с первым на первой
 * же правке, и разошёлся бы молча.
 *
 * ## Что берётся у MCP, а что печатаем сами
 *
 * Билдер MCP печатает МОДУЛЬ целиком: шапку, импорты и одно объявление
 * `export const <имя> = define…<T>(({ model }) => { … });`. Модуль единого контракта устроен
 * иначе — правила формы обёрнуты в `FormValidation`, правила шагов уходят в поток, а связи
 * поведения живут в одной функции с правилами узлов. Поэтому от вывода MCP берётся только то, что
 * выводится из правил: СТРОКИ ИМПОРТА операторов и валидаторов и СТРОКИ ТЕЛА объявления
 * ({@link parseEmittedModule}). Обвязку — имена экспортов, тип формы, `FormValidation`,
 * комментарии — раскладывают шаблоны.
 *
 * Разбор держится на форме вывода MCP и закреплён тестом на настоящем выводе: если билдер
 * начнёт печатать иначе, упадёт тест, а не модуль у пользователя.
 *
 * @module plugins/reformer/core/codegen/emit/rules-bridge
 */

import {
  buildBehaviorTs,
  buildValidationSchemaTs,
} from '@reformer/mcp/dist/core/generate/builders.js';
import { normalizeIntent } from '@reformer/mcp/dist/core/generate/form-intent.js';
import { visibilityFromRules, type FormRules } from '../../form-model/rules';
import type { Names } from '../naming';
import type { ModuleLayout, StepInfo } from '../steps';

/** Модуль, напечатанный билдером MCP, в разобранном виде. */
export interface EmittedModule {
  /** Строки `import { … } from '…';` — значения; импорт типа формы сюда не входит. */
  readonly imports: readonly string[];
  /** Строки тела объявления (между `… => {` и `});`), без отступа первого уровня. */
  readonly body: readonly string[];
}

/** Первая строка объявления: `export const formBehavior = defineFormBehavior<T>(({ model }) => {`. */
const DECLARATION = /^export const [A-Za-z_$][\w$]* = [A-Za-z_$][\w$]*<[^>]*>\(.*=> \{$/;

/** Закрывающая строка объявления — на нулевой колонке; вложенные блоки стоят с отступом. */
const DECLARATION_END = '});';

/**
 * Разобрать модуль, напечатанный билдером MCP.
 *
 * @throws Error если в тексте нет объявления `export const … => {` … `});`: молча отдать пустое
 * тело значило бы напечатать форму без правил, которые человек считает действующими.
 */
export function parseEmittedModule(code: string): EmittedModule {
  const lines = code.replace(/\s+$/, '').split('\n');
  const start = lines.findIndex((line) => DECLARATION.test(line));
  const end = lines.lastIndexOf(DECLARATION_END);
  if (start < 0 || end <= start) {
    throw new Error(
      'вывод билдера @reformer/mcp не разбирается: нет объявления `export const … => {` … `});`'
    );
  }
  return {
    imports: lines.slice(0, start).filter((line) => line.startsWith('import {')),
    // Отступ первого уровня ставит шаблон — там, где он виден вместе с окружающим кодом.
    body: lines.slice(start + 1, end).map((line) => (line.startsWith('  ') ? line.slice(2) : line)),
  };
}

/** Имена из `import { a, b } from '…';`. */
function namedImports(line: string): readonly string[] {
  const match = /^import \{([^}]*)\} from '[^']+';$/.exec(line);
  if (match === null) return [];
  return match[1]!
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

/**
 * Минимальный intent для эмиссии правил.
 *
 * Ни полей, ни раскладки, ни источников данных: всё это уже есть в схеме, и передавать его сюда
 * значило бы завести второй источник истины о форме. Билдер читает только имя формы, имя типа и
 * сами правила.
 */
function intentOf(rules: FormRules, names: Names) {
  return normalizeIntent({
    formName: names.title,
    interfaceName: names.TypeName,
    validation: [...rules.validation],
    behavior: [...rules.behavior],
    visibility: visibilityFromRules(rules),
  });
}

// ── Поведение: связи над моделью ────────────────────────────────────────────

/** Связи над моделью, выведенные из правил формы. */
export interface BehaviorCode {
  /** Операторы `@reformer/core/behaviors`, которыми пользуются связи (`compute`, `copyFrom`, …). */
  readonly operators: readonly string[];
  /** Строки связей — без отступа. */
  readonly lines: readonly string[];
}

/** Оператор, которым билдер объявляет поведение: в теле он не участвует. */
const BEHAVIOR_DECLARATOR = 'defineFormBehavior';

/**
 * Связи поведения из правил формы.
 *
 * Правила узлов (`hideWhen`, события, пропсы) сюда не входят: они печатаются из `rules.render`
 * тем же шаблоном поведения, и `visibility` intent-а билдер связей не читает.
 */
export function behaviorFromRules(rules: FormRules, names: Names): BehaviorCode {
  const parsed = parseEmittedModule(buildBehaviorTs(intentOf(rules, names)));
  return {
    operators: parsed.imports
      .flatMap(namedImports)
      .filter((name) => name !== BEHAVIOR_DECLARATOR)
      .sort(),
    lines: parsed.body,
  };
}

// ── Валидация ───────────────────────────────────────────────────────────────

type ValidationRule = FormRules['validation'][number];

/** Правила валидации, выведенные из правил формы: импорты операторов/валидаторов и тело. */
export type ValidationCode = EmittedModule;

/**
 * Правило строки массива — с целью ОТ СТРОКИ.
 *
 * Правила формы пишут цель такого правила полным путём (`references.name` при `each: 'references'`):
 * так её проверяет целостность правил (`form-model/rules-integrity`), и так же её принимает билдер
 * единого контракта MCP. Билдер одной схемы (`buildValidationSchemaTs`) ждёт путь от строки и
 * подставляет его как есть — с полным путём выходило `item.$.references.name`, и модуль не
 * компилировался. Имя массива срезается здесь; цель, уже записанная от строки, не меняется.
 */
function rowRelative(rule: ValidationRule): ValidationRule {
  if (rule.each === undefined || !rule.target.startsWith(`${rule.each}.`)) return rule;
  return { ...rule, target: rule.target.slice(rule.each.length + 1) };
}

/**
 * Тело схемы валидации для набора правил либо `null`, если правил нет.
 *
 * `null`, а не пустой вывод билдера: для пустого набора он печатает импорт `validate` и параметр
 * `model`, которыми никто не пользуется, — у пользователя это ошибка `noUnusedLocals`. Заготовку
 * без правил печатает шаблон.
 */
function validationOf(rules: readonly ValidationRule[], names: Names): ValidationCode | null {
  if (rules.length === 0) return null;
  // Имя экспорта и импорт типа билдеру обязательны, но в разбор не попадают: объявление и импорт
  // типа формы печатает шаблон — у него свои имена (`formRules`, `stepRules`, `crossStepRules`).
  return parseEmittedModule(
    buildValidationSchemaTs(rules.map(rowRelative), {
      interfaceName: names.TypeName,
      exportName: 'rules',
      typeImport: './types',
    })
  );
}

/** Правила простой формы — все правила валидации одним набором (`formRules`). */
export function formRulesFromRules(rules: FormRules, names: Names): ValidationCode | null {
  return validationOf(rules.validation, names);
}

/**
 * Путь, по которому правило относится к полю: у правила над элементами массива — путь массива
 * (`each`), иначе его цель.
 */
function ruleKey(rule: ValidationRule): string {
  return rule.each ?? rule.target;
}

/** Путь лежит в поле шага или внутри него (`contacts` покрывает `contacts.email`). */
function covers(fields: readonly string[], path: string): boolean {
  return fields.some((field) => path === field || path.startsWith(`${field}.`));
}

/**
 * Шаг, которому принадлежит правило, либо `undefined` — правило вне шагов.
 *
 * По ЦЕЛИ правила, а не по полям в условии `when`: правило про поле шага проверяется «Далее» этого
 * шага, даже если его условие читает поле с другого шага.
 */
export function stepOfRule(rule: ValidationRule, layout: ModuleLayout): StepInfo | undefined {
  const key = ruleKey(rule);
  return layout.steps.find((step) => covers(step.fields, key));
}

/**
 * Правила шага визарда (`validation/<шаг>.ts` → `stepRules`) либо `null`, если у шага своих
 * правил нет.
 */
export function stepRulesFromRules(
  rules: FormRules,
  names: Names,
  layout: ModuleLayout,
  step: StepInfo
): ValidationCode | null {
  return validationOf(
    rules.validation.filter((rule) => stepOfRule(rule, layout) === step),
    names
  );
}

/**
 * Правила визарда ВНЕ шагов (`validation/form.ts` → `crossStepRules`) либо `null`, если все
 * правила разошлись по шагам. Проверяются целиком, при отправке: в сборку уходят полем `extras`.
 */
export function crossStepRulesFromRules(
  rules: FormRules,
  names: Names,
  layout: ModuleLayout
): ValidationCode | null {
  return validationOf(
    rules.validation.filter((rule) => stepOfRule(rule, layout) === undefined),
    names
  );
}
