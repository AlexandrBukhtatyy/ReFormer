/**
 * Разрешение расхождения: собрать три стороны, слить, ПЕРЕРАЗОБРАТЬ, записать исход.
 *
 * Слияние текста живёт в `./text-merge` и про форматы не знает ничего. Здесь — то, что знает:
 * откуда берутся стороны, что делать с результатом и почему одного слияния мало.
 *
 * ## Повторный разбор обязателен
 *
 * Записано в контракте (`docs/assistant-and-merge.md`, Э11) и здесь не обсуждается:
 *
 * ```text
 * BASE + YOURS + THEIRS
 *         │
 *         ├── непересекающиеся участки  → слить автоматически
 *         │                                └── разобрать
 *         │                                     ├── разобралось → принять
 *         │                                     └── нет         → диалог
 *         └── пересекающиеся участки    → диалог
 * ```
 *
 * Причина не формальная. Слияние по строкам не знает про запятые и скобки: два аккуратных,
 * непересекающихся изменения JSON дают текст, который не разбирается, — и без проверки он
 * молча уехал бы в источник. Поэтому разбор идёт ДО записи, а не после: разобранный обратно
 * документ — это то, что модельный документ соберёт из слитого текста, а не слитая модель.
 *
 * **Исключений из проверки нет.** Даже когда слияние дало текст, равный нашему, — если он
 * не разбирается, спрашиваем. Соблазн добавить оговорку «наш и так был сломан, значит слияние
 * ни при чём» велик, но эта оговорка — правило, которого в контракте нет, а цена ошибки в ней
 * несимметрична: молча записанный неразбираемый текст обнаруживают на чужой машине.
 *
 * ## Молча сторону не выбираем
 *
 * Единственный случай, когда никого не спрашивают, — {@link MergePlan} `identical`: наша версия
 * и версия источника посимвольно совпали. Там нет сторон, между которыми можно выбрать, а значит
 * нечего и терять. Всё остальное — либо автоматическое слияние (никто не проиграл: правки
 * не пересеклись и результат разобрался), либо вопрос.
 *
 * @module host/workspace/merge/resolve
 */

import type { ResourceId } from '@/shell/platform/primitives/resource';
import type { SaveConflict, Workspace } from '../workspace';
import { mergeThreeWay, type MergeOptions, type MergeResult } from './text-merge';

/** Три стороны и то, чем версия источника подписана. */
export interface MergeSides {
  /**
   * Общий предок — содержимое, каким его отдал источник, когда мы его прочитали.
   * `null` — основания нет: файл создан локально, а в источнике появился его тёзка.
   */
  readonly base: string | null;
  /** Рабочая копия сейчас. */
  readonly ours: string;
  /** Версия источника сейчас. `null` — файл из источника исчез. */
  readonly theirs: string | null;
  /**
   * Ревизия ПРОЧИТАННОЙ версии источника.
   *
   * Именно прочитанной, а не той, что приехала в отказе-конфликте. Между отказом и чтением
   * источник мог уехать ещё раз, и запись с ревизией из отказа тогда снова конфликтует —
   * бесконечно и необъяснимо для человека. Отказ говорит «мы разошлись»; с чем именно —
   * говорит чтение.
   */
  readonly theirsRevision?: string;
}

/** Разобрался ли текст. Сообщение — для диагностики, не для интерфейса: в нём код, не фраза. */
export type VerifyOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/**
 * Повторный разбор слитого текста.
 *
 * Внедряется, а не берётся из реестра провайдеров: разбор знает про формат, а слияние — нет,
 * и знание формата в этом модуле означало бы, что второй формат придётся вносить правкой ядра.
 * Для ресурса без провайдера модели подставляется {@link ALWAYS_PARSES} — и это не заглушка:
 * у markdown и `.ts`-сайдкара разбора действительно нет, ломаться там нечему.
 */
export type VerifyText = (text: string) => VerifyOutcome;

export const ALWAYS_PARSES: VerifyText = () => ({ ok: true });

/** Почему без человека не обойтись. */
export type AskReason =
  /** Участки пересеклись: обе стороны правили одно место по-разному. */
  | 'conflict'
  /** Слилось, но результат не разбирается — ровно то, ради чего разбор и делается. */
  | 'unparsable'
  /** Основания нет: сливать не от чего, любое сведение было бы догадкой. */
  | 'no-base'
  /** Файла в источнике больше нет. */
  | 'gone';

export type MergePlan =
  /** Стороны совпали посимвольно: выбирать не из чего, принимаем ревизию источника. */
  | { readonly kind: 'identical'; readonly text: string; readonly revision?: string }
  /** Слилось само и разобралось. */
  | { readonly kind: 'auto'; readonly text: string; readonly merged: MergeResult }
  /** Нужен человек. `merged` есть везде, кроме исчезнувшего файла: сливать не с чем. */
  | {
      readonly kind: 'ask';
      readonly reason: AskReason;
      readonly merged?: MergeResult;
      /** Сообщение разбора — только при `unparsable`. */
      readonly failure?: string;
    };

/**
 * Решает, чем кончится расхождение: само, или вопросом.
 *
 * Чистая функция: ни рабочей области, ни источника, ни React. Всё, что нужно, — три текста
 * и способ проверить разбор.
 */
export function planMerge(
  sides: MergeSides,
  verify: VerifyText = ALWAYS_PARSES,
  options?: MergeOptions
): MergePlan {
  if (sides.theirs === null) {
    // Файл удалили в источнике. Автоматически принять удаление нельзя (это потеря работы),
    // а «оставить свою» здесь означает создать файл заново — исход, который человек обязан
    // выбрать сам.
    return { kind: 'ask', reason: 'gone' };
  }

  if (sides.ours === sides.theirs) {
    return { kind: 'identical', text: sides.ours, revision: sides.theirsRevision };
  }

  // Основания нет — сливать не от чего. Показываем как конфликт двух сторон целиком:
  // пустое основание честно означает «общего у этих текстов мы не знаем».
  const merged = mergeThreeWay(sides.base ?? '', sides.ours, sides.theirs, options);
  if (sides.base === null) {
    return { kind: 'ask', reason: 'no-base', merged };
  }

  if (!merged.clean) {
    return { kind: 'ask', reason: 'conflict', merged };
  }

  const verified = verify(merged.text);
  if (!verified.ok) {
    return { kind: 'ask', reason: 'unparsable', merged, failure: verified.message };
  }

  return { kind: 'auto', text: merged.text, merged };
}

/*
 * ─────────────────────────  сбор сторон  ─────────────────────────
 */

/**
 * Рабочая область в объёме, нужном для сбора сторон.
 *
 * `Pick` от настоящей, а не свой интерфейс: форма обязана совпадать буква в букву, иначе
 * расхождение вскроется на композиции, а не на типах.
 */
export type MergeReader = Pick<Workspace, 'readBase' | 'readText' | 'readSourceText'>;

/**
 * Читает три стороны.
 *
 * Порядок обращений несущий: источник спрашивается ПОСЛЕДНИМ. Чтение из него — единственная
 * дорогая операция здесь, и делать её до того, как выяснилось, что читать локальные слои
 * получилось, значило бы платить за неё зря.
 */
export async function loadMergeSides(reader: MergeReader, id: ResourceId): Promise<MergeSides> {
  const base = await reader.readBase(id);
  const ours = await reader.readText(id);
  const theirs = await reader.readSourceText(id);
  return {
    base,
    ours,
    theirs: theirs === null ? null : theirs.text,
    theirsRevision: theirs?.revision,
  };
}

/*
 * ─────────────────────────  запись исхода  ─────────────────────────
 */

/** Что выбрал человек (или что решило автослияние). */
export type MergeChoice = 'ours' | 'theirs' | 'merged';

/**
 * Как исход попадает наружу.
 *
 * Два вида, и разница между ними не техническая: `push` пишет в источник, `adopt` не пишет.
 * «Взять версию источника» — это не запись того же самого обратно: у источника только на
 * чтение записи бы не вышло вовсе, а у файловой системы она подняла бы ревизию на пустом
 * месте и породила расхождение у соседа по проекту.
 */
export interface MergeCommit {
  readonly kind: 'push' | 'adopt';
  readonly text: string;
  /** Ревизия, поверх которой мы слили. Для `adopt` — она же становится нашей. */
  readonly expected?: string;
}

/** Выбор человека не соответствует собранным сторонам (взять источник, которого нет). */
export class MergeChoiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MergeChoiceError';
  }
}

export function commitFor(
  choice: MergeChoice,
  sides: MergeSides,
  mergedText?: string
): MergeCommit {
  switch (choice) {
    case 'theirs':
      if (sides.theirs === null) {
        throw new MergeChoiceError('версии источника нет: файл из него исчез');
      }
      return { kind: 'adopt', text: sides.theirs, expected: sides.theirsRevision };
    case 'ours':
      return { kind: 'push', text: sides.ours, expected: sides.theirsRevision };
    case 'merged':
      if (mergedText === undefined) {
        throw new MergeChoiceError('текст ручного слияния не передан');
      }
      return { kind: 'push', text: mergedText, expected: sides.theirsRevision };
  }
}

/** Рабочая область в объёме, нужном для записи исхода. */
export type MergeWriter = Pick<Workspace, 'writeText' | 'save' | 'acceptExternal'>;

export type MergeCommitResult =
  | { readonly status: 'done' }
  /** Источник уехал ещё раз, пока человек думал. Сливаться придётся заново, с новой ревизией. */
  | { readonly status: 'conflict'; readonly conflict: SaveConflict }
  | { readonly status: 'failed'; readonly message: string };

/**
 * Записывает исход.
 *
 * Путь наружу — тот же самый `save`, а не отдельный канал: правило «единственная дверь
 * в источник» держится и здесь, иначе слияние стало бы вторым местом, где рабочая копия
 * уходит в источник, и охранять пришлось бы оба.
 *
 * Запись рабочей копии идёт через `writeText`, поэтому буфер открытого документа обновляется
 * сам, а модельный документ переразбирает его — тот самый повторный разбор, но уже как
 * состояние документа, а не как проверка перед записью.
 */
/**
 * Чем кончилась попытка разрешить расхождение без человека.
 *
 * `ask` — не отказ, а нормальный исход: он несёт ровно то, что нужно диалогу, и второй раз
 * читать стороны не придётся.
 */
export type DivergenceOutcome =
  | { readonly kind: 'resolved'; readonly how: 'identical' | 'auto' }
  | { readonly kind: 'ask'; readonly sides: MergeSides; readonly plan: MergePlan }
  | { readonly kind: 'conflict'; readonly conflict: SaveConflict }
  | { readonly kind: 'failed'; readonly message: string };

/**
 * Полный ход разрешения: собрать стороны, слить, переразобрать, записать — или спросить.
 *
 * Существует затем, чтобы политика контракта («слилось и разобралось — принимаем; иначе
 * спрашиваем») лежала в ОДНОМ месте. Разложенная по композиции, она превратилась бы в десяток
 * строк, которые кто-нибудь однажды упростит до «взять свою», и это будет тихая потеря работы —
 * ровно то, что контракт запрещает.
 */
export async function resolveDivergence(
  workspace: MergeReader & MergeWriter,
  id: ResourceId,
  verify: VerifyText = ALWAYS_PARSES,
  options?: MergeOptions
): Promise<DivergenceOutcome> {
  const sides = await loadMergeSides(workspace, id);
  const plan = planMerge(sides, verify, options);

  if (plan.kind === 'identical') {
    // Наша версия и версия источника совпали посимвольно: принимаем ревизию, чтобы
    // расхождение не всплывало снова, и в источник не пишем ничего.
    await workspace.acceptExternal(id, plan.text, plan.revision);
    return { kind: 'resolved', how: 'identical' };
  }

  if (plan.kind === 'ask') return { kind: 'ask', sides, plan };

  const result = await applyMergeCommit(workspace, id, commitFor('merged', sides, plan.text));
  if (result.status === 'conflict') return { kind: 'conflict', conflict: result.conflict };
  if (result.status === 'failed') return { kind: 'failed', message: result.message };
  return { kind: 'resolved', how: 'auto' };
}

export async function applyMergeCommit(
  writer: MergeWriter,
  id: ResourceId,
  commit: MergeCommit
): Promise<MergeCommitResult> {
  if (commit.kind === 'adopt') {
    await writer.acceptExternal(id, commit.text, commit.expected);
    return { status: 'done' };
  }

  await writer.writeText(id, commit.text);
  const result = await writer.save(id, { expected: commit.expected });
  const conflict = result.conflicts[0];
  if (conflict !== undefined) return { status: 'conflict', conflict };
  const failure = result.failures[0];
  if (failure !== undefined) return { status: 'failed', message: failure.message };
  return { status: 'done' };
}
