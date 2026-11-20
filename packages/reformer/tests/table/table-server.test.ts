/**
 * Уровень таблицы, серверный режим [ReFormer-cn5g.4].
 *
 * Страницу отдаёт провайдер. Проверяется контракт, который сейчас держит DataGrid ui-kit, и то,
 * чего ему не хватало: одно действие пользователя — один вызов провайдера (фильтр со сбросом
 * страницы, внешние записи в привязанные поля), отмена устаревшего запроса через `AbortSignal`,
 * прежняя страница на время перезагрузки, ограничение номера страницы только после ответа, выбор
 * с ключом и без.
 */

import { describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals-core';
import { createStore, defineBehavior, watchField } from '../../src/model/index';
import { createTable, type TablePage, type TableQuery } from '../../src/table/index';
import { deferred, flushMicrotasks, type Deferred } from '../test-utils/async';

type Order = { id: string; customer: string };

const order = (n: number): Order => ({ id: `o${n}`, customer: `Клиент ${n}` });

/** Провайдер под контролем теста. */
function controlledProvider() {
  const calls: { query: TableQuery; signal: AbortSignal; answer: Deferred<TablePage<Order>> }[] =
    [];
  const dataProvider = vi.fn((query: TableQuery, ctx: { signal: AbortSignal }) => {
    const answer = deferred<TablePage<Order>>();
    calls.push({ query, signal: ctx.signal, answer });
    return answer.promise;
  });
  const respond = async (index: number, rows: Order[], total: number) => {
    calls[index]!.answer.resolve({ rows, total });
    await flushMicrotasks(6);
  };
  return { dataProvider, calls, respond };
}

const COLUMNS = [
  { id: 'id', sortable: true },
  { id: 'customer', filterable: true },
] as const;

describe('createTable (server) — запросы', () => {
  it('первая загрузка: loading, затем строки страницы и total', async () => {
    const { dataProvider, calls, respond } = controlledProvider();
    const t = createTable({ dataProvider, columns: COLUMNS, getRowKey: (o: Order) => o.id });
    expect(t.mode).toBe('server');
    expect(t.status.value).toBe('loading');
    await flushMicrotasks();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.query).toEqual({
      filters: {},
      pagination: { pageIndex: 0, pageSize: 10 },
      sorting: [],
    });
    await respond(0, [order(1), order(2)], 25);
    expect(t.status.value).toBe('ready');
    expect(t.rows.value.map((r) => r.key)).toEqual(['o1', 'o2']);
    expect(t.total.value).toBe(25);
    expect(t.pageCount.value).toBe(3);
    t.dispose();
  });

  it('фильтр на 3-й странице — один запрос: фильтр и первая страница', async () => {
    const { dataProvider, calls, respond } = controlledProvider();
    const t = createTable({ dataProvider, columns: COLUMNS });
    await flushMicrotasks();
    await respond(0, [order(1)], 50);
    t.setPage(2);
    await flushMicrotasks();
    await respond(1, [order(21)], 50);
    t.columns.customer.setFilter('ив');
    await flushMicrotasks();
    expect(calls).toHaveLength(3);
    expect(calls[2]!.query.filters).toEqual({ customer: 'ив' });
    expect(calls[2]!.query.pagination.pageIndex).toBe(0);
    t.dispose();
  });

  it('внешняя запись фильтра (адрес, модель) — тоже один запрос со сбросом страницы', async () => {
    const { dataProvider, calls, respond } = controlledProvider();
    const filters = signal<Record<string, unknown>>({});
    const pageIndex = signal(0);
    const t = createTable({ dataProvider, columns: COLUMNS, state: { filters, pageIndex } });
    await flushMicrotasks();
    await respond(0, [order(1)], 50);
    t.setPage(3);
    await flushMicrotasks();
    await respond(1, [order(31)], 50);
    filters.value = { customer: 'ан' };
    await flushMicrotasks();
    expect(calls).toHaveLength(3);
    expect(calls[2]!.query).toMatchObject({
      filters: { customer: 'ан' },
      pagination: { pageIndex: 0 },
    });
    t.dispose();
  });

  it('новый запрос отменяет устаревший, его ответ не применяется', async () => {
    const { dataProvider, calls, respond } = controlledProvider();
    const t = createTable({ dataProvider, columns: COLUMNS });
    await flushMicrotasks();
    await respond(0, [order(1)], 30);
    t.setPage(1);
    await flushMicrotasks();
    t.setPage(2);
    await flushMicrotasks();
    expect(calls[1]!.signal.aborted).toBe(true);
    await respond(1, [order(99)], 30);
    expect(t.rows.value.map((r) => r.value.id)).toEqual(['o1']); // прежняя страница
    expect(t.refreshing.value).toBe(true);
    await respond(2, [order(21)], 30);
    expect(t.rows.value.map((r) => r.value.id)).toEqual(['o21']);
    expect(t.refreshing.value).toBe(false);
    t.dispose();
  });

  it('ошибка провайдера — status error, прежняя страница на месте, reload повторяет', async () => {
    const { dataProvider, calls, respond } = controlledProvider();
    const t = createTable({ dataProvider, columns: COLUMNS });
    await flushMicrotasks();
    await respond(0, [order(1)], 1);
    t.reload();
    await flushMicrotasks();
    calls[1]!.answer.reject(new Error('503'));
    await flushMicrotasks(6);
    expect(t.status.value).toBe('error');
    expect((t.error.value as Error).message).toBe('503');
    expect(t.rows.value).toHaveLength(1);
    t.reload();
    await flushMicrotasks();
    expect(calls).toHaveLength(3);
    t.dispose();
  });

  it('страница из адреса не обрезается до первого ответа; после ответа — не дальше последней', async () => {
    const { dataProvider, calls, respond } = controlledProvider();
    const pageIndex = signal(7);
    const t = createTable({ dataProvider, columns: COLUMNS, pageSize: 10, state: { pageIndex } });
    t.setPage(5); // число строк неизвестно — верхней границы нет
    expect(pageIndex.value).toBe(5);
    await flushMicrotasks();
    expect(calls[0]!.query.pagination.pageIndex).toBe(5);
    await respond(0, [], 22); // три страницы
    expect(pageIndex.value).toBe(2);
    await flushMicrotasks();
    expect(calls[1]!.query.pagination.pageIndex).toBe(2);
    t.dispose();
  });

  it('выбор с getRowKey переживает страницы; rows помнит строки с других страниц', async () => {
    const { dataProvider, respond } = controlledProvider();
    const t = createTable({
      dataProvider,
      columns: COLUMNS,
      getRowKey: (o: Order) => o.id,
      pageSize: 1,
      selection: 'multiple',
    });
    await flushMicrotasks();
    await respond(0, [order(1)], 2);
    t.rows.value[0]!.select();
    t.nextPage();
    await flushMicrotasks();
    await respond(1, [order(2)], 2);
    expect([...t.selection.keys.value]).toEqual(['o1']);
    t.selection.toggleAllOnPage();
    expect(t.selection.rows.value.map((o) => o.id)).toEqual(['o1', 'o2']);
    t.dispose();
  });

  it('без getRowKey ключ — индекс: выбор сбрасывается на каждой загрузке', async () => {
    const { dataProvider, respond } = controlledProvider();
    const t = createTable({ dataProvider, columns: COLUMNS, pageSize: 1, selection: 'multiple' });
    await flushMicrotasks();
    await respond(0, [order(1)], 2);
    t.rows.value[0]!.select();
    expect(t.selection.keys.value.size).toBe(1);
    t.nextPage();
    await flushMicrotasks();
    await respond(1, [order(2)], 2);
    expect(t.selection.keys.value.size).toBe(0);
    t.dispose();
  });

  it('enabled: пока выключено — idle без запросов; включили — загрузка', async () => {
    const { dataProvider, calls } = controlledProvider();
    const mounted = signal(false);
    const t = createTable({ dataProvider, columns: COLUMNS, enabled: () => mounted.value });
    await flushMicrotasks();
    expect(t.status.value).toBe('idle');
    expect(calls).toHaveLength(0);
    mounted.value = true;
    expect(t.status.value).toBe('loading');
    await flushMicrotasks();
    expect(calls).toHaveLength(1);
    t.dispose();
  });

  it('снятие стора отменяет запрос и перестаёт запрашивать', async () => {
    const { dataProvider, calls } = controlledProvider();
    const store = createStore(() => ({ t: createTable({ dataProvider, columns: COLUMNS }) }));
    await flushMicrotasks();
    store.dispose();
    expect(calls[0]!.signal.aborted).toBe(true);
    store.t.setPage(3);
    await flushMicrotasks();
    expect(calls).toHaveLength(1);
  });
});

describe('createTable (server) — правило между уровнями', () => {
  it('defineBehavior: смена языка перезапрашивает страницу', async () => {
    const { dataProvider, calls, respond } = controlledProvider();
    const reloadOnLanguage = defineBehavior<{ lang: { value: string }; reload: () => void }>(
      ({ lang, reload }) => {
        watchField(lang as never, () => reload());
      }
    );
    const lang = signal('ru');
    const app = createStore(() => {
      const table = createTable({ dataProvider, columns: COLUMNS });
      reloadOnLanguage.attach({ lang, reload: table.reload });
      return { table };
    });
    await flushMicrotasks();
    await respond(0, [order(1)], 1);
    lang.value = 'en';
    await flushMicrotasks();
    expect(calls).toHaveLength(2);
    app.dispose();
    lang.value = 'de';
    await flushMicrotasks();
    expect(calls).toHaveLength(2);
  });
});
