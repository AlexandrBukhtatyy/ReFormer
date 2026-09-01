/**
 * Применение набора изменений к рабочей области.
 *
 * Здесь сходятся три решения, и каждое из них — граница, а не удобство.
 *
 * **Пишем через `Workspace.writeText`, как все.** У ассистента нет и не будет своего канала
 * записи: он правит форму той же дверью, что человек и структурный редактор. Отсюда же берётся
 * аудит — правка попадает в журнал рабочей области сама, потому что журнал ведёт она.
 *
 * Одна дверь на двоих означает, что различить их можно только пометкой, и она здесь есть:
 * запись уходит с `origin: 'agent'` и с `txId` хода. Без пометки журнал писал бы `user` на
 * всё подряд, и аудит терял ровно то, ради чего заводился, — ответ на вопрос «это правил
 * человек или машина?». `txId` делает ход отменяемым целиком (`Journal.undoTransaction`),
 * включая тот случай, когда попыток было две и записей в буфер тоже две.
 *
 * **Ход — ОДНА запись.** Не потому, что кто-то завёл транзакцию, а потому, что весь ход
 * приземляется одним `writeText`: инструменты копят черновик (`core/changeset`), а в буфер
 * уходит его итог. Отсюда «отменить ход» — одно действие и в журнале, и в истории редактора,
 * который увидит правку буфера целиком.
 *
 * **Строгий гейт — барьер.** Ни один выход агента не попадает в буфер, минуя `validateSchema`
 * в строгом режиме. Гейт на каждой правке (`core/gate`) существует ради обратной связи модели,
 * но полагаться на него как на единственную защиту нельзя: набор мог быть собран раньше, чем
 * переключили вкладку или кит.
 *
 * ## Расхождение сравнивается ТЕКСТОМ
 *
 * В v1 конфликт определялся сравнением ссылок на иммутабельную схему вкладки. Здесь истина —
 * буфер рабочей области, и единственное сравнение, которое ничего не выдумывает, — сравнение
 * текста на начало хода с текстом сейчас. Оно ловит и правку руками в Monaco, и правку
 * структурным редактором, и правку командой, которую ассистент сам же и вызвал по ходу.
 *
 * Молча перезаписать расхождение нельзя: `force` существует, но приходит только от кнопки,
 * которую нажал человек, увидев предупреждение.
 *
 * @module plugins/ai/session/apply
 */

import { hasChanges, type ChangeSet } from '../model/changeset';
import { validateSchema, type LoadValidateForm } from '../model/validate';
import type { AiHost } from '../host';
import { printSchemaText } from '../model/schema-text';
import type { PendingChanges } from './session';

/** Исход применения. */
export type ApplyOutcome =
  | { readonly status: 'applied' }
  /** Применять нечего. */
  | { readonly status: 'empty' }
  /** Документа больше нет: вкладку закрыли или проект закрыли. */
  | { readonly status: 'no-form' }
  /** Буфер разошёлся с базой хода: форму правили, пока ассистент работал. */
  | { readonly status: 'conflict' }
  /** Набор не проходит строгий гейт. */
  | { readonly status: 'invalid'; readonly errors: readonly string[] }
  /**
   * Применить не удалось: рабочая область отказала в записи либо не загрузилась проверка,
   * без которой строгий гейт не барьер, а видимость барьера.
   */
  | { readonly status: 'failed'; readonly error: unknown };

/** Настройки применения. */
export interface ApplyOptions {
  /** Применить, несмотря на расхождение с буфером (осознанный выбор пользователя). */
  readonly force?: boolean;
}

/** Что нужно применению от платформы. */
export interface ApplyDeps {
  readonly host: Pick<AiHost, 'documentOf' | 'writeText' | 'catalog'>;
  /**
   * Заказ проверки по мета-схеме. ЗАКАЗ, а не сама функция: применение асинхронно и уже ждёт
   * записи, поэтому дождаться загрузки здесь ничего не стоит, а вызывающему не приходится
   * держать разрешённое значение и решать, что делать с отказом загрузки. Отказ здесь —
   * {@link ApplyOutcome} со статусом `failed`, потому что без проверки барьера нет.
   */
  readonly validateForm: LoadValidateForm;
}

/**
 * Разошёлся ли буфер с базой хода.
 *
 * Отдельно от применения, потому что спрашивает об этом ещё и панель: кнопка обязана называться
 * «Применить всё равно» ДО того, как её нажали, а не после отказа.
 *
 * Просит ТОЛЬКО рабочую область, а не весь {@link ApplyDeps}: вопрос «разошёлся ли текст»
 * решается сравнением строк, и требовать ради него загрузчик проверки значило бы заставить
 * панель держать то, чем она не пользуется, — и грузить 120 кБ ради подписи на кнопке.
 */
export function isStale(deps: Pick<ApplyDeps, 'host'>, pending: PendingChanges): boolean {
  const document = deps.host.documentOf(pending.resource);
  return document === null || document.getText() !== pending.baseText;
}

/** Применить набор изменений к рабочей копии. */
export async function applyChangeSet(
  deps: ApplyDeps,
  pending: PendingChanges,
  options: ApplyOptions = {}
): Promise<ApplyOutcome> {
  const set: ChangeSet = pending.set;
  if (!hasChanges(set)) return { status: 'empty' };

  const document = deps.host.documentOf(pending.resource);
  if (document === null) return { status: 'no-form' };
  if (document.getText() !== pending.baseText && options.force !== true) {
    return { status: 'conflict' };
  }

  // Загрузка заказывается ПОСЛЕ дешёвых проверок: набору, который и так не ляжет (нечего
  // применять, вкладку закрыли, буфер разошёлся), проверка не нужна вовсе.
  let validateForm;
  try {
    validateForm = await deps.validateForm();
  } catch (error) {
    // Не `invalid`: схема не отвергнута, её нечем было проверить. Пропустить гейт нельзя —
    // он барьер, а барьер, отсутствие которого выглядит как успех, хуже отсутствующего.
    return { status: 'failed', error };
  }

  const { valid, errors } = validateSchema(set.draft, {
    catalog: deps.host.catalog(),
    baseline: set.base,
    rules: set.draftRules,
    validateForm,
  });
  if (!valid) return { status: 'invalid', errors };

  try {
    // Одна запись — весь ход. Ни цикла по правкам, ни второго `writeText` здесь нет и быть
    // не должно: второй превратил бы ход в две записи журнала и две отмены.
    //
    // `origin: 'agent'` — единственное место, где ассистент называет себя рабочей области.
    // Канал записи у него тот же, что у человека (в этом граница прав), поэтому пометка —
    // единственное, чем правка машины отличима от правки руками в журнале аудита. Из неё же
    // следует, что записи ассистента и человека не схлопываются в одну: `canMerge` сравнивает
    // происхождение.
    await deps.host.writeText(pending.resource, printSchemaText(set.draft), {
      origin: 'agent',
      ...(pending.txId === undefined ? {} : { txId: pending.txId }),
    });
  } catch (error) {
    return { status: 'failed', error };
  }
  return { status: 'applied' };
}
