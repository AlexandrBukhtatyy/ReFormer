/**
 * Точка расширения редакторов и выбор кандидата по ресурсу.
 *
 * ## Выбор идёт не по расширению
 *
 * `.json` бывает и схемой формы, и конфигом пакета, поэтому таблица «расширение → редактор»
 * неверна в самой посылке: ответ зависит от содержимого, а не от имени. Кандидат отвечает
 * {@link EditorContribution.canOpen} — числом (приоритет, больше — предпочтительнее) или
 * `false` (отказ), и решение принимается по успеху разбора, а не по суффиксу.
 *
 * ## Содержимое читается один раз на всех кандидатов
 *
 * Ради этого существует `EditorProbe`. Он объявлен в `workspace/model/provider` и переиспользуется
 * здесь как есть: один и тот же объект уходит и в `applies` провайдера модели, и в `canOpen`
 * редактора, поэтому второго типа с той же формой заводить нельзя — они разъедутся.
 *
 * Читает {@link chooseEditor}: одно обращение к тексту, затем синхронный опрос всех кандидатов
 * над готовой пробой. Кандидатов может быть сколько угодно — обращений к рабочей области
 * останется одно. `canOpen` синхронна именно поэтому: асинхронный кандидат вернул бы себе
 * право читать самостоятельно, и запрет N+1 держался бы на дисциплине.
 *
 * Двоичный ресурс НЕ читается вовсе: `readText` над ним — отказ по контракту рабочей области,
 * и тянуть содержимое ради отказа незачем. Такие кандидаты решают по `ref.mediaType`,
 * а проба честно отвечает отказом на `text()` — см. {@link createUnreadableProbe}.
 *
 * ## `viewState` — только состояние вида
 *
 * Прокрутка, свёрнутые ветки, позиция каретки. Выделение туда не входит: оно часть модели
 * правки, живёт в снимке отмены и следует за узлом при вставках и перемещениях. Редактор,
 * положивший выделение в `viewState`, получил бы вторую его копию — расходящуюся с первой.
 *
 * @module shell/platform/ui/contributions/editors
 */

import type { ComponentType } from 'react';
import type { CommandContribution } from '@/shell/platform/primitives/command';
import {
  defineExtensionPoint,
  type Contribution,
} from '@/shell/platform/primitives/extension-point';
import {
  isTextMediaType,
  type ResourceId,
  type ResourceRef,
} from '@/shell/platform/primitives/resource';
import type { Document } from '@/shell/platform/workspace/document';
import { createEditorProbe, type EditorProbe } from '@/shell/platform/workspace/model/provider';
import type { PanelContribution } from '../slots';

/**
 * Редактор — вклад, отвечающий на два вопроса: берётся ли он за ресурс и чем его рисовать.
 *
 * Панели и команды перечислены ЗДЕСЬ, а не вносятся отдельно, потому что у них другой срок
 * жизни: инспектор без своего редактора бессмыслен. Вносит их тот, кто редактор подключает;
 * видимостью по-прежнему управляет `when` (см. `./slots`), а не перерегистрация.
 */
export interface EditorContribution {
  /** Уникален среди редакторов; служит ключом состояния вида и адресом в диагностике. */
  readonly id: string;
  /**
   * Приоритет или отказ. Больше — предпочтительнее; `false` — «это не ко мне».
   *
   * Обязана быть синхронной, чистой и быстрой: её зовут для каждого кандидата на каждое
   * открытие. Содержимое берётся из пробы, а не читается самостоятельно.
   */
  canOpen(ref: ResourceRef, probe: EditorProbe): number | false;
  /**
   * Ключ заголовка для выбора «открыть с помощью» — необязателен.
   *
   * Разрешается в пространстве имён ВНЁСШЕГО плагина, как у панели (см. `panelTitle`
   * в `./panels`): словарь всегда чей-то, и `editor.label` двух разных плагинов — две
   * разные строки. Редактор, который себя не назвал, показывается своим `id`: это честно
   * (имя вклада — то, что про него известно) и не требует правки чужого плагина ради
   * появления пункта в меню.
   */
  readonly titleKey?: string;
  readonly Body: ComponentType<{ documentId: ResourceId }>;
  readonly contributes?: {
    readonly panels?: readonly PanelContribution[];
    readonly commands?: readonly CommandContribution[];
  };
  /**
   * Состояние вида: прокрутка, свёрнутые ветки, позиция каретки — и ничего больше.
   *
   * Обе операции адресуются документом, а не редактором: один редактор обслуживает много
   * вкладок, и «восстанови прокрутку» без адреса означало бы одну прокрутку на всех.
   */
  readonly viewState?: {
    capture(id: ResourceId): unknown;
    restore(id: ResourceId, state: unknown): void;
  };
}

/**
 * Точка расширения редакторов.
 *
 * Заполняется только через `PluginContext.extensions`: у корневого реестра метода `contribute`
 * нет вовсе, поэтому «редактор, внесённый самим Host» невыразим. Пока вкладов нет, центр
 * оболочки показывает пустое состояние — это нормальное состояние Э5, а не незавершённость.
 */
export const EditorPoint = defineExtensionPoint<EditorContribution>('editor');

/** Вклад редактора вместе с происхождением и React-ключом. */
export type EditorEntry = Contribution<EditorContribution>;

/** Кандидат, согласившийся открыть ресурс, вместе с объявленным приоритетом. */
export interface EditorCandidate {
  readonly entry: EditorEntry;
  readonly priority: number;
}

/**
 * Куда сообщать о падении `canOpen`.
 *
 * Политика та же, что у предиката панели и у провайдера модели: упавший кандидат
 * пропускается, остальные спрашиваются дальше. Иначе один сломанный плагин делал бы
 * недоступной часть файлов и не сообщал бы об этом ничем, кроме отказа открытия.
 */
export type EditorCandidateErrorHandler = (error: unknown, entry: EditorEntry) => void;

function defaultOnCandidateError(error: unknown, entry: EditorEntry): void {
  console.error(
    `[shell] редактор «${entry.value.id}» плагина «${entry.pluginId}»: canOpen бросил`,
    error
  );
}

/**
 * Согласившиеся кандидаты в порядке предпочтения.
 *
 * Приоритет — число, и принимается только конечное: `NaN` и бесконечности отсеиваются как
 * отказ. Это не педантизм — `NaN` в сравнении даёт `false` в обе стороны, и один такой ответ
 * сделал бы порядок кандидатов зависящим от реализации сортировки, то есть невоспроизводимым.
 *
 * При равном приоритете выигрывает тот, кто раньше в реестре (`order` вклада, при равенстве —
 * порядок регистрации): сортировка устойчива, а реестр уже отсортирован.
 */
export function rankEditors(
  entries: readonly EditorEntry[],
  ref: ResourceRef,
  probe: EditorProbe,
  onError: EditorCandidateErrorHandler = defaultOnCandidateError
): readonly EditorCandidate[] {
  const candidates: EditorCandidate[] = [];
  for (const entry of entries) {
    let answer: number | false;
    try {
      answer = entry.value.canOpen(ref, probe);
    } catch (error) {
      onError(error, entry);
      continue;
    }
    if (typeof answer !== 'number' || !Number.isFinite(answer)) continue;
    candidates.push({ entry, priority: answer });
  }
  return candidates.sort((a, b) => b.priority - a.priority);
}

/**
 * Кандидат с наибольшим приоритетом или `null`, если не вызвался никто.
 *
 * `null` — законный ответ, а не ошибка: файл без редактора показывается пустым состоянием,
 * и это лучше, чем отказ открыть. Пока точка расширения пуста, `null` — единственный ответ.
 */
export function resolveEditor(
  entries: readonly EditorEntry[],
  ref: ResourceRef,
  probe: EditorProbe,
  onError?: EditorCandidateErrorHandler
): EditorEntry | null {
  return rankEditors(entries, ref, probe, onError)[0]?.entry ?? null;
}

/**
 * Проба над ресурсом, который текстом не читается.
 *
 * Отказ, а не пустая строка: кандидат, разбирающий содержимое, обязан отличить «пустой файл»
 * от «содержимое недоступно». Промис создаётся в момент вызова, а не заранее, — иначе
 * необращение к пробе давало бы необработанный отказ промиса.
 */
export function createUnreadableProbe(ref: ResourceRef): EditorProbe {
  return {
    text: () =>
      Promise.reject(new Error(`ресурс не читается текстом: ${ref.id} (${ref.mediaType})`)),
  };
}

/**
 * Проба, читающая содержимое лениво и не более одного раза.
 *
 * Для дерева ресурсов: декорации получают пробу на каждый файл уровня, и если бы она читала
 * заранее, раскрытие каталога стоило бы N чтений вместо одного листинга. `peek` здесь нет
 * намеренно — синхронный вклад обязан решать по `ref`, а не притворяться, что содержимое есть.
 */
export function createLazyEditorProbe(read: () => Promise<string>): EditorProbe {
  let pending: Promise<string> | null = null;
  return {
    text: () => {
      pending ??= read();
      return pending;
    },
  };
}

/** Чтение текста ресурса — ровно та часть рабочей области, которая нужна выбору редактора. */
export type ReadResourceText = (id: ResourceId) => Promise<string>;

/**
 * Выбирает редактор для ресурса, прочитав его содержимое ОДИН раз.
 *
 * Это и есть ответ на вопрос «сколько раз читается файл при открытии»: один, независимо
 * от числа кандидатов. Двоичный ресурс не читается ни разу — {@link createUnreadableProbe}.
 *
 * Отказ чтения не глотается: файл мог исчезнуть между листингом и открытием, и показать
 * вместо этого «редактора нет» значило бы соврать про причину.
 */
export async function chooseEditor(
  entries: readonly EditorEntry[],
  ref: ResourceRef,
  readText: ReadResourceText,
  onError?: EditorCandidateErrorHandler
): Promise<EditorEntry | null> {
  // Пустая точка расширения — обычное состояние Э5. Читать ради никого незачем.
  if (entries.length === 0) return null;
  const probe = isTextMediaType(ref.mediaType)
    ? createEditorProbe(await readText(ref.id))
    : createUnreadableProbe(ref);
  return resolveEditor(entries, ref, probe, onError);
}

/**
 * Выбирает редактор для УЖЕ ОТКРЫТОГО документа — не читая ничего.
 *
 * Содержимое открытого документа уже в буфере: его прочитал `workspace.open`, ровно один раз.
 * Поэтому проба строится над `getText()`, а не над новым обращением к рабочей области, и
 * переключение вкладок не стоит ни одного чтения. Это же делает выбор синхронным: у вкладки,
 * которую рисуют, документ есть всегда.
 */
export function resolveEditorForDocument(
  entries: readonly EditorEntry[],
  document: Pick<Document, 'ref' | 'getText'>,
  onError?: EditorCandidateErrorHandler
): EditorEntry | null {
  if (entries.length === 0) return null;
  return resolveEditor(entries, document.ref, createEditorProbe(document.getText()), onError);
}

/** Пустой список кандидатов: одна ссылка — его читает `useMemo` и сравнивает по ссылке. */
const NO_CANDIDATES: readonly EditorCandidate[] = Object.freeze([]);

/**
 * ВСЕ согласившиеся кандидаты на уже открытый документ, в порядке предпочтения.
 *
 * Отличается от {@link resolveEditorForDocument} ровно тем, что не выбрасывает проигравших:
 * они и есть меню «открыть с помощью». Отбор один и тот же — `canOpen`, — поэтому меню
 * не может предложить редактор, который за файл не берётся, и не может умолчать о том,
 * который берётся. Второго списка кандидатов в оболочке нет и быть не должно: он разошёлся
 * бы с тем, по которому редактор выбирается на самом деле.
 */
export function rankEditorsForDocument(
  entries: readonly EditorEntry[],
  document: Pick<Document, 'ref' | 'getText'>,
  onError?: EditorCandidateErrorHandler
): readonly EditorCandidate[] {
  if (entries.length === 0) return NO_CANDIDATES;
  return rankEditors(entries, document.ref, createEditorProbe(document.getText()), onError);
}

/**
 * Состояние вида по паре «редактор + документ».
 *
 * Ключ составной, потому что состояние принадлежит паре: у структурного редактора свёрнуты
 * ветки, у текстового — прокрутка, и одно и то же поле у них означает разное. Один ключ
 * на документ означал бы, что переключение вида восстанавливает чужое состояние.
 *
 * Хранилище держит непрозрачные значения и никогда в них не заглядывает: что именно там
 * лежит, знает только редактор, который это положил.
 */
export interface ViewStateStore {
  /** Снимает состояние вида у редактора и запоминает его. Редактор без `viewState` пропускается. */
  capture(entry: EditorEntry, id: ResourceId): void;
  /** Возвращает состояние редактору. Ничего не запомнено — `restore` не зовётся вовсе. */
  restore(entry: EditorEntry, id: ResourceId): void;
  /** Забывает состояние документа во ВСЕХ редакторах: вкладку закрыли, восстанавливать нечего. */
  forget(id: ResourceId): void;
  /** Есть ли запомненное состояние. Нужно диагностике и тестам. */
  has(entry: EditorEntry, id: ResourceId): boolean;
}

/**
 * Разделитель составного ключа.
 *
 * Пробел: в идентификаторе редактора и в идентификаторе ресурса он невыразим (первый —
 * имя вклада, второй — `sourceId:path`), поэтому склейка однозначна, а `:` был бы двусмыслен.
 */
const VIEW_STATE_KEY_SEPARATOR = ' ';

export function createViewStateStore(): ViewStateStore {
  const states = new Map<string, unknown>();
  const keyOf = (entry: EditorEntry, id: ResourceId): string =>
    `${entry.value.id}${VIEW_STATE_KEY_SEPARATOR}${id}`;

  return {
    capture(entry, id) {
      const viewState = entry.value.viewState;
      if (viewState === undefined) return;
      try {
        states.set(keyOf(entry, id), viewState.capture(id));
      } catch (error) {
        // Несохранённая прокрутка — не повод рвать переключение вкладки.
        console.error(`[shell] редактор «${entry.value.id}»: capture состояния вида бросил`, error);
      }
    },

    restore(entry, id) {
      const viewState = entry.value.viewState;
      if (viewState === undefined) return;
      const key = keyOf(entry, id);
      if (!states.has(key)) return;
      try {
        viewState.restore(id, states.get(key));
      } catch (error) {
        console.error(`[shell] редактор «${entry.value.id}»: restore состояния вида бросил`, error);
      }
    },

    forget(id) {
      const suffix = `${VIEW_STATE_KEY_SEPARATOR}${id}`;
      for (const key of [...states.keys()]) {
        if (key.endsWith(suffix)) states.delete(key);
      }
    },

    has: (entry, id) => states.has(keyOf(entry, id)),
  };
}
