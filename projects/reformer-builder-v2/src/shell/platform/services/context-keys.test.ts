import { describe, expect, it, vi } from 'vitest';

import { toDisposable, type Disposable } from '@/shell/platform/primitives/disposable';
import { whenContext, type WhenContext } from '@/shell/platform/primitives/when-context';
import { createContextKeyService, readWhenContext } from './context-keys';
import type { ScopeSource, WhenContextSource } from './context-keys';

/**
 * Источник пяти полей в объёме порта. Настоящий `WhenContextStore` подходит под ту же форму;
 * здесь двойник, потому что проверяется служба, а не стор.
 */
function contextSource(initial: Partial<WhenContext> = {}): WhenContextSource & {
  set(patch: Partial<WhenContext>): void;
} {
  let snapshot = whenContext(initial);
  const listeners = new Set<() => void>();
  return {
    get: (): WhenContext => snapshot,
    subscribe(listener: () => void): Disposable {
      listeners.add(listener);
      return toDisposable(() => listeners.delete(listener));
    },
    set(patch: Partial<WhenContext>): void {
      snapshot = whenContext({ ...snapshot, ...patch });
      for (const listener of [...listeners]) listener();
    },
  };
}

function scopeSource(initial: readonly string[] = []): ScopeSource & {
  push(scope: string): void;
} {
  let stack = [...initial];
  const listeners = new Set<() => void>();
  return {
    top: (): string | null => stack.at(-1) ?? null,
    all: (): readonly string[] => stack,
    subscribe(listener: () => void): Disposable {
      listeners.add(listener);
      return toDisposable(() => listeners.delete(listener));
    },
    push(scope: string): void {
      stack = [...stack, scope];
      for (const listener of [...listeners]) listener();
    },
  };
}

describe('пять полей контекста', () => {
  it('читаются как ключи, без копии значения', () => {
    // Копия завела бы второе место, отвечающее на «куда направлен фокус», и клавиша с панелью
    // начали бы расходиться. Проверяем именно сквозное чтение: записали в стор — видно здесь.
    const source = contextSource({ focus: 'tree' });
    const service = createContextKeyService({ whenContext: source });

    expect(service.read('focus')).toBe('tree');
    source.set({ focus: 'canvas' });
    expect(service.read('focus')).toBe('canvas');
  });

  it('объявить ключ с именем платформы нельзя', () => {
    const service = createContextKeyService({ whenContext: contextSource() });

    expect(() => service.createKey('focus', 'canvas')).toThrow(/принадлежит платформе/);
    expect(() => service.createKey('scope', 'dialog')).toThrow(/принадлежит платформе/);
  });

  it('без источника областей ключи области пусты, а не отсутствуют', () => {
    // Условие `scope == dialog` обязано быть разрешимым и до того, как появятся окна.
    const service = createContextKeyService({ whenContext: contextSource() });

    expect(service.read('scope')).toBeNull();
    expect(service.read('scopes')).toEqual([]);
  });

  it('область читается из своего порта', () => {
    const scopes = scopeSource(['palette']);
    const service = createContextKeyService({ whenContext: contextSource(), scopes });

    expect(service.read('scope')).toBe('palette');
    scopes.push('dialog');
    expect(service.read('scope')).toBe('dialog');
    expect(service.read('scopes')).toEqual(['palette', 'dialog']);
  });
});

describe('ключи плагинов', () => {
  it('объявляются, читаются и пишутся', () => {
    const service = createContextKeyService({ whenContext: contextSource() });
    const key = service.createKey('schemaEditor.nodeSelected', false, 'editor-schema');

    expect(service.read('schemaEditor.nodeSelected')).toBe(false);
    key.set(true);
    expect(service.read('schemaEditor.nodeSelected')).toBe(true);
    expect(key.get()).toBe(true);
  });

  it('повторное объявление — отказ, а не молчаливая замена', () => {
    // Две записи одного ключа означали бы, что значение зависит от порядка активации
    // плагинов, а он по контракту рантайма ничего не значит.
    const service = createContextKeyService({ whenContext: contextSource() });
    service.createKey('acme.ready', false);

    expect(() => service.createKey('acme.ready', true)).toThrow(/уже объявлен/);
  });

  it('снятие возвращает чтение к «ключа нет» и уведомляет о нём', () => {
    // На этом держится выключение плагина: условие, ссылающееся на снятый ключ, снова
    // читает `undefined`, то есть ложь, и правило перестаёт совпадать.
    const service = createContextKeyService({ whenContext: contextSource() });
    const key = service.createKey('acme.ready', true);
    const seen = vi.fn<(changed: ReadonlySet<string>) => void>();
    service.subscribe(seen);

    key.dispose();

    expect(service.read('acme.ready')).toBeUndefined();
    expect(seen).toHaveBeenCalledWith(new Set(['acme.ready']));
  });

  it('снятие устаревшего объявления не уносит одноимённый ключ, объявленный позже', () => {
    const service = createContextKeyService({ whenContext: contextSource() });
    const first = service.createKey('acme.ready', 1);
    first.dispose();
    service.createKey('acme.ready', 2);

    first.dispose();

    expect(service.read('acme.ready')).toBe(2);
  });

  it('reset возвращает начальное значение', () => {
    const service = createContextKeyService({ whenContext: contextSource() });
    const key = service.createKey('acme.mode', 'idle');
    key.set('busy');

    key.reset();

    expect(key.get()).toBe('idle');
  });

  it('объявленные ключи перечисляются вместе с владельцем', () => {
    const service = createContextKeyService({ whenContext: contextSource() });
    service.createKey('acme.ready', false, 'acme-forms');

    expect(service.declared()).toEqual([{ key: 'acme.ready', owner: 'acme-forms' }]);
  });
});

describe('уведомления', () => {
  it('запись того же значения не уведомляет', () => {
    // Ключи пишут из обработчиков выделения и фокуса, то есть десятками раз в секунду;
    // подавляющее большинство записей ничего не меняет.
    const service = createContextKeyService({ whenContext: contextSource() });
    const key = service.createKey('acme.ready', false);
    const seen = vi.fn();
    service.subscribe(seen);

    key.set(false);

    expect(seen).not.toHaveBeenCalled();
  });

  it('уведомление несёт ИМЕНА изменившихся ключей', () => {
    // Ради этого свойства читаемые ключи условия и считаются один раз при разборе:
    // подписчик сравнивает пересечение и молчит, если оно пусто.
    const service = createContextKeyService({ whenContext: contextSource() });
    const key = service.createKey('acme.ready', false);
    const seen = vi.fn<(changed: ReadonlySet<string>) => void>();
    service.subscribe(seen);

    key.set(true);

    expect(seen).toHaveBeenCalledWith(new Set(['acme.ready']));
  });

  it('смена контекста задевает поля платформы', () => {
    const source = contextSource();
    const service = createContextKeyService({ whenContext: source });
    const seen = vi.fn<(changed: ReadonlySet<string>) => void>();
    service.subscribe(seen);

    source.set({ focus: 'tree' });

    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen.mock.calls[0][0].has('focus')).toBe(true);
  });

  it('подписка снимается', () => {
    const service = createContextKeyService({ whenContext: contextSource() });
    const key = service.createKey('acme.ready', false);
    const seen = vi.fn();
    service.subscribe(seen).dispose();

    key.set(true);

    expect(seen).not.toHaveBeenCalled();
  });
});

describe('снимок', () => {
  it('между изменениями отдаёт ТУ ЖЕ ссылку', () => {
    // Требование `useSyncExternalStore`: получая новый объект на каждый вызов, React уходит
    // в бесконечную перерисовку.
    const service = createContextKeyService({ whenContext: contextSource() });

    expect(service.snapshot()).toBe(service.snapshot());
  });

  it('после изменения ссылка новая', () => {
    const source = contextSource();
    const service = createContextKeyService({ whenContext: source });
    const before = service.snapshot();

    source.set({ focus: 'tree' });

    expect(service.snapshot()).not.toBe(before);
  });

  it('снятый снимок не меняется под руками', () => {
    // Предикаты одного нажатия обязаны видеть одно состояние, а не два соседних во времени.
    const source = contextSource({ focus: 'tree' });
    const service = createContextKeyService({ whenContext: source });
    const snapshot = service.snapshot();

    source.set({ focus: 'canvas' });

    expect(snapshot.read('focus')).toBe('tree');
  });

  it('несёт обе проекции: чтение ключей и контекст из пяти полей', () => {
    // Одним снимком обслуживаются и условие, и предикат `enabled`, который по контракту
    // принимает WhenContext, — иначе они видели бы разное состояние.
    const service = createContextKeyService({ whenContext: contextSource({ focus: 'tree' }) });
    const key = service.createKey('acme.ready', true);
    const snapshot = service.snapshot();

    expect(snapshot.read('acme.ready')).toBe(true);
    expect(snapshot.whenContext().focus).toBe('tree');
    key.dispose();
  });
});

describe('readWhenContext — читатель без службы', () => {
  it('читает те же пять полей', () => {
    const read = readWhenContext(whenContext({ focus: 'canvas', hasSelection: true }));

    expect(read('focus')).toBe('canvas');
    expect(read('hasSelection')).toBe(true);
    expect(read('activeEditorId')).toBeNull();
  });

  it('неизвестный ключ — undefined, область пуста', () => {
    const read = readWhenContext();

    expect(read('acme.ready')).toBeUndefined();
    expect(read('scope')).toBeNull();
    expect(read('scopes')).toEqual([]);
  });
});
