/**
 * Модель как общее состояние: форма над её частью и несколько форм над одной моделью.
 *
 * Модель от формы не зависит — в ней держат данные всего приложения, а форма собирается над её
 * частью (`createForm({ model: app.user })`). Над одной моделью бывает и несколько форм. Каждая
 * сборка обязана работать со СВОИМИ нодами: проверка кладёт замечания в них, поведение выключает
 * их, рендерер находит их, — хотя у ручки модели нод несколько, а общий реестр помнит последнюю.
 */

import { describe, it, expect, vi } from 'vitest';
import { tick } from '../test-utils/async';
import { issueCodes } from '../test-utils/issues';
import { arrayOf, createModel } from '../../src/model';
import { createForm } from '../../src/form/form-bundle';
import { applyEach, defineFormBehavior, enableWhen } from '../../src/form/behaviors';
import { defineValidation, validate } from '../../src/form/validation';
import { required } from '../../src/form/validators';
import { getNodeForSignal, registerSignalNode } from '../../src/form/signal-node-registry';

interface User {
  name: string;
  email: string;
  nickname: string;
}
interface Phone {
  number: string;
  primary: boolean;
}
interface App {
  user: User;
  phones: Phone[];
  theme: 'light' | 'dark';
}

const blankPhone = (): Phone => ({ number: '', primary: false });

const createApp = () =>
  createModel<App>({
    user: { name: '', email: '', nickname: '' },
    phones: arrayOf(blankPhone, [{ number: '', primary: true }]),
    theme: 'light',
  });

const userRules = defineValidation<User>(({ model }) => {
  validate(model.$.email, [required()]);
});

const appRules = defineValidation<App>(({ model }) => {
  validate(model.$.user.email, [required()]);
});

describe('форма над частью модели приложения', () => {
  it('проверка ставит замечания полям формы, а не отбрасывает их', async () => {
    const app = createApp();
    const profile = createForm<User>({ model: app.user, validation: userRules });

    const result = await profile.validate();

    expect(result.status).toBe('invalid');
    expect(issueCodes(profile.form.email)).toEqual(['required']);
    expect(profile.form.valid.value).toBe(false);
  });

  it('поле, которое выключило поведение формы, в проверке не участвует', async () => {
    const app = createApp();
    const profile = createForm<User>({
      model: app.user,
      validation: userRules,
      behavior: defineFormBehavior<User>(({ model }) => {
        enableWhen(model.$.email, () => model.name !== 'гость');
      }),
    });

    app.user.name = 'гость';
    const result = await profile.validate();

    expect(profile.form.email.disabled.value).toBe(true);
    expect(result.status).toBe('valid');
    expect(profile.form.email.issues.value).toEqual([]);
  });

  it('отправка с нарушенным правилом не зовёт обработчик', async () => {
    const app = createApp();
    const profile = createForm<User>({ model: app.user, validation: userRules });
    const handler = vi.fn();

    const outcome = await profile.submission.submit(handler);

    expect(outcome.status).toBe('invalid');
    expect(handler).not.toHaveBeenCalled();
  });

  it('ввод в поле формы виден всем, кто читает модель приложения', async () => {
    const app = createApp();
    const profile = createForm<User>({ model: app.user, validation: userRules });

    profile.form.email.setValue('neo@zion.io');

    expect(app.user.email).toBe('neo@zion.io');
    expect((await profile.validate()).status).toBe('valid');
  });
});

describe('несколько форм над одной моделью', () => {
  it('проверка каждой формы кладёт замечания в её ноды', async () => {
    const app = createApp();
    const first = createForm<App>({ model: app, validation: appRules });
    const second = createForm<App>({ model: app, validation: appRules });

    expect((await first.validate()).status).toBe('invalid');

    expect(issueCodes(first.form.user.email)).toEqual(['required']);
    expect(second.form.user.email.issues.value).toEqual([]);

    expect((await second.validate()).status).toBe('invalid');
    expect(issueCodes(second.form.user.email)).toEqual(['required']);
  });

  it('одновременные проверки двух форм с одними правилами не отменяют друг друга', async () => {
    const app = createApp();
    const first = createForm<App>({ model: app, validation: appRules });
    const second = createForm<App>({ model: app, validation: appRules });

    const [a, b] = await Promise.all([first.validate(), second.validate()]);

    expect(a.status).toBe('invalid');
    expect(b.status).toBe('invalid');
  });

  it('формы над разными частями модели проверяются независимо', async () => {
    const app = createApp();
    const whole = createForm<App>({ model: app, validation: appRules });
    const profile = createForm<User>({ model: app.user, validation: userRules });

    await profile.validate();

    expect(issueCodes(profile.form.email)).toEqual(['required']);
    expect(whole.form.user.email.issues.value).toEqual([]);
  });

  it('поведение формы выключает её поле, а не поле последней собранной', async () => {
    const app = createApp();
    const first = createForm<App>({
      model: app,
      behavior: defineFormBehavior<App>(({ model }) => {
        enableWhen(model.$.user.nickname, () => model.theme === 'dark');
      }),
    });
    const second = createForm<App>({ model: app });
    expect(first.form.user.nickname.disabled.value).toBe(true);

    // Условие меняется уже после второй сборки: поведение первой ищет ноду заново.
    app.theme = 'dark';
    await tick();
    expect(first.form.user.nickname.disabled.value).toBe(false);

    app.theme = 'light';
    await tick();
    expect(first.form.user.nickname.disabled.value).toBe(true);
    expect(second.form.user.nickname.disabled.value).toBe(false);
  });

  it('поведение строк массива работает с формами строк своей сборки', async () => {
    const app = createApp();
    const rowRules = defineFormBehavior<Phone>(({ model }) => {
      enableWhen(model.$.number, () => model.primary);
    });
    const schema = (model: typeof app) => ({
      children: [{ model: model.$.phones, item: () => ({ children: [] }) }],
    });
    const first = createForm<App>({
      model: app,
      schema,
      behavior: defineFormBehavior<App>(({ model }) => {
        applyEach(model.$.phones, rowRules);
      }),
    });
    const second = createForm<App>({ model: app, schema });

    app.phones.push({ number: '', primary: false });
    await tick(); // доступность после сборки пишется на микротаске
    expect(first.form.phones.at(1)?.number.disabled.value).toBe(true);

    app.phones.at(1)!.primary = true;
    await tick();
    expect(first.form.phones.at(1)?.number.disabled.value).toBe(false);

    app.phones.at(1)!.primary = false;
    await tick();
    expect(first.form.phones.at(1)?.number.disabled.value).toBe(true);
    expect(first.form.phones.at(0)?.number.disabled.value).toBe(false);
    expect(second.form.phones.at(1)?.number.disabled.value).toBe(false);
  });

  it('рендер сборки находит её ноды, общий реестр — ноды последней собранной', () => {
    const app = createApp();
    const first = createForm<App>({ model: app });
    const second = createForm<App>({ model: app });

    expect(first.render.nodeOf(app.$.user.email)).toBe(first.form.user.email);
    expect(second.render.nodeOf(app.$.user.email)).toBe(second.form.user.email);
    expect(getNodeForSignal(app.$.user.email)).toBe(second.form.user.email);
  });

  it('явная перепривязка ручки после сборки главнее её собственной ноды', async () => {
    const app = createApp();
    const bundle = createForm<App>({ model: app, validation: appRules });
    const elsewhere = createForm<User>({ model: createModel<User>({ ...app.user.get() }) });

    registerSignalNode(app.$.user.email, elsewhere.form.email);
    await bundle.validate();

    expect(issueCodes(elsewhere.form.email)).toEqual(['required']);
    expect(bundle.form.user.email.issues.value).toEqual([]);
  });
});
