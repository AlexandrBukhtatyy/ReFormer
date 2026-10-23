/**
 * Стеки генерации в глазах хозяина: какой стек печатает документ, какие цели ему отдать и как
 * сказать словами его отказ.
 *
 * Стеки читаются из точки на каждый вопрос, а не захватываются при активации: стек вносит себя
 * своим плагином, и порядок активации плагинов не важен — как у поверхностей превью и стеков
 * ассистента.
 *
 * @module plugins/reformer/codegen/stacks
 */

import {
  applyOverrides,
  overrideDrift,
  targetsOfStack,
  type StaleOverride,
} from '@reformer/builder-toolkit';
import type {
  CodegenDocument,
  CodegenProblem,
  CodegenStack,
  CodegenTarget,
  CodegenText,
  WhenContext,
} from '@reformer/builder-plugin-api';

/**
 * Стек вместе с плагином, который его внёс.
 *
 * Владелец нужен уведомлениям: отказ и заметка стека — ключи ЕГО словаря, и уведомление
 * называет их `pluginMessageKey(владелец, ключ)`. Панель переводит те же ключи
 * `CodegenStack.translate`.
 */
export interface StackEntry {
  readonly stack: CodegenStack;
  readonly pluginId: string;
}

/** Стеки точки — лениво, на каждый вопрос. */
export type Stacks = () => readonly StackEntry[];

/** Стек, который печатает документы такого вида, либо `null`. Первый по порядку вкладов. */
export function stackOfKind(stacks: Stacks, kind: string | null): StackEntry | null {
  if (kind === null) return null;
  return stacks().find((entry) => entry.stack.kinds.includes(kind)) ?? null;
}

/** Стек документа — по виду ресурса, как поверхность превью. */
export function stackFor(stacks: Stacks, document: CodegenDocument): StackEntry | null {
  return stackOfKind(stacks, document.resourceKind);
}

/** Стек по имени — генерация из дерева называет его аргументом. */
export function stackById(stacks: Stacks, id: string): StackEntry | null {
  return stacks().find((entry) => entry.stack.id === id) ?? null;
}

/**
 * Активен ли документ, который печатает какой-нибудь стек. Чистая и дешёвая — её зовут на
 * каждый кадр: по ней видны панель и команда генерации.
 */
export function stackDocumentVisible(stacks: Stacks): (ctx: WhenContext) => boolean {
  return (ctx) => stackOfKind(stacks, ctx.activeResourceKind) !== null;
}

/**
 * Цели к печати одним стеком: его собственные, общие (без стека) и замены его целей — без
 * заменённых и без устаревших замен. Общее правило замен — из toolkit, устаревание узнаёт стек.
 */
export function targetsFor(
  targets: readonly CodegenTarget[],
  stack: CodegenStack
): readonly CodegenTarget[] {
  const stale: StaleOverride<CodegenTarget> | undefined =
    stack.staleOverride === undefined
      ? undefined
      : (target, replaced) => stack.staleOverride?.(target, replaced) ?? null;
  return applyOverrides(targetsOfStack(targets, stack.id), stale);
}

/**
 * Предупреждения о заменах по всему списку целей.
 *
 * Устаревание замены спрашивается у каждого стека: заменённой цели может не быть вовсе (её
 * сняли с контракта), и чья она была, тогда знает только стек, который её снял.
 */
export function overrideProblems(
  targets: readonly CodegenTarget[],
  stacks: Stacks
): readonly CodegenProblem[] {
  const entries = stacks();
  return overrideDrift(targets, (target, replaced) => {
    for (const { stack } of entries) {
      const reason = stack.staleOverride?.(target, replaced) ?? null;
      if (reason !== null) return reason;
    }
    return null;
  });
}

/** Перевод текста стека; стека уже нет — сам ключ, чтобы отказ не пропал молча. */
export function stackText(stacks: Stacks, stackId: string, text: CodegenText): string {
  const entry = stackById(stacks, stackId);
  return entry === null ? text.key : entry.stack.translate(text.key, text.params);
}
