/**
 * Debouncer - утилита для отложенного выполнения функций
 *
 * Устраняет дублирование debounce логики между field-node.ts и behavior-registry.ts
 *
 * @example
 * ```typescript
 * const debouncer = new Debouncer(300);
 *
 * // Отложить выполнение на 300мс
 * await debouncer.debounce(async () => {
 *   await validateField();
 * });
 *
 * // Отменить отложенное выполнение
 * debouncer.cancel();
 *
 * // Выполнить немедленно, отменив отложенное
 * await debouncer.flush(async () => {
 *   await validateField();
 * });
 * ```
 */

/**
 * Класс для debouncing (отложенного выполнения) функций
 *
 * Откладывает выполнение функции на заданное время. Если функция вызывается
 * повторно до истечения времени, предыдущий вызов отменяется.
 *
 * Полезно для:
 * - Отложенной валидации при вводе (debounced validation)
 * - Отложенного сохранения данных
 * - Отложенной обработки событий behaviors
 *
 * @example
 * ```typescript
 * // В FieldNode
 * class FieldNode {
 *   private validationDebouncer: Debouncer;
 *
 *   constructor(config) {
 *     this.validationDebouncer = new Debouncer(config.debounce || 0);
 *   }
 *
 *   async validate(): Promise<boolean> {
 *     return this.validationDebouncer.debounce(async () => {
 *       // Валидация выполнится через debounce мс
 *       return await this.runValidation();
 *     });
 *   }
 * }
 * ```
 */
export class Debouncer {
  /**
   * Таймер для отложенного выполнения
   * @private
   */
  private timer?: ReturnType<typeof setTimeout>;

  /**
   * Создать Debouncer с заданной задержкой
   *
   * @param delay Задержка в миллисекундах (0 = без задержки)
   *
   * @example
   * ```typescript
   * const debouncer = new Debouncer(300); // 300мс задержка
   * const immediate = new Debouncer(0);  // Без задержки
   * ```
   */
  constructor(private readonly delay: number) {}

  /**
   * Отложить выполнение функции
   *
   * Если вызывается повторно до истечения delay, предыдущий вызов отменяется
   * и таймер перезапускается.
   *
   * @param fn Функция для выполнения (может быть async)
   * @returns Promise, который разрешается результатом функции
   *
   * @example
   * ```typescript
   * const debouncer = new Debouncer(300);
   *
   * // Первый вызов - запланирован через 300мс
   * debouncer.debounce(async () => console.log('First'));
   *
   * // Второй вызов через 100мс - отменяет первый, запланирован через 300мс
   * debouncer.debounce(async () => console.log('Second'));
   *
   * // Через 300мс выведет только: "Second"
   * ```
   */
  async debounce<T>(fn: () => T | Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      // Отменяем предыдущий таймер, если есть
      if (this.timer) {
        clearTimeout(this.timer);
      }

      // Если delay = 0, выполняем немедленно
      if (this.delay === 0) {
        Promise.resolve()
          .then(() => fn())
          .then(resolve)
          .catch(reject);
        return;
      }

      // Запускаем новый таймер
      this.timer = setTimeout(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, this.delay);
    });
  }

  /**
   * Отменить отложенное выполнение
   *
   * Если есть запланированный вызов, он будет отменен и не выполнится.
   * Promise из debounce() никогда не разрешится.
   *
   * @example
   * ```typescript
   * const debouncer = new Debouncer(300);
   *
   * debouncer.debounce(async () => {
   *   console.log('This will not execute');
   * });
   *
   * debouncer.cancel(); // Отменяем вызов
   * ```
   */
  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  /**
   * Выполнить функцию немедленно, отменив любой отложенный вызов
   *
   * Полезно когда нужно принудительно выполнить действие сейчас,
   * игнорируя debounce.
   *
   * @param fn Функция для немедленного выполнения
   * @returns Promise с результатом функции
   *
   * @example
   * ```typescript
   * const debouncer = new Debouncer(300);
   *
   * // Запланировано через 300мс
   * debouncer.debounce(async () => console.log('Delayed'));
   *
   * // Отменяем отложенный и выполняем немедленно
   * await debouncer.flush(async () => console.log('Immediate'));
   * // Выведет: "Immediate" (сразу)
   * // "Delayed" не выполнится (отменен)
   * ```
   */
  async flush<T>(fn: () => T | Promise<T>): Promise<T> {
    this.cancel();
    return await fn();
  }

  /**
   * Проверить, есть ли активный (запланированный) вызов
   *
   * @returns true если есть запланированный вызов
   *
   * @example
   * ```typescript
   * const debouncer = new Debouncer(300);
   *
   * console.log(debouncer.isPending()); // false
   *
   * debouncer.debounce(() => console.log('Test'));
   * console.log(debouncer.isPending()); // true
   *
   * // Через 300мс
   * console.log(debouncer.isPending()); // false
   * ```
   */
  isPending(): boolean {
    return this.timer !== undefined;
  }
}
