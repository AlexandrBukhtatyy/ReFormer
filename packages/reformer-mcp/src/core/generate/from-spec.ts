/**
 * Спека → `FormIntent`. Чистая функция без IO.
 *
 * Вынесена из `planFormTool`: раньше intent собирался внутри инструмента и наружу выходил
 * только markdown'ом. Проверить его можно было лишь парсингом собственной выдачи — то есть
 * через слой форматирования, который к корректности intent отношения не имеет. Теперь у
 * контракта «спека → intent» есть отдельная точка входа, и её проверяет тест
 * `tests/form-from-spec.test.ts`, доводя результат до живой формы.
 *
 * Что здесь НЕ делается: формулы вычисляемых полей не угадываются. В спеках они заданы прозой
 * («Автоматически вычисляется как 20% от стоимости недвижимости»), и правдоподобная выдуманная
 * формула хуже явного пробела — она выглядит проверенной. Такие поля уходят в `warnings`.
 */

import { analyzeSpec, type SpecAnalysis } from '../spec/analyze.js';
import {
  normalizeIntent,
  type BehaviorIntent,
  type FormIntent,
  type ReformerTargetStack,
  type ValidationRuleIntent,
} from './form-intent.js';

/**
 * Условие вида `model.loanType === 'mortgage'` → поле, от которого зависит правило.
 * Нужно для `sources` поведения: из них строится проверка циклов в `check_behaviors`.
 */
function sourcesOf(when: string): string[] {
  const names = new Set<string>();
  for (const m of when.matchAll(/\bmodel\.([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  return [...names];
}

export function intentFromAnalysis(
  analysis: SpecAnalysis,
  target: ReformerTargetStack
): FormIntent {
  const validation: ValidationRuleIntent[] = [];
  const behavior: BehaviorIntent[] = [];
  const warnings = [...analysis.warnings];

  for (const f of analysis.fields) {
    if (f.rules.length > 0) {
      validation.push({ target: f.name, rules: f.rules, ...(f.when ? { when: f.when } : {}) });
    }

    // Два слоя, а не дубль. `when` гейтит ПРАВИЛО в `validateModel` — это модельный прогон,
    // он про состояние узла ничего не знает. `enableWhen` гейтит ПОЛЕ в форме. Сделать один
    // из двух — обычная ошибка, поэтому оба заводятся из одного источника.
    if (f.when) {
      behavior.push({
        kind: 'enableWhen',
        target: f.name,
        sources: sourcesOf(f.when),
        expr: f.when,
      });
    }
  }

  const named = new Set(analysis.fields.map((f) => f.name));
  for (const name of analysis.computedFields) {
    if (!named.has(name)) continue;
    warnings.push(
      `Поле \`${name}\` помечено в спеке как вычисляемое, но формула задана прозой — ` +
        'добавьте `compute`/`computeFrom` в `behavior` вручную.'
    );
  }

  return normalizeIntent({
    formName: analysis.formName,
    target,
    fields: analysis.fields.map((f) => ({
      name: f.name,
      type: f.type,
      component: f.component,
      label: f.label,
      ...(f.initialValue !== undefined ? { initialValue: f.initialValue } : {}),
    })),
    validation,
    behavior,
    warnings,
  });
}

/** Полный путь: текст спеки (или свободное описание) → нормализованный intent. */
export function intentFromSpec(source: string, target: ReformerTargetStack): FormIntent {
  return intentFromAnalysis(analyzeSpec(source), target);
}
