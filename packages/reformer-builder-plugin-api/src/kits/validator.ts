/**
 * Проверка каталога кита против контракта `component-catalog.schema.json`.
 *
 * Нужна там, где каталог пришёл ИЗВНЕ: кит, внесённый плагином, реестр китов сверяет до того,
 * как отдать его стекам, а инструмент автора плагина — до сборки. Встроенный кит проверен своей
 * сборкой, поэтому на горячем пути открытия проекта проверки нет.
 *
 * ## Почему асинхронно
 *
 * ajv и схема грузятся ЛЕНИВО. Статический импорт клал в главный чанк 118 кБ ради функции,
 * которую зовут только для китов из плагинов, — замерено, а не предположено.
 *
 * @module @reformer/builder-plugin-api/kits/validator
 */

/** Итог проверки: годен ли каталог и что именно не так. */
export interface CatalogCheck {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/** Проверка каталога. Синхронная — движок уже загружен. */
export type CatalogValidator = (json: unknown) => CatalogCheck;

/**
 * Загруженный движок со скомпилированной схемой — один на приложение: компиляция стоит заметно
 * дороже проверки, а схема не меняется.
 */
let loading: Promise<CatalogValidator> | null = null;

/**
 * Загрузить проверку каталога. Повторный и параллельный вызовы отдают ту же работу — двух
 * движков не будет.
 */
export async function loadCatalogValidator(): Promise<CatalogValidator> {
  loading ??= (async (): Promise<CatalogValidator> => {
    const [{ default: Ajv }, schema] = await Promise.all([
      import('ajv'),
      import('./component-catalog.schema.json'),
    ]);
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile((schema.default ?? schema) as object);
    return (json: unknown): CatalogCheck => {
      const valid = validate(json);
      const errors = (validate.errors ?? []).map((error) =>
        `${error.instancePath || '/'} ${error.message ?? ''}`.trim()
      );
      return { valid: Boolean(valid), errors };
    };
  })();
  return loading;
}
