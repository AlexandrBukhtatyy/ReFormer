// ============================================================================
// Типы ресурсов
// ============================================================================

export interface ResourceItem<T> {
  id: string | number;
  label: string;
  value: T;
  [key: string]: any;
}

export interface ResourceResult<T> {
  items: ResourceItem<T>[];
  totalCount: number;
}

export interface ResourceConfig<T> {
  type: 'static' | 'preload' | 'partial';
  load: (params?: ResourceLoadParams) => Promise<ResourceResult<T>>;
}

export interface ResourceLoadParams {
  search?: string;
  page?: number;
  pageSize?: number;
  [key: string]: any;
}

// ============================================================================
// 1. Статическая стратегия
// ============================================================================

/**
 * Статический ресурс - данные загружаются один раз
 * @param items - массив элементов
 */
export function staticResource<T>(items: ResourceItem<T>[]): ResourceConfig<T> {
  return {
    type: 'static',
    load: async () => ({
      items,
      totalCount: items.length,
    }),
  };
}

// ============================================================================
// 2. Предзагрузка
// ============================================================================

/**
 * Предзагрузка - данные загружаются один раз при первом обращении через функцию
 * @param loader - функция загрузки, принимает параметры и возвращает массив
 */
export function preloadResource<T>(
  loader: (params?: ResourceLoadParams) => Promise<ResourceItem<T>[]>
): ResourceConfig<T> {
  let cache: ResourceResult<T> | null = null;

  return {
    type: 'preload',
    load: async (params) => {
      if (!cache) {
        const items = await loader(params);
        cache = {
          items,
          totalCount: items.length,
        };
      }
      return cache;
    },
  };
}

// ============================================================================
// 3. Парциональная загрузка
// ============================================================================

/**
 * Парциональная загрузка - данные загружаются порциями с учетом поиска/пагинации
 * @param loader - функция загрузки, принимает параметры и возвращает массив
 */
export function partialResource<T>(
  loader: (params?: ResourceLoadParams) => Promise<ResourceItem<T>[]>
): ResourceConfig<T> {
  return {
    type: 'partial',
    load: async (params) => {
      const items = await loader(params);
      return {
        items,
        totalCount: items.length, // Можно расширить для поддержки серверной пагинации
      };
    },
  };
}

// ============================================================================
// Экспорт всех стратегий
// ============================================================================

export const Resources = {
  static: staticResource,
  preload: preloadResource,
  partial: partialResource,
};
