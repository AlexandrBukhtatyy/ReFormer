/**
 * Стек ReFormer в генерации кода — публичная поверхность: то, что берут композиция и тесты.
 *
 * @module plugins/reformer/codegen/stack
 */

export {
  activateCodegenStack,
  fixtureCommand,
  stackDocumentActive,
  CREATE_FIXTURE_COMMAND_ID,
  type CodegenStackActivation,
} from './plugin';
export { createCodegenStack, CODEGEN_STACK_KINDS, type CodegenStackOptions } from './stack';
export { BUILTIN_TARGETS, CODEGEN_STACK_ID, RETIRED_TARGETS, staleOverride } from './targets';
export { generateModule } from './generate';
export type { CodegenTarget, Formatter, GeneratedModule, ModuleFile } from './generate';
export { codegenContextMenuItems, CODEGEN_CONTEXT_SUBMENU, GENERATE_INTO_COMMAND_ID } from './menu';
export { findSchemaIn, schemaCandidates, schemaOf, type FoundSchema } from './find';
export { kitMismatchOf, notesOf, registryKitOf } from './disk';
export { asFormSchema, formSourceOf, loadFormSource, StepPartsError } from './source';
export { readFormRules, RulesFileError } from './rules';
export { createFixture, type FixtureHost, type FixtureOutcome } from './fixture-command';
export {
  ModulePrinterCapability,
  modulePrinter,
  type ModulePrinterService,
  type PrintedFile,
  type PrintSeed,
} from './printer';
export { codegenStackWorkspace, type CodegenStackWorkspace } from './workspace';
export { CODEGEN_STACK_MESSAGES } from './messages';
