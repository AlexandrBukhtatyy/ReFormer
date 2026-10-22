/**
 * `list_source` — дерево каталога проекта таким, каким оно лежит на диске.
 *
 * Один уровень каталога модель может прочитать и `read_resource` по адресу каталога; этот
 * инструмент нужен, чтобы увидеть несколько уровней одним вызовом, а не шагом на каждый. Глубина
 * ограничена тремя: дерево глубже уже не помещается в ответ и стоит больше, чем объясняет.
 *
 * Зависимости, сборка и скрытые каталоги показываются, но не раскрываются — модели важно знать,
 * что они есть, а не что внутри.
 *
 * @module plugins/base/files/assistant/list-source
 */

import type { AssistantTool, AssistantToolResult } from '@reformer/builder-plugin-api';
import { assistantErrorOf, idOfPath, NO_PROJECT, type SourceAccess } from './source-errors';
import { deniedReason, normalizeSourcePath, skippedInWalk } from './source-uri';

/** Параметры вызова. */
interface Params {
  readonly path?: string;
  readonly depth?: number;
}

/** Потолок строк ответа: дерево длиннее модель всё равно не дочитает. */
const MAX_ENTRIES = 200;

/** Потолок текста ответа — с запасом под обрезку ассистентом. */
const MAX_TEXT = 1400;

/** Инструмент `list_source` поверх доступа к источнику. */
export function listSourceTool(access: SourceAccess): AssistantTool<Params> {
  return {
    name: 'list_source',
    description:
      'List a project directory as saved on disk, as a tree. Entries are source:<path> ' +
      'resources — read files with read_resource.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory from the project root; empty — root' },
        depth: { type: 'integer', minimum: 1, maximum: 3, description: 'Levels, default 1' },
      },
      additionalProperties: false,
    },
    readOnly: true,
    async run(params, ctx): Promise<AssistantToolResult> {
      const path = normalizeSourcePath(params.path ?? '');
      if (path === null) {
        return {
          ok: false,
          error: { code: 'REFUSED', message: `${String(params.path)} is outside the project.` },
        };
      }
      const rootId = idOfPath(access, path);
      if (rootId === null) return { ok: false, error: NO_PROJECT };

      const depth = Math.min(3, Math.max(1, params.depth ?? 1));
      const lines: string[] = [];
      let total = 0;
      let shown = 0;
      let shownChars = 0;

      /** Обход в глубину: дерево читается сверху вниз, как его рисуют. */
      const walk = async (dirPath: string, level: number): Promise<AssistantToolResult | null> => {
        const id = idOfPath(access, dirPath);
        if (id === null) return { ok: false, error: NO_PROJECT };
        const listed = await access.source.list(id, { signal: ctx.signal });
        if (!listed.ok) {
          // Корень — ответ инструмента; вложенный каталог — строка-пометка, дерево продолжается.
          if (level === 0) return { ok: false, error: assistantErrorOf(listed.error, dirPath) };
          lines.push(`${'  '.repeat(level)}(not listed: ${listed.error.kind})`);
          return null;
        }
        for (const ref of listed.value) {
          if (deniedReason(ref.path) !== null) continue;
          total += 1;
          const line = `${'  '.repeat(level)}${ref.name}${ref.kind === 'directory' ? '/' : ''}`;
          if (shown < MAX_ENTRIES && shownChars + line.length < MAX_TEXT) {
            lines.push(line);
            shown += 1;
            shownChars += line.length + 1;
          }
          if (ref.kind === 'directory' && level + 1 < depth && !skippedInWalk(ref.name)) {
            const nested = await walk(ref.path, level + 1);
            if (nested !== null) return nested;
          }
        }
        return null;
      };

      const failed = await walk(path, 0);
      if (failed !== null) return failed;
      const head = `source:${path} — ${String(total)} entries`;
      const tail =
        total > shown
          ? `\n… ${String(total - shown)} more — narrow it: list_source path=<subdirectory>`
          : '';
      return `${head}\n${lines.join('\n')}${tail}`;
    },
  };
}
