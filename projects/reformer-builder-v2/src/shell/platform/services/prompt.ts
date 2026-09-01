/**
 * Запрос к человеку: спросить имя, спросить подтверждение — и ничего больше.
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
 * @module host/services/prompt
 */

import type { Disposable } from '../primitives/disposable';
import { createEventBus, defineEvent } from '../primitives/event';
import { defineService } from '../primitives/service';

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

export type PromptRequest = PromptInputRequest | PromptConfirmRequest;

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

export const PromptServiceToken = defineService<PromptService>('host.prompt');

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
