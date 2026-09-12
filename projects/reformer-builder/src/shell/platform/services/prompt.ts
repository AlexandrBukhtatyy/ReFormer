/**
 * Запрос к человеку: спросить имя, подтверждение или выбор из списка — и ничего больше.
 *
 * ## Почему служба, а не диалог внутри панели
 *
 * Переименование живёт в трёх местах сразу: пункт контекстного меню дерева, клавиша `F2`
 * и палитра команд. Если диалог принадлежит панели, то из палитры он недоступен вовсе —
 * панель может быть даже не смонтирована. А поскольку действие обязано быть ОДНОЙ командой
 * (это правило реестра: палитра, сочетания и ассистент ходят одной дверью), диалог обязан
 * быть доступен команде, а не панели.
 *
 * Отсюда форма: команда зовёт `input`/`confirm` и получает обещание ответа; оболочка
 * подписана на очередь и рисует то, что в ней лежит. Ровно то же разделение, что
 * у уведомлений, — с одним отличием, которое всё и определяет: **уведомление ничего не
 * ждёт, а запрос ждёт ответа**, поэтому здесь есть обещание и есть `resolve`.
 *
 * ## Отмена — это `null`, а не отказ
 *
 * Escape, крестик и щелчок мимо диалога равны отмене, и отмена — законный исход, а не ошибка.
 * Бросок означал бы `try/catch` вокруг каждого вызова и «ошибку» в журнале там, где человек
 * просто передумал.
 *
 * ## Проверка ввода живёт у СПРАШИВАЮЩЕГО
 *
 * `validate` — часть запроса, а не служба: правила имени файла знают операции над ресурсами,
 * правила имени шаблона — плагин шаблонов, и служба, взявшаяся судить, обязана была бы знать
 * обоих. Возвращается ключ сообщения (или `null`), потому что показывать текст будет
 * оболочка, а она переводит.
 *
 * ## Очередь, а не единственный запрос
 *
 * Два запроса подряд — обычное дело (команда переименования сразу после создания), а
 * потерянный второй выглядит как зависший интерфейс. Показывается всегда первый в очереди;
 * ответ снимает его и открывает следующий.
 *
 * ## Выбор из списка — третий вид запроса, а не режим палитры
 *
 * «Недавно открытые» по `Ctrl+R` — это список, из которого выбирают с клавиатуры, и ответа
 * ждёт КОМАНДА: та же форма, что у имени и подтверждения, — обещание ответа и отмена как
 * `null`. Палитра для этого не годится: она общий список команд без своего режима и без кнопок
 * у пунктов, а меню не открыть с клавиши и не отфильтровать набором. Пункты — готовые строки:
 * это данные (имена проектов), а не сообщения, и переводить их нечем.
 *
 * @module shell/platform/services/prompt
 */

import type { Disposable } from '@reformer/builder-plugin-api/internal';
import { createEventBus } from '@/shell/platform/primitives/event';
import { defineEvent } from '@reformer/builder-plugin-api/internal';
import { defineService } from '@reformer/builder-plugin-api/internal';

/** Проверка введённого значения: ключ сообщения об ошибке или `null`, если всё хорошо. */
export type PromptValidator = (value: string) => string | null;

/** Общая часть запроса: заголовок и необязательное пояснение — ключами i18n. */
export interface PromptRequestBase {
  /** Ключ i18n заголовка. */
  readonly titleKey: string;
  /** Ключ i18n пояснения под заголовком. */
  readonly descriptionKey?: string;
  /** Параметры подстановки для заголовка и пояснения (имя файла, число записей). */
  readonly params?: Readonly<Record<string, unknown>>;
  /**
   * Чей это словарь. Тот же приём, что у заголовков команд в палитре: ключ сам по себе
   * не говорит, где его искать, и без владельца запрос плагина показывал бы маркер промаха.
   */
  readonly pluginId?: string;
}

/** Запрос строки. */
export interface PromptInputRequest extends PromptRequestBase {
  readonly kind: 'input';
  /** Начальное значение поля. */
  readonly value?: string;
  /** Ключ i18n подписи поля — для скринридера и для метки над полем. */
  readonly labelKey?: string;
  /** Ключ i18n подписи кнопки подтверждения; без него оболочка возьмёт свою. */
  readonly confirmKey?: string;
  /** Ключ i18n подписи кнопки отмены; без него оболочка возьмёт свою. */
  readonly cancelKey?: string;
  /**
   * Что выделить при открытии.
   *
   * `stem` — имя без расширения: переименовывая `schema.json`, человек меняет `schema`,
   * и выделять точку с расширением значило бы заставлять его каждый раз их дописывать.
   */
  readonly select?: 'all' | 'stem';
  readonly validate?: PromptValidator;
}

/** Запрос подтверждения. */
export interface PromptConfirmRequest extends PromptRequestBase {
  readonly kind: 'confirm';
  readonly confirmKey?: string;
  readonly cancelKey?: string;
  /** Опасное действие: оболочка покажет подтверждение красным. */
  readonly tone?: 'default' | 'danger';
}

/** Пункт выбора из списка. */
export interface PromptPickItem {
  /** Уникален в пределах запроса; его и возвращает {@link PromptService.pick}. */
  readonly id: string;
  /** Готовая строка: пункты — данные, а не сообщения. */
  readonly label: string;
  /** Пояснение справа: дата, раздел. Участвует в поиске — как пояснение пункта палитры. */
  readonly description?: string;
}

/** Выбор из списка. */
export interface PromptPickRequest extends PromptRequestBase {
  readonly kind: 'pick';
  /**
   * Пункты в порядке показа. Порядок — решение спрашивающего (у недавних это свежесть):
   * поиск его не пересчитывает, пока пункты совпадают с запросом одинаково.
   */
  readonly items: readonly PromptPickItem[];
  /** Ключ i18n подсказки в поле поиска. */
  readonly placeholderKey?: string;
  /** Ключ i18n текста для пустого списка; без него оболочка возьмёт свой. */
  readonly emptyKey?: string;
  /**
   * Кнопка «убрать» на каждом пункте — «Remove from Recently Opened» из VS Code.
   *
   * Зовёт её оболочка, и окно при этом остаётся открытым: человек чистит список, а не выбирает.
   * Пункт исчезает сразу, не дожидаясь `run`: ответ хранилища ничего не меняет в том, что
   * человек уже увидел. Отказ `run` уходит в консоль.
   */
  readonly remove?: {
    /** Ключ i18n подписи кнопки — для скринридера и всплывающей подсказки. */
    readonly labelKey: string;
    run(id: string): void | Promise<void>;
  };
}

export type PromptRequest = PromptInputRequest | PromptConfirmRequest | PromptPickRequest;

/** Запрос, ждущий ответа: то, что оболочка сейчас рисует. */
export type PendingPrompt = PromptRequest & {
  /** Выдаётся службой; годится React-ключом и адресом ответа. */
  readonly id: string;
};

/** Ответ на запрос: строка либо согласие; отмена — всегда `null`. */
export type PromptAnswer = string | boolean | null;

export interface PromptService {
  /** Спрашивает строку. `null` — отменили. */
  input(request: Omit<PromptInputRequest, 'kind'>): Promise<string | null>;
  /** Спрашивает согласие. Отмена — `false`: несделанное действие и есть отказ. */
  confirm(request: Omit<PromptConfirmRequest, 'kind'>): Promise<boolean>;
  /** Спрашивает выбор из списка. Ответ — `id` пункта; отмена — `null`. */
  pick(request: Omit<PromptPickRequest, 'kind'>): Promise<string | null>;
  /**
   * Текущий запрос или `null`. Ссылка стабильна между изменениями — условие
   * `useSyncExternalStore`.
   */
  current(): PendingPrompt | null;
  /**
   * Отвечает на текущий запрос. Отвечает ОБОЛОЧКА, а не спрашивающий.
   *
   * Идентификатор обязателен: между отрисовкой и нажатием запрос мог смениться (команда
   * отменила его, плагин выключили), и ответ «да» ушёл бы не тому вопросу.
   */
  resolve(id: string, answer: PromptAnswer): void;
  /** Снимает все ожидающие запросы отменой: закрытие проекта, выключение плагина. */
  cancelAll(): void;
  observe(cb: () => void): Disposable;
}

export const PromptServiceToken = defineService<PromptService>('reformer.prompt');

const PromptDidChange = defineEvent<void>('prompt.didChange');

interface Waiting {
  readonly prompt: PendingPrompt;
  readonly settle: (answer: PromptAnswer) => void;
}

/**
 * Потолок очереди.
 *
 * Запрос ждёт человека, поэтому очередь длиной в сотню означает не нагрузку, а цикл,
 * который спрашивает без остановки. Лишнее отменяется сразу — тот, кто спросил, получит
 * `null` и не будет ждать вечно.
 */
const MAX_PENDING = 16;

export function createPromptService(): PromptService {
  const queue: Waiting[] = [];
  const bus = createEventBus();
  let nextId = 0;

  const changed = (): void => {
    bus.emit(PromptDidChange, undefined);
  };

  const ask = (request: PromptRequest): Promise<PromptAnswer> => {
    if (request.titleKey.trim() === '') {
      throw new Error('prompt: ключ заголовка не может быть пустым');
    }
    if (queue.length >= MAX_PENDING) {
      return Promise.resolve(null);
    }
    const id = `p${++nextId}`;
    return new Promise<PromptAnswer>((resolve) => {
      queue.push({ prompt: Object.freeze({ ...request, id }), settle: resolve });
      changed();
    });
  };

  return {
    // Не `async`, и это существенно: негодный запрос — ошибка ВЫЗЫВАЮЩЕГО, и она обязана
    // быть броском в его кадре, а не отклонённым обещанием, которое всплывёт без стека.
    input(request) {
      return ask({ ...request, kind: 'input' }).then((answer) =>
        typeof answer === 'string' ? answer : null
      );
    },

    confirm(request) {
      return ask({ ...request, kind: 'confirm' }).then((answer) => answer === true);
    },

    pick(request) {
      return ask({ ...request, kind: 'pick' }).then((answer) =>
        // Ответ сверяется со списком: оболочка отвечает идентификатором пункта, и строка,
        // которой в запросе не было, — ответ не на этот вопрос.
        typeof answer === 'string' && request.items.some((item) => item.id === answer)
          ? answer
          : null
      );
    },

    current() {
      return queue[0]?.prompt ?? null;
    },

    resolve(id, answer) {
      const at = queue.findIndex((item) => item.prompt.id === id);
      // Ответ на снятый запрос — не ошибка: диалог мог закрыться в тот же кадр, в котором
      // запрос отменили. Ронять здесь означало бы падать на гонке, которая ничего не значит.
      if (at === -1) return;
      const [waiting] = queue.splice(at, 1);
      waiting?.settle(answer);
      changed();
    },

    cancelAll() {
      if (queue.length === 0) return;
      const waiting = queue.splice(0, queue.length);
      for (const item of waiting) item.settle(null);
      changed();
    },

    observe(cb) {
      return bus.on(PromptDidChange, cb);
    },
  };
}
