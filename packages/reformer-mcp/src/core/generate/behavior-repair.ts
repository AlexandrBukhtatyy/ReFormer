/**
 * Связи intent, которые собрались бы и молча не работали, — в запись, которая делает задуманное.
 *
 * Обе починки найдены формой кредита, собранной агентом через `form_build` (clean-test-2): сборка
 * отвечала ✓, контракт сценария их не проверял, а в браузере форма вела себя не по спеке.
 *
 * - `resetWhen` с условием, которое не читает модель (`"expr": "true"`), и источниками в `sources`.
 *   Задумано «сбросить модель при смене марки»: так записано и в `sources`. Но печатался
 *   `resetWhen(model.$.carModel, () => true)` — `sources` в коде не участвуют, условие не
 *   подписано ни на один сигнал, и смену марки сброс не видит (ReFormer-j356.12). Факт смены
 *   источника — это `onChange` на нём, так отвечает и `choose_api`; без источников такой сброс
 *   невыразим, и запись — проблема.
 * - Цель `compute`, которую включает `enableWhen`. Узел вычисляемого поля сборка блокирует
 *   (`disabled: true`), но `enable()` снимает блокировку схемы, и пока условие истинно, поле
 *   открыто для ввода — взнос ипотеки вводился руками (ReFormer-j356.13). Задумано другое: поле
 *   живёт, пока условие истинно, и чистится, когда ложно. Поэтому условие уходит в `when`
 *   вычисления (без него `compute` заново заполнит выключенное поле — предупреждение `enableWhen`
 *   в ядре), очистка — в `resetWhen` по ложному условию, а узел остаётся заблокированным.
 *   Связь, которая включает поле ровно тогда, когда оно НЕ вычисляется (`when` другое), —
 *   осознанная «расчёт или ручной ввод», её не трогаем.
 *
 * Чинится только то, смысл чего однозначен; каждая починка названа в замечании.
 *
 * @module reformer-mcp/core/generate/behavior-repair
 */

import type {
  BehaviorIntent,
  FieldIntent,
  FormIntent,
  IntentProblem,
  IntentWarning,
} from './form-intent.js';

/** Выражение читает модель: форму (`model`, `form`) или строку массива (`item`). */
function readsModel(expr: string | undefined): boolean {
  return expr !== undefined && /\b(model|item|form)\b/.test(expr);
}

/** Путь поля строки — от строки: `items.qty` при `each: 'items'` → `qty`. */
function rowPath(path: string, each: string | undefined): string {
  return each !== undefined && path.startsWith(`${each}.`) ? path.slice(each.length + 1) : path;
}

/** Описание поля цели: поле формы по пути модели или поле строки массива `each`. */
function fieldOf(intent: FormIntent, target: string, each: string | undefined): FieldIntent | null {
  if (each === undefined) {
    return intent.fields.find((f) => (f.modelPath ?? f.name) === target) ?? null;
  }
  const array = intent.arrays.find((a) => (a.modelPath ?? a.name) === each);
  const path = rowPath(target, each);
  return array?.itemFields.find((f) => (f.modelPath ?? f.name) === path) ?? null;
}

/**
 * Значение сброса: `resetValue` записи, иначе начальное значение поля. Сброс к начальному — то же,
 * что делает `resetOnDisable` (`resetToCreation`), и литерал заведомо подходит к типу поля.
 */
function resetLiteral(intent: FormIntent, b: BehaviorIntent): string {
  const value =
    b.options && 'resetValue' in b.options
      ? b.options.resetValue
      : fieldOf(intent, b.target, b.each)?.initialValue;
  // Строка — в одинарных кавычках, как во всём напечатанном модуле (`prettier --check`).
  return typeof value === 'string'
    ? `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
    : JSON.stringify(value ?? null);
}

/** Условия совпадают с точностью до пробелов и внешних скобок. */
function sameCondition(a: string, b: string): boolean {
  const normalize = (expr: string): string => {
    let text = expr.replace(/\s+/g, '');
    while (/^\(.*\)$/.test(text) && balanced(text.slice(1, -1))) text = text.slice(1, -1);
    return text;
  };
  return normalize(a) === normalize(b);
}

/** Скобки строки сбалансированы — внешнюю пару можно снять, не склеив два выражения. */
function balanced(text: string): boolean {
  let depth = 0;
  for (const char of text) {
    if (char === '(') depth++;
    if (char === ')' && --depth < 0) return false;
  }
  return depth === 0;
}

const negate = (expr: string): string => `!(${expr})`;

/**
 * `resetWhen` с условием без модели: при источниках — `onChange` на каждом из них, без источников —
 * проблема. Остальные связи — как были.
 */
function repairConstantResets(
  intent: FormIntent,
  behavior: BehaviorIntent[],
  notices: IntentWarning[],
  problems: IntentProblem[]
): BehaviorIntent[] {
  return behavior.flatMap((b): BehaviorIntent[] => {
    if (b.kind !== 'resetWhen' || readsModel(b.expr)) return [b];
    const condition = b.expr ?? '(нет)';
    if (b.sources.length === 0) {
      problems.push({
        at: `behavior: resetWhen ${b.target}`,
        message:
          `условие \`${condition}\` не читает ни одного поля модели — сброс \`${b.target}\` ` +
          'не сработает ни при каком изменении',
        expected:
          'условие над полями ("!model.phone") или сброс при смене поля — onChange на нём: ' +
          `{"kind":"onChange","target":"<поле>","expr":"model.${b.target} = null;"}`,
      });
      return [];
    }
    const handle = b.each === undefined ? 'model' : 'item';
    const assignment = `${handle}.${rowPath(b.target, b.each)} = ${resetLiteral(intent, b)};`;
    notices.push({
      code: 'reset-as-on-change',
      message:
        `resetWhen \`${b.target}\` с условием \`${condition}\` не читает модель и смену ` +
        `${b.sources.map((s) => `\`${s}\``).join(', ')} не увидел бы — записан сбросом в ` +
        'onChange источника. Сброс при смене поля пиши так: {"kind":"onChange","target":"<поле>",' +
        `"expr":"${assignment}"}.`,
      at: b.target,
    });
    return b.sources.map((source) => ({
      kind: 'onChange',
      target: source,
      ...(b.each === undefined ? {} : { each: b.each }),
      sources: [],
      expr: assignment,
    }));
  });
}

/**
 * Включение вычисляемого поля на время расчёта → `when` расчёта и сброс по ложному условию. Цель с
 * несколькими вычислениями или включениями не трогаем: какое из них задумано — не понять.
 */
function repairComputedToggles(
  intent: FormIntent,
  behavior: BehaviorIntent[],
  notices: IntentWarning[]
): BehaviorIntent[] {
  const key = (b: BehaviorIntent): string => `${b.each ?? ''}|${rowPath(b.target, b.each)}`;
  const count = (kinds: ReadonlySet<string>) => {
    const counts = new Map<string, number>();
    for (const b of behavior)
      if (kinds.has(b.kind)) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1);
    return counts;
  };
  const computeKinds = new Set(['compute', 'computeFrom']);
  const toggleKinds = new Set(['enableWhen', 'disableWhen']);
  const computes = count(computeKinds);
  const toggles = count(toggleKinds);

  const replaced = new Map<string, BehaviorIntent>();
  for (const toggle of behavior) {
    const k = key(toggle);
    if (!toggleKinds.has(toggle.kind) || computes.get(k) !== 1 || toggles.get(k) !== 1) continue;
    const condition = toggle.expr;
    const compute = behavior.find((b) => computeKinds.has(b.kind) && key(b) === k);
    if (condition === undefined || compute === undefined || !readsModel(condition)) continue;
    const active = toggle.kind === 'enableWhen' ? condition : negate(condition);
    if (compute.when !== undefined && !sameCondition(compute.when, active)) continue;
    replaced.set(k, toggle);
  }
  if (replaced.size === 0) return behavior;

  return behavior.flatMap((b): BehaviorIntent[] => {
    const toggle = replaced.get(key(b));
    if (toggle === undefined) return [b];
    const enabled = toggle.kind === 'enableWhen';
    const condition = toggle.expr ?? '';
    if (computeKinds.has(b.kind)) {
      return [b.when === undefined ? { ...b, when: enabled ? condition : negate(condition) } : b];
    }
    if (b !== toggle) return [b];
    const reset = toggle.options?.resetOnDisable === true;
    const compute = behavior.find((other) => computeKinds.has(other.kind) && key(other) === key(b));
    const done = [
      ...(compute?.when === undefined ? ['условие стало `when` вычисления'] : []),
      ...(reset ? ['очищается resetWhen по ложному условию'] : []),
      'поле заблокировано',
    ];
    notices.push({
      code: 'computed-toggle-replaced',
      message:
        `Вычисляемое поле \`${toggle.target}\`: ${toggle.kind} включал бы его для ввода — ` +
        `${done.join(', ')}. Цель compute заблокирована сама: видимость задаёт visibility.`,
      at: toggle.target,
    });
    if (!reset) return [];
    return [
      {
        kind: 'resetWhen',
        target: toggle.target,
        ...(toggle.each === undefined ? {} : { each: toggle.each }),
        sources: toggle.sources,
        expr: enabled ? negate(condition) : condition,
        options: { resetValue: fieldOf(intent, toggle.target, toggle.each)?.initialValue ?? null },
      },
    ];
  });
}

/**
 * Починить связи intent (см. модуль). Замечания — в `notices`, неисправимое — в `problems`.
 *
 * @returns Новый список связей; intent не меняется.
 */
export function repairBehavior(
  intent: FormIntent,
  notices: IntentWarning[],
  problems: IntentProblem[]
): BehaviorIntent[] {
  const resets = repairConstantResets(intent, intent.behavior, notices, problems);
  return repairComputedToggles(intent, resets, notices);
}
