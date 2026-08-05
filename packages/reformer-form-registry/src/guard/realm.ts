/**
 * Guard от двойного рантайма.
 *
 * Репозиторий про эту проблему знает — комментарии в `renderer-json/vite.config.ts` и
 * `cdk/vite.config.ts` это постмортемы. Но защиты работают на уровне «одна сборка»: они не дают
 * вшить зависимость в бандл. В микрофронтах отказ приходит с другой стороны — два независимо
 * собранных бандла грузят по своей копии, и ни один из них при этом не «неправильный».
 *
 * Что ломается от дубля, и почему это не видно:
 * - Две копии `@preact/signals-core` → восемь точек `instanceof Signal` дают `false`.
 * - Две копии `@reformer/core` → раздваиваются модульные `WeakMap`: `derived-registry` (bulk-set
 *   **затирает вычисляемые поля** — тихая порча данных) и `signal-node-registry` (`enableWhen`
 *   становится **тихим no-op**).
 *
 * Юнит-тесты этого не ловят: vitest резолвит один инстанс. Ломается только собранный артефакт.
 *
 * ## Как пользоваться
 *
 * Каждый бандл при инициализации ставит свои штампы, хост потом спрашивает результат:
 *
 * ```ts
 * // в каждом микрофронте, при загрузке:
 * import { Signal } from '@reformer/core/signals';
 * import { CORE_RUNTIME_TOKEN } from '@reformer/core';
 * stampRuntime('@preact/signals-core', Signal);
 * stampRuntime('@reformer/core', CORE_RUNTIME_TOKEN);
 *
 * // в хосте, после загрузки всех ремоутов:
 * const { duplicates } = checkRuntime();
 * ```
 *
 * Сравниваются ОБЪЕКТЫ, а не версии: две копии одной и той же версии ломают всё ровно так же.
 *
 * **Ограничение, которое важно понимать:** guard видит только те копии, которые сами себя
 * штампанули. Бандл, не вызвавший `stampRuntime`, останется невидимым. Это цена того, что
 * никакой способ пересчитать «все загруженные модули» из JS недоступен.
 *
 * Строгость задаётся рантайм-флагом, а НЕ окружением: `import.meta.env.DEV` вырезается при
 * сборке пакета, а `process.env.NODE_ENV` в голом ESM и web-components даёт
 * `ReferenceError: process is not defined`. Ни то ни другое здесь не годится.
 *
 * @module reformer/form-registry/guard
 */

const KEY = Symbol.for('reformer.runtime.v1');

export interface RuntimeDiagnostic {
  pkg: string;
  copies: number;
  message: string;
}

interface RealmSlot {
  /** pkg → множество наблюдённых копий (по идентичности объекта). */
  runtimes: Map<string, Set<unknown>>;
  strict: boolean;
}

function realm(): RealmSlot {
  const g = globalThis as unknown as Record<symbol, RealmSlot | undefined>;
  return (g[KEY] ??= { runtimes: new Map(), strict: false });
}

/**
 * Регистрирует штамп рантайма из ЭТОГО бандла.
 *
 * @param pkg - Имя пакета, например `'@reformer/core'`.
 * @param token - Объект, единственный в пределах копии модуля: конструктор `Signal`,
 *   `CORE_RUNTIME_TOKEN`, `React.createContext`. Примитивы не годятся — они совпадут по значению
 *   у разных копий и дубль останется незамеченным.
 */
export function stampRuntime(pkg: string, token: unknown): void {
  if (token === null || (typeof token !== 'object' && typeof token !== 'function')) {
    throw new TypeError(
      `[form-registry/guard] штамп для "${pkg}" обязан быть объектом или функцией: ` +
        `примитив совпадёт у разных копий, и дубль останется незамеченным.`
    );
  }
  const slot = realm();
  let set = slot.runtimes.get(pkg);
  if (!set) {
    set = new Set();
    slot.runtimes.set(pkg, set);
  }
  set.add(token);

  if (slot.strict && set.size > 1) throw new Error(describe(pkg, set.size));
}

function describe(pkg: string, copies: number): string {
  return (
    `[form-registry/guard] в одном realm загружено ${copies} копии "${pkg}". ` +
    `Это ломает проверки идентичности (instanceof Signal) и раздваивает модульные реестры ядра: ` +
    `bulk-set затирает вычисляемые поля, enableWhen превращается в no-op — и всё это МОЛЧА. ` +
    `Сведите пакет к одной копии: общий chunk в Module Federation, import map либо externals.`
  );
}

export interface RuntimeCheck {
  ok: boolean;
  duplicates: RuntimeDiagnostic[];
  /** Что вообще штамповалось — чтобы отличить «дублей нет» от «никто не штамповался». */
  observed: { pkg: string; copies: number }[];
}

/** Текущее состояние. Ничего не бросает — решение принимает вызывающий. */
export function checkRuntime(): RuntimeCheck {
  const slot = realm();
  const observed = [...slot.runtimes].map(([pkg, set]) => ({ pkg, copies: set.size }));
  const duplicates = observed
    .filter((o) => o.copies > 1)
    .map((o) => ({ pkg: o.pkg, copies: o.copies, message: describe(o.pkg, o.copies) }));
  return { ok: duplicates.length === 0, duplicates, observed };
}

/**
 * Режим реакции на дубль.
 *
 * По умолчанию `'report'`: рушить хост из-за диагностики хуже, чем работать с известной проблемой.
 * `'throw'` осмыслен в CI и на стенде, где отказ должен быть заметным.
 */
export function setRuntimeStrict(strict: boolean): void {
  realm().strict = strict;
}

/**
 * Сообщает о дублях через `console.error` и возвращает результат.
 *
 * @param onDiagnostic - Куда ещё отправить диагностику (телеметрия хоста).
 */
export function reportRuntime(onDiagnostic?: (d: RuntimeDiagnostic) => void): RuntimeCheck {
  const result = checkRuntime();
  for (const d of result.duplicates) {
    if (typeof console !== 'undefined') console.error(d.message);
    onDiagnostic?.(d);
  }
  return result;
}

/** Сбрасывает состояние. Только для тестов. */
export function resetRuntimeGuard(): void {
  const g = globalThis as unknown as Record<symbol, RealmSlot | undefined>;
  g[KEY] = { runtimes: new Map(), strict: false };
}
