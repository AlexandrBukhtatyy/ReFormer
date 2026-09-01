/**
 * Третий слой изоляции: окружение, которое форма берёт, ни у кого не спрашивая.
 *
 * ## Подмена лексическая, а не глобальная
 *
 * Значения отсюда уходят ПАРАМЕТРАМИ функции модуля (`new Function('exports', …, 'fetch', src)`),
 * поэтому `fetch` внутри сайдкара — обычная переменная, затеняющая глобал. Отсюда два свойства,
 * которых не даёт ни патч `globalThis`, ни Service Worker: область действия — ровно один модуль,
 * и снимать подмену не нужно, потому что снаружи её и не было. Оболочка, соседняя вкладка
 * и сам билдер продолжают видеть настоящий `fetch`.
 *
 * ## Прокси, а не замена
 *
 * `Date` и `Math` подменяются наследником и объектом с тем же прототипом. Подставить вместо них
 * `{ now: () => 0 }` значило бы сломать `Date.parse`, `Date.UTC` и `Math.max` — то есть всё,
 * чем форма пользуется помимо того, что мы фиксируем.
 *
 * ## Чего здесь нет
 *
 * `XMLHttpRequest` не подменяется. Формы ReFormer ходят в сеть либо через `fetch`, либо через
 * клиент, который сама форма импортирует (`axios`), — а импорт закрывается вторым слоем, где
 * подставить можно сразу нужный ответ, не воспроизводя протокол XHR.
 *
 * Таймеры тоже не подменяются: управляемые часы нужны детерминированному прогону сценариев,
 * а живое превью обязано вести себя как приложение — `debounce` в нём настоящий.
 *
 * @module lib/form-fixture/ambient
 */

import type { FixtureClock, FixtureHttpRule, FormFixture } from './types';

/** Сообщение отказа для запроса, которого нет среди правил. */
export function unmatchedRequestMessage(method: string, url: string): string {
  return (
    `запрос ${method} ${url} не описан в фикстуре: правило не нашлось, ` +
    `а ходить в сеть из превью нельзя — добавьте его в fixture.http`
  );
}

/** Подходит ли правило запросу. */
export function ruleMatches(rule: FixtureHttpRule, method: string, url: string): boolean {
  if (rule.method !== undefined && rule.method.toUpperCase() !== method.toUpperCase()) return false;
  return typeof rule.url === 'string' ? url.includes(rule.url) : rule.url.test(url);
}

/** Метод и адрес из аргументов `fetch`, какими бы они ни пришли. */
function describeRequest(
  input: unknown,
  init?: { method?: string }
): {
  method: string;
  url: string;
} {
  const method = init?.method ?? (input as { method?: string } | null)?.method ?? 'GET';
  const url =
    typeof input === 'string' ? input : ((input as { url?: string } | null)?.url ?? String(input));
  return { method, url };
}

/**
 * `fetch`, отвечающий по правилам фикстуры.
 *
 * Несовпавший запрос ОТКЛОНЯЕТСЯ, а не пропускается наружу. Пропустить значило бы, что форма
 * с объявленной фикстурой всё равно ходит в сеть — и человек узнаёт об этом по чужому трафику,
 * а не по сообщению.
 */
export function createFixtureFetch(
  rules: readonly FixtureHttpRule[],
  wait: (ms: number) => Promise<void> = defaultWait
): typeof globalThis.fetch {
  return (async (input: unknown, init?: { method?: string }) => {
    const { method, url } = describeRequest(input, init);
    const rule = rules.find((candidate) => ruleMatches(candidate, method, url));
    if (rule === undefined) throw new Error(unmatchedRequestMessage(method, url));

    const { status = 200, json, text, headers, delayMs } = rule.respond;
    if (delayMs !== undefined && delayMs > 0) await wait(delayMs);

    const body = json !== undefined ? JSON.stringify(json) : (text ?? '');
    return new Response(body, {
      status,
      headers: {
        ...(json !== undefined ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
    });
  }) as typeof globalThis.fetch;
}

const defaultWait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Момент времени из объявления фикстуры. `NaN` — объявление негодное, подменять нечем. */
export function resolveNow(now: FixtureClock['now']): number {
  if (typeof now === 'number') return now;
  if (typeof now === 'string') return Date.parse(now);
  return Number.NaN;
}

/**
 * `Date` с зафиксированным «сейчас».
 *
 * Обёртка вокруг настоящего `Date`, а не наследник: наследник пришлось бы объявлять с точной
 * сигнатурой конструктора, а у `Date` их семь, и компилятор сводит их к последней — «ноль
 * аргументов» становится недостижимой веткой. Обёртка перехватывает ровно два случая
 * (`new Date()` и `Date.now()`) и всё остальное — `parse`, `UTC`, `instanceof` — отдаёт оригиналу.
 */
export function createFixedDate(fixedNow: number): DateConstructor {
  return new Proxy(Date, {
    construct: (target, args: unknown[]) =>
      // Ноль аргументов означает «сейчас» — единственный случай, который фиксируется.
      // `new Date('2020-01-01')` обязан остаться собой.
      args.length === 0
        ? new target(fixedNow)
        : Reflect.construct(target, args as ConstructorParameters<DateConstructor>),
    get: (target, property, receiver) =>
      property === 'now' ? () => fixedNow : Reflect.get(target, property, receiver),
  });
}

/**
 * `Math` с предсказуемым `random`.
 *
 * Объект с прототипом настоящего `Math`: `max`, `floor` и остальные шестьдесят функций остаются
 * на месте, подменяется ровно одна.
 */
export function createFixedMath(random: number | readonly number[]): Math {
  const values = typeof random === 'number' ? [random] : random;
  let index = 0;
  const proxy = Object.create(Math) as Math;
  proxy.random = (): number => {
    if (values.length === 0) return 0;
    const value = values[index % values.length];
    index += 1;
    return value;
  };
  return proxy;
}

/**
 * Имена и значения, которые получит модуль формы.
 *
 * Пустой объект означает «ничего не подменяем» — тогда и параметров у функции модуля не добавится,
 * то есть плагины каталога и формы без фикстуры видят ровно то же окружение, что и раньше.
 */
export function createAmbient(fixture: FormFixture | null): Readonly<Record<string, unknown>> {
  if (fixture === null) return EMPTY;
  const ambient: Record<string, unknown> = {};

  if (fixture.http !== undefined) ambient.fetch = createFixtureFetch(fixture.http);

  const clock = fixture.clock;
  if (clock !== undefined) {
    const now = resolveNow(clock.now);
    // Негодную дату молча не берём: `new Date(NaN)` дал бы «Invalid Date» во всех полях сразу,
    // и искать причину человек пошёл бы в форму, а не в фикстуру.
    if (!Number.isNaN(now)) ambient.Date = createFixedDate(now);
    if (clock.random !== undefined) ambient.Math = createFixedMath(clock.random);
  }

  return Object.keys(ambient).length === 0 ? EMPTY : ambient;
}

const EMPTY: Readonly<Record<string, unknown>> = Object.freeze({});
