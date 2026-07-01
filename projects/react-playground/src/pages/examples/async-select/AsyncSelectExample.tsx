import { useState } from 'react';
import { Select, type ResourceConfig } from '@reformer/ui-kit';

/**
 * Демонстрация асинхронного источника опций `Select` со стратегиями
 * загрузки: `partial` (серверные поиск + пагинация) и `preload`
 * (одна загрузка + клиентский поиск).
 *
 * Здесь бэкенд имитируется: массив из 200 элементов, `load` возвращает
 * срез по `page`/`pageSize` и фильтрует по `search` с искусственной задержкой.
 */

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ALL_ITEMS = Array.from({ length: 200 }, (_, i) => ({
  id: i + 1,
  name: `Опция №${i + 1}`,
}));

const COUNTRIES = [
  { id: 'ru', name: 'Россия' },
  { id: 'by', name: 'Беларусь' },
  { id: 'kz', name: 'Казахстан' },
  { id: 'am', name: 'Армения' },
  { id: 'kg', name: 'Киргизия' },
];

// partial: сервер фильтрует по search и отдаёт постранично.
const partialResource: ResourceConfig<number> = {
  type: 'partial',
  pageSize: 20,
  load: async ({ search = '', page = 1, pageSize = 20 } = {}) => {
    await delay(400);
    const q = String(search).toLowerCase();
    const filtered = ALL_ITEMS.filter((x) => x.name.toLowerCase().includes(q));
    const start = (page - 1) * pageSize;
    return {
      items: filtered
        .slice(start, start + pageSize)
        .map((x) => ({ id: x.id, label: x.name, value: x.id })),
      totalCount: filtered.length,
    };
  },
};

// preload: одна загрузка всех опций, поиск фильтрует их на клиенте.
const preloadResource: ResourceConfig<string> = {
  type: 'preload',
  load: async () => {
    await delay(300);
    return {
      items: COUNTRIES.map((c) => ({ id: c.id, label: c.name, value: c.id })),
      totalCount: COUNTRIES.length,
    };
  },
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

export default function AsyncSelectExample() {
  const [itemId, setItemId] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-md space-y-8">
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-gray-800">Select — async опции</h2>
        <p className="mb-6 text-sm text-gray-500">
          Демонстрация серверного поиска и пагинации через <code>ResourceConfig</code>.
        </p>

        <div className="space-y-6">
          <Field label="partial — серверный поиск + пагинация (200 опций по 20)">
            <Select
              value={itemId}
              onChange={setItemId}
              resource={partialResource}
              placeholder="Начните поиск или прокрутите список…"
              clearable
            />
            <p className="text-xs text-gray-400">Выбрано: {itemId ?? '—'}</p>
          </Field>

          <Field label="preload — всё сразу + клиентский поиск">
            <Select
              value={country}
              onChange={setCountry}
              resource={preloadResource}
              placeholder="Страна"
              clearable
            />
            <p className="text-xs text-gray-400">Выбрано: {country ?? '—'}</p>
          </Field>
        </div>
      </div>
    </div>
  );
}
