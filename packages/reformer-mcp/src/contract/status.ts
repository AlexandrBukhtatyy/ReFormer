/**
 * Статус платформы: что сторона с диском знает о проекте и пакетах.
 *
 * Клиент собирает его у себя и присылает сервису в каждом вызове (`HostRequest.platform`), сервис
 * подставляет свою версию и отдаёт его ресурсом `reformer://status`.
 *
 * @module @reformer/mcp/contract/status
 */

export interface KnowledgeProblem {
  /** Кто сообщил: `index:@reformer/core`, `typecheck`, `ui-kit-catalog`, … */
  readonly source: string;
  readonly detail: string;
}

export interface PackageLocationStatus {
  readonly name: string;
  /** Корень пакета; `null` — не найден ни от одной базы поиска. */
  readonly root: string | null;
  readonly version: string | null;
  /** Как найден: `node_modules`, `self`, `workspace`, `resolve`, `bundle`. */
  readonly via: string | null;
}

export interface PlatformStatus {
  readonly profile: 'node' | 'browser';
  /**
   * Версия и метка сборки сервера. `corpusHash` — у среды со вшитым корпусом: по нему видно, что
   * копии корпуса из одной сборки.
   */
  readonly server: {
    readonly version: string;
    readonly buildId: string | null;
    readonly corpusHash?: string | null;
  };
  /** Пакеты, как их нашла платформа. В браузере — то, что вшито в артефакт. */
  readonly packages: readonly PackageLocationStatus[];
  /** Проверка типов `form_build`: у браузера её нет вовсе. */
  readonly typecheck: { readonly available: boolean; readonly detail: string };
  /**
   * Каталог компонентов кита приложения (`@reformer/ui-kit`, `@reformer/kit-vuetify`, … — любой
   * зависимости со входом `./catalog`).
   */
  readonly uiKitCatalog: {
    readonly found: boolean;
    readonly components: number;
    readonly source: string | null;
    /** Пакет кита (`kit.package` каталога). */
    readonly package?: string | null;
    /** Фреймворк кита (`kit.framework` каталога; нет поля — `react`). */
    readonly framework?: 'react' | 'vue' | 'angular' | null;
  };
  /** Базы поиска пакетов, по порядку (CLI). */
  readonly bases?: readonly string[];
  readonly problems: readonly KnowledgeProblem[];
}

export type PlatformStatusSource = () => PlatformStatus;
