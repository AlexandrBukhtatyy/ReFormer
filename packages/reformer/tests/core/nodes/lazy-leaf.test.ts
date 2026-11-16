/**
 * Ленивый лист группы: нода поля строится при первом обращении, а до того лист ведёт себя как нода
 * в исходном состоянии — не тронута, не изменена, без замечаний.
 */
import { describe, expect, it } from 'vitest';
import { createModel } from '../../../src/model/index';
import { createFormFromModel } from '../../../src/form/create-form';
import { rawNode } from '../../../src/form/nodes/node-kind';
import type { FormGroupNode } from '../../../src/form/nodes/form-group-node';
import { isLazyLeaf } from '../../../src/form/nodes/lazy-leaf';
import { getNodeForSignal } from '../../../src/form/signal-node-registry';

interface Profile {
  email: string;
  name: string;
  address: { city: string };
}

const createProfile = () => {
  const model = createModel<Profile>({ email: 'a@b.c', name: 'Анна', address: { city: 'Казань' } });
  const form = createFormFromModel<Profile>({ model });
  return { model, form, group: rawNode(form) as unknown as FormGroupNode<Profile> };
};

/** Построена ли нода поля группы. */
const built = (group: FormGroupNode<Profile>, key: string): boolean => {
  const child = group.childAt(key);
  return !isLazyLeaf(child) || child.materialized;
};

describe('ленивый лист группы', () => {
  it('нода поля строится при первом обращении — и только она', () => {
    const { form, group } = createProfile();
    expect([built(group, 'email'), built(group, 'name')]).toEqual([false, false]);

    const email = form.email;

    expect([built(group, 'email'), built(group, 'name')]).toEqual([true, false]);
    expect(form.email).toBe(email);
  });

  it('значение группы читается из модели без построения нод', () => {
    const { form, group, model } = createProfile();

    expect(form.value.value).toEqual({ email: 'a@b.c', name: 'Анна', address: { city: 'Казань' } });
    expect(form.getValue().name).toBe('Анна');
    model.name = 'Мария';
    expect(form.value.value.name).toBe('Мария');
    expect([built(group, 'email'), built(group, 'name')]).toEqual([false, false]);
  });

  it('снятие касания, очистка замечаний и включение не строят ноды', () => {
    const { form, group } = createProfile();

    form.markAsUntouched();
    form.clearIssues();
    form.enable();

    expect([built(group, 'email'), built(group, 'name')]).toEqual([false, false]);
  });

  it('значение создания — на момент сборки, даже если нода построена позже', () => {
    const { form, model } = createProfile();
    model.email = 'later@b.c';

    rawNode(form.email).resetToCreation();

    expect(model.email).toBe('a@b.c');
  });

  it('сводное состояние группы видит ноду, построенную после чтения значения', () => {
    const { form } = createProfile();
    void form.value.value;
    expect(form.valid.value).toBe(true);

    form.name.setIssues([{ code: 'required' }]);

    expect([form.valid.value, form.invalid.value]).toEqual([false, true]);
    expect(form.issues.value).toHaveLength(1);
  });

  it('реестр отдаёт ноду листа, строя её по запросу', () => {
    const { model, form, group } = createProfile();

    expect(getNodeForSignal(model.$.name)).toBe(form.name);
    expect(built(group, 'email')).toBe(false);
  });
});
