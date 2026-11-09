/**
 * `dirty` ноды и `isDirty()` модели отвечают на разные вопросы [ReFormer-ee4].
 *
 * `dirty` ставит только ввод через ноду (`setValue` — так пишет обёртка поля): данные, пришедшие из
 * кода, не должны «открывать» замечания поля до касания. `isDirty()` модели сравнивает значения с
 * точкой отсчёта и видит любую запись. Рецепт llms 19-reading-values описывает это различие.
 */
import { describe, expect, it } from 'vitest';
import { createForm, createModel } from '../../../src';

describe('dirty ноды против isDirty() модели', () => {
  it('запись в модель не делает ноду dirty, но меняет isDirty(); ввод через ноду — и то, и другое', () => {
    const model = createModel<{ email: string }>({ email: '' });
    const { form } = createForm<{ email: string }>({
      model,
      schema: (m) => ({ children: [{ model: m.$.email, component: () => null }] }),
    });

    model.patch({ email: 'server@example.com' });
    expect(form.email.dirty.value).toBe(false);
    expect(model.isDirty()).toBe(true);

    model.captureInitial();
    expect(model.isDirty()).toBe(false);

    form.email.setValue('user@example.com');
    expect(form.email.dirty.value).toBe(true);
    expect(model.isDirty()).toBe(true);
  });
});
