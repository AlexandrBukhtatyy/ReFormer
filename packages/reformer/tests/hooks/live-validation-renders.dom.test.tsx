// @vitest-environment happy-dom
/**
 * Живая проверка не будит чужие поля: после попытки отправки (`afterFirstSubmit`) ввод в одно
 * поле прогоняет всю схему, но компонент перерисовывается, только если у его поля что-то
 * действительно изменилось.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createForm } from '../../src/form/form-bundle';
import {
  defineValidation,
  validate,
  validateAsync,
  type AsyncRule,
} from '../../src/form/validation';
import type { FormControl, ValidationIssue } from '../../src/form/types/index';
import { useFormBundle, useFormControl } from '../../src/react';
import { act, cleanup, render } from '../test-utils/react';
import { settle } from '../test-utils/async';

afterEach(() => cleanup());

interface Signup {
  username: string;
  email: string;
  fullName: string;
}

const required =
  (code: string) =>
  (value: string): ValidationIssue | null =>
    value ? null : { code };

const usernameFree: AsyncRule<string> = async () => null;

const rules = defineValidation<Signup>(({ model }) => {
  validate(model.$.username, [required('username.required')]);
  validateAsync(model.$.username, [usernameFree]);
  validate(model.$.email, [required('email.required')]);
  validate(model.$.fullName, [required('fullName.required')]);
});

/**
 * Поле, которое сообщает о каждом своём рендере. Читает всё состояние: подписка по прочитанному
 * будит компонент только на смену прочитанного, а тест ловит лишнюю смену любого члена.
 */
function Field({ control, onRender }: { control: FormControl<string>; onRender: () => void }) {
  void { ...useFormControl(control) };
  onRender();
  return null;
}

function setup() {
  const counts = new Map<string, number>();
  const rendered = (name: string) => () => counts.set(name, (counts.get(name) ?? 0) + 1);
  const bundle = createForm<Signup>({
    initial: { username: '', email: '', fullName: '' },
    validation: { rules, strategy: 'afterFirstSubmit' },
  });
  function App() {
    const { form } = useFormBundle(() => bundle);
    return (
      <>
        <Field control={form.username} onRender={rendered('username')} />
        <Field control={form.email} onRender={rendered('email')} />
        <Field control={form.fullName} onRender={rendered('fullName')} />
      </>
    );
  }
  render(<App />);
  return {
    bundle,
    /** Сколько раз отрисовано каждое поле с последнего `resetRenders`. */
    renders: (): Record<string, number> => Object.fromEntries(counts),
    resetRenders: (): void => counts.clear(),
  };
}

describe('живая проверка — точечные перерисовки', () => {
  it('ввод в одно поле после отказа отправки рисует только его', async () => {
    const { bundle, renders, resetRenders } = setup();
    await act(async () => {
      await bundle.submission.submit(async () => undefined);
    });
    await act(settle);
    resetRenders();

    await act(async () => {
      bundle.form.fullName.setValue('И');
      await settle();
    });

    // Прогон проверил всю схему: `email` получил те же замечания, async-правило `username` — тот
    // же ответ на то же значение. Ни то ни другое поле не перерисовано (ReFormer-w83s).
    expect(Object.keys(renders())).toEqual(['fullName']);
  });
});
