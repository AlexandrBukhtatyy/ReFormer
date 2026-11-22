/**
 * Стор демо «Уровни UI»: одна модель приложения и уровни над ней — тема, язык, две таблицы.
 *
 * Тема и язык привязаны к полям `settings` модели: форма настроек над этими полями управляет ими
 * без клея. Клиентская таблица стоит над массивом `users` модели — правка строки сразу видна в
 * таблице. Серверная таблица грузит страницу из «сервера» с задержкой; правило между уровнями
 * перезапрашивает её при смене языка.
 *
 * Стор — синглтон на время жизни страницы: тема и язык — состояние приложения, а не компонента
 * (и под StrictMode не должны создаваться дважды).
 */

import { createLocaleLoader } from '@reformer/core/i18n';
import { createLanguage, webStorage } from '@reformer/core/language';
import {
  arrayOf,
  createModel,
  createStore,
  defineBehavior,
  watchField,
} from '@reformer/core/model';
import { signal, type Signal } from '@reformer/core/signals';
import { createTable, type Table, type TablePage, type TableQuery } from '@reformer/core/table';
import { createTheme, type ThemePreference } from '@reformer/core/theme';
import { loadKitLocale } from '@reformer/ui-kit/locale';

export interface User {
  id: number;
  name: string;
  city: string;
  age: number;
}

export interface Order {
  id: string;
  customer: string;
  total: number;
}

export interface Settings {
  theme: ThemePreference;
  lang: string;
}

const USERS: User[] = [
  { id: 1, name: 'Иван Петров', city: 'Москва', age: 34 },
  { id: 2, name: 'анна Смирнова', city: 'Казань', age: 28 },
  { id: 3, name: 'Борис Орлов', city: 'Пермь', age: 45 },
  { id: 4, name: 'Ärla Lind', city: 'Stockholm', age: 31 },
  { id: 5, name: 'Zoe Adams', city: 'London', age: 22 },
  { id: 6, name: 'вера Козлова', city: 'Москва', age: 39 },
  { id: 7, name: 'Глеб Морозов', city: 'Тверь', age: 27 },
  { id: 8, name: 'Alex Brown', city: 'Berlin', age: 51 },
];

const MESSAGES: Record<string, Record<string, string>> = {
  ru: {
    'demo.title': 'Уровни UI над одной моделью',
    'demo.intro':
      'Тема, язык и таблицы — уровни над моделью приложения. Форма настроек пишет поля модели, уровни читают те же сигналы.',
    'demo.settings': 'Форма настроек (createForm над app.model.settings)',
    'demo.state': 'Состояние уровней',
    'demo.client': 'Клиентская таблица над массивом модели',
    'demo.client.hint':
      'Сортировка — коллацией языка уровня: «анна» и «вера» со строчной встают по алфавиту, а не после заглавных. Выберите строку и правьте её формой ниже — таблица пересортируется сама.',
    'demo.editor': 'Форма строки (createForm над под-моделью выбранной строки)',
    'demo.editor.empty': 'Выберите строку в таблице',
    'demo.server': 'Серверная таблица (dataProvider с задержкой 700 мс)',
    'demo.server.hint':
      'Быстро листайте страницы: устаревшие запросы отменяются. Фильтр на 3-й странице — один запрос сразу на первую. Смена языка — перезапрос (defineBehavior).',
    'demo.log': 'Журнал запросов',
    'demo.col.name': 'Имя',
    'demo.col.city': 'Город',
    'demo.col.age': 'Возраст',
    'demo.col.id': 'Номер',
    'demo.col.customer': 'Клиент',
    'demo.col.total': 'Сумма',
    'demo.add': 'Добавить пользователя',
    'demo.selected': 'Выбрано: {count}',
  },
  en: {
    'demo.title': 'UI levels over one model',
    'demo.intro':
      'Theme, language and tables are levels over the app model. The settings form writes model fields, levels read the same signals.',
    'demo.settings': 'Settings form (createForm over app.model.settings)',
    'demo.state': 'Level state',
    'demo.client': 'Client table over a model array',
    'demo.client.hint':
      'Sorted with the language collation (case-insensitive order). Select a row and edit it below — the table re-sorts by itself.',
    'demo.editor': 'Row form (createForm over the selected row sub-model)',
    'demo.editor.empty': 'Select a row in the table',
    'demo.server': 'Server table (dataProvider with a 700 ms delay)',
    'demo.server.hint':
      'Page quickly: stale requests are aborted. A filter on page 3 is one request straight to page 1. Switching the language reloads (defineBehavior).',
    'demo.log': 'Request log',
    'demo.col.name': 'Name',
    'demo.col.city': 'City',
    'demo.col.age': 'Age',
    'demo.col.id': 'Number',
    'demo.col.customer': 'Customer',
    'demo.col.total': 'Total',
    'demo.add': 'Add user',
    'demo.selected': 'Selected: {count}',
  },
};

/** Словарь кита + тексты демо, чанк языка по запросу. */
const loadDemoLocale = createLocaleLoader([loadKitLocale, (code) => MESSAGES[code] ?? null]);

const ORDERS: Order[] = Array.from({ length: 57 }, (_, i) => ({
  id: `A-${String(i + 1).padStart(3, '0')}`,
  customer: ['Иванов', 'Петрова', 'Смит', 'Мюллер', 'Сидоров', 'Lee'][i % 6]!,
  total: ((i * 7919) % 90_000) + 1_000,
}));

/** Запись журнала серверной таблицы. */
export interface RequestLogEntry {
  readonly n: number;
  readonly query: string;
  readonly state: 'pending' | 'done' | 'aborted';
}

/** «Сервер»: фильтр, сортировка и страница — на стороне провайдера, ответ через 700 мс. */
function fakeServer(log: Signal<readonly RequestLogEntry[]>) {
  let counter = 0;
  const mark = (n: number, state: RequestLogEntry['state']) => {
    log.value = log.value.map((entry) => (entry.n === n ? { ...entry, state } : entry));
  };
  return (query: TableQuery, { signal: abort }: { signal: AbortSignal }) => {
    const n = ++counter;
    const summary = `page=${query.pagination.pageIndex + 1} filter=${JSON.stringify(query.filters)} sort=${query.sorting
      .map((s) => `${s.id}${s.desc ? '↓' : '↑'}`)
      .join(',')}`;
    log.value = [{ n, query: summary, state: 'pending' as const }, ...log.value].slice(0, 12);
    return new Promise<TablePage<Order>>((resolve, reject) => {
      const timer = setTimeout(() => {
        const needle = String(query.filters.customer ?? '').toLowerCase();
        let rows = ORDERS.filter((o) => o.customer.toLowerCase().includes(needle));
        for (const { id, desc } of [...query.sorting].reverse()) {
          rows = [...rows].sort((a, b) => {
            const x = a[id as keyof Order];
            const y = b[id as keyof Order];
            const order =
              typeof x === 'number' ? x - (y as number) : String(x).localeCompare(String(y));
            return desc ? -order : order;
          });
        }
        const { pageIndex, pageSize } = query.pagination;
        mark(n, 'done');
        resolve({
          rows: rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
          total: rows.length,
        });
      }, 700);
      abort.addEventListener('abort', () => {
        clearTimeout(timer);
        mark(n, 'aborted');
        reject(abort.reason);
      });
    });
  };
}

/** Правило между уровнями: сервер сортирует своей коллацией — при смене языка перезапросить. */
const reloadOnLanguage = defineBehavior<{ code: { value: string }; table: Table<Order> }>(
  ({ code, table }) => {
    watchField(code as never, () => table.reload());
  },
  { name: 'reloadOnLanguage' }
);

function createDemoApp() {
  return createStore(() => {
    const model = createModel({
      settings: { theme: 'system' as ThemePreference, lang: 'ru' } satisfies Settings,
      users: arrayOf((): User => ({ id: 0, name: '', city: '', age: 18 }), USERS),
    });
    const storage = webStorage();

    const theme = createTheme({
      preference: model.$.settings.theme,
      storage,
      storageKey: 'reformer.demo.theme',
    });
    const language = createLanguage({
      lang: model.$.settings.lang,
      load: loadDemoLocale,
      supported: ['ru', 'en'],
      detect: null,
      storage,
      storageKey: 'reformer.demo.lang',
    });

    const users = createTable({
      data: model.$.users,
      columns: [
        { id: 'name', sortable: true, filterable: true },
        { id: 'city', sortable: true, filterable: true },
        { id: 'age', sortable: true },
      ],
      getRowKey: (u) => u.id,
      pageSize: 5,
      selection: 'single',
      locale: () => language.code.value,
    });

    const log = signal<readonly RequestLogEntry[]>([]);
    const orders = createTable({
      dataProvider: fakeServer(log),
      columns: [
        { id: 'id', sortable: true },
        { id: 'customer', sortable: true, filterable: true },
        { id: 'total', sortable: true },
      ],
      getRowKey: (o: Order) => o.id,
      pageSize: 8,
      selection: 'multiple',
    });
    reloadOnLanguage.attach({ code: language.code, table: orders as Table<Order> });

    let nextId = USERS.length + 1;
    return {
      model,
      theme,
      language,
      users,
      orders,
      log,
      addUser(): void {
        const id = nextId++;
        model.users.push({ id, name: `Новый ${id}`, city: 'Москва', age: 20 + (id % 30) });
      },
    };
  });
}

export type DemoApp = ReturnType<typeof createDemoApp>;

let app: DemoApp | undefined;

/** Стор демо — один на страницу; создаётся при первом показе демо. */
export function getDemoApp(): DemoApp {
  app ??= createDemoApp();
  return app;
}
