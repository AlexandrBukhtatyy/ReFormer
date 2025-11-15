import { describe, it, expect, vi } from 'vitest';
import { SubscriptionManager } from '../../../src/core/utils/subscription-manager';

describe('SubscriptionManager', () => {
  describe('add', () => {
    it('добавляет подписку', () => {
      const manager = new SubscriptionManager();
      const dispose = vi.fn();

      manager.add('test', dispose);

      expect(manager.has('test')).toBe(true);
      expect(manager.size()).toBe(1);
    });

    it('возвращает функцию отписки', () => {
      const manager = new SubscriptionManager();
      const dispose = vi.fn();

      const unsubscribe = manager.add('test', dispose);

      expect(typeof unsubscribe).toBe('function');
    });

    it('заменяет существующую подписку', () => {
      const manager = new SubscriptionManager();
      const dispose1 = vi.fn();
      const dispose2 = vi.fn();

      manager.add('test', dispose1);
      manager.add('test', dispose2); // заменяет первую

      expect(dispose1).toHaveBeenCalledTimes(1); // старая отписалась
      expect(manager.size()).toBe(1); // осталась только одна
    });

    it('вызывает старый dispose при замене', () => {
      const manager = new SubscriptionManager();
      const dispose1 = vi.fn();
      const dispose2 = vi.fn();

      manager.add('test', dispose1);

      // При добавлении новой подписки с тем же ключом
      manager.add('test', dispose2);

      // Старая подписка должна быть отписана
      expect(dispose1).toHaveBeenCalledTimes(1);
      expect(dispose2).not.toHaveBeenCalled();
    });

    it('добавляет несколько подписок с разными ключами', () => {
      const manager = new SubscriptionManager();
      const dispose1 = vi.fn();
      const dispose2 = vi.fn();
      const dispose3 = vi.fn();

      manager.add('sub1', dispose1);
      manager.add('sub2', dispose2);
      manager.add('sub3', dispose3);

      expect(manager.size()).toBe(3);
      expect(manager.has('sub1')).toBe(true);
      expect(manager.has('sub2')).toBe(true);
      expect(manager.has('sub3')).toBe(true);
    });

    it('работает с разными типами ключей', () => {
      const manager = new SubscriptionManager();

      manager.add('watch-value', vi.fn());
      manager.add('watch-errors', vi.fn());
      manager.add('validate-async', vi.fn());

      expect(manager.size()).toBe(3);
    });
  });

  describe('remove', () => {
    it('удаляет подписку', () => {
      const manager = new SubscriptionManager();
      const dispose = vi.fn();

      manager.add('test', dispose);
      const removed = manager.remove('test');

      expect(removed).toBe(true);
      expect(dispose).toHaveBeenCalledTimes(1);
      expect(manager.has('test')).toBe(false);
      expect(manager.size()).toBe(0);
    });

    it('возвращает false для несуществующей подписки', () => {
      const manager = new SubscriptionManager();

      const removed = manager.remove('nonExistent');

      expect(removed).toBe(false);
    });

    it('не вызывает ошибку при удалении несуществующей подписки', () => {
      const manager = new SubscriptionManager();

      expect(() => {
        manager.remove('nonExistent');
      }).not.toThrow();
    });

    it('удаляет только указанную подписку', () => {
      const manager = new SubscriptionManager();
      const dispose1 = vi.fn();
      const dispose2 = vi.fn();
      const dispose3 = vi.fn();

      manager.add('sub1', dispose1);
      manager.add('sub2', dispose2);
      manager.add('sub3', dispose3);

      manager.remove('sub2');

      expect(manager.size()).toBe(2);
      expect(manager.has('sub1')).toBe(true);
      expect(manager.has('sub2')).toBe(false);
      expect(manager.has('sub3')).toBe(true);
      expect(dispose1).not.toHaveBeenCalled();
      expect(dispose2).toHaveBeenCalledTimes(1);
      expect(dispose3).not.toHaveBeenCalled();
    });

    it('позволяет удалить подписку дважды без ошибок', () => {
      const manager = new SubscriptionManager();
      const dispose = vi.fn();

      manager.add('test', dispose);
      manager.remove('test');

      // Вторая попытка удаления той же подписки
      const removed = manager.remove('test');

      expect(removed).toBe(false);
      expect(dispose).toHaveBeenCalledTimes(1); // dispose вызван только один раз
    });
  });

  describe('clear', () => {
    it('очищает все подписки', () => {
      const manager = new SubscriptionManager();
      const dispose1 = vi.fn();
      const dispose2 = vi.fn();
      const dispose3 = vi.fn();

      manager.add('sub1', dispose1);
      manager.add('sub2', dispose2);
      manager.add('sub3', dispose3);

      manager.clear();

      expect(dispose1).toHaveBeenCalledTimes(1);
      expect(dispose2).toHaveBeenCalledTimes(1);
      expect(dispose3).toHaveBeenCalledTimes(1);
      expect(manager.size()).toBe(0);
    });

    it('работает с пустым менеджером', () => {
      const manager = new SubscriptionManager();

      expect(() => {
        manager.clear();
      }).not.toThrow();

      expect(manager.size()).toBe(0);
    });

    it('можно вызвать несколько раз', () => {
      const manager = new SubscriptionManager();
      const dispose = vi.fn();

      manager.add('test', dispose);

      manager.clear();
      manager.clear(); // Второй вызов

      expect(dispose).toHaveBeenCalledTimes(1); // dispose вызван только один раз
      expect(manager.size()).toBe(0);
    });

    it('позволяет добавить новые подписки после очистки', () => {
      const manager = new SubscriptionManager();
      const dispose1 = vi.fn();
      const dispose2 = vi.fn();

      manager.add('test', dispose1);
      manager.clear();

      // Добавляем новую подписку после очистки
      manager.add('test', dispose2);

      expect(manager.size()).toBe(1);
      expect(manager.has('test')).toBe(true);
      expect(dispose1).toHaveBeenCalledTimes(1);
      expect(dispose2).not.toHaveBeenCalled();
    });
  });

  describe('size', () => {
    it('возвращает 0 для пустого менеджера', () => {
      const manager = new SubscriptionManager();

      expect(manager.size()).toBe(0);
    });

    it('возвращает количество подписок', () => {
      const manager = new SubscriptionManager();

      manager.add('sub1', vi.fn());
      expect(manager.size()).toBe(1);

      manager.add('sub2', vi.fn());
      expect(manager.size()).toBe(2);

      manager.add('sub3', vi.fn());
      expect(manager.size()).toBe(3);
    });

    it('уменьшается при удалении подписки', () => {
      const manager = new SubscriptionManager();

      manager.add('sub1', vi.fn());
      manager.add('sub2', vi.fn());
      manager.add('sub3', vi.fn());

      expect(manager.size()).toBe(3);

      manager.remove('sub2');
      expect(manager.size()).toBe(2);

      manager.remove('sub1');
      expect(manager.size()).toBe(1);

      manager.remove('sub3');
      expect(manager.size()).toBe(0);
    });

    it('становится 0 после clear', () => {
      const manager = new SubscriptionManager();

      manager.add('sub1', vi.fn());
      manager.add('sub2', vi.fn());

      expect(manager.size()).toBe(2);

      manager.clear();

      expect(manager.size()).toBe(0);
    });

    it('не изменяется при замене подписки', () => {
      const manager = new SubscriptionManager();

      manager.add('test', vi.fn());
      expect(manager.size()).toBe(1);

      manager.add('test', vi.fn()); // замена
      expect(manager.size()).toBe(1);
    });
  });

  describe('has', () => {
    it('возвращает false для пустого менеджера', () => {
      const manager = new SubscriptionManager();

      expect(manager.has('test')).toBe(false);
    });

    it('возвращает true для существующей подписки', () => {
      const manager = new SubscriptionManager();

      manager.add('test', vi.fn());

      expect(manager.has('test')).toBe(true);
    });

    it('возвращает false для несуществующей подписки', () => {
      const manager = new SubscriptionManager();

      manager.add('test', vi.fn());

      expect(manager.has('nonExistent')).toBe(false);
    });

    it('возвращает false после удаления подписки', () => {
      const manager = new SubscriptionManager();

      manager.add('test', vi.fn());
      manager.remove('test');

      expect(manager.has('test')).toBe(false);
    });

    it('возвращает false после clear', () => {
      const manager = new SubscriptionManager();

      manager.add('test', vi.fn());
      manager.clear();

      expect(manager.has('test')).toBe(false);
    });

    it('чувствителен к регистру ключей', () => {
      const manager = new SubscriptionManager();

      manager.add('Test', vi.fn());

      expect(manager.has('Test')).toBe(true);
      expect(manager.has('test')).toBe(false);
      expect(manager.has('TEST')).toBe(false);
    });
  });

  describe('getKeys', () => {
    it('возвращает пустой массив для пустого менеджера', () => {
      const manager = new SubscriptionManager();

      expect(manager.getKeys()).toEqual([]);
    });

    it('возвращает все ключи подписок', () => {
      const manager = new SubscriptionManager();

      manager.add('sub1', vi.fn());
      manager.add('sub2', vi.fn());
      manager.add('sub3', vi.fn());

      const keys = manager.getKeys();

      expect(keys).toHaveLength(3);
      expect(keys).toContain('sub1');
      expect(keys).toContain('sub2');
      expect(keys).toContain('sub3');
    });

    it('обновляется после добавления подписки', () => {
      const manager = new SubscriptionManager();

      manager.add('sub1', vi.fn());
      expect(manager.getKeys()).toEqual(['sub1']);

      manager.add('sub2', vi.fn());
      expect(manager.getKeys()).toHaveLength(2);
    });

    it('обновляется после удаления подписки', () => {
      const manager = new SubscriptionManager();

      manager.add('sub1', vi.fn());
      manager.add('sub2', vi.fn());
      manager.add('sub3', vi.fn());

      manager.remove('sub2');

      const keys = manager.getKeys();
      expect(keys).toHaveLength(2);
      expect(keys).toContain('sub1');
      expect(keys).toContain('sub3');
      expect(keys).not.toContain('sub2');
    });

    it('возвращает пустой массив после clear', () => {
      const manager = new SubscriptionManager();

      manager.add('sub1', vi.fn());
      manager.add('sub2', vi.fn());

      manager.clear();

      expect(manager.getKeys()).toEqual([]);
    });

    it('возвращает новый массив (не мутирует внутреннее состояние)', () => {
      const manager = new SubscriptionManager();

      manager.add('sub1', vi.fn());
      manager.add('sub2', vi.fn());

      const keys1 = manager.getKeys();
      const keys2 = manager.getKeys();

      // Разные массивы
      expect(keys1).not.toBe(keys2);
      // Но одинаковое содержимое
      expect(keys1).toEqual(keys2);
    });
  });

  describe('возвращаемая функция отписки из add()', () => {
    it('отписывает от подписки', () => {
      const manager = new SubscriptionManager();
      const dispose = vi.fn();

      const unsubscribe = manager.add('test', dispose);
      unsubscribe();

      expect(dispose).toHaveBeenCalledTimes(1);
      expect(manager.has('test')).toBe(false);
    });

    it('можно вызвать несколько раз без ошибок', () => {
      const manager = new SubscriptionManager();
      const dispose = vi.fn();

      const unsubscribe = manager.add('test', dispose);

      unsubscribe();
      unsubscribe(); // Второй вызов

      expect(dispose).toHaveBeenCalledTimes(1); // dispose вызван только один раз
    });

    it('работает независимо для разных подписок', () => {
      const manager = new SubscriptionManager();
      const dispose1 = vi.fn();
      const dispose2 = vi.fn();

      const unsubscribe1 = manager.add('sub1', dispose1);
      // @ts-ignore
      const unsubscribe2 = manager.add('sub2', dispose2);

      unsubscribe1();

      expect(dispose1).toHaveBeenCalledTimes(1);
      expect(dispose2).not.toHaveBeenCalled();
      expect(manager.has('sub1')).toBe(false);
      expect(manager.has('sub2')).toBe(true);
    });
  });

  describe('интеграционные тесты', () => {
    it('полный жизненный цикл подписки', () => {
      const manager = new SubscriptionManager();
      const dispose = vi.fn();

      // Создание
      manager.add('test', dispose);
      expect(manager.has('test')).toBe(true);
      expect(manager.size()).toBe(1);

      // Удаление
      manager.remove('test');
      expect(manager.has('test')).toBe(false);
      expect(manager.size()).toBe(0);
      expect(dispose).toHaveBeenCalledTimes(1);
    });

    it('несколько подписок с разными ключами', () => {
      const manager = new SubscriptionManager();
      const dispose1 = vi.fn();
      const dispose2 = vi.fn();
      const dispose3 = vi.fn();

      manager.add('watch-value', dispose1);
      manager.add('watch-errors', dispose2);
      manager.add('validate', dispose3);

      expect(manager.size()).toBe(3);

      // Удаляем только одну
      manager.remove('watch-errors');

      expect(manager.size()).toBe(2);
      expect(dispose2).toHaveBeenCalledTimes(1);
      expect(dispose1).not.toHaveBeenCalled();
      expect(dispose3).not.toHaveBeenCalled();

      // Очищаем остальные
      manager.clear();

      expect(manager.size()).toBe(0);
      expect(dispose1).toHaveBeenCalledTimes(1);
      expect(dispose3).toHaveBeenCalledTimes(1);
    });

    it('замена подписки с автоматической отпиской от старой', () => {
      const manager = new SubscriptionManager();
      const dispose1 = vi.fn();
      const dispose2 = vi.fn();

      manager.add('test', dispose1);
      expect(manager.size()).toBe(1);

      // Замена
      manager.add('test', dispose2);

      expect(manager.size()).toBe(1); // Всё ещё одна подписка
      expect(dispose1).toHaveBeenCalledTimes(1); // Старая отписалась
      expect(dispose2).not.toHaveBeenCalled(); // Новая активна

      // Удаление
      manager.remove('test');

      expect(dispose2).toHaveBeenCalledTimes(1); // Новая отписалась
    });

    it('использование в классе FormNode (симуляция)', () => {
      class MockFieldNode {
        private subscriptions = new SubscriptionManager();
        private watchCallbacks: Array<(value: string) => void> = [];
        private watchCounter = 0;

        watch(callback: (value: string) => void): () => void {
          this.watchCallbacks.push(callback);

          // Симуляция effect с уникальным ключом
          const dispose = vi.fn();
          return this.subscriptions.add(`watch-${this.watchCounter++}`, dispose);
        }

        dispose(): void {
          this.subscriptions.clear();
        }

        getSubscriptionCount(): number {
          return this.subscriptions.size();
        }
      }

      const node = new MockFieldNode();

      const unsubscribe1 = node.watch(() => {});
      // @ts-ignore
      const unsubscribe2 = node.watch(() => {});

      expect(node.getSubscriptionCount()).toBe(2);

      unsubscribe1();
      expect(node.getSubscriptionCount()).toBe(1);

      node.dispose();
      expect(node.getSubscriptionCount()).toBe(0);
    });
  });
});
