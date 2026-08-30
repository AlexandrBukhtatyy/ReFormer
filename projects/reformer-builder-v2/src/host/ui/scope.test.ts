import { describe, expect, it, vi } from 'vitest';

import { createScopeStack } from './scope';

describe('стек областей', () => {
  it('верх стека — последняя положенная', () => {
    const stack = createScopeStack();
    stack.push('palette');
    stack.push('dialog');

    expect(stack.top()).toBe('dialog');
  });

  it('пустой стек: области нет, а не пустая строка', () => {
    // Условие `scope == null` обязано означать «окон нет вовсе».
    const stack = createScopeStack();

    expect(stack.top()).toBeNull();
    expect(stack.all()).toEqual([]);
  });

  it('весь стек идёт снизу вверх', () => {
    const stack = createScopeStack();
    stack.push('dialog');
    stack.push('palette');

    expect(stack.all()).toEqual(['dialog', 'palette']);
  });

  it('снятие внутренней записи не трогает внешнюю с ТЕМ ЖЕ именем', () => {
    // Два вложенных диалога объявляют одну область. Снимай мы «верхнюю по имени» —
    // закрытие внутреннего убирало бы область у внешнего, который ещё открыт.
    const stack = createScopeStack();
    const outer = stack.push('dialog');
    const inner = stack.push('dialog');

    inner.dispose();

    expect(stack.all()).toEqual(['dialog']);
    expect(stack.top()).toBe('dialog');
    outer.dispose();
    expect(stack.top()).toBeNull();
  });

  it('снятие НЕ по порядку убирает свою запись', () => {
    // Окна закрываются в произвольном порядке: диалог поверх палитры может закрыться
    // раньше неё.
    const stack = createScopeStack();
    const first = stack.push('palette');
    stack.push('dialog');

    first.dispose();

    expect(stack.all()).toEqual(['dialog']);
  });

  it('повторное снятие ничего не ломает', () => {
    const stack = createScopeStack();
    const subscription = stack.push('dialog');

    subscription.dispose();
    subscription.dispose();

    expect(stack.all()).toEqual([]);
  });
});

describe('подписка', () => {
  it('уведомляет о появлении и снятии области', () => {
    const stack = createScopeStack();
    const seen = vi.fn();
    stack.subscribe(seen);

    const subscription = stack.push('dialog');
    expect(seen).toHaveBeenCalledTimes(1);

    subscription.dispose();
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it('снятая подписка молчит', () => {
    const stack = createScopeStack();
    const seen = vi.fn();
    stack.subscribe(seen).dispose();

    stack.push('dialog');

    expect(seen).not.toHaveBeenCalled();
  });

  it('ссылка на стек стабильна между изменениями', () => {
    // Требование снимка контекстных ключей: он кэширует значение, а `useSyncExternalStore`
    // падает, получая новый массив на каждый вызов.
    const stack = createScopeStack();
    stack.push('dialog');

    expect(stack.all()).toBe(stack.all());
  });

  it('падение одного подписчика не мешает остальным', () => {
    const stack = createScopeStack();
    const healthy = vi.fn();
    stack.subscribe(() => {
      throw new Error('подписчик сломан');
    });
    stack.subscribe(healthy);

    expect(() => stack.push('dialog')).toThrow('подписчик сломан');
    expect(healthy).toHaveBeenCalled();
    // Изменение всё равно совершено: отказ подписчика его не откатывает.
    expect(stack.top()).toBe('dialog');
  });
});
