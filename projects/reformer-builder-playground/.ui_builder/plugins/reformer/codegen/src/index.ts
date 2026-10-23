/**
 * Стек ReFormer в генерации кода — публичная поверхность: то, что берут композиция и тесты.
 * Оболочка грузит плагин из `./main`.
 *
 * @module plugins/reformer/codegen/index
 */

export {
  activateCodegenStack,
  createCodegenStackPlugin,
  CODEGEN_STACK_PLUGIN_ID,
  fixtureCommand,
  stackDocumentActive,
  CREATE_FIXTURE_COMMAND_ID,
  type CodegenStackActivation,
} from './plugin';
export { createCodegenStack, CODEGEN_STACK_KINDS, type CodegenStackOptions } from './stack/stack';
export {
  BUILTIN_TARGETS,
  CODEGEN_STACK_ID,
  RETIRED_TARGETS,
  staleOverride,
} from './pipeline/targets';
export { generateModule } from './pipeline/generate';
export type { CodegenTarget, Formatter, GeneratedModule, ModuleFile } from './pipeline/generate';
export {
  codegenContextMenuItems,
  CODEGEN_CONTEXT_SUBMENU,
  GENERATE_INTO_COMMAND_ID,
} from './commands/menu';
export { findSchemaIn, schemaCandidates, schemaOf, type FoundSchema } from './stack/find';
export { kitMismatchOf, notesOf, registryKitOf } from './stack/disk';
export { asFormSchema, formSourceOf, loadFormSource, StepPartsError } from './pipeline/source';
export { readFormRules, RulesFileError } from './pipeline/rules';
export { createFixture, type FixtureHost, type FixtureOutcome } from './commands/fixture-command';
export {
  ModulePrinterCapability,
  modulePrinter,
  type ModulePrinterService,
  type PrintedFile,
  type PrintSeed,
} from './printer';
export { codegenStackWorkspace, type CodegenStackWorkspace } from './workspace';
export { CODEGEN_STACK_MESSAGES } from './messages';
