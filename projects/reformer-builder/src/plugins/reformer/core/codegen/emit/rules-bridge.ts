/**
 * Мост к билдерам `@reformer/mcp`: `form.validation.ts` и `form.behavior.ts` ИЗ ПРАВИЛ формы.
 *
 * Содержимое собирают чужие билдеры — там правила уже умеют превращаться в код, там же живут
 * проверка циклов и кросс-проверки. Обвязка остаётся нашей: свои имена файлов, свои импорты.
 * Второй комплект эмиттеров для того же самого разошёлся бы с первым на первой же правке,
 * и разошёлся бы молча.
 *
 * Одна несостыковка требует адаптации и потому названа явно: MCP кладёт тип модели в `model.ts`,
 * а билдер — в `types.ts`. Импорт переписывается здесь, а не правится в MCP: раскладка файлов —
 * решение потребителя, и у CLI-потребителя она другая.
 *
 * @module plugins/reformer/core/codegen/emit/rules-bridge
 */

import {
  buildBehaviorTs,
  buildValidationSchemaTs,
  buildValidationTs,
} from '@reformer/mcp/dist/core/generate/builders.js';
import { normalizeIntent } from '@reformer/mcp/dist/core/generate/form-intent.js';
import { visibilityFromRules, type FormRules } from '../../form-model/rules';
import type { Names } from '../naming';
import { MODULE_FILES, importOf } from '../layout';
import type { ModuleLayout, StepInfo } from '../steps';

/**
 * Минимальный intent для эмиссии правил.
 *
 * Ни полей, ни раскладки, ни источников данных: всё это уже есть в схеме, и передавать его сюда
 * значило бы завести второй источник истины о форме. Оба билдера читают только имя формы, имя
 * типа и сами правила.
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

/** MCP импортирует тип из `./model`, у билдера он в `./types`. */
function retargetModelImport(code: string, typeName: string): string {
  return code.replace(
    new RegExp(`import type \\{ ${typeName} \\} from './model';`),
    `import type { ${typeName} } from './types';`
  );
}

/** `form.validation.ts` из правил. */
export function validationFromRules(rules: FormRules, names: Names): string {
  return retargetModelImport(buildValidationTs(intentOf(rules, names)), names.TypeName);
}

/** `form.behavior.ts` из правил. */
export function formBehaviorFromRules(rules: FormRules, names: Names): string {
  return retargetModelImport(buildBehaviorTs(intentOf(rules, names)), names.TypeName);
}

// ── Визард: правила валидации по шагам ──────────────────────────────────────

type ValidationRule = FormRules['validation'][number];

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

/** Правила одного шага. */
function rulesOf(rules: FormRules, layout: ModuleLayout, step: StepInfo): ValidationRule[] {
  return rules.validation.filter((rule) => stepOfRule(rule, layout) === step);
}

/**
 * `steps/<шаг>/form.validation.ts` из правил формы либо `null`, если у шага своих правил нет.
 *
 * `null`, а не пустой вывод билдера: для пустого набора он печатает импорт `validate` и параметр
 * `model`, которыми никто не пользуется, — у пользователя это ошибка `noUnusedLocals`. Заготовку
 * без правил печатает шаблон.
 */
export function stepValidationFromRules(
  rules: FormRules,
  names: Names,
  layout: ModuleLayout,
  step: StepInfo
): string | null {
  const own = rulesOf(rules, layout, step);
  if (own.length === 0) return null;
  return buildValidationSchemaTs(own, {
    interfaceName: names.TypeName,
    exportName: 'stepValidation',
    typeImport: importOf(step.files.validation, MODULE_FILES.types),
    header: `Шаг «${step.title}» — правила полей шага. «Далее» проверяет только их.`,
  });
}

/** Спецификатор модуля валидации ядра — туда дописываются имена агрегатора. */
const VALIDATION_MODULE = '@reformer/core/validation';

/** Дописать имена в named-импорт из `module` (или добавить импорт после последнего). */
function withNamedImport(code: string, module: string, names: readonly string[]): string {
  const escaped = module.replace(/[/.]/g, (c) => `\\${c}`);
  const line = new RegExp(`^import \\{([^}]*)\\} from '${escaped}';$`, 'm');
  const match = line.exec(code);
  if (match !== null) {
    const present = match[1]!
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    const merged = [...present, ...names.filter((name) => !present.includes(name))];
    return code.replace(line, `import { ${merged.join(', ')} } from '${module}';`);
  }
  const lines = code.split('\n');
  const last = lines.reduce((at, text, i) => (text.startsWith('import ') ? i : at), -1);
  lines.splice(last + 1, 0, `import { ${names.join(', ')} } from '${module}';`);
  return lines.join('\n');
}

/**
 * Корневой `form.validation.ts` визарда, когда у формы есть правила ВНЕ шагов, либо `null`, если все
 * правила разошлись по шагам (тогда корень печатает шаблон-агрегатор).
 *
 * Правила вне шагов становятся `restValidation` и проверяются только полной проверкой (отправка);
 * экспорты корня те же, что у простой формы и у агрегатора: `formValidation`, `makeValidationConfig`.
 */
export function wizardValidationFromRules(
  rules: FormRules,
  names: Names,
  layout: ModuleLayout
): string | null {
  const rest = rules.validation.filter((rule) => stepOfRule(rule, layout) === undefined);
  if (rest.length === 0) return null;
  const types = importOf(MODULE_FILES.validation, MODULE_FILES.types);
  let code = buildValidationSchemaTs(rest, {
    interfaceName: names.TypeName,
    exportName: 'restValidation',
    typeImport: types,
    header:
      'Валидация модели визарда. Правила шагов — в steps/<шаг>/form.validation.ts, здесь их\n' +
      'сборка и правила полей вне шагов (проверяются только при отправке).',
  });
  code = withNamedImport(code, VALIDATION_MODULE, [
    'apply',
    'defineValidationSchema',
    'validateModel',
  ]);
  code = withNamedImport(code, '@reformer/core', ['type FormModel']);
  code = withNamedImport(code, importOf(MODULE_FILES.validation, 'steps/index.ts'), [
    'stepValidations',
  ]);
  return `${code.trimEnd()}

/** Полная проверка (отправка): правила всех шагов и поля вне шагов. */
export const formValidation = defineValidationSchema<${names.TypeName}>(() => {
  apply(...stepValidations, restValidation);
});

/**
 * Пошаговый контракт визарда (\`FormWizard\` → \`config\`). \`touch: true\` обязателен: киты показывают
 * ошибку только у тронутого поля, и без него остановленный шаг выглядел бы как неработающая кнопка.
 */
export function makeValidationConfig(model: FormModel<${names.TypeName}>) {
  return {
    validateStep: (step: number): Promise<boolean> => {
      const schema = stepValidations[step - 1];
      return schema === undefined
        ? Promise.resolve(true)
        : validateModel(model, schema, { touch: true });
    },
    validateAll: (): Promise<boolean> => validateModel(model, formValidation, { touch: true }),
  };
}
`;
}
