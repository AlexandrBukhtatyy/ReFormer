/**
 * AbstractRegistry - базовый класс для реестров (Behavior, Validation)
 *
 * Унифицирует общую логику:
 * - Управление global stack для изоляции форм
 * - Template methods для begin/end registration
 * - Проверку состояния регистрации
 *
 * @template TRegistration - Тип регистрируемых элементов
 *
 * @internal
 *
 * @example
 * ```typescript
 * class BehaviorRegistry extends AbstractRegistry<RegisteredBehavior> {
 *   protected onBeginRegistration(): void {
 *     this.registrations = [];
 *   }
 *
 *   protected onEndRegistration(form: GroupNode<T>): { cleanup: () => void } {
 *     // Применяем behaviors
 *     return { cleanup: () => { ... } };
 *   }
 * }
 * ```
 */

import { RegistryStack } from './registry-stack';

/**
 * Map для хранения стеков по конструкторам классов
 * Позволяет каждому наследнику иметь свой собственный стек
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registryStacks = new Map<new (...args: any[]) => AbstractRegistry<any>, RegistryStack<any>>();

/**
 * Базовый класс для реестров (BehaviorRegistry, ValidationRegistry).
 *
 * Реализует паттерн Template Method для управления регистрацией:
 * `beginRegistration()` → `onBeginRegistration()`, `endRegistration()` → `onEndRegistration()`.
 *
 * @typeParam TRegistration - Тип регистрируемых элементов.
 *
 * @example
 * ```typescript
 * import { AbstractRegistry } from '@reformer/core';
 *
 * class MyRegistry extends AbstractRegistry<{ name: string }> {
 *   protected onEndRegistration(items: { name: string }[]) {
 *     console.log('Registered', items.length);
 *   }
 * }
 * ```
 */
export abstract class AbstractRegistry<TRegistration> {
  /** Флаг активной регистрации */
  protected isRegistering = false;

  /** Массив зарегистрированных элементов */
  protected registrations: TRegistration[] = [];

  /**
   * Получить стек для конкретного класса реестра
   * Создает новый стек если не существует
   *
   * @param ctor - Конструктор класса реестра
   * @returns RegistryStack для данного класса
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected static getStack<T extends AbstractRegistry<any>>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctor: new (...args: any[]) => T
  ): RegistryStack<T> {
    if (!registryStacks.has(ctor)) {
      registryStacks.set(ctor, new RegistryStack<T>());
    }
    return registryStacks.get(ctor) as RegistryStack<T>;
  }

  /**
   * Получить текущий активный реестр из стека
   * Должен быть переопределен в наследниках как static метод
   *
   * @param ctor - Конструктор класса реестра
   * @returns Текущий активный реестр или null
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected static getCurrentFromStack<T extends AbstractRegistry<any>>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctor: new (...args: any[]) => T
  ): T | null {
    return this.getStack(ctor).getCurrent();
  }

  /**
   * Начать регистрацию
   *
   * Помещает this в global stack для изоляции форм
   * Вызывает hook onBeginRegistration()
   */
  beginRegistration(): void {
    this.isRegistering = true;
    this.registrations = [];

    // Помещаем в стек конкретного класса
    const stack = AbstractRegistry.getStack(this.constructor as never);
    stack.push(this);

    this.onBeginRegistration();
  }

  /**
   * Проверить, активна ли регистрация
   */
  isActive(): boolean {
    return this.isRegistering;
  }

  /**
   * Получить зарегистрированные элементы
   */
  getRegistrations(): TRegistration[] {
    return this.registrations;
  }

  /**
   * Hook: вызывается в начале регистрации
   * Может быть переопределен в наследниках для инициализации
   */
  protected onBeginRegistration(): void {
    // По умолчанию ничего не делает
  }

  /**
   * Завершить регистрацию и извлечь из стека
   *
   * @param registryName - Имя реестра для отладки
   */
  protected completeRegistration(registryName: string): void {
    this.isRegistering = false;

    // Извлекаем из стека с проверкой
    const stack = AbstractRegistry.getStack(this.constructor as never);
    stack.verify(this, registryName);
  }

  /**
   * Отменить регистрацию без применения
   *
   * @param registryName - Имя реестра для отладки
   */
  cancelRegistration(registryName: string): void {
    this.isRegistering = false;
    this.registrations = [];

    // Извлекаем из стека с проверкой
    const stack = AbstractRegistry.getStack(this.constructor as never);
    stack.verify(this, registryName);
  }
}
