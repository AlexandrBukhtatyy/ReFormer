/**
 * `reformer-plugin build`: исходники плагина → каталог, который оболочка грузит как есть.
 *
 * ## Что получается
 *
 * `manifest.json` (тот же, с `main: "main.js"` и `styles.file: "styles.css"`), один `main.js`,
 * `styles.css`, если стили объявлены, и словари по тем же путям, что в исходниках.
 *
 * - **`main.js` — CommonJS.** Линковщик оболочки исполняет модули как CommonJS, и готовый JS
 *   идёт у него без транспиляции (`shell/platform/modules/loader`): собери мы ESM, оболочке
 *   пришлось бы будить транспилятор ради уже собранного файла.
 * - **Модули рантайма — внешние, ровно по списку** `PLUGIN_RUNTIME_MODULES`. Вложенная копия
 *   React или ядра форм — второй экземпляр и тихая поломка. Импорт `@reformer/*` или
 *   `@builder/*`, которого в списке нет, — ОТКАЗ сборки: вложить его нельзя (тот же второй
 *   экземпляр), а оставить внешним — значит плагин, падающий на спецификаторе при загрузке.
 * - **Помощники печати — вкладываются** (`PLUGIN_BUNDLED_PACKAGES`, это `@reformer/builder-toolkit`):
 *   чистые функции без синглтонов, которых оболочка не подставляет. Код домена (ядро ReFormer)
 *   пакетом больше не бывает и не вкладывается: чужой домен расширяют возможностями.
 * - **CSS из кода — отказ.** Стили плагина объявляются в манифесте (`styles`), и только тогда
 *   оболочка их изолирует. Импорт `.css` из кода дал бы таблицу, о которой манифест молчит.
 *
 * ## Что проверяется на выходе
 *
 * Собранный каталог проходит то, что пройдёт у оболочки: разбор манифеста поставки `project`
 * (с каталогом, названным по `id`), потолок числа файлов кода и «сухую» активацию
 * (`./dry-run`) — узнавание плагина в экспортах, `id` кода и `provides`.
 *
 * ## Каталог вывода не чужой
 *
 * Перед записью каталог очищается, но только если он пуст или в нём лежит сборка ЭТОГО ЖЕ
 * плагина (манифест с тем же `id`). Иначе — отказ: `--out ~/project` не должен стирать проект.
 *
 * @module @reformer/builder-plugin-cli/commands/build
 */

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import {
  isBundledPluginModule,
  isPluginCodeFile,
  parsePluginManifest,
  PLUGIN_FILE_LIMIT,
  PLUGIN_MANIFEST_FILE,
  PLUGIN_RUNTIME_MODULES,
  type PluginSourceManifest,
} from '@reformer/builder-plugin-api/tooling';
import * as esbuild from 'esbuild';

import { dryActivate } from './dry-run.js';
import type { Finding } from './findings.js';
import { validatePlugin } from './validate.js';

export interface BuildOptions {
  /** Каталог исходников плагина (с `manifest.json`). */
  readonly dir: string;
  /** Куда класть сборку; умолчание — `dist` в каталоге исходников. */
  readonly outDir?: string;
}

export type BuildResult =
  | {
      readonly ok: true;
      readonly manifest: PluginSourceManifest;
      readonly outDir: string;
      readonly files: readonly string[];
      /** Проверки, которые не удалось довести до конца вне оболочки. Не отказы. */
      readonly notices: readonly string[];
    }
  | { readonly ok: false; readonly findings: readonly Finding[] };

/** Имена, под которыми сборка кладёт код и стили. */
const BUILT_MAIN = 'main.js';
const BUILT_STYLES = 'styles.css';

const fail = (...findings: Finding[]): BuildResult => ({ ok: false, findings });

/** Спецификатор пакета — не путь: ни относительный, ни абсолютный (в том числе `D:\`). */
function isBareSpecifier(path: string): boolean {
  return !path.startsWith('.') && !path.startsWith('/') && !/^[a-zA-Z]:[\\/]/.test(path);
}

/**
 * Модули рантайма — внешние; вкладываемые пакеты — вкладываются; прочее `@reformer/*` — отказ
 * с объяснением.
 */
const runtimeModules: esbuild.Plugin = {
  name: 'reformer-runtime-modules',
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      if (args.kind === 'entry-point' || !isBareSpecifier(args.path)) return undefined;
      if (PLUGIN_RUNTIME_MODULES.includes(args.path)) return { path: args.path, external: true };
      if (isBundledPluginModule(args.path)) return undefined;
      if (args.path.startsWith('@reformer/') || args.path.startsWith('@builder/')) {
        return {
          errors: [
            {
              text:
                `модуль «${args.path}» оболочка не подставляет, а вкладывать его в сборку нельзя — ` +
                'это был бы второй экземпляр пакета',
              detail: 'module-unavailable',
            },
          ],
        };
      }
      return undefined;
    });
  },
};

async function prepareOutDir(outDir: string, id: string): Promise<Finding | undefined> {
  let entries: string[];
  try {
    entries = await readdir(outDir);
  } catch {
    return undefined;
  }
  if (entries.length > 0) {
    let previousId: unknown;
    try {
      const text = await readFile(join(outDir, PLUGIN_MANIFEST_FILE), 'utf8');
      previousId = (JSON.parse(text) as { id?: unknown }).id;
    } catch {
      previousId = undefined;
    }
    if (previousId !== id) {
      return {
        code: 'output-not-ours',
        message:
          `каталог вывода «${outDir}» не пуст и не содержит сборку «${id}»: ` +
          'очищать чужой каталог сборка не станет',
      };
    }
  }
  await rm(outDir, { recursive: true, force: true });
  return undefined;
}

function buildFailure(error: unknown): Finding[] {
  const messages = (error as { errors?: esbuild.Message[] }).errors;
  if (messages === undefined || messages.length === 0) {
    return [
      { code: 'build-failed', message: error instanceof Error ? error.message : String(error) },
    ];
  }
  return messages.map((message) => ({
    code: message.detail === 'module-unavailable' ? 'module-unavailable' : 'build-failed',
    message: message.text,
    ...(message.location === null ? {} : { file: message.location.file }),
  }));
}

export async function buildPlugin(options: BuildOptions): Promise<BuildResult> {
  const dir = resolve(options.dir);
  const outDir = resolve(dir, options.outDir ?? 'dist');

  const validated = await validatePlugin(dir);
  if (!validated.ok) return fail(...validated.findings);
  const { manifest } = validated;

  let code: string;
  try {
    const result = await esbuild.build({
      absWorkingDir: dir,
      entryPoints: [join(dir, manifest.main)],
      outfile: join(outDir, BUILT_MAIN),
      bundle: true,
      write: false,
      format: 'cjs',
      platform: 'browser',
      target: 'es2020',
      jsx: 'automatic',
      logLevel: 'silent',
      plugins: [runtimeModules],
    });
    const css = result.outputFiles.find((file) => file.path.endsWith('.css'));
    if (css !== undefined) {
      return fail({
        code: 'css-from-code',
        message:
          'код импортирует CSS. Стили плагина объявляются в манифесте полем «styles» — ' +
          'только такую таблицу оболочка изолирует',
      });
    }
    const js = result.outputFiles.find((file) => file.path.endsWith('.js'));
    code = js?.text ?? '';
  } catch (error) {
    return fail(...buildFailure(error));
  }

  let styles: string | undefined;
  if (manifest.styles !== undefined) {
    try {
      const result = await esbuild.build({
        absWorkingDir: dir,
        entryPoints: [join(dir, manifest.styles.file)],
        outfile: join(outDir, BUILT_STYLES),
        bundle: true,
        write: false,
        logLevel: 'silent',
      });
      styles = result.outputFiles.find((file) => file.path.endsWith('.css'))?.text ?? '';
    } catch (error) {
      return fail(...buildFailure(error));
    }
  }

  // Манифест вывода — ИСХОДНЫЙ JSON с двумя заменами, а не сериализация разобранного:
  // разбор нормализует и подставляет умолчания, и автор увидел бы в сборке не свой файл.
  const raw = JSON.parse(await readFile(join(dir, PLUGIN_MANIFEST_FILE), 'utf8')) as Record<
    string,
    unknown
  >;
  raw.main = BUILT_MAIN;
  if (manifest.styles !== undefined) {
    raw.styles = { ...(raw.styles as object), file: BUILT_STYLES };
  }
  const manifestText = `${JSON.stringify(raw, null, 2)}\n`;

  const files = new Map<string, string>([
    [PLUGIN_MANIFEST_FILE, manifestText],
    [BUILT_MAIN, code],
  ]);
  if (styles !== undefined) files.set(BUILT_STYLES, styles);
  const messages: Readonly<Record<string, string>> = manifest.contributes?.messages ?? {};
  for (const file of Object.values(messages)) {
    files.set(file, await readFile(join(dir, file), 'utf8'));
  }

  // Проверки выхода — ДО записи: не прошедшая их сборка не должна затирать прошлую рабочую.
  const shipped = parsePluginManifest(manifestText, { kind: 'project', dir: manifest.id });
  if (!shipped.ok) return fail(shipped.problem);
  const codeFiles = [...files.keys()].filter(isPluginCodeFile).length;
  if (codeFiles > PLUGIN_FILE_LIMIT) {
    return fail({
      code: 'too-many-files',
      message: `в сборке ${String(codeFiles)} файлов кода, оболочка читает не больше ${String(PLUGIN_FILE_LIMIT)}`,
    });
  }
  const dryRun = await dryActivate(code, manifest);
  if (dryRun.findings.length > 0) return fail(...dryRun.findings);

  const refused = await prepareOutDir(outDir, manifest.id);
  if (refused !== undefined) return fail(refused);
  for (const [path, content] of files) {
    const target = join(outDir, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }

  return { ok: true, manifest, outDir, files: [...files.keys()], notices: dryRun.notices };
}
