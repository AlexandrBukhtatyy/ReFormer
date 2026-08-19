/**
 * Панель кэша: счётчики по двум осям, журнал событий и три кнопки сброса.
 *
 * Счётчики читаются `cache.stats()` на каждом рендере, а рендер вызывает подписка на журнал
 * событий — то есть цифры обновляются ровно тогда, когда что-то произошло. Тянуть `stats()` в
 * `useSyncExternalStore` напрямую нельзя: он отдаёт новый объект на каждый вызов, и сравнение
 * снимков по ссылке ушло бы в бесконечный цикл.
 *
 * @module react-playground/examples/form-registry-lab/cache-panel
 */

import { useSyncExternalStore } from 'react';
import type { CacheEvent, CacheStats, SchemaCache } from '@reformer/form-registry';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@reformer/ui-kit';
import type { LogStore } from './lab-store';
import { netLog, resetNetLog, type NetRecord } from './lab-net';

const LOOKUP: readonly { key: keyof CacheStats; title: string; hint: string }[] = [
  { key: 'l1Hit', title: 'L1', hint: 'свежее из памяти' },
  { key: 'l2Hit', title: 'L2', hint: 'свежее из хранилища — пережило F5' },
  { key: 'dedup', title: 'dedup', hint: 'присоединились к запросу в полёте' },
  { key: 'stale', title: 'stale', hint: 'тело было, но протухло — идём с If-None-Match' },
  { key: 'miss', title: 'miss', hint: 'тела не было вовсе' },
];

const NETWORK: readonly { key: keyof CacheStats; title: string; hint: string }[] = [
  { key: 'fetched', title: 'fetched', hint: 'холодная загрузка' },
  { key: 'refetched', title: 'refetched', hint: 'протухшее заменено новым телом' },
  { key: 'revalidated', title: 'revalidated', hint: 'сервер подтвердил 304' },
  { key: 'error', title: 'error', hint: 'отказ загрузки' },
  { key: 'aborted', title: 'aborted', hint: 'запрос погашен, когда ушёл последний ждущий' },
];

const L2_FAILURES: readonly { key: keyof CacheStats; title: string }[] = [
  { key: 'l2ReadFailed', title: 'чтение' },
  { key: 'l2WriteFailed', title: 'запись' },
  { key: 'l2Corrupt', title: 'битое тело' },
];

function Counters({
  stats,
  items,
  testIdPrefix,
}: {
  stats: CacheStats;
  items: readonly { key: keyof CacheStats; title: string; hint?: string }[];
  testIdPrefix: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.key}
          title={item.hint}
          className="rounded-md border border-gray-200 bg-white px-2 py-1.5"
        >
          <div className="text-[11px] tracking-wide text-gray-500 uppercase">{item.title}</div>
          <div
            data-testid={`${testIdPrefix}-${String(item.key)}`}
            className="font-mono text-lg text-gray-900"
          >
            {stats[item.key]}
          </div>
        </div>
      ))}
    </div>
  );
}

const eventTone: Record<CacheEvent['type'], string> = {
  'l1-hit': 'bg-green-100 text-green-800',
  'l2-hit': 'bg-green-100 text-green-800',
  dedup: 'bg-sky-100 text-sky-800',
  stale: 'bg-amber-100 text-amber-800',
  miss: 'bg-gray-100 text-gray-700',
  fetched: 'bg-blue-100 text-blue-800',
  refetched: 'bg-blue-100 text-blue-800',
  revalidated: 'bg-emerald-100 text-emerald-800',
  error: 'bg-red-100 text-red-800',
  aborted: 'bg-orange-100 text-orange-800',
};

const kb = (bytes: number): string => `${(bytes / 1024).toFixed(1)} КБ`;

export function CachePanel({
  cache,
  events,
  onInvalidateAll,
}: {
  cache: SchemaCache;
  events: LogStore<CacheEvent>;
  onInvalidateAll: () => void;
}) {
  const log = useSyncExternalStore(events.subscribe, events.snapshot, events.snapshot);
  const requests = useSyncExternalStore(netLog.subscribe, netLog.snapshot, netLog.snapshot);
  // Читается после подписки: сам по себе `stats()` не реактивен, но каждое событие вызывает рендер.
  const stats = cache.stats();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Кэш схем</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <section className="space-y-2">
          <h4 className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
            Исход поиска — ровно одно событие на каждое чтение
          </h4>
          <Counters stats={stats} items={LOOKUP} testIdPrefix="cache-stat" />
        </section>

        <section className="space-y-2">
          <h4 className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
            Исход сети — не больше одного на заведённый запрос
          </h4>
          <Counters stats={stats} items={NETWORK} testIdPrefix="cache-stat" />
        </section>

        <section className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-gray-600">
            Из сети:{' '}
            <b data-testid="cache-stat-bytesFromNetwork" className="font-mono">
              {kb(stats.bytesFromNetwork)}
            </b>{' '}
            <span className="text-xs text-gray-400">(после сериализации, не байты по проводу)</span>
          </span>
          <span className="text-gray-600">
            Записей в L1: <b className="font-mono">{cache.memorySize}</b>
          </span>
          <span className="text-gray-600">
            Вызовов fetch:{' '}
            <b data-testid="lab-net-count" className="font-mono">
              {requests.length}
            </b>
          </span>
        </section>

        {L2_FAILURES.some((f) => stats[f.key] > 0) && (
          <section className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            Отказы L2 (загрузку они не срывают, поэтому в «error» не попадают):{' '}
            {L2_FAILURES.filter((f) => stats[f.key] > 0)
              .map((f) => `${f.title} — ${String(stats[f.key])}`)
              .join(', ')}
          </section>
        )}

        <section className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            data-testid="btn-cache-invalidate"
            onClick={onInvalidateAll}
          >
            Инвалидировать схему
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-testid="btn-cache-clear"
            onClick={() => void cache.clear()}
          >
            Очистить кэш
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-testid="btn-cache-reset-stats"
            onClick={() => {
              cache.resetStats();
              events.clear();
            }}
          >
            Обнулить счётчики
          </Button>
          <Button size="sm" variant="outline" data-testid="btn-net-reset" onClick={resetNetLog}>
            Обнулить журнал сети
          </Button>
        </section>
        <p className="text-xs text-gray-500">
          Три кнопки делают три разные вещи: «инвалидировать» убирает одну схему из обоих уровней,
          «очистить» — весь кэш, «обнулить счётчики» не трогает содержимое.
        </p>

        <section className="space-y-1">
          <h4 className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
            Журнал событий
          </h4>
          <div
            data-testid="cache-event-log"
            className="max-h-56 space-y-1 overflow-auto rounded-md bg-gray-50 p-2"
          >
            {log.length === 0 && (
              <p className="text-xs text-gray-400">Пока пусто — смонтируйте форму.</p>
            )}
            {[...log].reverse().map((e, i) => (
              <div key={log.length - i} className="flex items-center gap-2 text-xs">
                <Badge className={eventTone[e.type]}>{e.type}</Badge>
                <code className="truncate text-gray-600">{e.key}</code>
                {e.durationMs !== undefined && (
                  <span className="ml-auto shrink-0 font-mono text-gray-400">
                    {e.durationMs} мс
                  </span>
                )}
                {e.bytes !== undefined && (
                  <span className="shrink-0 font-mono text-gray-400">{kb(e.bytes)}</span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-1">
          <h4 className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
            Сетевые обращения загрузчика
          </h4>
          <div className="max-h-40 space-y-1 overflow-auto rounded-md bg-gray-50 p-2">
            {requests.length === 0 && (
              <p className="text-xs text-gray-400">
                Ни одного — либо кэш закрыл, либо схема inline.
              </p>
            )}
            {[...requests].reverse().map((r: NetRecord, i) => (
              <div key={requests.length - i} className="flex items-center gap-2 text-xs">
                <Badge
                  className={
                    r.error || (r.status ?? 0) >= 400
                      ? 'bg-red-100 text-red-800'
                      : r.status === 304
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                  }
                >
                  {r.error ? 'сбой' : r.status}
                </Badge>
                <code className="truncate text-gray-600">{r.url}</code>
                <span className="ml-auto shrink-0 font-mono text-gray-400">{r.ms} мс</span>
              </div>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
