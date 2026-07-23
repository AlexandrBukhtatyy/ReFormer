/**
 * Утилиты для работы с файлами в валидаторах.
 *
 * Duck-typing вместо `instanceof File` — SSR-безопасность (в Node может не быть глобального
 * `File`) и поддержка сериализуемых дескрипторов загруженных файлов (`RemoteFileRef` из
 * `@reformer/cdk/file-upload`) наравне с нативными `File`.
 *
 * @group Validation
 * @category Validators
 * @module validators/file-utils
 */

/**
 * Минимальный файлоподобный контракт, с которым работают file-валидаторы:
 * нативный `File`, сериализуемый дескриптор загруженного файла и т.п.
 */
export interface FileLike {
  name: string;
  size?: number;
  type?: string;
}

/**
 * Проверяет, что значение файлоподобно: объект со строковым `name` и опциональными
 * числовым `size` / строковым `type`.
 *
 * @param value - Проверяемое значение
 * @returns `true`, если значение соответствует {@link FileLike}
 */
export function isFileLike(value: unknown): value is FileLike {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.name !== 'string') return false;
  if (v.size !== undefined && typeof v.size !== 'number') return false;
  if (v.type !== undefined && typeof v.type !== 'string') return false;
  return true;
}

/**
 * Нормализует значение file-поля в массив файлоподобных элементов.
 *
 * Одиночный {@link FileLike} оборачивается в массив; из массива отбираются только
 * файлоподобные элементы. Для прочих значений — `null` (валидатор пропускает).
 *
 * @param value - Значение поля (`FileLike`, `FileLike[]` или что-то ещё)
 * @returns Массив файлоподобных элементов или `null`
 */
export function toFileArray(value: unknown): FileLike[] | null {
  if (Array.isArray(value)) return value.filter(isFileLike);
  if (isFileLike(value)) return [value];
  return null;
}

/**
 * Проверяет файл против accept-паттерна в синтаксисе нативного атрибута
 * `<input type="file" accept>`: список через запятую из расширений (`.pdf`),
 * точных MIME (`image/png`) и wildcard-категорий (`image/*`). Регистронезависимо.
 *
 * Нужен собственный матчер, потому что `accept` у нативного input — только подсказка
 * пикеру: на drag-and-drop и на программное значение он не действует.
 *
 * @param file - Файлоподобное значение (`name` + опциональный `type`)
 * @param accept - Accept-строка; пустая/пробельная строка матчит всё
 * @returns `true`, если файл подходит хотя бы под один паттерн
 */
export function matchesFileAccept(file: Pick<FileLike, 'name' | 'type'>, accept: string): boolean {
  const patterns = accept
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  if (patterns.length === 0) return true;

  const name = file.name.toLowerCase();
  const type = (file.type ?? '').toLowerCase();

  return patterns.some((pattern) => {
    if (pattern.startsWith('.')) return name.endsWith(pattern);
    if (pattern.endsWith('/*')) return type.startsWith(pattern.slice(0, -1));
    if (pattern.includes('/')) return type === pattern;
    return false;
  });
}
