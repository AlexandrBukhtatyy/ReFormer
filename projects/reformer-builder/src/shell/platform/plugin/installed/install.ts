/**
 * Установка плагина из npm: одна операция из пяти уже готовых частей.
 *
 * ```text
 * реестр → архив → подпись+tar → манифест → хранилище
 * ```
 *
 * Собственного здесь почти ничего нет, и это правильно: каждый шаг уже написан и проверен
 * отдельно (`./registry`, `./package`, разбор манифеста в пакете контракта, `./store`).
 * Ценность модуля — в ПОРЯДКЕ и в том, где он останавливается.
 *
 * ## Манифест проверяется ДО записи на диск
 *
 * Пакет, у которого манифест не разбирается или `id` не совпадает с именем каталога, на диск
 * не попадает вовсе. Иначе список плагинов пополнился бы записью, которую нельзя ни включить,
 * ни объяснить, а удалять её человеку пришлось бы руками.
 *
 * ## Идентификатор берётся из МАНИФЕСТА, а не из имени пакета
 *
 * `@acme/forms-plugin` может объявлять плагин `acme-forms`: имя в npm и идентификатор
 * в реестрах оболочки — разные пространства. Каталогом на диске становится идентификатор,
 * потому что именно его ждёт загрузчик и именно он обязан совпасть с полем `id`.
 *
 * ## Чего здесь НЕТ
 *
 * Включения. Установка кладёт файлы и ничего не запускает: решение «пусть этот код работает»
 * принадлежит человеку и принимается в каталоге проекта (`../catalog`), где спрашиваются
 * и права. Установить и включить — два разных действия, и склеивать их значило бы исполнить
 * чужой код по факту скачивания.
 *
 * @module shell/platform/plugin/installed/install
 */

import { parsePluginManifest, PLUGIN_MANIFEST_FILE } from '@reformer/builder-plugin-api/internal';
import type { PluginProblem } from '@reformer/builder-plugin-api/internal';
import { BUILDER_VERSION } from '@/shell/platform/version';

import { readNpmPackage } from '../npm/package';
import type { NpmRegistryClient } from '../npm/registry';
import type { InstalledPluginRecord, InstalledPluginStore } from './store';

export interface InstallPluginDeps {
  readonly registry: NpmRegistryClient;
  readonly store: InstalledPluginStore;
  /** Адрес реестра — уезжает в запись, чтобы обновление шло туда же, откуда приехало. */
  readonly registryUrl: string;
}

export interface InstallPluginRequest {
  /** Имя пакета npm. */
  readonly package: string;
  /** Диапазон версий; умолчание — любая выпущенная. */
  readonly range?: string;
}

export type InstallPluginResult =
  | { readonly ok: true; readonly record: InstalledPluginRecord }
  | { readonly ok: false; readonly problem: PluginProblem };

const decoder = new TextDecoder();

const fail = (code: PluginProblem['code'], message: string): InstallPluginResult => ({
  ok: false,
  problem: { code, message },
});

/**
 * Ставит плагин. Ничего не бросает: сеть, подпись и чужой манифест — данные отказа.
 *
 * Отказы описаны кодами ОБОЛОЧКИ (`manifest-invalid`, `id-mismatch`, …), а не своими: список
 * плагинов показывает их одной строкой, и человеку незачем различать «не разобрался манифест
 * при установке» и «не разобрался при обходе каталога».
 */
export async function installPluginFromNpm(
  deps: InstallPluginDeps,
  request: InstallPluginRequest
): Promise<InstallPluginResult> {
  const found = await deps.registry.resolve(request.package, request.range ?? '>=0.0.0');
  if (!found.ok) return fail('manifest-missing', found.problem.message);

  const archive = await deps.registry.download(found.value);
  if (!archive.ok) return fail('manifest-missing', archive.problem.message);

  const unpacked = await readNpmPackage(archive.value, { integrity: found.value.integrity });
  if (!unpacked.ok) return fail('manifest-unreadable', unpacked.problem.message);

  const manifestBytes = unpacked.files.get(PLUGIN_MANIFEST_FILE);
  if (manifestBytes === undefined) {
    return fail(
      'manifest-missing',
      `в пакете «${request.package}» нет ${PLUGIN_MANIFEST_FILE}: это не плагин билдера`
    );
  }

  // Разбор — ТОТ ЖЕ, что у каталога проекта, и поставка та же: у установленного есть каталог
  // и точка входа, а правила у них общие. Имя каталога берётся из самого манифеста, поэтому
  // сверка id с каталогом здесь означает «id непротиворечив», а настоящую сверку сделает
  // обход слоя — на том, что реально лежит на диске.
  const text = decoder.decode(manifestBytes);
  const declaredId = readId(text);
  if (declaredId === undefined) {
    return fail('manifest-invalid', `${PLUGIN_MANIFEST_FILE} пакета не содержит строкового «id»`);
  }
  const parsed = parsePluginManifest(
    text,
    { kind: 'project', dir: declaredId },
    { builder: BUILDER_VERSION }
  );
  if (!parsed.ok) return { ok: false, problem: parsed.problem };

  await deps.store.install({
    id: parsed.manifest.id,
    package: found.value.name,
    version: found.value.version,
    integrity: found.value.integrity,
    registry: deps.registryUrl,
    files: unpacked.files,
  });

  const record = (await deps.store.list()).find((item) => item.id === parsed.manifest.id);
  if (record === undefined) {
    return fail('manifest-missing', 'плагин записан, но не читается обратно из хранилища');
  }
  return { ok: true, record };
}

/** Достаёт `id` до полного разбора: им назовётся каталог, в который разбор и целится. */
function readId(text: string): string | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof raw !== 'object' || raw === null) return undefined;
  const id = (raw as { id?: unknown }).id;
  return typeof id === 'string' && id.trim() !== '' ? id.trim() : undefined;
}
