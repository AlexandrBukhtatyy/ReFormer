/**
 * Менеджер подписок для FormNode
 *
 * Централизует управление effect-подписками в узлах формы,
 * предотвращает утечки памяти и упрощает отладку.
 *
 * Каждая подписка имеет уникальный ключ, что позволяет:
 * - Отписываться от конкретной подписки по ключу
 * - Автоматически заменять существующие подписки
 * - Отслеживать количество активных подписок (для отладки)
 *
 * @example
 * ```typescript
 * class FieldNode {
 *   private subscriptions = new SubscriptionManager();
 *
 *   watch(callback: Function) {
 *     const dispose = effect(() => callback(this.value.value));
 *     return this.subscriptions.add('watch', dispose);
 *   }
 *
 *   dispose() {
 *     this.subscriptions.clear();
 *   }
 * }
 * ```
 */
export class SubscriptionManager {
  /**
   * Хранилище подписок
   * Ключ: уникальный идентификатор подписки
   * Значение: функция отписки (dispose)
   */
  private subscriptions = new Map<string, () => void>();

  /**
   * Добавляет подписку
   *
   * Если подписка с таким ключом уже существует, отписывается от неё
   * и заменяет новой. Это предотвращает утечки памяти при повторной
   * регистрации подписки с тем же ключом.
   *
   * @param key Уникальный ключ подписки
   * @param dispose Функция отписки (обычно возвращаемая из effect())
   * @returns Функция для отписки от этой конкретной подписки
   *
   * @example
   * ```typescript
   * const manager = new SubscriptionManager();
   *
   * // Добавление подписки
   * const unsubscribe = manager.add('mySubscription', () => {
   *   console.log('Disposing subscription');
   * });
   *
   * // Отписка через возвращаемую функцию
   * unsubscribe();
   *
   * // Или через manager.remove()
   * manager.add('anotherSub', disposeFn);
   * manager.remove('anotherSub');
   * ```
   */
  add(key: string, dispose: () => void): () => void {
    // Если подписка с таким ключом уже есть, отписываемся от неё
    if (this.subscriptions.has(key)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[SubscriptionManager] Subscription "${key}" already exists, replacing`);
      }
      this.subscriptions.get(key)?.();
    }

    // Сохраняем новую подписку
    this.subscriptions.set(key, dispose);

    // Возвращаем функцию отписки
    return () => this.remove(key);
  }

  /**
   * Удаляет подписку по ключу
   *
   * Вызывает функцию отписки и удаляет подписку из хранилища.
   * Если подписка с таким ключом не найдена, ничего не делает.
   *
   * @param key Ключ подписки
   * @returns true, если подписка была удалена, false если не найдена
   *
   * @example
   * ```typescript
   * const manager = new SubscriptionManager();
   * manager.add('mySub', disposeFn);
   *
   * // Удаление подписки
   * const removed = manager.remove('mySub'); // true
   *
   * // Попытка удалить несуществующую подписку
   * const removed2 = manager.remove('nonExistent'); // false
   * ```
   */
  remove(key: string): boolean {
    const dispose = this.subscriptions.get(key);
    if (dispose) {
      dispose();
      this.subscriptions.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Очищает все подписки
   *
   * Вызывает функции отписки для всех активных подписок
   * и очищает хранилище. Обычно используется при dispose узла формы.
   *
   * @example
   * ```typescript
   * class FieldNode {
   *   private subscriptions = new SubscriptionManager();
   *
   *   dispose() {
   *     // Отписываемся от всех effect
   *     this.subscriptions.clear();
   *   }
   * }
   * ```
   */
  clear(): void {
    // Используем forEach для совместимости
    this.subscriptions.forEach((dispose) => {
      dispose();
    });
    this.subscriptions.clear();
  }

  /**
   * Возвращает количество активных подписок
   *
   * Полезно для отладки утечек памяти. Если количество подписок
   * растет без ограничений, это может указывать на то, что
   * компоненты не отписываются должным образом.
   *
   * @returns Количество активных подписок
   *
   * @example
   * ```typescript
   * const manager = new SubscriptionManager();
   * console.log(manager.size()); // 0
   *
   * manager.add('sub1', disposeFn1);
   * manager.add('sub2', disposeFn2);
   * console.log(manager.size()); // 2
   *
   * manager.clear();
   * console.log(manager.size()); // 0
   * ```
   */
  size(): number {
    return this.subscriptions.size;
  }

  /**
   * Проверяет, есть ли подписка с данным ключом
   *
   * @param key Ключ подписки
   * @returns true, если подписка существует
   *
   * @example
   * ```typescript
   * const manager = new SubscriptionManager();
   * manager.add('mySub', disposeFn);
   *
   * console.log(manager.has('mySub')); // true
   * console.log(manager.has('nonExistent')); // false
   * ```
   */
  has(key: string): boolean {
    return this.subscriptions.has(key);
  }

  /**
   * Возвращает список всех ключей активных подписок
   *
   * Полезно для отладки: можно увидеть, какие подписки активны.
   *
   * @returns Массив ключей всех активных подписок
   *
   * @example
   * ```typescript
   * const manager = new SubscriptionManager();
   * manager.add('watch-value', disposeFn1);
   * manager.add('watch-errors', disposeFn2);
   *
   * console.log(manager.getKeys()); // ['watch-value', 'watch-errors']
   * ```
   */
  getKeys(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Отписывается от всех подписок (алиас для clear())
   *
   * Используется при dispose() узла формы для совместимости с ожидаемым API.
   *
   * @example
   * ```typescript
   * class FieldNode {
   *   private subscriptions = new SubscriptionManager();
   *
   *   dispose() {
   *     this.subscriptions.dispose();
   *   }
   * }
   * ```
   */
  dispose(): void {
    this.clear();
  }
}
