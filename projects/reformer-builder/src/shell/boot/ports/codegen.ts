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
 * Он единственный выносит написанное НАРУЖУ, в источник. Все остальные пути записи упираются
 * в рабочую копию, и потому безопасны по построению: до источника мимо сохранения не дотянуться
 * физически. Отдать `save` службой — значит открыть плагину из каталога проекта вторую дверь,
 * которую придётся охранять политикой прав, а политики прав нет.
 *
 * Поэтому сохранение остаётся у того, кого пользователь уже впустил: у композиции. Когда
 * появятся права плагинов (фаза 9 плана v4 — установка из npm), это место станет первым
 * их потребителем.
 *
 * `format` и `rulesOf` не передаются, и оба — честная неполнота, а не забывчивость:
 * форматирование проектным prettier требует его конфигурации из открытого проекта (её чтение
 * ещё не написано), а сайдкар правил формы в v2 не проброшен ни к кому — ассистент держит
 * правила в памяти сессии и говорит об этом вслух.
 *
 * @module shell/boot/ports/codegen
 */

import type { ResourceId } from '@/shell/platform/primitives/resource';
import type { CodegenGaps } from '@/plugins/codegen';
import type { ProjectHost } from '@/shell/boot/project/project';

export interface CodegenGapsDeps {
  /** Держатель проекта в объёме одной операции: только снимок. */
  readonly project: Pick<ProjectHost, 'get'>;
}

export function createCodegenGaps(deps: CodegenGapsDeps): CodegenGaps {
  const { project } = deps;

  return {
    async save(ids: readonly ResourceId[]) {
      const session = project.get();
      if (session === null) return false;
      const results = await Promise.all(ids.map((id) => session.workspace.save(id)));
      // Расхождения с источником — не отказ сохранения, а состояние рабочей области: их
      // показывает диалог слияния, и знать о них обязан тот, кто его открывает.
      session.divergence.noteConflicts(results.flatMap((r) => r.conflicts ?? []));
      return results.every((r) => r.ok);
    },
  };
}
