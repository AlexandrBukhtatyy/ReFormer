/**
 * Regression tests for defect #28.
 *
 * Поля модели, чьи имена совпадают с членами GroupNode (`value`/`status`/`id`/`errors`/…),
 * затеняются через `form.<name>` (там приоритет у члена узла). Раньше такие поля были
 * недостижимы по имени вообще (кроме `getField`). Теперь escape-hatch `form.$.<name>`
 * возвращает узел поля, обходя затенение.
 */

import { describe, it, expect } from 'vitest';
import { GroupNode } from '../../../src/form/nodes/group-node';
import { FieldNode } from '../../../src/form/nodes/field-node';

interface ShadowedModel {
  status: string; // совпадает с GroupNode.status (агрегированный сигнал)
  id: string; // совпадает с GroupNode.id (UUID)
  value: string; // совпадает с GroupNode.value (computed value)
  email: string; // не конфликтует
}

function makeForm() {
  const node = new GroupNode<ShadowedModel>({
    status: { value: 'active', component: null },
    id: { value: 'user-42', component: null },
    value: { value: 'raw', component: null },
    email: { value: 'e@x.com', component: null },
  } as never);
  return node.getProxy();
}

describe('FormProxy — затенение полей членами GroupNode (defect #28)', () => {
  it('form.<reservedName> возвращает член GroupNode, а не поле (сохранённое поведение)', () => {
    const form = makeForm();

    // status → агрегированный сигнал FieldStatus, а не FieldNode
    expect(form.status.value).toBe('valid');
    // id → UUID строка GroupNode, а не поле
    expect(typeof form.id).toBe('string');
    expect(form.id).not.toBe('user-42');
    // value → computed объект-значение всей группы, а не поле
    expect(form.value.value).toMatchObject({ email: 'e@x.com', status: 'active' });
  });

  it('form.$ даёт доступ к затенённым полям как к настоящим FieldNode', () => {
    const form = makeForm();

    expect(form.$.status).toBeInstanceOf(FieldNode);
    expect(form.$.status.value.value).toBe('active');

    expect(form.$.id).toBeInstanceOf(FieldNode);
    expect(form.$.id.value.value).toBe('user-42');

    expect(form.$.value).toBeInstanceOf(FieldNode);
    expect(form.$.value.value.value).toBe('raw');
  });

  it('form.$.<field>.setValue меняет значение затенённого поля', () => {
    const form = makeForm();

    form.$.status.setValue('inactive');
    expect(form.$.status.value.value).toBe('inactive');
    // Обновление отражается в агрегированном value группы
    expect(form.value.value.status).toBe('inactive');
  });

  it('незатенённые поля доступны и напрямую, и через form.$', () => {
    const form = makeForm();

    expect(form.email).toBeInstanceOf(FieldNode);
    expect(form.email.value.value).toBe('e@x.com');
    expect(form.$.email).toBe(form.email);
  });

  it("'$' виден через оператор in", () => {
    const form = makeForm();
    expect('$' in form).toBe(true);
  });
});
