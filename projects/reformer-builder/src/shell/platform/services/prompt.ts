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
 * Служба запросов — очередь, из которой рисует диалог оболочки.
 *
 * Объявление службы, запросов и токен живут в пакете `@reformer/builder-plugin-api`.
 *
 * @module shell/platform/services/prompt
 */

import { createEventBus } from '@/shell/platform/primitives/event';
import { defineEvent } from '@reformer/builder-plugin-api/internal';
import {
  type PendingPrompt,
  type PromptAnswer,
  type PromptRequest,
  type PromptService,
} from '@reformer/builder-plugin-api/internal';

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
