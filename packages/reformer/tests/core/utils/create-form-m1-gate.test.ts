/**
 * Unit tests for createForm({ model, schema }) M1 fixes:
 *  - Defect 1/27 (gate submit()/validate() со schema-валидаторами) — УДАЛЁН: валидация вынесена
 *    во внешний `validateModel` из `@reformer/core/validation`; тесты gate удалены.
 *  - Defect 22: F9 derived-guard в GroupNode.setValue/patchValue сверяется с записываемым
 *    сигналом модели (markDerived), а не с computed-обёрткой field.value.
 *  - Defect 30: DEV-предупреждение, когда узел с component имеет нераспознанную «ручку» value.
 *  - Defect 31: поле данных, буквально названное `form`, больше не ломает форму.
 */

import { describe, it, expect, vi } from 'vitest';
import { createForm } from '../../../src/form/create-form';
import { createModel } from '../../../src/state/index';
import { markDerived } from '../../../src/state/derived-registry';

const InputStub = () => null;

// Gate submit()/validate() со schema-валидаторами УДАЛЁН (валидация вынесена во внешний
// validateModel из @reformer/core/validation). Тесты этого gate удалены; остальные проверки
// createForm (derived-guard / DEV-warning / поле "form") ниже актуальны.

describe('createForm M1 — derived-guard в bulk-set (Defect 22)', () => {
  interface F {
    a: number;
    total: number;
  }

  const buildF = () => {
    const model = createModel<F>({ a: 1, total: 0 });
    const schema = {
      children: [
        { value: model.$.a, component: InputStub },
        { value: model.$.total, component: InputStub },
      ],
    };
    return { model, form: createForm<F>({ model, schema }) };
  };

  it('setValue не затирает compute-производное поле', () => {
    const { model, form } = buildF();
    markDerived(model.$.total); // total принадлежит compute

    form.setValue({ a: 5, total: 999 } as F);

    expect(model.a).toBe(5);
    expect(model.total).toBe(0); // производное поле НЕ перезаписано payload'ом
  });

  it('patchValue не затирает compute-производное поле', () => {
    const { model, form } = buildF();
    markDerived(model.$.total);

    form.patchValue({ a: 7, total: 123 });

    expect(model.a).toBe(7);
    expect(model.total).toBe(0);
  });

  it('НЕ derived поле по-прежнему обновляется bulk-сеттером', () => {
    const { model, form } = buildF();
    // total НЕ помечен производным

    form.setValue({ a: 2, total: 42 } as F);

    expect(model.a).toBe(2);
    expect(model.total).toBe(42);
  });
});

describe('createForm M1 — DEV-предупреждение о нераспознанном value (Defect 30)', () => {
  it('предупреждает, когда узел с component имеет value-прокси вместо model.$.x', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createModel<{ email: string }>({ email: '' });
    // Ошибка автора: value-прокси (обычное значение), а не PathAwareSignal model.$.email
    const schema = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      children: [{ value: (model as any).email, component: InputStub }],
    };
    createForm({ model, schema });

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('НЕ предупреждает при корректном value: model.$.x', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createModel<{ email: string }>({ email: '' });
    const schema = { children: [{ value: model.$.email, component: InputStub }] };
    createForm({ model, schema });

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('createForm M1 — поле данных named "form" (Defect 31)', () => {
  interface WithForm {
    form: string;
    email: string;
  }

  it('поле, названное "form", материализуется как реальное поле (и соседи не пропадают)', () => {
    const model = createModel<WithForm>({ form: 'hi', email: '' });
    const schema = {
      children: [
        { value: model.$.form, component: InputStub },
        { value: model.$.email, component: InputStub },
      ],
    };
    const built = createForm<WithForm>({ model, schema });

    const formField = built.getField('form');
    const emailField = built.getField('email');
    expect(formField).toBeDefined();
    expect(emailField).toBeDefined();
    expect(formField!.value.value).toBe('hi');

    // двусторонняя связь работает
    model.form = 'x';
    expect(formField!.value.value).toBe('x');
    formField!.setValue('y');
    expect(model.form).toBe('y');
  });
});
