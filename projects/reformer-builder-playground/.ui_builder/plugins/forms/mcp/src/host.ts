/**
 * Что плагину нужно от рабочей области — порт, собранный из служб контекста (`./workspace`).
 *
 * Порт, а не службы напрямую: тесты подставляют проект картой файлов, а остальной плагин не знает
 * ни об источнике, ни о рабочей копии.
 *
 * @module plugins/forms/mcp/host
 */

import type {
  Disposable,
  PluginContext,
  ResourceId,
  ResourceRef,
  SourceResult,
  SourceText,
  Translate,
} from '@reformer/builder-plugin-api';

export type { Translate };

/** Секреты плагина — тип поля контекста: отдельным именем SDK его не экспортирует. */
export type SecretStorage = PluginContext['secrets'];

export interface McpHost {
  /** Корень открытого проекта; `null` — проекта нет. */
  projectRoot(): ResourceId | null;
  resolve(dir: ResourceId, ...segments: readonly string[]): ResourceId;
  /** Записи каталога. Каталога нет — пустой список или отказ: обе ситуации — «серверов нет». */
  list(dir: ResourceId): Promise<readonly ResourceRef[]>;
  /**
   * Текст рабочей копии; `null` — файла нет. Так читаются `.mcp.json` и `server.json`: правка в
   * редакторе билдера видна до сохранения.
   */
  readText(id: ResourceId): Promise<string | null>;
  /**
   * Сохранённый текст скрипта мимо рабочей копии — бандл сервера весит мегабайты, и копировать
   * его в рабочую копию ради запуска незачем.
   */
  readScript(id: ResourceId, maxBytes: number): Promise<SourceResult<SourceText>>;
  /** Разрешает ли источник исполнять код этого ресурса — та же граница, что у плагинов проекта. */
  executesCode(id: ResourceId): boolean;
  /** Текст ресурсов рабочей копии изменился. */
  onDidChangeFiles(cb: (changed: readonly ResourceId[]) => void): Disposable;
  /** Сменился проект или вкладки — поводов перечитать серверы проекта нет других. */
  onDidChangeProject(cb: () => void): Disposable;
  /** Секреты плагина: значения `${VAR}` удалённых серверов. */
  readonly secrets: SecretStorage;
  useTranslate(): Translate;
}
