import { describe, expect, it, vi } from 'vitest';

import { createExtensionRegistry, defineExtensionPoint } from './extension-point';

interface Panel {
  readonly title: string;
}

const PanelPoint = defineExtensionPoint<Panel>('test.panel');
const LabelPoint = defineExtensionPoint<string>('test.label');

const ids = (items: readonly { readonly id: string }[]): string[] => items.map((item) => item.id);

describe('defineExtensionPoint', () => {
  it('возвращает точку с переданным идентификатором', () => {
    expect(PanelPoint.id).toBe('test.panel');
  });

  it('не даёт объявить точку с пустым идентификатором', () => {
    expect(() => defineExtensionPoint('')).toThrow(/пуст/);
  });
});

describe('пустая точка — рабочее состояние', () => {
  it('get отдаёт пустой список, а не бросает', () => {
    // «Если встроенной реализации нет вовсе — приложение работает, просто без возможности».
    const registry = createExtensionRegistry();

    expect(registry.get(PanelPoint)).toEqual([]);
  });

  it('пустой список стабилен по ссылке', () => {
    const registry = createExtensionRegistry();

    expect(registry.get(PanelPoint)).toBe(registry.get(LabelPoint));
  });
});

describe('contribute проставляет происхождение вклада', () => {
  it('вклад несёт pluginId вида, через который внесён', () => {
    const registry = createExtensionRegistry();
    registry.forPlugin('files').contribute(PanelPoint, { title: 'Файлы' });

    const [contribution] = registry.get(PanelPoint);

    expect(contribution.pluginId).toBe('files');
    expect(contribution.value).toEqual({ title: 'Файлы' });
  });

  it('на вопрос «откуда здесь эта панель» отвечает реестр', () => {
    const registry = createExtensionRegistry();
    registry.forPlugin('files').contribute(PanelPoint, { title: 'Файлы' });
    registry.forPlugin('assistant').contribute(PanelPoint, { title: 'Ассистент' });

    const owners = registry.get(PanelPoint).map((c) => `${c.pluginId}:${c.value.title}`);

    expect(owners).toEqual(['files:Файлы', 'assistant:Ассистент']);
  });

  it('вид плагина не даёт способа внести вклад от чужого имени', () => {
    // В виде нет ни параметра pluginId, ни forPlugin — подделать происхождение нечем.
    const registry = createExtensionRegistry();
    const view = registry.forPlugin('files');

    expect('forPlugin' in view).toBe(false);
    expect(Object.keys(view).sort()).toEqual(['contribute', 'get', 'observe']);
  });

  it('вид плагина стабилен по ссылке', () => {
    const registry = createExtensionRegistry();

    expect(registry.forPlugin('files')).toBe(registry.forPlugin('files'));
    expect(registry.forPlugin('files')).not.toBe(registry.forPlugin('assistant'));
  });

  it('не даёт внести вклад от плагина с пустым идентификатором', () => {
    const registry = createExtensionRegistry();

    expect(() => registry.forPlugin('  ')).toThrow(/пуст/);
  });

  it('order по умолчанию — 0, id генерируется', () => {
    const registry = createExtensionRegistry();
    registry.forPlugin('files').contribute(PanelPoint, { title: 'Файлы' });

    const [contribution] = registry.get(PanelPoint);

    expect(contribution.order).toBe(0);
    expect(contribution.id).toMatch(/^files:test\.panel#\d+$/);
  });

  it('вклад заморожен: порядок и происхождение не переписать снаружи', () => {
    const registry = createExtensionRegistry();
    registry.forPlugin('files').contribute(PanelPoint, { title: 'Файлы' });

    expect(Object.isFrozen(registry.get(PanelPoint)[0])).toBe(true);
    expect(Object.isFrozen(registry.get(PanelPoint))).toBe(true);
  });
});

describe('порядок вкладов', () => {
  it('сортирует по order', () => {
    const registry = createExtensionRegistry();
    const view = registry.forPlugin('p');
    view.contribute(LabelPoint, 'третий', { id: 'c', order: 30 });
    view.contribute(LabelPoint, 'первый', { id: 'a', order: 10 });
    view.contribute(LabelPoint, 'второй', { id: 'b', order: 20 });

    expect(ids(registry.get(LabelPoint))).toEqual(['a', 'b', 'c']);
  });

  it('при равном order сохраняет порядок регистрации', () => {
    const registry = createExtensionRegistry();
    const first = registry.forPlugin('first');
    const second = registry.forPlugin('second');
    first.contribute(LabelPoint, 'a', { id: 'a' });
    second.contribute(LabelPoint, 'b', { id: 'b' });
    first.contribute(LabelPoint, 'c', { id: 'c' });

    expect(ids(registry.get(LabelPoint))).toEqual(['a', 'b', 'c']);
  });

  it('порядок стабилен и при смешении групп order', () => {
    const registry = createExtensionRegistry();
    const view = registry.forPlugin('p');
    view.contribute(LabelPoint, 'a', { id: 'a', order: 10 });
    view.contribute(LabelPoint, 'b', { id: 'b' });
    view.contribute(LabelPoint, 'c', { id: 'c', order: 10 });
    view.contribute(LabelPoint, 'd', { id: 'd' });

    expect(ids(registry.get(LabelPoint))).toEqual(['b', 'd', 'a', 'c']);
  });

  it('отрицательный order ставит вклад перед умолчанием', () => {
    const registry = createExtensionRegistry();
    const view = registry.forPlugin('p');
    view.contribute(LabelPoint, 'a', { id: 'a' });
    view.contribute(LabelPoint, 'b', { id: 'b', order: -1 });

    expect(ids(registry.get(LabelPoint))).toEqual(['b', 'a']);
  });
});

describe('идентификатор вклада', () => {
  it('явный id сохраняется как есть', () => {
    const registry = createExtensionRegistry();
    registry.forPlugin('files').contribute(PanelPoint, { title: 'Файлы' }, { id: 'files.tree' });

    expect(registry.get(PanelPoint)[0].id).toBe('files.tree');
  });

  it('повторный явный id в той же точке — ошибка', () => {
    // Вклады рисуются списком: одинаковые id означают одинаковые React-ключи.
    const registry = createExtensionRegistry();
    const view = registry.forPlugin('files');
    view.contribute(PanelPoint, { title: 'Первая' }, { id: 'files.tree' });

    expect(() => view.contribute(PanelPoint, { title: 'Вторая' }, { id: 'files.tree' })).toThrow(
      /files\.tree/
    );
    expect(registry.get(PanelPoint)).toHaveLength(1);
  });

  it('тот же id в другой точке разрешён', () => {
    const registry = createExtensionRegistry();
    const view = registry.forPlugin('files');
    view.contribute(PanelPoint, { title: 'Файлы' }, { id: 'tree' });

    expect(() => view.contribute(LabelPoint, 'Файлы', { id: 'tree' })).not.toThrow();
  });

  it('после снятия тот же id можно занять снова', () => {
    const registry = createExtensionRegistry();
    const view = registry.forPlugin('files');
    const sub = view.contribute(PanelPoint, { title: 'Первая' }, { id: 'files.tree' });
    sub.dispose();

    view.contribute(PanelPoint, { title: 'Вторая' }, { id: 'files.tree' });

    expect(registry.get(PanelPoint)[0].value.title).toBe('Вторая');
  });
});

describe('вклады снимаемые', () => {
  it('dispose убирает вклад, остальные остаются в порядке', () => {
    const registry = createExtensionRegistry();
    const view = registry.forPlugin('p');
    view.contribute(LabelPoint, 'a', { id: 'a' });
    const sub = view.contribute(LabelPoint, 'b', { id: 'b' });
    view.contribute(LabelPoint, 'c', { id: 'c' });

    sub.dispose();

    expect(ids(registry.get(LabelPoint))).toEqual(['a', 'c']);
  });

  it('повторный dispose ничего больше не снимает', () => {
    const registry = createExtensionRegistry();
    const view = registry.forPlugin('p');
    const sub = view.contribute(LabelPoint, 'a', { id: 'a' });
    sub.dispose();
    view.contribute(LabelPoint, 'b', { id: 'b' });

    sub.dispose();

    expect(ids(registry.get(LabelPoint))).toEqual(['b']);
  });

  it('точки расширения изолированы друг от друга', () => {
    const registry = createExtensionRegistry();
    const view = registry.forPlugin('p');
    view.contribute(PanelPoint, { title: 'Файлы' });
    view.contribute(LabelPoint, 'метка');

    expect(registry.get(PanelPoint)).toHaveLength(1);
    expect(registry.get(LabelPoint)).toHaveLength(1);
  });
});

describe('observe', () => {
  it('вызывается при добавлении и при снятии', () => {
    const registry = createExtensionRegistry();
    const seen = vi.fn();
    registry.observe(PanelPoint, seen);

    const sub = registry.forPlugin('files').contribute(PanelPoint, { title: 'Файлы' });
    expect(seen).toHaveBeenCalledTimes(1);

    sub.dispose();
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it('не будит наблюдателей чужой точки', () => {
    const registry = createExtensionRegistry();
    const seen = vi.fn();
    registry.observe(LabelPoint, seen);

    registry.forPlugin('files').contribute(PanelPoint, { title: 'Файлы' });

    expect(seen).not.toHaveBeenCalled();
  });

  it('после dispose подписки наблюдатель молчит', () => {
    const registry = createExtensionRegistry();
    const seen = vi.fn();
    const sub = registry.observe(PanelPoint, seen);
    sub.dispose();

    registry.forPlugin('files').contribute(PanelPoint, { title: 'Файлы' });

    expect(seen).not.toHaveBeenCalled();
  });

  it('к моменту уведомления get уже видит новое состояние', () => {
    const registry = createExtensionRegistry();
    const seenLengths: number[] = [];
    registry.observe(PanelPoint, () => seenLengths.push(registry.get(PanelPoint).length));

    const sub = registry.forPlugin('files').contribute(PanelPoint, { title: 'Файлы' });
    sub.dispose();

    expect(seenLengths).toEqual([1, 0]);
  });

  it('ошибка одного наблюдателя не мешает другому и не откатывает вклад', () => {
    const registry = createExtensionRegistry();
    const healthy = vi.fn();
    registry.observe(PanelPoint, () => {
      throw new Error('наблюдатель сломан');
    });
    registry.observe(PanelPoint, healthy);

    expect(() => registry.forPlugin('files').contribute(PanelPoint, { title: 'Файлы' })).toThrow(
      /сломан/
    );
    expect(healthy).toHaveBeenCalledTimes(1);
    expect(registry.get(PanelPoint)).toHaveLength(1);
  });
});

describe('снимок get стабилен между изменениями', () => {
  it('та же ссылка, пока точка не менялась', () => {
    // useSyncExternalStore требует кэшированный getSnapshot, иначе падает.
    const registry = createExtensionRegistry();
    registry.forPlugin('files').contribute(PanelPoint, { title: 'Файлы' });

    expect(registry.get(PanelPoint)).toBe(registry.get(PanelPoint));
  });

  it('новая ссылка после добавления и после снятия', () => {
    const registry = createExtensionRegistry();
    const view = registry.forPlugin('files');
    view.contribute(PanelPoint, { title: 'Файлы' });
    const before = registry.get(PanelPoint);

    const sub = view.contribute(PanelPoint, { title: 'Ассистент' });
    const afterAdd = registry.get(PanelPoint);
    sub.dispose();
    const afterRemove = registry.get(PanelPoint);

    expect(afterAdd).not.toBe(before);
    expect(afterRemove).not.toBe(afterAdd);
  });
});
