/**
 * Generic Registry Stack - утилита для управления стеком регистрации
 *
 * Используется ValidationRegistry и BehaviorRegistry для tracking активного контекста.
 * Устраняет дублирование кода между параллельными системами.
 *
 * @template T - Тип элементов в стеке (ValidationRegistry или BehaviorRegistry)
 *
 * @internal
 *
 * @example
 * ```typescript
 * class ValidationRegistry {
 *   private static registryStack = new RegistryStack<ValidationRegistry>();
 *
 *   static getCurrent() {
 *     return ValidationRegistry.registryStack.getCurrent();
 *   }
 *
 *   beginRegistration() {
 *     ValidationRegistry.registryStack.push(this);
 *   }
 *
 *   endRegistration() {
 *     ValidationRegistry.registryStack.verify(this, 'ValidationRegistry');
 *   }
 * }
 * ```
 */
export class RegistryStack<T> {
  private stack: T[] = [];

  /**
   * Добавить элемент в стек
   * @param item - Элемент для добавления
   */
  push(item: T): void {
    this.stack.push(item);
  }

  /**
   * Извлечь элемент из стека
   * @returns Извлеченный элемент или undefined если стек пуст
   */
  pop(): T | undefined {
    return this.stack.pop();
  }

  /**
   * Получить текущий элемент (вершину стека) без извлечения
   * @returns Текущий элемент или null если стек пуст
   */
  getCurrent(): T | null {
    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
  }

  /**
   * Извлечь элемент из стека с проверкой
   * Выводит предупреждение в DEV режиме если извлеченный элемент не совпадает с ожидаемым
   *
   * @param expected - Ожидаемый элемент
   * @param name - Имя реестра для отладки (например, 'ValidationRegistry')
   */
  verify(expected: T, name: string): void {
    const popped = this.pop();
    if (popped !== expected && import.meta.env.DEV) {
      console.warn(`${name}: Stack mismatch. Expected ${expected}, got ${popped}`);
    }
  }

  /**
   * Получить длину стека
   * @returns Количество элементов в стеке
   */
  get length(): number {
    return this.stack.length;
  }

  /**
   * Проверить, пуст ли стек
   * @returns true если стек пуст
   */
  isEmpty(): boolean {
    return this.stack.length === 0;
  }

  /**
   * Очистить стек
   */
  clear(): void {
    this.stack = [];
  }
}
