/**
 * Запросы к человеку: ввод строки, подтверждение, выбор из списка.
 *
 * Здесь ОБЪЯВЛЕНИЕ. Очередь запросов и диалог живут в оболочке билдера: плагин спрашивает,
 * а как вопрос выглядит и что делать со вторым одновременным — решает она.
 *
 * @module @reformer/builder-plugin-api/services/prompt
 */

import type { Disposable } from '../primitives/disposable';
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
