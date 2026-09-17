/**
 * Реестр ReFormer: каталог плагинов, которые кто-то счёл годными.
 *
 * ## Что это и чем НЕ является
 *
 * Это список «что бывает» — имя пакета, описание, издатель, ключевые слова, — и ничего сверх.
 * Версий он не решает: какая версия пакета последняя, знает npm, и спрашивать об этом второй
 * источник значило бы иметь два ответа на один вопрос. Реестр отвечает на другой вопрос —
 * «что вообще стоит смотреть», — и потому его запись это метаданные, а не артефакт: файлы
 * по-прежнему приезжают из npm и проверяются подписью оттуда (`../npm`).
 *
 * ## Адреса по умолчанию нет
 *
 * Реестра как внешней инфраструктуры ещё не существует, и вписать сюда будущий URL значило бы
 * ходить в никуда у каждого, кто запустит билдер. Поэтому адрес приходит конфигом запуска
 * (`.ui_builder/config.json`, поле `marketplace.registry`), а без него раздел честно говорит
 * «реестр не настроен» — это состояние, а не поломка.
 *
 * ## Чему из ответа верим
 *
 * Тому же, чему у npm: ничему, что не проверили. Запись без `id` или `package` пропускается,
 * а не чинится умолчаниями; неизвестные поля игнорируются (реестр вправе расти); ответ
 * не-массивом — отказ целиком. Установка при этом идёт НЕ отсюда: из записи берётся только
 * имя пакета, а дальше работает обычный путь установки с подписью.
 *
 * @module shell/platform/plugin/marketplace/registry
 */

/** Запись каталога — то, что показывается человеку до всякой установки. */
export interface MarketplaceEntry {
  /** Идентификатор плагина: тот же, что объявит его манифест. */
  readonly id: string;
  /** Имя пакета npm — единственное, что нужно установке. */
  readonly package: string;
  readonly name: string;
  readonly description?: string;
  /** Кто публикует. Показывается рядом с именем: доверие — к человеку, а не к строке в npm. */
  readonly publisher?: string;
  readonly homepage?: string;
  readonly keywords?: readonly string[];
}

export type MarketplaceProblemCode =
  /** Адрес реестра не задан конфигом запуска. */
  | 'not-configured'
  /** Сеть или сервер не ответили. */
  | 'network'
  /** Ответ пришёл, но это не каталог. */
  | 'malformed';

export interface MarketplaceProblem {
  readonly code: MarketplaceProblemCode;
  readonly message: string;
}

export type MarketplaceResult =
  | { readonly ok: true; readonly entries: readonly MarketplaceEntry[] }
  | { readonly ok: false; readonly problem: MarketplaceProblem };

export interface MarketplaceClient {
  /** Настроен ли реестр вообще. Ответ нужен интерфейсу ДО запроса: он меняет пустое состояние. */
  configured(): boolean;
  /** Читает каталог. Ничего не кэширует: решает это тот, кто показывает. */
  list(): Promise<MarketplaceResult>;
}

export interface MarketplaceClientDeps {
  /** Адрес каталога-JSON. Пусто или отсутствует — реестр не настроен. */
  readonly url?: string;
  readonly fetch?: typeof globalThis.fetch;
}

const problem = (code: MarketplaceProblemCode, message: string): MarketplaceResult => ({
  ok: false,
  problem: { code, message },
});

const stringOf = (raw: Record<string, unknown>, key: string): string | undefined => {
  const value = raw[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
};

/** Разбирает одну запись. `undefined` — запись пропускается, каталог остаётся годным. */
function parseEntry(raw: unknown): MarketplaceEntry | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const fields = raw as Record<string, unknown>;

  const id = stringOf(fields, 'id');
  const packageName = stringOf(fields, 'package');
  // Без этих двух запись бесполезна: по `id` её сверяют с установленным, по `package` ставят.
  if (id === undefined || packageName === undefined) return undefined;

  const keywords = Array.isArray(fields.keywords)
    ? fields.keywords.filter((value): value is string => typeof value === 'string')
    : [];
  const description = stringOf(fields, 'description');
  const publisher = stringOf(fields, 'publisher');
  const homepage = stringOf(fields, 'homepage');

  return {
    id,
    package: packageName,
    name: stringOf(fields, 'name') ?? id,
    ...(description === undefined ? {} : { description }),
    ...(publisher === undefined ? {} : { publisher }),
    ...(homepage === undefined ? {} : { homepage }),
    ...(keywords.length === 0 ? {} : { keywords }),
  };
}

export function createMarketplaceClient(deps: MarketplaceClientDeps = {}): MarketplaceClient {
  const url = deps.url?.trim() ?? '';
  const request = deps.fetch ?? globalThis.fetch.bind(globalThis);

  return {
    configured: () => url !== '',

    async list() {
      if (url === '') {
        return problem(
          'not-configured',
          'реестр плагинов не настроен: адрес каталога задаётся полем «marketplace.registry» ' +
            'в .ui_builder/config.json'
        );
      }

      let response: Response;
      try {
        response = await request(url, { headers: { Accept: 'application/json' } });
      } catch (error) {
        return problem(
          'network',
          `реестр не ответил: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      if (!response.ok) {
        return problem('network', `реестр ответил ${String(response.status)}`);
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        return problem('malformed', 'ответ реестра не разбирается как JSON');
      }

      // Две формы: голый массив и объект с полем `plugins`. Вторая оставляет реестру место
      // под собственные поля (версия формата, дата сборки), и отвергать её было бы упрямством.
      const raw = Array.isArray(body)
        ? body
        : typeof body === 'object' &&
            body !== null &&
            Array.isArray((body as { plugins?: unknown }).plugins)
          ? (body as { plugins: unknown[] }).plugins
          : undefined;
      if (raw === undefined) {
        return problem(
          'malformed',
          'каталог реестра должен быть массивом записей или объектом с «plugins»'
        );
      }

      const entries = raw
        .map(parseEntry)
        .filter((entry): entry is MarketplaceEntry => entry !== undefined);
      return { ok: true, entries };
    },
  };
}
