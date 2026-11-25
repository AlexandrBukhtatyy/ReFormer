/**
 * `@reformer/form-intent/emit` — строительные блоки печати для генераторов кода.
 *
 * Основная точка входа печатает правила целиком. Генератор, который собирает из intent модуль
 * формы с другой разметкой файлов (например, валидацию по шагам мастера), берёт отсюда те же
 * блоки, чтобы правило печаталось одинаково в любом файле. Контракт этих функций уже, чем у
 * основной точки входа: они рассчитаны на intent после `normalizeIntent`.
 */

export { normalizeWith } from './intent.js';
export {
  DEFAULT_CROSS_CODE,
  behaviorCode,
  behaviorExtraImports,
  behaviorOps,
  fieldTsType,
  hoistRuleConstants,
  initialLiteral,
  optionalText,
  renderBehaviors,
  rowPath,
  schemaBody,
  schemaParams,
  tsString,
  unionMembers,
  validationCode,
  validationImports,
  validationRuleBlock,
  validationRulePart,
  validationRuleParts,
  type HoistRuleOptions,
  type RuleConstant,
  type SchemaPart,
} from './rules-emit.js';
export { nameIgnoringCase } from './component-names.js';
