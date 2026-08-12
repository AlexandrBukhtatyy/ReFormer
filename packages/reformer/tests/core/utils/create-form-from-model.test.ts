/**
 * Unit tests: createForm({ model, schema }) — сборка формы из FormModel + единой схемы (M1).
 *
 * Проверяет:
 * - дерево нод строится из структуры модели (objects + leaves)
 * - конфиг поля (component/componentProps) харвестится из схемы по идентичности сигнала
 *   (устойчиво к вложенности: children внутри контейнеров); легаси-`validators` на узле
 *   срезаются (schema-валидация — внешний `validateModel` из `@reformer/core/validation`)
 * - двусторонняя связь form-node ↔ model
 * - массивы пока дают явную ошибку (следующий шаг)
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createForm } from '../../../src/form/create-form';
import { createModel } from '../../../src/state/index';

// Заглушки UI-компонентов (просто маркеры идентичности).
const InputStub = () => null;
const SectionStub = () => null;

interface Form {
  email: string;
  profile: { name: string; age: number };
}

const build = () => {
  const model = createModel<Form>({ email: '', profile: { name: '', age: 0 } });
  const schema = {
    component: SectionStub,
    componentProps: { title: 'Root' },
    children: [
      { value: model.$.email, component: InputStub },
      {
        component: SectionStub,
        children: [
          { value: model.$.profile.name, component: InputStub },
          { value: model.$.profile.age, component: InputStub },
        ],
      },
    ],
  };
  const form = createForm<Form>({ model, schema });
  return { model, form, schema };
};

describe('createForm({ model, schema })', () => {
  it('строит ноды и читает значения из модели', () => {
    const { model, form } = build();
    expect(form.email.value.value).toBe('');
    model.email = 'a@b.c';
    expect(form.email.value.value).toBe('a@b.c');
  });

  it('node.setValue пишет в модель', () => {
    const { model, form } = build();
    form.email.setValue('new@mail.com');
    expect(model.email).toBe('new@mail.com');
  });

  it('вложенные поля привязаны к модели', () => {
    const { model, form } = build();
    form.profile.name.setValue('Иван');
    expect(model.get().profile.name).toBe('Иван');
    model.profile.age = 30;
    expect(form.profile.age.value.value).toBe(30);
  });

  it('харвестит component из схемы (по сигналу, через вложенность)', () => {
    const { form } = build();
    expect(form.email.component).toBe(InputStub);
    expect(form.profile.name.component).toBe(InputStub);
  });

  it('массивы не материализуются в родительской форме (model-owned)', () => {
    const model = createModel<{ name: string; tags: string[] }>({ name: '', tags: [] });
    const form = createForm<{ name: string; tags: string[] }>({
      model,
      schema: { children: [{ value: model.$.name, component: InputStub }] },
    });
    form.name.setValue('ok');
    expect(model.name).toBe('ok');
    // массив пропущен — им управляют модель + рендер (см. create-form-arrays.test.ts)
    expect((form as unknown as Record<string, unknown>).tags).toBeUndefined();
  });
});

describe('createForm({ model, schema }) — узел формы внутри схемы', () => {
  afterEach(() => vi.restoreAllMocks());

  it('FormProxy в схеме пропускается с подсказкой вместо переполнения стека', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createModel<Form>({ email: '', profile: { name: '', age: 0 } });
    // Первый проход: дерево без формы — так и надо строить схему для createForm.
    const form = createForm<Form>({
      model,
      schema: { children: [{ value: model.$.email, component: InputStub }] },
    });

    // Второй проход: дерево, куда уже положили форму (типичный визард). Раньше рекурсивный обход
    // уходил по самоссылкам прокси и падал с RangeError.
    const rebuilt = createForm<Form>({
      model,
      schema: {
        component: SectionStub,
        componentProps: { form },
        children: [{ value: model.$.email, component: InputStub }],
      },
    });

    expect(rebuilt.email.component).toBe(InputStub); // остальная схема отхарвестилась
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('узел формы (FormProxy)'));
  });
});
