/**
 * Файловые инструменты агента, у которого нет своих (Ollama): только внутри рабочего каталога.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const MAX_READ_CHARS = 20_000;

export const WORKSPACE_TOOLS = [
  {
    name: 'read_file',
    description: 'Read a text file from the working directory.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path relative to the working directory.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Create or overwrite a text file in the working directory.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path relative to the working directory.' },
        content: { type: 'string', description: 'Full file content.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_files',
    description: 'List files of the working directory, recursively.',
    inputSchema: { type: 'object', properties: {} },
  },
];

function listFiles(directory, prefix = '') {
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    const relative = prefix ? `${prefix}/${name}` : name;
    return statSync(full).isDirectory() ? listFiles(full, relative) : [relative];
  });
}

/** Путь внутри рабочего каталога; выход за его пределы — исключение. */
export function resolveInside(workspaceDirectory, relative) {
  const root = path.resolve(workspaceDirectory);
  const target = path.resolve(root, String(relative ?? ''));
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error(`Путь вне рабочего каталога: ${relative}`);
  }
  return target;
}

/**
 * Выполнить инструмент. Ошибка возвращается текстом: модель должна увидеть её и поправиться.
 *
 * @returns {{ ok: boolean, text: string }}
 */
export function runWorkspaceTool(workspaceDirectory, name, input) {
  try {
    if (name === 'list_files') {
      return { ok: true, text: listFiles(workspaceDirectory).join('\n') || '(пусто)' };
    }
    const target = resolveInside(workspaceDirectory, input?.path);
    if (name === 'read_file') {
      if (!existsSync(target)) return { ok: false, text: `Файла нет: ${input?.path}` };
      return { ok: true, text: readFileSync(target, 'utf8').slice(0, MAX_READ_CHARS) };
    }
    if (typeof input?.content !== 'string') {
      return { ok: false, text: 'Нужен строковый аргумент content.' };
    }
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, input.content);
    return { ok: true, text: `Записано: ${input.path}` };
  } catch (error) {
    return { ok: false, text: String(error?.message ?? error) };
  }
}
