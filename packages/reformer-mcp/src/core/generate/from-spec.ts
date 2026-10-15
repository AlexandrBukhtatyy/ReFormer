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

import { analyzeSpec, type SpecAnalysis, type SpecField } from '../spec/analyze.js';
import {
  normalizeIntent,
  type ArrayIntent,
  type BehaviorIntent,
  type FieldIntent,
  type FormIntent,
  type LayoutNode,
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

/** Поле спеки → поле intent: то, что прочитано, без догадок сверх него. */
function fieldIntentOf(f: SpecField): FieldIntent {
  return {
    name: f.name,
    type: f.type,
    component: f.component,
    label: f.label,
    ...(f.initialValue !== undefined ? { initialValue: f.initialValue } : {}),
  };
}

/** `properties` → `PropertiesItem`: интерфейс элемента, тем же правилом, что у нормализации. */
function itemInterfaceOf(name: string): string {
  const last = name.split('.').pop() ?? name;
  return `${last.charAt(0).toUpperCase()}${last.slice(1)}Item`;
}

/**
 * Раскладка формы: поля и массивы в порядке спеки, а у спеки с шагами — по шагам визарда.
 *
 * Шаг строки — последний заголовок `### Шаг N` над ней. Раньше раскладка была плоской всегда:
 * поле номера шага не несло, и спека «из шести шагов» давала одну длинную форму. Строки до
 * первого шага кладутся в первый. Шаг без единой строки не заводится; если непустой шаг
 * остался один — визард не нужен, раскладка плоская.
 */
function layoutOf(analysis: SpecAnalysis): LayoutNode {
  const stepOf = new Map<string, number | undefined>([
    ...analysis.fields.map((f) => [`field:${f.name}`, f.step] as const),
    ...analysis.arrayDefs.map((a) => [`array:${a.name}`, a.step] as const),
  ]);
  const leaf = (e: SpecAnalysis['order'][number]): LayoutNode =>
    e.kind === 'field' ? { kind: 'field', ref: e.name } : { kind: 'array', ref: e.name };

  const first = analysis.stepList[0]?.number;
  const byStep = new Map<number, LayoutNode[]>(analysis.stepList.map((s) => [s.number, []]));
  for (const entry of analysis.order) {
    const step = stepOf.get(`${entry.kind}:${entry.name}`) ?? first;
    if (step !== undefined) byStep.get(step)?.push(leaf(entry));
  }
  const steps = analysis.stepList.filter((s) => (byStep.get(s.number)?.length ?? 0) > 0);

  if (steps.length < 2) {
    return { kind: 'container', component: 'Box', children: analysis.order.map(leaf) };
  }
  return {
    kind: 'container',
    component: 'Box',
    children: steps.map((s) => ({
      kind: 'step' as const,
      title: s.title || `Шаг ${s.number}`,
      children: byStep.get(s.number) ?? [],
    })),
  };
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

  // Правила полей строки — схемой над элементом (`each`). Условное правило гейтится так же,
  // а `enableWhen` полю строки не заводится: путь до него от корня модели не выражается одной
  // ручкой, и молча завести его не на то поле хуже, чем сказать.
  for (const a of analysis.arrayDefs) {
    for (const f of a.itemFields) {
      if (f.rules.length > 0) {
        validation.push({
          target: `${a.name}.${f.name}`,
          each: a.name,
          rules: f.rules,
          ...(f.when ? { when: f.when } : {}),
        });
      }
      if (f.when) {
        warnings.push(
          `Поле \`${a.name}[].${f.name}\` условное (\`${f.when}\`): правило гейтится, но ` +
            'доступность поля строки (`enableWhen`) задайте вручную.'
        );
      }
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

  const arrays: ArrayIntent[] = analysis.arrayDefs.map((a) => ({
    name: a.name,
    itemInterfaceName: itemInterfaceOf(a.name),
    itemFields: a.itemFields.map(fieldIntentOf),
    // Пустой массив — честное начало: строки добавляет человек. Без значения узел массива
    // ломается на первом `add` (см. `ArrayIntent.initialValue`).
    initialValue: [],
  }));

  return normalizeIntent({
    formName: analysis.formName,
    target,
    layoutRoot: layoutOf(analysis),
    fields: analysis.fields.map(fieldIntentOf),
    arrays,
    validation,
    behavior,
    warnings,
  });
}

/** Полный путь: текст спеки (или свободное описание) → нормализованный intent. */
export function intentFromSpec(source: string, target: ReformerTargetStack): FormIntent {
  return intentFromAnalysis(analyzeSpec(source), target);
}
