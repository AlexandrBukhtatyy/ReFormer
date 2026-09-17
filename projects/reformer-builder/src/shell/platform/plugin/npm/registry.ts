/**
 * Клиент реестра npm: найти версию пакета и скачать её архив.
 *
 * Работает из браузера напрямую — `registry.npmjs.org` отдаёт CORS, — и поэтому весь модуль
 * написан вокруг одного вопроса: **чему из ответа мы верим**. Ответ приходит из сети, его
 * содержимое выбирает не оболочка, а тот, кто опубликовал пакет.
 *
 * ## Что проверяется и почему
 *
 * - **Имя пакета** — до запроса и своим выражением. Имя уезжает в URL, и `../` в нём означал бы
 *   обращение не туда, куда мы собирались.
 * - **Хост архива совпадает с хостом реестра.** `dist.tarball` — строка ИЗ ОТВЕТА, то есть её
 *   пишет публикующий. Ссылка на чужой хост — это не «зеркало», а способ отдать нам другой
 *   архив, и подпись тут не спасает: `integrity` приезжает тем же ответом.
 * - **Подпись обязана быть.** Пакет без `dist.integrity` не устанавливается: без неё скачанное
 *   не с чем сверить, а проверка подписи — единственное, что отличает настоящий архив
 *   от подменённого (`./integrity`).
 * - **Потолок размера** — и по `Content-Length`, и по фактически прочитанному: заголовку тоже
 *   пишет чужая сторона, и верить ему на слово значит согласиться качать сколько дадут.
 *
 * Версия выбирается НАШЕЙ утилитой диапазонов (`primitives/semver`), той же, которой
 * сверяются `apiVersion` и возможности. Пререлизы в ней не поддерживаются — значит и здесь
 * ставятся только выпущенные версии, и это осознанное сужение, а не недоделка.
 *
 * Отказы — данные: сеть отваливается, пакетов не находится, ответы приходят неожиданной формы.
 * Ни одно из этого не авария приложения.
 *
 * @module shell/platform/plugin/npm/registry
 */

import {
  compareVersions,
  parseRange,
  parseVersion,
  satisfiesRange,
} from '@reformer/builder-plugin-api/internal';

/** Реестр по умолчанию. Свой (зеркало, приватный) подставляется композицией. */
export const DEFAULT_NPM_REGISTRY = 'https://registry.npmjs.org';

/**
 * Сокращённый пакумент — формат, который реестр отдаёт по этому `Accept`.
 *
 * Он в разы меньше полного: без README, без истории сопровождающих. Нам из него нужны
 * версии и их `dist`, и просить полный значило бы качать мегабайты ради трёх полей.
 */
const PACKUMENT_ACCEPT = 'application/vnd.npm.install-v1+json';

/** Потолок архива. Плагин — это браузерный бандл, а не дистрибутив. */
export const TARBALL_SIZE_LIMIT = 8 * 1024 * 1024;

/**
 * Имя пакета npm: то же правило, что у самого npm, без попытки быть умнее.
 *
 * Строчные буквы, цифры, `-`, `_`, `.`, необязательная область `@scope/`. Всё остальное
 * (в том числе `..`, `/` внутри имени, пробел) отвергается ДО обращения в сеть.
 */
const PACKAGE_NAME = /^(?:@[a-z0-9-][a-z0-9._-]*\/)?[a-z0-9-][a-z0-9._-]*$/;

export type NpmRegistryProblemCode =
  /** Имя пакета не годится — проверено до запроса. */
  | 'package-name'
  /** Сеть или реестр не ответили; ответ не разобрался как JSON. */
  | 'network'
  /** Пакета нет в реестре. */
  | 'not-found'
  /** Есть пакет, но нет версии под диапазон. */
  | 'no-version'
  /** Ответ реестра разобран, но нужных полей в нём нет. */
  | 'malformed'
  /** Архив лежит не на том хосте или без подписи. */
  | 'untrusted'
  /** Архив больше потолка. */
  | 'too-large';

export interface NpmRegistryProblem {
  readonly code: NpmRegistryProblemCode;
  readonly message: string;
}

/** Найденная версия: что качать и с чем сверять. */
export interface NpmPackageRef {
  readonly name: string;
  readonly version: string;
  readonly tarball: string;
  /** Подпись SRI из `dist.integrity`. Пакет без неё сюда не доходит. */
  readonly integrity: string;
}

export type NpmRegistryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly problem: NpmRegistryProblem };

export interface NpmRegistryClient {
  /** Разрешает диапазон в конкретную версию: максимальную из подходящих. */
  resolve(name: string, range: string): Promise<NpmRegistryResult<NpmPackageRef>>;
  /** Качает архив. Подпись здесь НЕ проверяется — это дело `./package`. */
  download(ref: NpmPackageRef): Promise<NpmRegistryResult<Uint8Array>>;
}

export interface NpmRegistryClientDeps {
  /** База реестра без завершающего слэша. */
  readonly registry?: string;
  /** Чем ходить в сеть. Параметр ради тестов: настоящий `fetch` — умолчание. */
  readonly fetch?: typeof globalThis.fetch;
  readonly sizeLimit?: number;
}

const problem = <T>(code: NpmRegistryProblemCode, message: string): NpmRegistryResult<T> => ({
  ok: false,
  problem: { code, message },
});

/** Имя в URL: область отделяется закодированным слэшем, как требует реестр. */
function encodeName(name: string): string {
  return name.startsWith('@') ? name.replace('/', '%2f') : name;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface PackumentVersion {
  readonly dist?: { readonly tarball?: unknown; readonly integrity?: unknown };
}

/** Максимальная версия, удовлетворяющая диапазону. */
function pickVersion(versions: readonly string[], range: string): string | undefined {
  const parsed = parseRange(range);
  if (parsed === undefined) return undefined;
  let best: { text: string; semver: ReturnType<typeof parseVersion> } | undefined;
  for (const text of versions) {
    const semver = parseVersion(text);
    if (semver === undefined || !satisfiesRange(semver, parsed)) continue;
    if (best?.semver === undefined || compareVersions(semver, best.semver) > 0) {
      best = { text, semver };
    }
  }
  return best?.text;
}

export function createNpmRegistryClient(deps: NpmRegistryClientDeps = {}): NpmRegistryClient {
  const registry = (deps.registry ?? DEFAULT_NPM_REGISTRY).replace(/\/+$/, '');
  const request = deps.fetch ?? globalThis.fetch.bind(globalThis);
  const sizeLimit = deps.sizeLimit ?? TARBALL_SIZE_LIMIT;

  return {
    async resolve(name, range) {
      if (!PACKAGE_NAME.test(name)) {
        return problem('package-name', `«${name}» не годится в имена пакетов npm`);
      }

      let response: Response;
      try {
        response = await request(`${registry}/${encodeName(name)}`, {
          headers: { Accept: PACKUMENT_ACCEPT },
        });
      } catch (error) {
        return problem('network', `реестр не ответил: ${describe(error)}`);
      }
      if (response.status === 404) return problem('not-found', `пакета «${name}» в реестре нет`);
      if (!response.ok) {
        return problem('network', `реестр ответил ${String(response.status)} на запрос «${name}»`);
      }

      let packument: { versions?: Record<string, PackumentVersion> };
      try {
        packument = (await response.json()) as typeof packument;
      } catch (error) {
        return problem('network', `ответ реестра не разбирается как JSON: ${describe(error)}`);
      }

      const versions = packument.versions ?? {};
      const version = pickVersion(Object.keys(versions), range);
      if (version === undefined) {
        return problem(
          'no-version',
          `у «${name}» нет версии под диапазон «${range}». Пререлизы не поддерживаются`
        );
      }

      const dist = versions[version]?.dist;
      const tarball = typeof dist?.tarball === 'string' ? dist.tarball : undefined;
      const integrity = typeof dist?.integrity === 'string' ? dist.integrity : undefined;
      if (tarball === undefined) {
        return problem('malformed', `в ответе реестра нет ссылки на архив «${name}@${version}»`);
      }
      if (integrity === undefined) {
        return problem(
          'untrusted',
          `у «${name}@${version}» нет подписи (dist.integrity): скачанное будет не с чем сверить`
        );
      }

      // Хост архива — из ответа, то есть его пишет публикующий. Чужой хост отдал бы нам
      // другой архив вместе с подписью к нему, и проверка подписи перестала бы что-то значить.
      let host: string;
      try {
        host = new URL(tarball).origin;
      } catch {
        return problem('malformed', `ссылка на архив «${tarball}» не разбирается как URL`);
      }
      if (host !== new URL(registry).origin) {
        return problem(
          'untrusted',
          `архив «${name}@${version}» лежит на «${host}», а реестр — «${registry}». ` +
            'Пакет, отправляющий за содержимым на чужой хост, не устанавливается'
        );
      }

      return { ok: true, value: { name, version, tarball, integrity } };
    },

    async download(ref) {
      let response: Response;
      try {
        response = await request(ref.tarball);
      } catch (error) {
        return problem('network', `архив не скачался: ${describe(error)}`);
      }
      if (!response.ok) {
        return problem('network', `на запрос архива реестр ответил ${String(response.status)}`);
      }

      const declared = Number(response.headers.get('content-length') ?? Number.NaN);
      if (Number.isFinite(declared) && declared > sizeLimit) {
        return problem('too-large', `архив объявляет ${String(declared)} байт — это не плагин`);
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      // Заголовку верить нельзя: его пишет та же сторона. Фактический размер — второй раз.
      if (bytes.length > sizeLimit) {
        return problem('too-large', `архив весит ${String(bytes.length)} байт — это не плагин`);
      }
      return { ok: true, value: bytes };
    },
  };
}
