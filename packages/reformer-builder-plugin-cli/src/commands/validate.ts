/**
 * `reformer-plugin validate`: пропустит ли оболочка этот плагин — ДО оболочки.
 *
 * Каждое правило здесь взято из пакета контракта, а не написано заново: разбор манифеста,
 * разбор словаря, расширения кода. Валидатор, пропускающий то, что оболочка отвергнет, хуже
 * отсутствия валидатора, — поэтому своего у CLI только то, чего оболочка не видит вовсе.
 *
 * ## Что проверяется
 *
 * 1. **Манифест исходников** — `parsePluginSourceManifest`: всё, что проверяет оболочка, кроме
 *    имени каталога, плюс обязательная версия. Отказ здесь останавливает проверку: без манифеста
 *    не известно, какие файлы искать.
 * 2. **Файлы, на которые манифест ссылается**: точка входа (есть и это код), таблица стилей,
 *    словари (есть и плоские). Оболочка отказывает на них при загрузке — здесь то же
 *    отказом, но до неё. Эти проверки собираются ВСЕ: автору полезнее список, чем первая беда.
 * 3. **Версия `package.json`**, если он есть, совпадает с версией манифеста. Оболочка
 *    `package.json` не читает, поэтому расхождение она не заметит, — а упаковка опубликует пакет
 *    одной версии с манифестом другой.
 *
 * Чего здесь НЕТ и почему: сверки `provides` с тем, что плагин регистрирует, и потолка числа
 * файлов. Первое требует исполнить код, второе относится к собранному каталогу, а не
 * к исходникам с тестами; оба — дело сборки.
 *
 * @module @reformer/builder-plugin-cli/commands/validate
 */

import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import {
  isPluginCodeFile,
  parseMessagesBundle,
  parsePluginSourceManifest,
  PLUGIN_MANIFEST_FILE,
  type PluginSourceManifest,
} from '@reformer/builder-plugin-api/tooling';

import type { Finding } from './findings.js';

/** Замечание валидатора; общий тип всех команд — `./findings`. */
export type ValidationFinding = Finding;

export type ValidationResult =
  | { readonly ok: true; readonly manifest: PluginSourceManifest }
  | {
      readonly ok: false;
      /** Есть, если манифест разобран, а отказали файлы вокруг него. */
      readonly manifest?: PluginSourceManifest;
      readonly findings: readonly ValidationFinding[];
    };

async function readText(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return undefined;
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** Проверяет каталог исходников плагина. Ничего не бросает: отказы — данные. */
export async function validatePlugin(dir: string): Promise<ValidationResult> {
  const text = await readText(join(dir, PLUGIN_MANIFEST_FILE));
  if (text === undefined) {
    return {
      ok: false,
      findings: [
        {
          code: 'manifest-missing',
          message: `в каталоге нет ${PLUGIN_MANIFEST_FILE}`,
          file: PLUGIN_MANIFEST_FILE,
        },
      ],
    };
  }

  const parsed = parsePluginSourceManifest(text);
  if (!parsed.ok) return { ok: false, findings: [parsed.problem] };
  const { manifest } = parsed;

  const findings: ValidationFinding[] = [];

  if (!isPluginCodeFile(manifest.main)) {
    findings.push({
      code: 'entry-missing',
      message: `точка входа «${manifest.main}» — не файл кода: загрузчик берёт только .js/.ts и родственные`,
      file: PLUGIN_MANIFEST_FILE,
    });
  } else if (!(await isFile(join(dir, manifest.main)))) {
    findings.push({
      code: 'entry-missing',
      message: `точки входа «${manifest.main}» нет`,
      file: manifest.main,
    });
  }

  if (manifest.styles !== undefined && !(await isFile(join(dir, manifest.styles.file)))) {
    findings.push({
      code: 'styles-invalid',
      message: `объявленной таблицы стилей «${manifest.styles.file}» нет`,
      file: manifest.styles.file,
    });
  }

  const messages: Readonly<Record<string, string>> = manifest.contributes?.messages ?? {};
  for (const [locale, file] of Object.entries(messages)) {
    const bundle = await readText(join(dir, file));
    if (bundle === undefined) {
      findings.push({
        code: 'messages-invalid',
        message: `словарь локали «${locale}»: «${file}» не читается`,
        file,
      });
      continue;
    }
    const checked = parseMessagesBundle(bundle);
    if (!checked.ok) {
      findings.push({
        code: 'messages-invalid',
        message: `словарь локали «${locale}»: «${file}» ${checked.reason}`,
        file,
      });
    }
  }

  const pkg = await readText(join(dir, 'package.json'));
  if (pkg !== undefined) {
    let version: unknown;
    try {
      version = (JSON.parse(pkg) as { version?: unknown }).version;
    } catch {
      version = undefined;
    }
    if (version !== manifest.version) {
      findings.push({
        code: 'package-version',
        message:
          `версия package.json («${String(version)}») не совпадает с версией манифеста ` +
          `(«${manifest.version}»): пакет опубликуется одной версией, а оболочка покажет другую`,
        file: 'package.json',
      });
    }
  }

  return findings.length === 0 ? { ok: true, manifest } : { ok: false, manifest, findings };
}
