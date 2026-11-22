import { useState } from 'react';
import { isNearBottom, useResourceOptions, type ResourceConfig } from '@reformer/cdk/option-source';
import { Button } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

const BANKS = [
  'Альфа-Банк',
  'Банк Санкт-Петербург',
  'ВТБ',
  'Газпромбанк',
  'Дом.РФ',
  'МКБ',
  'Открытие',
  'Почта Банк',
  'Райффайзенбанк',
  'Росбанк',
  'Россельхозбанк',
  'Сбербанк',
  'Совкомбанк',
  'Т-Банк',
  'Уралсиб',
  'Ак Барс',
  'Абсолют Банк',
  'Банк Зенит',
  'Ренессанс Кредит',
  'ОТП Банк',
];

/** Имитация сервера: фильтр по подстроке и нарезка на страницы, ответ через 400 мс. */
function queryBanks(search = '', page = 1, pageSize = BANKS.length) {
  return new Promise<{ items: { id: string; label: string; value: string }[]; totalCount: number }>(
    (resolve) => {
      setTimeout(() => {
        const q = search.trim().toLowerCase();
        const found = BANKS.filter((b) => b.toLowerCase().includes(q));
        const items = found
          .slice((page - 1) * pageSize, page * pageSize)
          .map((b) => ({ id: b, label: b, value: b }));
        resolve({ items, totalCount: found.length });
      }, 400);
    }
  );
}

// Источники — константы модуля: хук перезагружает опции при смене ссылки на источник.

/** preload: один load({}) — сервер отдаёт всё, поиск фильтрует на клиенте. */
const preloadBanks: ResourceConfig<string> = {
  type: 'preload',
  load: () => queryBanks(),
};

/** partial: поиск и страницы на сервере — load({ search, page, pageSize }). */
const partialBanks: ResourceConfig<string> = {
  type: 'partial',
  pageSize: 5,
  load: ({ search, page, pageSize } = {}) => queryBanks(search, page, pageSize),
};

const BOX: React.CSSProperties = { maxWidth: 380, width: '100%', display: 'grid', gap: 8 };
const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  borderRadius: 6,
  border: '1px solid var(--ifm-color-emphasis-400)',
  fontSize: 14,
};
const LIST: React.CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 4,
  maxHeight: 200,
  overflowY: 'auto',
  borderRadius: 6,
  border: '1px solid var(--ifm-color-emphasis-300)',
};
const MUTED: React.CSSProperties = { color: 'var(--ifm-color-emphasis-600)', fontSize: 13 };

function PreloadDemo() {
  const [picked, setPicked] = useState<string | null>(null);
  const { options, loading, error, reload, searchInput, setSearchInput } =
    useResourceOptions(preloadBanks);

  return (
    <div style={BOX}>
      <input
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Поиск банка"
        aria-label="Поиск банка"
        style={INPUT}
      />
      {loading && <p style={MUTED}>Загрузка…</p>}
      {error && (
        <p style={MUTED}>
          Не удалось загрузить.{' '}
          <Button size="sm" variant="ghost" onClick={reload}>
            Повторить
          </Button>
        </p>
      )}
      {!loading && (
        <ul style={LIST} role="listbox" aria-label="Банки">
          {options.map((o) => (
            <li
              key={o.id}
              role="option"
              aria-selected={picked === o.value}
              onClick={() => setPicked(o.value)}
              style={{
                padding: '4px 8px',
                cursor: 'pointer',
                fontWeight: picked === o.value ? 600 : undefined,
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
      <p style={MUTED}>Выбрано: {picked ?? '—'}</p>
    </div>
  );
}

function PartialDemo() {
  const { options, loading, loadingMore, hasMore, loadMore, searchInput, setSearchInput } =
    useResourceOptions(partialBanks);

  return (
    <div style={BOX}>
      <input
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Поиск на сервере"
        aria-label="Поиск банка на сервере"
        style={INPUT}
      />
      <ul style={LIST}>
        {options.map((o) => (
          <li key={o.id} style={{ padding: '4px 8px' }}>
            {o.label}
          </li>
        ))}
        {loading && <li style={{ ...MUTED, padding: '4px 8px' }}>Загрузка…</li>}
      </ul>
      {hasMore && (
        <div>
          <Button size="sm" variant="outline" disabled={loadingMore} onClick={loadMore}>
            {loadingMore ? 'Загрузка…' : 'Показать ещё'}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Догрузка при прокрутке: isNearBottom сообщает, что до низа списка осталось меньше 48 px. */
function InfiniteDemo() {
  const { options, loading, loadingMore, loadMore } = useResourceOptions(partialBanks);

  return (
    <div style={BOX}>
      <ul
        style={{ ...LIST, maxHeight: 120 }}
        onScroll={(e) => {
          if (isNearBottom(e.currentTarget)) loadMore();
        }}
      >
        {options.map((o) => (
          <li key={o.id} style={{ padding: '4px 8px' }}>
            {o.label}
          </li>
        ))}
        {(loading || loadingMore) && <li style={{ ...MUTED, padding: '4px 8px' }}>Загрузка…</li>}
      </ul>
      <p style={MUTED}>Загружено: {options.length}</p>
    </div>
  );
}

export const cdkOptionSourceDocConfig: ComponentDocConfig = {
  name: 'useResourceOptions',
  importFrom: '@reformer/cdk/option-source',
  description:
    'Загрузка вариантов для списочного поля по описанию источника ResourceConfig: один раз целиком или постранично с поиском на сервере. Разметки нет — список рисуете вы.',
  variants: [
    {
      id: 'preload',
      title: 'preload: всё сразу, поиск на клиенте',
      description:
        'Один запрос load({}) при монтировании, дальше setSearchInput фильтрует загруженное по подстроке подписи.',
      render: PreloadDemo,
      code: `import { isNearBottom, useResourceOptions, type ResourceConfig } from '@reformer/cdk/option-source';

// Константа модуля: смена ссылки на источник перезапускает загрузку.
const preloadBanks: ResourceConfig<string> = {
  type: 'preload',
  load: () => api.banks(), // → { items: [{ id, label, value }], totalCount }
};

const { options, loading, error, reload, searchInput, setSearchInput } =
  useResourceOptions(preloadBanks);

<>
  <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
  {loading && <p>Загрузка…</p>}
  {error && <button onClick={reload}>Повторить</button>}
  <ul role="listbox">
    {options.map((o) => (
      <li key={o.id} role="option" aria-selected={picked === o.value} onClick={() => setPicked(o.value)}>
        {o.label}
      </li>
    ))}
  </ul>
</>`,
    },
    {
      id: 'partial',
      title: 'partial: поиск и страницы на сервере',
      description:
        'Ввод уходит на сервер через 300 мс после последней буквы и загружает первую страницу. loadMore догружает следующую, пока загружено меньше totalCount.',
      render: PartialDemo,
      code: `const partialBanks: ResourceConfig<string> = {
  type: 'partial',
  pageSize: 5,
  load: ({ search, page, pageSize } = {}) => api.banks({ search, page, pageSize }),
};

const { options, loading, loadingMore, hasMore, loadMore, searchInput, setSearchInput } =
  useResourceOptions(partialBanks);

<>
  <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
  <ul>
    {options.map((o) => <li key={o.id}>{o.label}</li>)}
    {loading && <li>Загрузка…</li>}
  </ul>
  {hasMore && (
    <button disabled={loadingMore} onClick={loadMore}>
      {loadingMore ? 'Загрузка…' : 'Показать ещё'}
    </button>
  )}
</>`,
    },
  ],
  examples: [
    {
      id: 'infinite',
      title: 'Догрузка при прокрутке',
      description:
        'loadMore сам проверяет, есть ли ещё страницы и не идёт ли загрузка, — его можно звать на каждое событие прокрутки.',
      render: InfiniteDemo,
      code: `import { isNearBottom, useResourceOptions } from '@reformer/cdk/option-source';

const { options, loading, loadingMore, loadMore } = useResourceOptions(partialBanks);

<ul
  style={{ maxHeight: 120, overflowY: 'auto' }}
  onScroll={(e) => {
    if (isNearBottom(e.currentTarget)) loadMore();
  }}
>
  {options.map((o) => <li key={o.id}>{o.label}</li>)}
  {(loading || loadingMore) && <li>Загрузка…</li>}
</ul>`,
    },
  ],
  props: [
    {
      name: 'ResourceConfig.type',
      type: "'static' | 'preload' | 'partial'",
      description:
        'static — один load({}) без поиска; preload — один load({}), поиск на клиенте; partial — load({ search, page, pageSize }) на каждый поиск и страницу.',
    },
    {
      name: 'ResourceConfig.load',
      type: '(params?: { search?, page?, pageSize?, … }) => Promise<{ items, totalCount }>',
      description:
        'Загрузка вариантов. items — { id, label, value, group? }; value приводится к строке. totalCount нужен partial, чтобы знать, есть ли ещё страницы.',
    },
    {
      name: 'ResourceConfig.pageSize',
      type: 'number',
      description: 'Размер страницы для partial — передаётся в load как pageSize.',
    },
    {
      name: 'useResourceOptions(resource?)',
      type: '→ { options, loading, loadingMore, error, hasMore, loadMore, reload, searchInput, setSearchInput, flags }',
      description:
        'options — нормализованные варианты { id, label, value, group? }. flags — serverSearch, paginated, searchable по стратегии. Без resource ничего не грузит.',
    },
    {
      name: 'resolveStrategyFlags / normalizeItems / mergeOptions / filterClient / resourceReducer / hasMore / isNearBottom',
      type: 'чистые функции',
      description:
        'Ядро без React: флаги стратегии, нормализация, слияние страниц без дублей по id, клиентский поиск, состояние загрузки, порог догрузки при прокрутке (isNearBottom, запас 48 px).',
    },
  ],
};
