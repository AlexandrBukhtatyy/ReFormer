/**
 * Диск пользователя для тонкого клиента: что положить в вызов сервиса и как применить его ответ.
 *
 * Всё читается и пишется теми же адаптерами, что у локального сервера, поэтому граница записи та
 * же: каталог формы — внутри проекта, без `node_modules` и `.git`; проверка типов — компилятором и
 * пакетами проекта; отчёты — в каталог отчётов.
 *
 * @module @reformer/mcp/host/local
 */

import { createHash } from 'node:crypto';
import { createCliFormWorkspace } from '../local/form-workspace.js';
import { createCliIssueSink } from '../local/issue-sink.js';
import { localPlatformStatus } from '../local/status.js';
import { createCliSpecSource } from '../local/spec-source.js';
import { loadUiKitCatalog } from '../local/ui-kit-catalog.js';
import {
  DEFAULT_DIR_KEY,
  type HostDirectory,
  type HostFile,
  type HostOp,
  type HostTypecheckResult,
} from '../contract/protocol.js';

/** Файл описания формы: его ищут и выше каталога (`FormDirectory.above`). */
const INTENT_FILE = 'form.intent.json';

/** Файл крупнее этого в снимок не идёт: в каталоге формы так велики только чужие файлы. */
const MAX_FILE_BYTES = 2 * 1024 * 1024;

export interface LocalHost {
  directory(key: string): HostDirectory;
  above(key: string, name: string): string[];
  spec(ref: string): string | null;
  specBase(): string;
  issuesLocation(): string;
  /** Каталог кита с отпечатком; `null` — кит не установлен. */
  uiKitCatalog(): { readonly hash: string; readonly json: unknown } | null;
  typecheck(key: string, files: readonly HostFile[]): Promise<HostTypecheckResult>;
  platform(): unknown;
  /** Применить операции сервиса к диску — по порядку. */
  apply(ops: readonly HostOp[]): void;
}

/**
 * @param start - От чего считать относительный путь каталога формы — как у локального сервера,
 *   рабочий каталог процесса.
 */
export function createLocalHost(start?: string): LocalHost {
  const workspace = createCliFormWorkspace(start);
  const specs = createCliSpecSource();
  const issues = createCliIssueSink();
  const open = (key: string) => workspace.open(key === DEFAULT_DIR_KEY ? null : key);

  return {
    directory(key) {
      const opened = open(key);
      if (!opened.ok) return { ok: false, reason: opened.reason };
      const directory = opened.directory;
      const files: Record<string, string> = {};
      for (const name of directory.list()) {
        // Подкаталог читается как `null` — он не файл модуля.
        const content = directory.read(name);
        if (content !== null && Buffer.byteLength(content) <= MAX_FILE_BYTES) files[name] = content;
      }
      return {
        ok: true,
        label: directory.label,
        files,
        above: { [INTENT_FILE]: directory.above?.(INTENT_FILE) ?? [] },
      };
    },
    above(key, name) {
      const opened = open(key);
      return opened.ok ? (opened.directory.above?.(name) ?? []) : [];
    },
    spec: (ref) => specs.read(ref),
    specBase: () => specs.describe?.() ?? process.cwd(),
    issuesLocation: () => issues.location(),
    uiKitCatalog() {
      const json = loadUiKitCatalog();
      if (json === undefined || json === null) return null;
      const hash = createHash('sha256').update(JSON.stringify(json)).digest('hex').slice(0, 32);
      return { hash, json };
    },
    async typecheck(key, files) {
      const opened = open(key);
      if (!opened.ok) return { status: 'unavailable', reason: opened.reason };
      return opened.directory.typecheck(files);
    },
    platform: () => localPlatformStatus(),
    apply(ops) {
      const directories = new Map<string, ReturnType<typeof open>>();
      for (const op of ops) {
        if (op.op === 'issue') {
          issues.write(op.baseName, op.payload);
          continue;
        }
        let opened = directories.get(op.dir);
        if (!opened) {
          opened = open(op.dir);
          directories.set(op.dir, opened);
        }
        if (!opened.ok) throw new Error(`cannot write the form folder: ${opened.reason}`);
        if (op.op === 'write') opened.directory.write(op.name, op.content);
        else opened.directory.remove(op.name);
      }
    },
  };
}
