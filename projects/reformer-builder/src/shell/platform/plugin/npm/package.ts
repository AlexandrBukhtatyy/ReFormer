/**
 * Пакет npm → набор файлов плагина: распаковать, сверить с `integrity`, снять обёртку.
 *
 * Три шага, и порядок между ними несущий.
 *
 * 1. **Сверка с `integrity` — ПЕРВОЙ**, над скачанными байтами и до всякого разбора. Так
 *    работает сам npm, и довод тот же: подпись подтверждает то, что приехало, а не то, что
 *    мы из этого вычитали. Распаковав сначала, мы дали бы чужому архиву исполнить наш
 *    разбор до любой проверки.
 * 2. **Распаковка** — `DecompressionStream('gzip')` и свой tar (`./tar`): closed-list того,
 *    что бывает в плагине, и отказ данными на всём остальном.
 * 3. **Снятие обёртки `package/`** — её кладёт `npm pack` вокруг всего содержимого, и дальше
 *    оболочке нужен набор файлов плагина, а не пакета. Запись вне этой обёртки — отказ:
 *    архив, разложенный иначе, разложен не npm.
 *
 * Отказы — ДАННЫЕ ({@link NpmPackageProblem}), не исключения: испорченный или подменённый
 * архив — обычное состояние сети, а не авария приложения.
 *
 * @module shell/platform/plugin/npm/package
 */

import { verifyIntegrity, type IntegrityResult } from './integrity';
import { readTar, TAR_LIMITS, type TarLimits } from './tar';

/** Обёртка, которой `npm pack` накрывает содержимое пакета. */
const PACKAGE_PREFIX = 'package/';

export type NpmPackageProblemCode =
  /** `integrity` не совпал или его нечем проверить. */
  | 'integrity'
  /** Архив не распаковывается: не gzip, оборван, испорчен. */
  | 'unpack'
  /** Содержимое разложено не так, как кладёт npm. */
  | 'layout';

export interface NpmPackageProblem {
  readonly code: NpmPackageProblemCode;
  readonly message: string;
}

export type NpmPackageResult =
  | { readonly ok: true; readonly files: ReadonlyMap<string, Uint8Array> }
  | { readonly ok: false; readonly problem: NpmPackageProblem };

export interface ReadNpmPackageOptions {
  /**
   * Ожидаемая подпись в формате SRI (`sha512-…`), как её отдаёт реестр.
   *
   * Обязательна. Установка без подписи — это «скачали что дали», и отличить подменённый
   * архив от настоящего после распаковки уже нечем.
   */
  readonly integrity: string;
  readonly limits?: TarLimits;
}

const problem = (code: NpmPackageProblemCode, message: string): NpmPackageResult => ({
  ok: false,
  problem: { code, message },
});

/** Распаковка gzip браузерным потоком. `undefined` — не распаковалось. */
async function gunzip(data: Uint8Array): Promise<Uint8Array | undefined> {
  if (typeof DecompressionStream !== 'function') return undefined;
  try {
    const stream = new Blob([data as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return undefined;
  }
}

/** Читает `.tgz` пакета npm и отдаёт файлы плагина путями ВНУТРИ пакета. */
export async function readNpmPackage(
  data: Uint8Array,
  options: ReadNpmPackageOptions
): Promise<NpmPackageResult> {
  const checked: IntegrityResult = await verifyIntegrity(data, options.integrity);
  if (!checked.ok) return problem('integrity', checked.reason);

  const tar = await gunzip(data);
  if (tar === undefined) {
    return problem('unpack', 'архив не распаковывается: это не gzip или он повреждён');
  }

  const read = readTar(tar, options.limits ?? TAR_LIMITS);
  if (!read.ok) return problem('unpack', read.reason);

  const files = new Map<string, Uint8Array>();
  for (const entry of read.entries) {
    if (!entry.path.startsWith(PACKAGE_PREFIX)) {
      return problem(
        'layout',
        `в архиве есть «${entry.path}» вне каталога «package/»: так пакеты npm не устроены`
      );
    }
    const path = entry.path.slice(PACKAGE_PREFIX.length);
    if (path === '') continue;
    files.set(path, entry.bytes);
  }

  if (files.size === 0) return problem('layout', 'в архиве нет ни одного файла пакета');
  return { ok: true, files };
}
