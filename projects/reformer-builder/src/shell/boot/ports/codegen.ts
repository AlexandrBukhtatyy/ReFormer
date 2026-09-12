/**
 * То, чего генерации кода не хватает в возможностях, — и ничего сверх.
 *
 * Порт был широким: документы, каталог кита, листинг, путевая арифметика, запись, открытие
 * вкладки — всё это композиция собирала и передавала плагину параметром. Теперь плагин
 * собирает это сам, из служб контекста (`plugins/codegen/workspace`), и композиции остаётся
 * ОДНА операция.
 *
 * ## Почему `save` остаётся здесь
 *
 * Он единственный выносит написанное НАРУЖУ, в источник, — довод целиком в `./workspace-save`,
 * там же и реализация: операция у генерации и у шаблонов одна и та же.
 *
 * `format` и `rulesOf` не передаются, и оба — честная неполнота, а не забывчивость:
 * форматирование проектным prettier требует его конфигурации из открытого проекта (её чтение
 * ещё не написано), а сайдкар правил формы в v2 не проброшен ни к кому — ассистент держит
 * правила в памяти сессии и говорит об этом вслух.
 *
 * @module shell/boot/ports/codegen
 */

import type { CodegenGaps } from '@/plugins/codegen';
import type { ProjectHost } from '@/shell/boot/project/project';
import { createWorkspaceSave } from './workspace-save';

export interface CodegenGapsDeps {
  /** Держатель проекта в объёме одной операции: только снимок. */
  readonly project: Pick<ProjectHost, 'get'>;
}

export function createCodegenGaps(deps: CodegenGapsDeps): CodegenGaps {
  // Та же операция, что у шаблонов, и та же реализация: см. `./workspace-save`.
  return { save: createWorkspaceSave({ project: deps.project }) };
}
