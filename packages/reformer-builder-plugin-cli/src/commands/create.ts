/**
 * `reformer-plugin create <каталог>`: новый плагин из шаблона.
 *
 * Идентификатор проверяется РАЗБОРОМ манифеста, а не своим выражением: шаблон собирает манифест
 * и отдаёт его `parsePluginSourceManifest`. Так «годится ли id» решает то же правило, что
 * у оболочки, и CLI не может разрешить идентификатор, который оболочка не примет.
 *
 * В непустой каталог не пишет: перезапись чужих файлов шаблоном — не та ошибка, которую
 * хочется обнаружить после.
 *
 * @module @reformer/builder-plugin-cli/commands/create
 */

import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

import { parsePluginSourceManifest } from '@reformer/builder-plugin-api/tooling';

import { manifestTemplate, pluginTemplate } from './template.js';

export interface CreateOptions {
  /** Каталог нового плагина. Создаётся, если его нет; обязан быть пустым, если есть. */
  readonly dir: string;
  /** Идентификатор; умолчание — имя каталога. */
  readonly id?: string;
  /** Подпись в списке плагинов; умолчание — идентификатор. */
  readonly name?: string;
  readonly cliVersion: string;
}

export type CreateResult =
  | { readonly ok: true; readonly dir: string; readonly files: readonly string[] }
  | { readonly ok: false; readonly message: string };

async function isEmptyOrMissing(dir: string): Promise<boolean> {
  try {
    return (await readdir(dir)).length === 0;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT';
  }
}

export async function createPlugin(options: CreateOptions): Promise<CreateResult> {
  const dir = resolve(options.dir);
  const id = options.id ?? basename(dir);
  const name = options.name ?? id;

  const checked = parsePluginSourceManifest(manifestTemplate({ id, name }));
  if (!checked.ok) return { ok: false, message: checked.problem.message };

  if (!(await isEmptyOrMissing(dir))) {
    return { ok: false, message: `каталог «${dir}» не пуст: шаблон не перезаписывает файлы` };
  }

  const files = pluginTemplate({ id, name, cliVersion: options.cliVersion });
  for (const [path, content] of Object.entries(files)) {
    const target = join(dir, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }
  return { ok: true, dir, files: Object.keys(files) };
}
