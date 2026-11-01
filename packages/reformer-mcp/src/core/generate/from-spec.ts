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
  // Путь целиком (`vehicle.hasAlarm`), а не первый сегмент: источник — поле, а не его группа.
  for (const m of when.matchAll(/\bmodel\.([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/g))
    names.add(m[1]);
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
    ...(f.mask ? { componentProps: { mask: f.mask } } : {}),
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
/** Общая часть заголовков вариантов шага: «Объект страхования - Транспорт» → «Объект страхования». */
function commonTitle(titles: string[]): string {
  const heads = titles.map((t) => t.split(/\s+[-–—]\s+/)[0].trim());
  return heads.every((h) => h === heads[0]) ? heads[0] : titles[0];
}

/**
 * Раскладка из шагов спеки.
 *
 * Номер шага может повторяться: «Шаг 3: Объект страхования — Транспорт», «… — Недвижимость» —
 * это ВАРИАНТЫ одного шага. Раньше шаги ключевались номером, и поля всех вариантов печатались в
 * каждом из них: четыре копии каждого поля, кросс-проверка C10 (калибровка, holdout-спека
 * страхования). Теперь вариант — секция внутри одного шага, а какой показывать, решает
 * `visibility`, — о чём и говорит предупреждение.
 */
function layoutOf(analysis: SpecAnalysis, warnings: string[]): LayoutNode {
  const meta = new Map<string, { step?: number; heading?: number }>([
    ...analysis.fields.map(
      (f) => [`field:${f.name}`, { step: f.step, heading: f.stepHeading }] as const
    ),
    ...analysis.arrayDefs.map(
      (a) => [`array:${a.name}`, { step: a.step, heading: a.stepHeading }] as const
    ),
  ]);
  const leaf = (e: SpecAnalysis['order'][number]): LayoutNode =>
    e.kind === 'field' ? { kind: 'field', ref: e.name } : { kind: 'array', ref: e.name };

  const first = analysis.stepList[0]?.number;
  const byHeading = new Map<number, LayoutNode[]>();
  const byNumber = new Map<number, LayoutNode[]>();
  const add = <K>(map: Map<K, LayoutNode[]>, key: K, node: LayoutNode) =>
    map.set(key, [...(map.get(key) ?? []), node]);
  for (const entry of analysis.order) {
    const m = meta.get(`${entry.kind}:${entry.name}`);
    if (m?.heading !== undefined) add(byHeading, m.heading, leaf(entry));
    else if ((m?.step ?? first) !== undefined)
      add(byNumber, (m?.step ?? first) as number, leaf(entry));
  }

  const headings = analysis.stepList.map((s, index) => ({ ...s, index }));
  const steps = [...new Set(headings.map((h) => h.number))]
    .map((number) => {
      const variants = headings.filter((h) => h.number === number);
      const loose = byNumber.get(number) ?? [];
      if (variants.length === 1) {
        return {
          title: variants[0].title || `Шаг ${number}`,
          children: [...(byHeading.get(variants[0].index) ?? []), ...loose],
        };
      }
      const filled = variants.filter((v) => (byHeading.get(v.index)?.length ?? 0) > 0);
      if (filled.length > 1) {
        warnings.push(
          `Шаг ${number} описан в ${filled.length} вариантах (${filled.map((v) => `«${v.title}»`).join(', ')}): ` +
            'поля разложены по секциям одного шага — какую показывать, задайте `visibility` ' +
            '(hideWhen по selector секции).'
        );
      }
      const sections: LayoutNode[] = filled.map((v, k) => ({
        kind: 'container',
        component: 'Section',
        selector: `step${number}-variant${k + 1}`,
        componentProps: { title: v.title },
        children: byHeading.get(v.index) ?? [],
      }));
      return {
        title: commonTitle(variants.map((v) => v.title)) || `Шаг ${number}`,
        children: [
          ...loose,
          ...(filled.length === 1 ? (byHeading.get(filled[0].index) ?? []) : sections),
        ],
      };
    })
    .filter((s) => s.children.length > 0);

  if (steps.length < 2) {
    return { kind: 'container', component: 'Box', children: analysis.order.map(leaf) };
  }
  return {
    kind: 'container',
    component: 'Box',
    children: steps.map((s) => ({ kind: 'step' as const, title: s.title, children: s.children })),
  };
}

export function intentFromAnalysis(
  analysis: SpecAnalysis,
  target: ReformerTargetStack
): FormIntent {
  const validation: ValidationRuleIntent[] = [];
  const behavior: BehaviorIntent[] = [];
  const warnings = [...analysis.warnings];

  // Условия «при x='y'» спека пишет коротким именем поля, а поле живёт в группе
  // (`vehicle.hasAntiTheft`), и флаг сравнивался со строкой `'true'`: `generate_form` отвечал C5
  // («такого поля нет»), а бандл не собирался (калибровка, holdout-спека страхования).
  const fieldTypes = new Map(analysis.fields.map((f) => [f.name, f.type]));
  for (const f of analysis.fields) {
    if (f.when) f.when = resolveCondition(f.when, f.name, fieldTypes, warnings);
  }

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
  // Одной строкой: восемь вычисляемых полей кредитной спеки занимали половину предупреждений,
  // которые агент видит в бюджете ответа, и вытесняли то, что переносить сложнее.
  const computed = analysis.computedFields.filter((name) => named.has(name));
  if (computed.length > 0) {
    warnings.push(
      `Вычисляемые поля (${computed.length}): ${computed.map((n) => `\`${n}\``).join(', ')} — ` +
        'формулы в спеке заданы прозой; добавьте `compute`/`computeFrom` в `behavior` вручную.'
    );
  }
  dependencyBehaviors(analysis, fieldTypes, new Set(computed), behavior, warnings);

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
    layoutRoot: layoutOf(analysis, warnings),
    fields: analysis.fields.map(fieldIntentOf),
    arrays,
    validation,
    behavior,
    warnings,
  });
}

/**
 * Путь из таблицы зависимостей → путь модели: точный, в группе соседнего поля (`near`) или
 * единственный, который им оканчивается. Массив — по имени без `[]`.
 */
function resolvePath(
  ref: string,
  types: ReadonlyMap<string, string>,
  arrays: ReadonlySet<string>,
  near?: string
): string | null {
  const clean = ref.replace(/\[\]$/, '');
  if (types.has(clean) || arrays.has(clean)) return clean;
  const group = near?.includes('.') ? near.slice(0, near.lastIndexOf('.') + 1) : '';
  if (group && types.has(group + clean)) return group + clean;
  const candidates = [...types.keys()].filter((p) => p.endsWith(`.${clean}`));
  return candidates.length === 1 ? candidates[0] : null;
}

/** Пустое значение поля по его типу — то, что пишет сброс. */
function emptyOf(type: string | undefined): string {
  return type === 'boolean' ? 'false' : type === 'string' ? "''" : 'null';
}

/**
 * Подсказка-оператор для строки таблицы зависимостей, которую не перевести без догадок. Порядок
 * важен: «Условная валидация» проверяется раньше «Условных полей».
 */
const DEPENDENCY_HINTS: Array<[RegExp, string]> = [
  [/вычисл/i, '`computeFrom` в `behavior`, формула — прозой в колонке «Описание»'],
  [/кросс/i, '`cross` в `validation` — выражение над `values`'],
  [/условн\S*\s+валид/i, 'правило с `when` в `validation`'],
  [
    /загрузк/i,
    '`onChange` источника: `await fetch(…, { signal })` и `form.<поле>.updateComponentProps({ options })`',
  ],
  [/лимит|предел/i, '`onChange` источника и `form.<поле>.updateComponentProps({ max })`'],
  [/сервер/i, '`async` в `validation`'],
  [/блокиров/i, '`disableWhen` в `behavior`'],
  [/предупрежд/i, "правило с `severity: 'warning'`"],
  [/ревалид/i, '`revalidateWhen` в `behavior`'],
  [/сообщени/i, 'узел-подсказка со своим `selector` и правило в `visibility`'],
  [/условн\S*\s+пол|видимост/i, '`enableWhen` в `behavior` или правило в `visibility`'],
  [/сброс/i, '`onChange` управляющего поля, пишущий пустые значения'],
  [
    /копирован/i,
    '`copyFrom` с условием в `expr` (у группы — на каждое поле); флаг условия должен быть полем модели',
  ],
  [/массив/i, '`onChange` флага с `model.<массив>.clear()` либо правило в `visibility`'],
];

/**
 * Таблица зависимостей → поведение там, где перевод однозначен; остальное — предупреждение с
 * оператором, по одному на вид поведения.
 *
 * Однозначны три вида: очистка массива по флагу (`onChange` + `clear()`), копирование поля в
 * поле по условию (`copyFrom` с `when`) и сброс НАЗВАННЫХ зависимых полей (`onChange`, пишущий
 * пустые значения). «Условные поля» и «Вычисляемое поле» обычно повторяют ячейки «Условное» и
 * «Вычисляемое» таблиц полей — уже разобранное повторно не предупреждается.
 */
function dependencyBehaviors(
  analysis: SpecAnalysis,
  types: ReadonlyMap<string, string>,
  computed: ReadonlySet<string>,
  behavior: BehaviorIntent[],
  warnings: string[]
): void {
  const arrays = new Set(analysis.arrayDefs.map((a) => a.name));
  const enabled = new Set(behavior.filter((b) => b.kind === 'enableWhen').map((b) => b.target));
  const pending = new Map<string, string[]>();

  for (const d of analysis.dependencies) {
    const controller =
      d.controllers.length === 1 ? resolvePath(d.controllers[0], types, arrays) : null;
    const resolved = d.dependents.map((p) =>
      resolvePath(p, types, arrays, controller ?? undefined)
    );

    if (
      /массив/i.test(d.kind) &&
      /очища|очистк|clear|удаля/i.test(`${d.action} ${d.description}`)
    ) {
      const array = resolved.find((p): p is string => p !== null && arrays.has(p));
      const flag = /=\s*false$/i.test(d.condition)
        ? '!value'
        : /=\s*true$/i.test(d.condition)
          ? 'value'
          : null;
      if (controller && array && flag) {
        behavior.push({
          kind: 'onChange',
          target: controller,
          sources: [],
          expr: `if (${flag}) model.${array}.clear();`,
        });
        continue;
      }
    }

    if (/копирован/i.test(d.kind) && controller && types.has(controller) && resolved.length === 1) {
      const to = resolved[0];
      const cond = d.condition.match(/^([A-Za-z_$][\w$.]*)\s*={1,3}\s*['"]?([^'"]+?)['"]?$/);
      // Условие — по полю, которое в спеке объявлено: флаг, только упомянутый в примечании
      // (`sameEmail`), дал бы `model.sameEmail` несуществующего поля. Такая строка — предупреждение.
      const flag = cond ? resolvePath(cond[1], types, arrays, to ?? undefined) : null;
      const when =
        cond && flag
          ? resolveCondition(`model.${flag} === '${cond[2]}'`, to ?? '', types, warnings)
          : null;
      if (to && types.has(to) && (!d.condition || when)) {
        behavior.push({
          kind: 'copyFrom',
          target: to,
          sources: [controller, ...(when ? sourcesOf(when) : [])],
          ...(when ? { expr: when } : {}),
        });
        continue;
      }
    }

    if (/сброс/i.test(d.kind) && controller && resolved.length > 0) {
      const targets = resolved.filter((p): p is string => p !== null && types.has(p));
      if (targets.length === resolved.length && !targets.includes(controller)) {
        behavior.push({
          kind: 'onChange',
          target: controller,
          sources: [],
          expr: targets.map((t) => `model.${t} = ${emptyOf(types.get(t))};`).join(' '),
        });
        continue;
      }
    }

    const covered = (set: ReadonlySet<string>) =>
      resolved.length > 0 && resolved.every((p) => p !== null && set.has(p));
    if (/условн\S*\s+пол/i.test(d.kind) && covered(enabled)) continue;
    if (/вычисл/i.test(d.kind) && covered(computed)) continue;

    const what = `${d.controllers.join(', ') || '—'} → ${d.action}`;
    pending.set(d.kind, [
      ...(pending.get(d.kind) ?? []),
      what.length > 60 ? `${what.slice(0, 59)}…` : what,
    ]);
  }

  // Виды без оператора («Каскадный эффект», «Форматирование») — скорее пояснения, чем
  // требования: одной строкой, чтобы не вытеснять из начала списка то, что переносить нужно.
  const other: string[] = [];
  for (const [kind, items] of pending) {
    const hint = DEPENDENCY_HINTS.find(([re]) => re.test(kind))?.[1];
    if (!hint) {
      other.push(`«${kind}» (${items.length})`);
      continue;
    }
    const shown = items
      .slice(0, 3)
      .map((i) => `«${i}»`)
      .join(', ');
    const more = items.length > 3 ? ` и ещё ${items.length - 3}` : '';
    warnings.push(`Таблица зависимостей, «${kind}» (${items.length}): ${shown}${more} — ${hint}.`);
  }
  if (other.length > 0) {
    warnings.push(
      `Таблица зависимостей, прочие виды: ${other.join(', ')} — проверьте, не требуют ли они правил.`
    );
  }
}

/**
 * Условие `model.<имя> === <литерал>` → с полным путём поля и литералом его типа.
 *
 * Короткое имя сводится к пути, который им оканчивается: среди нескольких — в той же группе,
 * что условное поле. Неоднозначность или отсутствие — предупреждение, условие остаётся как было.
 */
function resolveCondition(
  when: string,
  owner: string,
  types: ReadonlyMap<string, string>,
  warnings: string[]
): string {
  const m = when.match(/^model\.([\w$.]+) === (.+)$/);
  if (!m) return when;
  const [, ref, literal] = m;
  let path = ref;
  if (!types.has(ref)) {
    const candidates = [...types.keys()].filter((p) => p.endsWith(`.${ref}`));
    const group = owner.includes('.') ? owner.slice(0, owner.lastIndexOf('.') + 1) : '';
    const sameGroup = candidates.filter((p) => group && p.startsWith(group));
    const pick =
      sameGroup.length === 1 ? sameGroup[0] : candidates.length === 1 ? candidates[0] : null;
    if (pick) {
      path = pick;
    } else {
      warnings.push(
        `Поле \`${owner}\`: условие ссылается на \`${ref}\`, ` +
          (candidates.length === 0
            ? 'такого поля в спеке нет'
            : `а подходят несколько: ${candidates.map((c) => `\`${c}\``).join(', ')}`) +
          ' — укажите путь в `when` и `enableWhen` вручную.'
      );
      return when;
    }
  }
  const type = types.get(path);
  const bare = literal.replace(/^'(.*)'$/, '$1');
  const typed =
    type === 'boolean' && /^(true|false)$/.test(bare)
      ? bare
      : type === 'number' && /^-?\d+(\.\d+)?$/.test(bare)
        ? bare
        : literal;
  return `model.${path} === ${typed}`;
}

/** Полный путь: текст спеки (или свободное описание) → нормализованный intent. */
export function intentFromSpec(source: string, target: ReformerTargetStack): FormIntent {
  return intentFromAnalysis(analyzeSpec(source), target);
}
