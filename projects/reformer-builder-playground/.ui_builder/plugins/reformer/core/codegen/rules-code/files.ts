/**
 * Файлы правил модуля глазами того, кто их пишет: цели генерации, которые их печатают, и
 * заглушка файла правил, в котором правил больше нет.
 *
 * Правила пишет генерация кода — и панель экспорта, и ход ассистента, заказывающий у неё только
 * файлы правил (`GenerateRequest.only`). Поэтому список целей — здесь, в ядре: им пользуются оба
 * плагина, и разойтись с раскладкой целей генерации ему не даёт тест стека генерации.
 *
 * @module plugins/reformer/core/codegen/rules-code/files
 */

import { withMarker } from '@reformer/builder-toolkit';
import type { FormRules } from '../../form-model/rules';

/** Стек генерации ReFormer (`CodegenStack.id`) — ему адресован вход с правилами. */
export const RULES_CODEGEN_STACK = 'reformer';

/**
 * Вход генерации, подменяющий правила кода (`GenerateRequest.stackInput`): так правила пишут в
 * код модуля те, у кого своего принтера правил нет, — ассистент и редактор.
 */
export function rulesStackInput(rules: FormRules): {
  readonly stack: string;
  readonly value: { readonly rules: FormRules };
} {
  return { stack: RULES_CODEGEN_STACK, value: { rules } };
}

/**
 * Цели генерации, печатающие файлы правил: валидацию формы и шагов, поведение, словарь текстов
 * замечаний и константы источников данных.
 */
export const RULE_TARGET_IDS: readonly string[] = Object.freeze([
  'codegen.validation',
  'codegen.step-validation',
  'codegen.form-behavior',
  'codegen.messages',
  'codegen.data-sources',
]);

/**
 * Заглушка файла правил шага, в котором правил больше нет: шаг переименован или убран, либо
 * отменён ход, который этот файл создал. С маркером генерации — её можно перезаписать; читатель
 * правил не находит в ней ни одного правила.
 */
export function ruleFileTombstone(path: string): string {
  return withMarker(
    `// ${path} — правил здесь больше нет: шаг переименован или убран, его правила — в файлах\n` +
      '// шагов рядом. Файл можно удалить.\n\nexport {};\n'
  );
}
