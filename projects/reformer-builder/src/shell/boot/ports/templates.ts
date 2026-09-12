/**
 * То, чего шаблонам не хватает в возможностях, — и ничего сверх.
 *
 * Порт был широким: активная вкладка, листинг, путевая арифметика, чтение и запись, каталог
 * кита, перевод. Всё это плагин теперь собирает сам, из служб контекста
 * (`plugins/templates/workspace`), и композиции остаётся ОДНА операция — сохранение.
 *
 * Довод, по которому она осталась, целиком в `./workspace-save`: `save` — единственная
 * запись, выносящая написанное наружу, в источник, и отдать её службой нельзя без политики
 * прав плагинов.
 *
 * @module shell/boot/ports/templates
 */

import type { TemplatesGaps } from '@/plugins/templates';
import type { ProjectHost } from '@/shell/boot/project/project';
import { createWorkspaceSave } from './workspace-save';

export interface TemplatesGapsDeps {
  /** Держатель проекта в объёме одной операции: только снимок. */
  readonly project: Pick<ProjectHost, 'get'>;
}

export function createTemplatesGaps(deps: TemplatesGapsDeps): TemplatesGaps {
  // Та же операция, что у генерации кода, и та же реализация: см. `./workspace-save`.
  return { save: createWorkspaceSave({ project: deps.project }) };
}
