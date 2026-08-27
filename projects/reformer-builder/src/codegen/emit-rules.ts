/**
 * Эмиссия `validation.ts` и `form.behavior.ts` ИЗ ПРАВИЛ формы.
 *
 * Гибрид по решению плана: содержимое собирают билдеры MCP (`buildValidationTs`,
 * `buildBehaviorTs`) — там правила уже умеют превращаться в код, там же живут проверка циклов
 * и кросс-проверки. Обвязка остаётся билдерской: свои имена файлов, свой prettier, свои
 * импорты кита. Второй комплект эмиттеров для того же самого разошёлся бы с первым на первой
 * же правке, и разошёлся бы молча.
 *
 * Одна несостыковка требует адаптации и потому названа явно: MCP кладёт тип модели в
 * `model.ts`, а билдер — в `types.ts`. Импорт переписывается здесь, а не правится в MCP:
 * раскладка файлов — это решение потребителя, и у CLI-потребителя она другая.
 *
 * Пустые правила — не ошибка: тогда эмиттеры отдают прежние заглушки с примерами, потому что
 * форма без правил валидна и должна генерироваться в компилируемый код.
 *
 * @module reformer-builder/codegen/emit-rules
 */

import { buildBehaviorTs, buildValidationTs } from '@reformer/mcp/dist/core/generate/builders.js';
import { normalizeIntent } from '@reformer/mcp/dist/core/generate/form-intent.js';
import { visibilityFromRules, type FormRules } from '../model/rules';
import type { Names } from './naming';

/**
 * Минимальный intent для эмиссии правил.
 *
 * Ни полей, ни раскладки, ни источников данных: всё это уже есть в схеме, и передавать его
 * сюда значило бы завести второй источник истины о форме. `buildValidationTs` и
 * `buildBehaviorTs` читают только имя формы, имя типа и сами правила — проверено по их коду.
 */
function intentOf(rules: FormRules, names: Names) {
  return normalizeIntent({
    formName: names.title,
    interfaceName: names.TypeName,
    validation: rules.validation,
    behavior: rules.behavior,
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

/** `validation.ts` из правил. */
export function emitValidationFromRules(rules: FormRules, names: Names): string {
  return retargetModelImport(buildValidationTs(intentOf(rules, names)), names.TypeName);
}

/** `form.behavior.ts` из правил. */
export function emitFormBehaviorFromRules(rules: FormRules, names: Names): string {
  return retargetModelImport(buildBehaviorTs(intentOf(rules, names)), names.TypeName);
}
