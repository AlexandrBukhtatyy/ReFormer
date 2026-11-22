/**
 * Правила формы из кода её модуля: чтение, каноническая форма, загрузка.
 *
 * @module plugins/reformer/core/codegen/rules-code
 */

export { normalizeRules, inferSources, callValidator } from './normalize';
export {
  readRulesFromCode,
  regenerableRules,
  lockedRuleFiles,
  type FileOrigin,
  type ForeignCode,
  type ModuleFileText,
  type ModuleRuleCode,
  type RuleFileRead,
  type RulesFromCode,
} from './read';
export {
  isRuleCodePath,
  loadDataSourcesFromModule,
  loadRulesFromModule,
  type ExpectedRuleFiles,
  type ModuleRuleSource,
} from './load';
export { SCAFFOLD_NOTE } from './validation';
export { RULE_TARGET_IDS, RULES_CODEGEN_STACK, ruleFileTombstone, rulesStackInput } from './files';
