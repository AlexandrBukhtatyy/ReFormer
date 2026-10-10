/**
 * Value-операции модели — cleanup и отложенные записи (`src/model/behaviors-value.ts`).
 *
 * Каждая операция возвращает cleanup; после него реакция должна молчать. `computeFrom`, `copyFrom`
 * и `watchField` пишут синхронно внутри effect, а `transformValue`, `resetWhen`, `syncFields` и
 * `revalidateWhen` — отложенно, через `runOutsideEffect` (микротаск). Отложенная запись — место,
 * где легко ошибиться: её нужно отменить, если cleanup пришёл в том же тике, и она должна писать
 * по текущему состоянию, а не по значению, замкнутому в момент прогона effect. Здесь же —
 * заявленные мелочи: `resetWhen` по умолчанию ставит `null`, `transform` у `syncFields`
 * асимметричен, сбой отложенной записи уходит в dev-лог.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { tick } from '../../test-utils/async';
import {
  computeFrom,
  copyFrom,
  createModel,
  resetWhen,
  revalidateWhen,
  syncFields,
  transformValue,
  watchField,
} from '../../../src/model/index';

afterEach(() => {
  vi.restoreAllMocks();
});

const upper = (value: string): string => value.toUpperCase();

describe('behaviors-value — cleanup останавливает реакцию', () => {
  it('computeFrom: цель больше не пересчитывается', () => {
    const model = createModel({ price: 2, qty: 3, total: 0 });
    const stop = computeFrom(
      [model.$.price, model.$.qty],
      model.$.total,
      (price: number, qty: number) => price * qty
    );
    expect(model.total).toBe(6);

    stop();
    model.qty = 10;

    expect(model.total).toBe(6);
  });

  it('copyFrom: цель больше не копирует источник', () => {
    const model = createModel({ email: 'a@b.c', copy: '' });
    const stop = copyFrom(model.$.email, model.$.copy, { transform: upper });
    expect(model.copy).toBe('A@B.C');

    stop();
    model.email = 'x@y.z';

    expect(model.copy).toBe('A@B.C');
  });

  it('watchField с immediate: колбэк вызван сразу, после cleanup — больше никогда', () => {
    const model = createModel({ country: 'RU' });
    const seen: string[] = [];
    const stop = watchField(model.$.country, (country) => seen.push(country), { immediate: true });

    model.country = 'KZ';
    stop();
    model.country = 'BY';

    expect(seen).toEqual(['RU', 'KZ']);
  });

  it('transformValue: поле больше не преобразуется', async () => {
    const model = createModel({ code: '' });
    const stop = transformValue(model.$.code, upper);
    model.code = 'ab';
    await tick();
    expect(model.code).toBe('AB');

    stop();
    model.code = 'cd';
    await tick();

    expect(model.code).toBe('cd');
  });

  it('resetWhen: истинное условие больше не сбрасывает поле', async () => {
    const model = createModel({ type: 'card', card: '4242' });
    const stop = resetWhen(model.$.card, () => model.type !== 'card', { resetValue: '' });
    await tick();

    stop();
    model.type = 'cash';
    await tick();

    expect(model.card).toBe('4242');
  });

  it('syncFields: связь снята в обе стороны', async () => {
    const model = createModel({ a: '', b: '' });
    const stop = syncFields(model.$.a, model.$.b);
    await tick();

    stop();
    model.a = 'x';
    await tick();
    model.b = 'y';
    await tick();

    expect(model.get()).toEqual({ a: 'x', b: 'y' });
  });

  it('revalidateWhen: колбэк больше не вызывается', async () => {
    const model = createModel({ max: 1 });
    const revalidate = vi.fn();
    const stop = revalidateWhen([model.$.max], revalidate);
    model.max = 2;
    await tick();
    expect(revalidate).toHaveBeenCalledTimes(1);

    stop();
    model.max = 3;
    await tick();

    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it('повторный cleanup безопасен', () => {
    const model = createModel({ a: '', b: '', n: 0 });
    const cleanups = [
      syncFields(model.$.a, model.$.b),
      computeFrom([model.$.n], model.$.n, (n: number) => n),
      revalidateWhen([model.$.n], () => {}),
    ];

    for (const cleanup of cleanups) {
      cleanup();
      expect(() => cleanup()).not.toThrow();
    }
  });
});

describe('behaviors-value — resetWhen', () => {
  it('по умолчанию сбрасывает в null', async () => {
    const model = createModel<{ on: boolean; card: string | null }>({ on: false, card: '4242' });
    resetWhen(model.$.card, () => model.on);

    model.on = true;
    await tick();

    expect(model.card).toBeNull();
  });

  it('сброс — по смене условия: правку при уже истинном условии он не трогает', async () => {
    // Так заявлено (docs/llms/25-reset-when.md): поле остаётся доступным, содержимое очищается
    // в момент переключения.
    const model = createModel({ type: 'card', card: '4242' });
    resetWhen(model.$.card, () => model.type !== 'card', { resetValue: '' });

    model.type = 'cash';
    await tick();
    expect(model.card).toBe('');

    model.card = '1111';
    await tick();
    expect(model.card).toBe('1111');

    model.type = 'card';
    await tick();
    model.type = 'cash';
    await tick();
    expect(model.card).toBe('');
  });
});

describe('behaviors-value — syncFields с transform', () => {
  it('a → b: значение проходит через transform', async () => {
    const model = createModel({ code: '', display: '' });
    syncFields(model.$.code, model.$.display, { transform: upper });
    await tick();

    model.code = 'ab1';
    await tick();

    expect(model.get()).toEqual({ code: 'ab1', display: 'AB1' });
  });

  it('b → a: значение пишется как есть — transform асимметричен, так заявлено', async () => {
    const model = createModel({ code: '', display: '' });
    syncFields(model.$.code, model.$.display, { transform: upper });
    await tick();

    model.display = 'xy';
    await tick();

    expect(model.get()).toEqual({ code: 'xy', display: 'xy' });
  });

  it('связь сходится: каждая запись даёт ровно одну запись во второе поле', async () => {
    const model = createModel({ code: '', display: '' });
    syncFields(model.$.code, model.$.display, { transform: upper });
    await tick();
    const writes: string[] = [];
    const stopCode = model.$.code.subscribe((value) => writes.push(`code=${value}`));
    const stopDisplay = model.$.display.subscribe((value) => writes.push(`display=${value}`));
    writes.length = 0;

    model.code = 'a';
    await tick();
    model.display = 'B';
    await tick();

    expect(writes).toEqual(['code=a', 'display=A', 'display=B', 'code=B']);
    stopCode();
    stopDisplay();
  });
});

describe('behaviors-value — transformValue', () => {
  it('значение уже в нужном виде — записи нет', async () => {
    const model = createModel({ code: 'ABC' });
    const writes: string[] = [];
    const stop = model.$.code.subscribe((value) => writes.push(value));
    writes.length = 0;
    const transformer = vi.fn(upper);

    transformValue(model.$.code, transformer);
    await tick();

    expect(transformer).toHaveBeenCalledWith('ABC');
    expect(writes).toEqual([]);
    stop();
  });

  it('сбой трансформера в dev уходит в console.error, значение не трогается', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const model = createModel({ code: 'a' });

    transformValue(model.$.code, () => {
      throw new Error('сбой');
    });
    await tick();

    expect(error).toHaveBeenCalledWith('[runOutsideEffect]', expect.any(Error));
    expect(model.code).toBe('a');
  });

  it('в production сбой отложенной записи проглатывается молча', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const model = createModel({ code: 'a' });

    transformValue(model.$.code, () => {
      throw new Error('сбой');
    });
    await tick();

    expect(error).not.toHaveBeenCalled();
    expect(model.code).toBe('a');
  });
});

describe('behaviors-value — cleanup в том же тике, что и изменение', () => {
  it('синхронные операции после cleanup в том же тике ничего не пишут', async () => {
    const model = createModel({ a: 1, sum: 0, copy: 0 });
    const watched = vi.fn();
    const cleanups = [
      computeFrom([model.$.a], model.$.sum, (a: number) => a * 10),
      copyFrom(model.$.a, model.$.copy),
      watchField(model.$.a, watched),
    ];

    cleanups.forEach((cleanup) => cleanup());
    model.a = 2;
    await tick();

    expect({ sum: model.sum, copy: model.copy, watched: watched.mock.calls.length }).toEqual({
      sum: 10,
      copy: 1,
      watched: 0,
    });
  });

  it('transformValue: cleanup отменяет ожидающую запись [ReFormer-kptp]', async () => {
    const model = createModel({ code: '' });
    const stop = transformValue(model.$.code, upper);
    await tick();

    model.code = 'abc';
    stop();
    await tick();

    expect(model.code).toBe('abc');
  });

  it('resetWhen: cleanup отменяет ожидающий сброс [ReFormer-kptp]', async () => {
    const model = createModel({ type: 'card', card: '4242' });
    const stop = resetWhen(model.$.card, () => model.type !== 'card', { resetValue: '' });
    await tick();

    model.type = 'cash';
    stop();
    await tick();

    expect(model.card).toBe('4242');
  });

  it('syncFields: cleanup отменяет ожидающую синхронизацию [ReFormer-kptp]', async () => {
    const model = createModel({ a: '', b: '' });
    const stop = syncFields(model.$.a, model.$.b);
    await tick();

    model.a = 'x';
    stop();
    await tick();

    expect(model.b).toBe('');
  });

  it('revalidateWhen: cleanup отменяет ожидающий вызов [ReFormer-kptp]', async () => {
    const model = createModel({ max: 1 });
    const revalidate = vi.fn();
    const stop = revalidateWhen([model.$.max], revalidate);

    model.max = 2;
    stop();
    await tick();

    expect(revalidate).not.toHaveBeenCalled();
  });
});

describe('behaviors-value — отложенная запись пишет по текущему состоянию', () => {
  it('syncFields: разные начальные значения сходятся к значению a [ReFormer-ggrb]', async () => {
    // Поле-зеркало b добавили в форму с уже заполненным a: связь должна скопировать a в b.
    const model = createModel({ a: 'заполнено', b: '' });

    syncFields(model.$.a, model.$.b);
    await tick();

    expect(model.get()).toEqual({ a: 'заполнено', b: 'заполнено' });
  });

  it('syncFields: запись в b сразу после создания связи не затирается копированием a', async () => {
    const model = createModel({ a: 'старое', b: '' });

    syncFields(model.$.a, model.$.b);
    model.b = 'из ответа сервера';
    await tick();

    expect(model.get()).toEqual({ a: 'из ответа сервера', b: 'из ответа сервера' });
  });

  it('syncFields: записи в оба поля в одном тике — побеждает последняя', async () => {
    const model = createModel({ a: '', b: '' });
    syncFields(model.$.a, model.$.b);
    await tick();

    model.a = 'первая';
    model.b = 'вторая';
    await tick();

    expect(model.get()).toEqual({ a: 'вторая', b: 'вторая' });
  });

  it('resetWhen: условие, снова ложное к моменту записи, не стирает поле [ReFormer-ggrb]', async () => {
    const model = createModel({ type: 'card', card: '' });
    resetWhen(model.$.card, () => model.type !== 'card', { resetValue: '' });
    await tick();

    // Сброс к исходному и загрузка сохранённой заявки — в одном обработчике.
    model.type = 'cash';
    model.patch({ type: 'card', card: '4242' });
    await tick();

    expect(model.card).toBe('4242');
  });

  it('transformValue: подписчик не видит отката к преобразованию старого значения [ReFormer-ggrb]', async () => {
    const model = createModel({ code: '' });
    transformValue(model.$.code, upper);
    await tick();
    const seen: string[] = [];
    const stop = model.$.code.subscribe((value) => seen.push(value));

    model.code = 'ab';
    model.code = 'abc';
    await tick();
    stop();

    expect(seen).toEqual(['', 'ab', 'abc', 'ABC']);
  });
});
