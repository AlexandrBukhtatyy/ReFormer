/**
 * Проверка `integrity` пакета: то, чем реестр npm подписывает содержимое архива.
 *
 * Формат — SRI: `sha512-<base64>`. Реестр отдаёт его в `dist.integrity`, и это единственное,
 * чем скачавший может отличить настоящий архив от подменённого по дороге.
 *
 * ## Почему алгоритмы закрытым списком
 *
 * У старых пакетов в реестре рядом лежит `dist.shasum` — SHA-1 в hex. Принять его здесь
 * значило бы согласиться на подпись, подделка которой давно по карману: коллизия SHA-1
 * стоит дешевле, чем вред от подменённого плагина, который исполняется в том же realm,
 * что и оболочка. Поэтому список — `sha512`, `sha384`, `sha256`, и `sha1` в нём нет.
 *
 * ## Недоступность `crypto.subtle` — отказ, а не пропуск
 *
 * В обычном http (не localhost) `crypto.subtle` не существует. Для кэша сборки это законная
 * деградация — он просто выключается (`modules/digest`), — а здесь наоборот: проверить
 * нечем, значит установка не происходит. «Не смогли проверить» и «проверили» обязаны
 * различаться, иначе подпись перестаёт что-либо значить в самом незащищённом окружении.
 *
 * @module shell/platform/plugin/npm/integrity
 */

/** Алгоритмы, которым мы верим, и их имена в WebCrypto. */
const ALGORITHMS: ReadonlyMap<string, string> = new Map([
  ['sha512', 'SHA-512'],
  ['sha384', 'SHA-384'],
  ['sha256', 'SHA-256'],
]);

export type IntegrityResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

const fail = (reason: string): IntegrityResult => ({ ok: false, reason });

function toBase64(bytes: ArrayBuffer): string {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Сверяет байты с подписью.
 *
 * @param data скачанный архив ЦЕЛИКОМ
 * @param integrity строка SRI из метаданных реестра; допускается несколько подписей через
 * пробел — тогда достаточно одной совпавшей известным алгоритмом, как в самом SRI
 */
export async function verifyIntegrity(
  data: Uint8Array,
  integrity: string
): Promise<IntegrityResult> {
  const declared = integrity.trim().split(/\s+/).filter(Boolean);
  if (declared.length === 0) return fail('подпись пакета не объявлена, а без неё установки нет');

  if (typeof crypto?.subtle?.digest !== 'function') {
    return fail(
      'подпись пакета нечем проверить: crypto.subtle доступен только в защищённом контексте ' +
        '(https или localhost). Установка без проверки подписи не делается'
    );
  }

  const known: string[] = [];
  for (const entry of declared) {
    const separator = entry.indexOf('-');
    const algorithm = ALGORITHMS.get(entry.slice(0, separator));
    if (algorithm === undefined) continue;
    known.push(entry);

    // `?` в конце SRI — параметры подписи; на сам хеш они не влияют.
    const expected = entry.slice(separator + 1).split('?')[0] ?? '';
    const actual = toBase64(await crypto.subtle.digest(algorithm, data as BufferSource));
    if (actual === expected) return { ok: true };
  }

  if (known.length === 0) {
    return fail(
      `подпись «${integrity}» не годится: известны ${[...ALGORITHMS.keys()].join(', ')}. ` +
        'SHA-1 из dist.shasum здесь не принимается — его подделка давно по карману'
    );
  }
  return fail('подпись пакета не совпала с содержимым архива: он повреждён или подменён');
}
