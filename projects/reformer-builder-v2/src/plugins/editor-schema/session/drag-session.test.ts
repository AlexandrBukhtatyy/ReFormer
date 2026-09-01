/**
 * Тесты сеанса перетаскивания.
 *
 * Модуль крошечный, и проверять в нём стоит одно: что признак «груз наш» отличает наш груз
 * от чужого. Ошибка здесь не видна на глаз — канвас просто начнёт подсвечиваться под файлом,
 * перетащенным из проводника, и бросок сделает не то или ничего.
 *
 * @module plugins/editor-schema/session/drag-session.test
 */

import { describe, expect, it } from 'vitest';
import { carriesSchemaNode, createDragSession, DRAG_MIME } from './drag-session';

describe('createDragSession', () => {
  it('до начала перетаскивания груза нет', () => {
    expect(createDragSession().payload()).toBeNull();
  });

  it('отдаёт положенный груз и забывает его по окончании', () => {
    const session = createDragSession();
    session.begin({ kind: 'node', id: 'abcd1234' });
    expect(session.payload()).toEqual({ kind: 'node', id: 'abcd1234' });
    session.end();
    expect(session.payload()).toBeNull();
  });

  it('новое перетаскивание вытесняет прежний груз', () => {
    const session = createDragSession();
    session.begin({ kind: 'node', id: 'abcd1234' });
    session.begin({ kind: 'new', node: { component: '$html(div)' } as never });
    expect(session.payload()?.kind).toBe('new');
  });
});

describe('carriesSchemaNode', () => {
  it('узнаёт свой тип', () => {
    expect(carriesSchemaNode([DRAG_MIME])).toBe(true);
    expect(carriesSchemaNode(['text/plain', DRAG_MIME])).toBe(true);
  });

  it('не принимает чужое: текст из другого окна и файл из проводника', () => {
    expect(carriesSchemaNode(['text/plain'])).toBe(false);
    expect(carriesSchemaNode(['Files', 'application/json'])).toBe(false);
    expect(carriesSchemaNode([])).toBe(false);
    expect(carriesSchemaNode(undefined)).toBe(false);
  });

  it('читает и `DOMStringList`-подобное: именно его отдаёт `dataTransfer.types`', () => {
    const list = { length: 1, 0: DRAG_MIME } as unknown as DOMStringList;
    expect(carriesSchemaNode(list)).toBe(true);
  });
});
