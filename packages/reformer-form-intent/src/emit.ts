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
  initialLiteral,
  optionalText,
  renderBehaviors,
  rowPath,
  schemaParams,
  tsString,
  validationCode,
  validationImports,
  validationRuleBlock,
} from './rules-emit.js';
export { nameIgnoringCase } from './component-names.js';
