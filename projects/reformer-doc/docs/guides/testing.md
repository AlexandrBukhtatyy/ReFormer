---
title: Тестирование форм
description: Как проверять правила, поведение, шаги и отправку формы без React, компонент формы с React и форму в браузере.
---

# Тестирование форм

Форма ReFormer работает без React. Модель, правила, поведение, шаги и отправку можно проверить
обычным модульным тестом: собрать форму, задать значения и посмотреть на результат. React нужен
только для проверки разметки — что поле показывает ошибку, а кнопка отправляет форму.

Примеры ниже — на [Vitest](https://vitest.dev) и
[React Testing Library](https://testing-library.com/docs/react-testing-library/intro/); с Jest код
тот же.

## Когда нужно

- Проверить правила формы: какие значения проходят, какие замечания получает поле.
- Проверить поведение: вычисляемые поля, доступность полей, переходы по шагам.
- Проверить компонент формы: подписи, ошибки под полями, отправку по кнопке.
- Проверить форму целиком в браузере — e2e-тестом.

## Минимальный пример

[Сборка формы](../reference/glossary.md#форма-и-данные) создаётся прямо в тесте. Каждый тест
собирает свою форму, а после теста сборка снимается:

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createForm, type FormBundle } from '@reformer/core';
import { defineValidation, validate } from '@reformer/core/validation';
import { email, minLength, required } from '@reformer/core/validators';

type Signup = { name: string; email: string };

const signupRules = defineValidation<Signup>(({ model }) => {
  validate(model.$.name, [required(), minLength(2)]);
  validate(model.$.email, [required(), email()]);
});

const createSignup = () =>
  createForm<Signup>({ initial: { name: '', email: '' }, validation: signupRules });

// Каждый тест собирает свою форму, а после теста сборка снимается.
const built: FormBundle<Signup>[] = [];
const build = () => {
  const signup = createSignup();
  built.push(signup);
  return signup;
};
afterEach(() => {
  for (const signup of built.splice(0)) signup.dispose();
});

const codes = (issues: readonly { code: string }[]) => issues.map((issue) => issue.code);

describe('регистрация', () => {
  it('пустая форма не проходит проверку', async () => {
    const signup = build();

    const result = await signup.validate();

    expect(result.status).toBe('invalid');
    expect(codes(signup.form.name.issues.value)).toEqual(['required']);
    expect(codes(signup.form.email.issues.value)).toEqual(['required']);
  });

  it('отправка зовёт обработчик со значениями модели', async () => {
    const signup = build();
    signup.model.patch({ name: 'Анна', email: 'anna@example.com' });
    const send = vi.fn(async (values: Signup) => `id-${values.name}`);

    const outcome = await signup.submission.submit(send);

    expect(outcome).toEqual({ status: 'submitted', result: 'id-Анна' });
    expect(send).toHaveBeenCalledWith({ name: 'Анна', email: 'anna@example.com' });
  });

  it('с ошибкой обработчик не вызывается, а замечание видно', async () => {
    const signup = build();
    signup.form.name.setValue('Анна');
    signup.form.email.setValue('anna@');
    const send = vi.fn();

    const outcome = await signup.submission.submit(send);

    expect(outcome.status).toBe('invalid');
    expect(send).not.toHaveBeenCalled();
    expect(codes(signup.form.email.issues.value)).toEqual(['email']);
    expect(signup.form.email.shouldShowError.value).toBe(true);
  });
});
```

Проверяйте **коды** замечаний, а не тексты: текст зависит от языка и словаря, а код — нет.

## Без React

### Значения

Значения пишутся в модель — так же, как их пишет поле при вводе:

| Способ                            | Когда удобно                                    |
| --------------------------------- | ----------------------------------------------- |
| `bundle.model.patch({ … })`       | заполнить несколько полей разом                 |
| `bundle.model.email = '…'`        | одно поле                                       |
| `bundle.form.email.setValue('…')` | одно поле через ноду — поле станет «изменённым» |

### Правила и отправка

| Вызов                                | Что проверить                                                          |
| ------------------------------------ | ---------------------------------------------------------------------- |
| `await bundle.validate()`            | `result.status` — `valid`, `invalid`, `error`, `cancelled`             |
| `await bundle.validateStep(id)`      | правила одного шага                                                    |
| `await bundle.submission.submit(fn)` | статус отправки и то, вызван ли обработчик                             |
| `form.<поле>.issues.value`           | замечания поля: `{ code, params?, severity? }`                         |
| `form.<поле>.shouldShowError.value`  | увидит ли пользователь ошибку: поле невалидно и его трогали или меняли |

Async-правило ходит в сеть через функцию, которую тест подменяет. Сбой правила — это не
замечание, а статус `error`:

```typescript
import { afterEach, expect, it, vi } from 'vitest';
import { createForm } from '@reformer/core';
import { defineValidation, validateAsync } from '@reformer/core/validation';

type Signup = { login: string };

// Проверку на сервере тест подменяет.
const isLoginFree = vi.fn<(login: string) => Promise<boolean>>();

const loginRules = defineValidation<Signup>(({ model }) => {
  validateAsync(model.$.login, [
    async (login) => ((await isLoginFree(login)) ? null : { code: 'login.taken' }),
  ]);
});

afterEach(() => isLoginFree.mockReset());

it('занятый логин', async () => {
  isLoginFree.mockResolvedValue(false);
  const signup = createForm<Signup>({ initial: { login: 'anna' }, validation: loginRules });

  const result = await signup.validate();

  expect(result.status).toBe('invalid');
  expect(signup.form.login.issues.value).toEqual([{ code: 'login.taken' }]);
  signup.dispose();
});

it('сервер проверки недоступен', async () => {
  isLoginFree.mockRejectedValue(new Error('network'));
  const signup = createForm<Signup>({ initial: { login: 'anna' }, validation: loginRules });

  const result = await signup.validate();

  expect(result.status).toBe('error'); // на поле — замечание { code: 'ruleFailed' }
  signup.dispose();
});
```

Правила можно прогнать и без формы — по одной модели. `runValidation` только собирает результат и
ноды не трогает:

```typescript
import { createModel } from '@reformer/core';
import { runValidation } from '@reformer/core/validation';

const model = createModel<Signup>({ login: '' });
const result = await runValidation(model, signupRules); // result.status, result.issues
```

### Поведение

Вычисляемое поле пересчитывается сразу. Доступность поля (`enableWhen`), сброс
(`resetWhen`, `resetOnDisable`), `transformValue`, `syncFields` и колбэк `onChange` поведение пишет
отложенно — на микротаске. Перед проверкой их дождитесь:

```typescript
import { expect, it } from 'vitest';
import { createForm } from '@reformer/core';
import { compute, defineFormBehavior, enableWhen } from '@reformer/core/behaviors';

type Order = { price: number; qty: number; total: number; delivery: boolean; address: string };

const orderBehavior = defineFormBehavior<Order>(({ model }) => {
  compute(model.$.total, () => model.price * model.qty);
  enableWhen(model.$.address, () => model.delivery, { resetOnDisable: true });
});

const createOrder = () =>
  createForm<Order>({
    initial: { price: 100, qty: 1, total: 0, delivery: false, address: '' },
    behavior: orderBehavior,
  });

it('total пересчитывается от цены и количества', () => {
  const order = createOrder();

  order.model.qty = 3;

  expect(order.model.total).toBe(300);
  order.dispose();
});

it('адрес доступен только с доставкой', async () => {
  const order = createOrder();
  expect(order.form.address.disabled.value).toBe(true);

  order.model.delivery = true;
  await Promise.resolve(); // доступность поведение переключает на микротаске

  expect(order.form.address.disabled.value).toBe(false);
  order.dispose();
});
```

### Шаги

Переходы потока возвращают результат — его и проверяйте:

```typescript
type Ticket = { name: string; email: string };

const contactsRules = defineValidation<Ticket>(({ model }) => {
  validate(model.$.name, [required()]);
});
const emailRules = defineValidation<Ticket>(({ model }) => {
  validate(model.$.email, [required(), email()]);
});

it('«Далее» не пускает дальше шага с ошибками', async () => {
  const ticket = createForm<Ticket>({
    initial: { name: '', email: '' },
    flow: {
      steps: [
        { id: 'contacts', rules: contactsRules },
        { id: 'email', rules: emailRules },
      ],
    },
  });
  const flow = ticket.flow!;

  expect(await flow.next()).toMatchObject({ status: 'stayed', reason: 'invalid' });
  expect(ticket.form.name.touched.value).toBe(true); // ошибки шага стали видны

  ticket.model.name = 'Анна';
  expect(await flow.next()).toEqual({ status: 'moved', from: 'contacts', to: 'email' });
  expect(flow.goTo('contacts')).toMatchObject({ status: 'moved' });
  expect(flow.goTo('email')).toMatchObject({ status: 'stayed', reason: 'locked' });

  ticket.dispose();
});
```

Причины остаться на шаге — в [Многошаговых формах](./multi-step-forms.mdx).

### Тексты замечаний

Если важен именно текст — например, свой словарь формы, — получите его резолвером. Синхронная
локаль из `@reformer/core/locale/ru` не требует загрузки:

```typescript
import { createI18n, resolveIssueMessage } from '@reformer/core/i18n';
import { ru } from '@reformer/core/locale/ru';

const i18n = createI18n(ru);
resolveIssueMessage({ code: 'required' }, i18n); // 'Обязательное поле'
resolveIssueMessage({ code: 'minLength', params: { minLength: 8 } }, i18n); // 'Не меньше 8 символов'
resolveIssueMessage({ code: 'loan.min' }, i18n, loanMessages); // текст из словаря формы
```

## С React

Для компонентов нужен DOM: окружение `happy-dom` или `jsdom` и React Testing Library. Окружение
задают в конфиге Vitest (`test.environment`) или первой строкой файла.

Ниже — тест формы обратной связи из [Быстрого старта](/docs/getting-started/quick-start):

```tsx
// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '@reformer/core/react';
import { ru } from '@reformer/ui-kit/locale/ru';
import ContactForm from './contact-form';

afterEach(cleanup);

// Без провайдера тексты английские. Синхронная локаль не требует ожидания загрузки.
const renderForm = () =>
  render(
    <I18nProvider locale={ru}>
      <ContactForm />
    </I18nProvider>
  );

it('показывает замечания после попытки отправки', async () => {
  renderForm();

  fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

  expect(await screen.findAllByText('Обязательное поле')).toHaveLength(3);
});

it('отправляет заполненную форму', async () => {
  renderForm();

  fireEvent.change(screen.getByLabelText('Имя'), { target: { value: 'Анна' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'anna@example.com' } });
  fireEvent.change(screen.getByLabelText('Сообщение'), {
    target: { value: 'Хочу узнать про тарифы' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

  expect(await screen.findByText('Готово, Анна! Форма очищена.')).toBeTruthy();
});
```

- **Поле по подписи.** `FormField` связывает подпись с контролом, поэтому работает
  `getByLabelText('Имя')`.
- **Поле по `data-testid`.** Если узлу схемы задан `componentProps.testId` (или проп `testId` у
  `FormField`), обёртка ставит атрибуты `field-<id>`, `label-<id>`, `input-<id>` и `error-<id>`.
- **Асинхронность.** Проверка и отправка асинхронны — ищите результат через `findBy…`, а не
  `getBy…`.
- **Живая проверка.** Стратегию проверки (`validation.strategy`) включает `useFormBundle` — в
  тесте компонента она работает, как в приложении. В тесте без React её нет.

## В браузере — e2e

Для сквозных тестов удобны те же `data-testid` обёртки поля. Пример на
[Playwright](https://playwright.dev):

```typescript
import { expect, test } from '@playwright/test';

test('ошибка в email видна после отправки', async ({ page }) => {
  await page.goto('/signup');

  await page.getByTestId('input-email').fill('anna@');
  await page.getByRole('button', { name: 'Отправить' }).click();

  await expect(page.getByTestId('error-email')).toHaveText('Введите корректный email');
});
```

Большой пример — e2e-тесты демо-стенда в репозитории: `projects/react-playground-e2e/tests/pages/`
(страница-объект на каждую форму, селекторы по `data-testid`).

## Подводные камни

- **Одна форма на несколько тестов.** Тесты начинают зависеть от порядка. Собирайте форму в каждом
  тесте.
- **Не снятая сборка.** Поведение формы продолжает работать после теста. Снимайте сборку
  `bundle.dispose()`; значения модели при этом остаются.
- **Проверка сразу после записи.** Поведение, которое пишет отложенно, ещё не отработало — дождитесь
  `await Promise.resolve()`. Async-правила дожидаются сами `validate()` и `submit()`.
- **Фейковые таймеры.** Для `debounce` используйте `vi.useFakeTimers()` и
  `await vi.advanceTimersByTimeAsync(ms)`; `waitFor` с фейковыми таймерами не сочетайте.
- **Тексты на английском.** Без `I18nProvider` библиотека говорит по-английски. Оберните компонент
  в `<I18nProvider locale={ru}>` или проверяйте коды замечаний.
- **Результат как `boolean`.** `expect(await bundle.validate()).toBe(true)` не пройдёт: результат —
  объект. Проверяйте `status`.

## См. также

- [Многошаговые формы](./multi-step-forms.mdx) — переходы и причины остаться на шаге
- [Отправка и сброс](/docs/patterns/submit-and-reset) — статусы отправки
- [Локализация](./localization.mdx) — словари и `I18nProvider`
- [Частые проблемы](../reference/faq.md)
