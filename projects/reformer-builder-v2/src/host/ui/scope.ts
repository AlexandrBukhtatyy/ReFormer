/**
 * Стек областей: какое окно сейчас сверху и какие открыты вообще.
 *
 * ## Зачем, если есть фокус
 *
 * Поле `focus` отвечает «в чём курсор» — поле ввода, дерево, канвас. Этого хватает панелям,
 * но не окнам: диалог и палитра забирают фокус СЕБЕ, и с точки зрения `focus` они выглядят
 * как обычное поле ввода. Различить «человек печатает в инспекторе» и «человек печатает
 * в палитре команд» через фокус нельзя, а клавиши у них разные.
 *
 * Область называет ОКНО и объявляется тем, кто его открыл. Она читается как ключ `scope`
 * (верх стека) и `scopes` (весь стек), поэтому в условии пишется обычным сравнением:
 * `scope == palette`. Вес у неё старший (см. `primitives/when-expr`), и это машинное
 * выражение привычки «пока открыт диалог, его клавиши принадлежат ему».
 *
 * ## Область даёт ПРИОРИТЕТ, а не исключительность
 *
 * Правило без области продолжает срабатывать при открытом окне. Это решение, а не упущение:
 * сделай область глушителем — и получилось бы состояние «пока открыт любой диалог,
 * клавиатура мертва», при котором `mod+shift+p` не открывает палитру из диалога, а `mod+s`
 * не сохраняет. Кому нужна исключительность, тот пишет `scope == своё` у своих правил
 * и выигрывает специфичностью.
 *
 * ## Область не заменяет `stopPropagation`
 *
 * Разные вопросы: область отвечает «какое правило выиграет», остановка распространения —
 * «дойдёт ли событие до глобального слоя вообще». Ловушка фокуса Radix, гашение стрелок
 * палитрой и `defaultPrevented` у Monaco остаются на месте. Смешать эти два механизма —
 * значит снова сломать палитру.
 *
 * @module host/ui/scope
 */

import { useEffect } from 'react';
import { toDisposable, type Disposable } from '../primitives/disposable';
import { defineService } from '../primitives/service';

/**
 * Имя области: `palette`, `dialog`. Непрозрачная строка, как `activeResourceKind`.
 *
 * Платформа её не интерпретирует и списка не держит: окна заводят плагины, и перечислить
 * их Host не может — ровно как пути подменю.
 */
export type ScopeId = string;

export interface ScopeStack {
  /** Верх стека или `null`, если окон нет. Это значение ключа `scope`. */
  top(): ScopeId | null;
  /**
   * Весь стек снизу вверх. Значение ключа `scopes` — правая часть оператора `in`,
   * которым пишут «где-то внутри диалога, пусть и не в самом верхнем».
   *
   * Ссылка стабильна между изменениями: её читает снимок контекстных ключей.
   */
  all(): readonly ScopeId[];
  /**
   * Кладёт область. `dispose()` снимает ИМЕННО эту запись, где бы она ни оказалась в стеке.
   *
   * Снятие по идентичности записи, а не «снять верхнюю»: два вложенных диалога, оба
   * объявившие `dialog`, дают `['dialog', 'dialog']`, и закрытие внутреннего не должно
   * снимать внешний. Тот же приём, что у реестра команд, где `dispose` сверяет значение,
   * а не только ключ.
   */
  push(scope: ScopeId): Disposable;
  subscribe(listener: () => void): Disposable;
}

export const ScopeStackServiceToken = defineService<ScopeStack>('host.scopes');

/**
 * Область модального окна — общая для всех диалогов оболочки.
 *
 * Одна на всех, а не своя у каждого: условие «пока открыт какой-нибудь диалог» пишется
 * человеком чаще, чем «пока открыт именно этот», а вложенные окна различает уже стек.
 * Диалогу, которому нужна своя клавиша, ничто не мешает положить рядом собственную область.
 */
export const DIALOG_SCOPE = 'dialog';

/** Пустой стек: одна замороженная ссылка вместо нового массива на каждое чтение. */
const EMPTY: readonly ScopeId[] = Object.freeze([]);

export function createScopeStack(): ScopeStack {
  /** Записи, а не строки: две одинаковые области обязаны быть различимы при снятии. */
  interface Entry {
    readonly scope: ScopeId;
  }

  let entries: Entry[] = [];
  let snapshot: readonly ScopeId[] = EMPTY;
  const listeners = new Set<() => void>();

  function notify(): void {
    snapshot = entries.length === 0 ? EMPTY : Object.freeze(entries.map((entry) => entry.scope));
    const errors: unknown[] = [];
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        errors.push(error);
      }
    }
    // Политика та же, что у контекста применимости и точки расширения: падение одного
    // подписчика не отменяет уже совершённого изменения и не мешает остальным.
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'ошибки в подписчиках стека областей');
  }

  return {
    top: (): ScopeId | null => entries.at(-1)?.scope ?? null,
    all: (): readonly ScopeId[] => snapshot,

    push(scope: ScopeId): Disposable {
      const entry: Entry = { scope };
      entries = [...entries, entry];
      notify();
      return toDisposable(() => {
        const index = entries.indexOf(entry);
        if (index === -1) return;
        entries = entries.filter((item) => item !== entry);
        notify();
      });
    },

    subscribe(listener: () => void): Disposable {
      listeners.add(listener);
      return toDisposable(() => {
        listeners.delete(listener);
      });
    },
  };
}

/**
 * Держит область, пока смонтирован компонент. `null` — не держит ничего.
 *
 * `null` вместо условного вызова хука: область кладут окна, а окно — это компонент, который
 * смонтирован всегда, а ОТКРЫТ иногда (диалоги Radix монтируются вместе с оболочкой).
 * Условный вызов хука запрещён правилами React, поэтому условие живёт внутри.
 */
export function useScope(stack: ScopeStack | undefined, scope: ScopeId | null): void {
  useEffect(() => {
    if (stack === undefined || scope === null) return;
    const subscription = stack.push(scope);
    return () => {
      subscription.dispose();
    };
  }, [stack, scope]);
}
