/**
 * Стек ReFormer в шаблонах форм — публичная поверхность: то, что берут композиция и тесты.
 * Оболочка грузит плагин из `./main`.
 *
 * @module plugins/reformer/templates/index
 */

export {
  activateTemplateStack,
  createTemplateStackPlugin,
  BUILTIN_STORE_ID,
  TEMPLATE_STACK_PLUGIN_ID,
  type TemplateStackActivation,
} from './plugin';
export { createTemplateStack, TEMPLATE_STACK_ID, type TemplateStackOptions } from './stack';
export { formDocumentOf, upgradeFormFiles, type FormDocument } from './document';
export {
  moduleNames,
  moduleTokens,
  tokenizeModuleNames,
  MODULE_TOKENS,
  type ModuleNameRole,
} from './names';
export {
  createBuiltinStore,
  BUILTIN_BASE_NAME,
  SIMPLE_TEMPLATE_ID,
  WIZARD_TEMPLATE_ID,
  type BuiltinStoreOptions,
  type ModulePrinter,
  type SeedExtras,
} from './builtin';
export {
  hasWizard,
  seedData,
  seedKitOf,
  simpleRules,
  simpleSeed,
  wizardRules,
  wizardSeed,
  type SeedData,
  type SeedKit,
} from './seeds';
export {
  hasPrinter,
  templatesPrinter,
  templateStackKit,
  ModulePrinterCapability,
  type ModulePrinterService,
} from './workspace';
