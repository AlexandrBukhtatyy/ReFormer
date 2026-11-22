/**
 * Разрешение: какую форму показать по данному запросу и в данном контексте.
 *
 * Ключевая идея — **три способа адресации (id / слот / маршрут) это разные ФОРМЫ ЗАПРОСА,
 * а права и флаги это ФИЛЬТР**, общий для всех трёх. Отсюда инвариант, который иначе
 * пришлось бы поддерживать вручную в каждой точке входа: право нельзя обойти, войдя через
 * другую дверь. Если бы гейт жил в React-компоненте слота, императивный API его бы миновал.
 *
 * Функция чистая и синхронная: ни сети, ни React, ни знания о роутере. Текущий маршрут
 * подаёт хост через {@link ResolveContext} — реестр совместим с любым роутером.
 *
 * @module reformer/form-registry/resolve
 */

import type { FormEntry, FormQuery, ResolveContext } from './types';

/**
 * Компилирует шаблон маршрута в RegExp.
 *
 * Поддерживает `:param` (один сегмент) и `*` (хвост любой глубины). Компиляция делается
 * ОДИН раз при регистрации записи, а не на каждый резолв — иначе на каждый рендер слота
 * пересобирался бы RegExp для каждой записи реестра.
 *
 * @param pattern - Шаблон вида `/loans/:id/apply`.
 * @returns Скомпилированный RegExp с именованными группами параметров.
 */
export function compileRoute(pattern: string): RegExp {
  const source = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // спецсимволы regexp, кроме : * ?
    .replace(/\/:([A-Za-z_][\w]*)/g, '/(?<$1>[^/]+)')
    .replace(/\*/g, '.*');
  return new RegExp(`^${source}/?$`);
}

/** Кэш скомпилированных маршрутов: ключ — исходный шаблон. */
const routeCache = new Map<string, RegExp>();

function routeRe(pattern: string): RegExp {
  let re = routeCache.get(pattern);
  if (!re) {
    re = compileRoute(pattern);
    routeCache.set(pattern, re);
  }
  return re;
}

/** Совпадает ли запись с запросом (без учёта прав). */
function matchesQuery(entry: FormEntry, query: FormQuery): boolean {
  switch (query.by) {
    case 'id':
      return (
        entry.id === query.id && (query.version === undefined || entry.version === query.version)
      );
    case 'slot':
      return entry.placement?.slots?.includes(query.slot) ?? false;
    case 'route':
      return entry.placement?.routes?.some((p) => routeRe(p).test(query.path)) ?? false;
    case 'tag':
      return entry.meta?.tags?.includes(query.tag) ?? false;
  }
}

/**
 * Гейт доступа. Единственное место, где проверяются права и флаги — поэтому его
 * невозможно обойти, выбрав другой способ адресации.
 */
export function passesGate(entry: FormEntry, ctx: ResolveContext): boolean {
  const access = entry.access;
  if (!access) return true;
  if (access.permissions?.some((p) => !ctx.permissions.has(p))) return false;
  if (access.flags?.some((f) => !ctx.flags.has(f))) return false;
  // canRender зовём последним: он потенциально дороже и не должен вызываться,
  // если запись и так отсеяна по правам.
  return access.canRender ? access.canRender(ctx) : true;
}

/** Сравнение semver-подобных версий по убыванию. Нечисловые части сравниваются лексикографически. */
function compareVersionDesc(a: string, b: string): number {
  const pa = a.split(/[.\-+]/);
  const pb = b.split(/[.\-+]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? '';
    const y = pb[i] ?? '';
    const nx = Number(x);
    const ny = Number(y);
    const bothNum = !Number.isNaN(nx) && !Number.isNaN(ny) && x !== '' && y !== '';
    const cmp = bothNum ? ny - nx : y.localeCompare(x);
    if (cmp !== 0) return cmp;
  }
  return 0;
}

/** Порядок выдачи: сначала приоритет размещения, затем версия — обе по убыванию. */
export function byPriorityThenVersionDesc(a: FormEntry, b: FormEntry): number {
  const pa = a.placement?.priority ?? 0;
  const pb = b.placement?.priority ?? 0;
  if (pa !== pb) return pb - pa;
  return compareVersionDesc(a.version, b.version);
}

/**
 * Единственная точка разрешения формы.
 *
 * @param store - Все зарегистрированные записи.
 * @param query - Способ адресации: по id, слоту, маршруту или тегу.
 * @param ctx - Права, флаги, текущий маршрут.
 * @returns Подходящие записи, отсортированные по приоритету и версии. Пустой массив —
 *   валидный результат: записи нет либо нет прав, и вызывающий обязан это пережить.
 *
 * @example Императивно — первая подходящая версия формы
 * ```typescript
 * const [entry] = resolveForms(store, { by: 'id', id: 'credit-application' }, ctx);
 * ```
 *
 * @example Слот — все формы, разрешённые пользователю
 * ```typescript
 * const entries = resolveForms(store, { by: 'slot', slot: 'checkout.sidebar' }, ctx);
 * ```
 */
export function resolveForms(
  store: readonly FormEntry[],
  query: FormQuery,
  ctx: ResolveContext
): FormEntry[] {
  return store
    .filter((e) => matchesQuery(e, query))
    .filter((e) => passesGate(e, ctx))
    .sort(byPriorityThenVersionDesc);
}

/**
 * Извлекает параметры маршрута из пути по шаблонам записи.
 *
 * @returns Первое совпадение или `undefined`. Нужен хосту, чтобы передать `:id` в форму.
 */
export function matchRouteParams(
  entry: FormEntry,
  path: string
): Record<string, string> | undefined {
  for (const pattern of entry.placement?.routes ?? []) {
    const m = routeRe(pattern).exec(path);
    if (m) return { ...m.groups };
  }
  return undefined;
}
