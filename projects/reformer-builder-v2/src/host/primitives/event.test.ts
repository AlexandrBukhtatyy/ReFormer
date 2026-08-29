import { describe, expect, it, vi } from 'vitest';

import { createEventBus, defineEvent } from './event';

interface Saved {
  readonly id: string;
}

const DidSave = defineEvent<Saved>('test.didSave');
const DidOpen = defineEvent<string>('test.didOpen');

describe('defineEvent', () => {
  it('возвращает тип с переданным идентификатором', () => {
    expect(DidSave.id).toBe('test.didSave');
  });

  it('не даёт объявить событие с пустым идентификатором', () => {
    // Пустой id склеил бы в одну кучу все события, которые забыли назвать.
    expect(() => defineEvent('')).toThrow(/пуст/);
    expect(() => defineEvent('   ')).toThrow(/пуст/);
  });
});

describe('доставка', () => {
  it('передаёт нагрузку подписчику', () => {
    const bus = createEventBus();
    const seen: Saved[] = [];
    bus.on(DidSave, (payload) => seen.push(payload));

    bus.emit(DidSave, { id: 'a' });

    expect(seen).toEqual([{ id: 'a' }]);
  });

  it('доставляет синхронно: после emit подписчик уже отработал', () => {
    // Несущее свойство: события публикуются из контура правки модели. Будь доставка
    // отложенной, подписчик увидел бы состояние, отличное от того, о котором ему сообщили.
    const bus = createEventBus();
    let seen: string | null = null;
    bus.on(DidOpen, (payload) => {
      seen = payload;
    });

    bus.emit(DidOpen, 'schema.json');

    expect(seen).toBe('schema.json');
  });

  it('доставляет всем подписчикам этого типа', () => {
    const bus = createEventBus();
    const first = vi.fn();
    const second = vi.fn();
    bus.on(DidOpen, first);
    bus.on(DidOpen, second);

    bus.emit(DidOpen, 'x');

    expect(first).toHaveBeenCalledWith('x');
    expect(second).toHaveBeenCalledWith('x');
  });

  it('не путает типы событий между собой', () => {
    const bus = createEventBus();
    const onSave = vi.fn();
    const onOpen = vi.fn();
    bus.on(DidSave, onSave);
    bus.on(DidOpen, onOpen);

    bus.emit(DidOpen, 'x');

    expect(onSave).not.toHaveBeenCalled();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('emit без подписчиков — ничего не делает', () => {
    const bus = createEventBus();
    expect(() => bus.emit(DidOpen, 'x')).not.toThrow();
  });

  it('один и тот же обработчик, подписанный дважды, вызывается дважды', () => {
    const bus = createEventBus();
    const cb = vi.fn();
    bus.on(DidOpen, cb);
    const second = bus.on(DidOpen, cb);

    bus.emit(DidOpen, 'x');
    expect(cb).toHaveBeenCalledTimes(2);

    // Отписка снимает ровно одну подписку, а не все с этим обработчиком.
    second.dispose();
    bus.emit(DidOpen, 'y');
    expect(cb).toHaveBeenCalledTimes(3);
  });
});

describe('отписка', () => {
  it('после dispose обработчик не вызывается', () => {
    const bus = createEventBus();
    const cb = vi.fn();
    const subscription = bus.on(DidOpen, cb);

    subscription.dispose();
    bus.emit(DidOpen, 'x');

    expect(cb).not.toHaveBeenCalled();
  });

  it('повторный dispose безвреден', () => {
    const bus = createEventBus();
    const subscription = bus.on(DidOpen, vi.fn());

    subscription.dispose();
    expect(() => subscription.dispose()).not.toThrow();
  });

  it('снятый во время доставки подписчик текущее событие уже не получает', () => {
    // Доставка идёт по снимку списка, поэтому без флага снятия отписанный обработчик
    // всё равно был бы вызван — а dispose обязан действовать сразу.
    const bus = createEventBus();
    const second = vi.fn();
    const secondSubscription = { current: { dispose: () => {} } };

    bus.on(DidOpen, () => secondSubscription.current.dispose());
    secondSubscription.current = bus.on(DidOpen, second);

    bus.emit(DidOpen, 'x');

    expect(second).not.toHaveBeenCalled();
  });
});

describe('ошибка подписчика', () => {
  it('не мешает остальным и не выходит наружу из emit', () => {
    const onListenerError = vi.fn();
    const bus = createEventBus({ onListenerError });
    const failure = new Error('подписчик сломан');
    const healthy = vi.fn();

    bus.on(DidOpen, () => {
      throw failure;
    });
    bus.on(DidOpen, healthy);

    expect(() => bus.emit(DidOpen, 'x')).not.toThrow();
    expect(healthy).toHaveBeenCalledWith('x');
    expect(onListenerError).toHaveBeenCalledWith(failure, { eventId: 'test.didOpen' });
  });

  it('без явного канала уходит в console.error, а не в тишину', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const bus = createEventBus();
      bus.on(DidOpen, () => {
        throw new Error('подписчик сломан');
      });

      bus.emit(DidOpen, 'x');

      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('порядок доставки', () => {
  it('детерминирован: два одинаковых emit дают одинаковую последовательность', () => {
    // Сам порядок контрактом не является — полагаться на него нельзя. Но он обязан быть
    // воспроизводимым, иначе тесты поверх шины падают через раз.
    const bus = createEventBus();
    const calls: string[] = [];
    bus.on(DidOpen, () => calls.push('first'));
    bus.on(DidOpen, () => calls.push('second'));
    bus.on(DidOpen, () => calls.push('third'));

    bus.emit(DidOpen, 'x');
    const firstRun = [...calls];
    calls.length = 0;
    bus.emit(DidOpen, 'x');

    expect(calls).toEqual(firstRun);
  });

  it('подписка во время доставки текущее событие не получает, следующее — получает', () => {
    // Иначе подписка изнутри обработчика продолжала бы ту же рассылку бесконечно.
    const bus = createEventBus();
    const late = vi.fn();
    const once = bus.on(DidOpen, () => {
      bus.on(DidOpen, late);
    });

    bus.emit(DidOpen, 'x');
    expect(late).not.toHaveBeenCalled();

    once.dispose();
    bus.emit(DidOpen, 'y');
    expect(late).toHaveBeenCalledWith('y');
  });

  it('вложенный emit из обработчика доставляется тут же', () => {
    const bus = createEventBus();
    const calls: string[] = [];
    bus.on(DidSave, () => {
      calls.push('save');
      bus.emit(DidOpen, 'nested');
    });
    bus.on(DidOpen, (payload) => calls.push(`open:${payload}`));

    bus.emit(DidSave, { id: 'a' });

    expect(calls).toEqual(['save', 'open:nested']);
  });
});
