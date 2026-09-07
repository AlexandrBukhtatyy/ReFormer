import { describe, expect, it, vi } from 'vitest';

import { makeResourceId } from '@/shell/platform/primitives/resource';
import { createSelectionService, SelectionServiceToken } from './selection';

const A = makeResourceId('mem', 'a.json');
const B = makeResourceId('mem', 'b.json');

describe('createSelectionService — состояние, а не факт', () => {
  it('подписчик, пришедший ПОСЛЕ записи, читает текущее выделение', () => {
    const selection = createSelectionService();
    // Издатель (превью) сработал раньше, чем подписчик (редактор) вообще появился.
    selection.set(A, ['n1']);

    const seen: string[] = [];
    selection.onDidChange((resource) => {
      seen.push(resource);
    });

    // Это и есть разница между службой и событием в шине: значение можно СПРОСИТЬ.
    expect(selection.get(A)).toEqual(['n1']);
    expect(seen).toEqual([]);
  });

  it('пустое выделение у ресурса, о котором никто ничего не писал', () => {
    const selection = createSelectionService();
    expect(selection.get(A)).toEqual([]);
  });

  it('снимок стабилен по ссылке между изменениями', () => {
    const selection = createSelectionService();
    selection.set(A, ['n1']);
    expect(selection.get(A)).toBe(selection.get(A));

    // И пустой ответ — тоже одна ссылка на всех: его читает useSyncExternalStore.
    expect(selection.get(B)).toBe(selection.get(B));
  });

  it('записанное возвращается тем же и в том же порядке', () => {
    const selection = createSelectionService();
    selection.set(A, ['n3', 'n1', 'n2']);
    expect(selection.get(A)).toEqual(['n3', 'n1', 'n2']);
  });

  it('список копируется: правка исходного массива не меняет службу', () => {
    const selection = createSelectionService();
    const mine = ['n1', 'n2'];
    selection.set(A, mine);
    mine.push('n3');
    expect(selection.get(A)).toEqual(['n1', 'n2']);
  });
});

describe('createSelectionService — привязка к ресурсу', () => {
  it('у двух ресурсов выделения независимы', () => {
    const selection = createSelectionService();
    selection.set(A, ['n1']);
    selection.set(B, ['n2', 'n3']);

    expect(selection.get(A)).toEqual(['n1']);
    expect(selection.get(B)).toEqual(['n2', 'n3']);
  });

  it('уведомление называет ресурс, а не только факт изменения', () => {
    const selection = createSelectionService();
    const seen: string[] = [];
    selection.onDidChange((resource) => {
      seen.push(resource);
    });

    selection.set(A, ['n1']);
    selection.set(B, ['n2']);

    expect(seen).toEqual([A, B]);
  });

  it('запись в один ресурс не трогает выделение соседа', () => {
    const selection = createSelectionService();
    selection.set(A, ['n1']);
    const before = selection.get(A);
    selection.set(B, ['n2']);
    expect(selection.get(A)).toBe(before);
  });
});

describe('createSelectionService — затухание эха', () => {
  it('повторная запись того же выделения не уведомляет', () => {
    const selection = createSelectionService();
    selection.set(A, ['n1', 'n2']);

    const listener = vi.fn();
    selection.onDidChange(listener);
    // Второй участник отражает то, что прочитал, — и на этом обмен обязан остановиться.
    selection.set(A, ['n1', 'n2']);

    expect(listener).not.toHaveBeenCalled();
  });

  it('порядок значим: та же тройка в другом порядке — это изменение', () => {
    const selection = createSelectionService();
    selection.set(A, ['n1', 'n2']);

    const listener = vi.fn();
    selection.onDidChange(listener);
    selection.set(A, ['n2', 'n1']);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(selection.get(A)).toEqual(['n2', 'n1']);
  });

  it('два подписчика, отражающих выделение друг друга, останавливаются', () => {
    const selection = createSelectionService();
    let hops = 0;
    // Каждая сторона делает ровно то, что сделает настоящий плагин: услышал — записал своё.
    selection.onDidChange((resource) => {
      hops += 1;
      if (hops > 10) throw new Error('обмен не затух');
      selection.set(resource, [...selection.get(resource)]);
    });
    selection.onDidChange((resource) => {
      hops += 1;
      if (hops > 10) throw new Error('обмен не затух');
      selection.set(resource, [...selection.get(resource)]);
    });

    selection.set(A, ['n1']);

    expect(hops).toBe(2);
  });
});

describe('createSelectionService — снятие и забывание', () => {
  it('пустой список снимает запись и уведомляет', () => {
    const selection = createSelectionService();
    selection.set(A, ['n1']);

    const listener = vi.fn();
    selection.onDidChange(listener);
    selection.set(A, []);

    expect(selection.get(A)).toEqual([]);
    expect(listener).toHaveBeenCalledWith(A);
  });

  it('снятие того, чего не было, молчит', () => {
    const selection = createSelectionService();
    const listener = vi.fn();
    selection.onDidChange(listener);
    selection.set(A, []);
    expect(listener).not.toHaveBeenCalled();
  });

  it('forget убирает выделение и сообщает об этом', () => {
    const selection = createSelectionService();
    selection.set(A, ['n1']);

    const listener = vi.fn();
    selection.onDidChange(listener);
    selection.forget(A);

    expect(selection.get(A)).toEqual([]);
    expect(listener).toHaveBeenCalledWith(A);
  });

  it('forget неизвестного ресурса молчит', () => {
    const selection = createSelectionService();
    const listener = vi.fn();
    selection.onDidChange(listener);
    selection.forget(A);
    expect(listener).not.toHaveBeenCalled();
  });

  it('подписку можно снять', () => {
    const selection = createSelectionService();
    const listener = vi.fn();
    const subscription = selection.onDidChange(listener);
    subscription.dispose();
    selection.set(A, ['n1']);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('createSelectionService — непрозрачность адреса', () => {
  it('адрес не проверяется на форму: платформа не знает чужого формата', () => {
    const selection = createSelectionService();
    // Домен сегодня выдаёт восемь символов base36, но провайдер другой модели вправе
    // адресовать иначе — служба обязана хранить и это.
    selection.set(A, ['/root/children/0', 'a1b2c3d4', '']);
    expect(selection.get(A)).toEqual(['/root/children/0', 'a1b2c3d4', '']);
  });

  it('мёртвый адрес остаётся лежать: чистка принадлежит тому, кто знает формат', () => {
    const selection = createSelectionService();
    selection.set(A, ['удалённый-узел']);
    // Служба ничего не выбрасывает сама — иначе она догадывалась бы о чужом разборе.
    expect(selection.get(A)).toEqual(['удалённый-узел']);
  });
});

describe('SelectionServiceToken', () => {
  it('идентификатор с пространством имён платформы', () => {
    expect(SelectionServiceToken.id).toBe('host.selection');
  });
});
