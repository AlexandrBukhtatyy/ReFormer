/**
 * Conformance формы регистрации: одинаковое видимое поведение всех реализаций
 * (docs/specs/registration-form.md + BENCH-CONTRACT §3). Числа бенча имеют смысл только при
 * зелёном прогоне этого файла на всех реализациях.
 */
import { expect, test } from '@playwright/test';
import { implementations } from '../../lib/participants';
import { REGISTRATION_FIELDS, RegistrationPage, VALID } from '../../pom/registration';

/** Debounce проверок общего клиента (BENCH-CONTRACT §3). */
const ASYNC_CHECK_DEBOUNCE_MS = 300;

const REQUIRED_ERRORS = {
  username: 'Имя пользователя обязательно',
  email: 'Email обязателен',
  password: 'Пароль обязателен',
  confirmPassword: 'Подтвердите пароль',
  fullName: 'Полное имя обязательно',
  phone: 'Телефон обязателен',
  captcha: 'Введите символы с картинки',
  acceptTerms: 'Необходимо принять условия',
};

for (const lib of implementations('registration')) {
  test.describe(`${lib.id}: регистрация`, () => {
    let form: RegistrationPage;

    test.beforeEach(async ({ page }) => {
      form = new RegistrationPage(page, lib.id);
    });

    test('исходное состояние: пустые поля, нет ошибок, одна загрузка капчи', async () => {
      await form.goto();
      for (const f of REGISTRATION_FIELDS) {
        if (f === 'acceptTerms') await expect(form.input(f)).not.toBeChecked();
        else await expect(form.input(f)).toHaveValue('');
      }
      expect(await form.errors()).toEqual({});
      expect(await form.calls()).toEqual({ captcha: 1 });
    });

    test('до первой отправки ошибки не показываются', async () => {
      await form.goto();
      await form.type('username', 'ab');
      await form.type('email', 'bad');
      await form.blur();
      await form.idle();
      expect(await form.errors()).toEqual({});
    });

    test('отправка пустой формы: по одной ошибке на поле, без запроса', async () => {
      await form.goto();
      await form.submit();
      await form.idle();
      expect(await form.errors()).toEqual(REQUIRED_ERRORS);
      expect(await form.submissions()).toHaveLength(0);
    });

    test('после отправки ошибки обновляются на каждом вводе', async () => {
      await form.goto();
      await form.submit();
      await form.idle();
      await form.type('username', 'jo');
      await form.idle();
      await expect(form.error('username')).toHaveText('Минимум 3 символа');
      await form.type('username', '!');
      await form.idle();
      await expect(form.error('username')).toHaveText('Латиница, цифры, _ (3-20)');
      await form.type('username', 'john', { clear: true });
      await form.idle();
      await expect(form.error('username')).toHaveCount(0);
      // Остальные поля по-прежнему с ошибками — ввод в одно поле их не снимает.
      await expect(form.error('email')).toHaveText(REQUIRED_ERRORS.email);
    });

    test('пароль: сложность и совпадение подтверждения, правка пароля перепроверяет подтверждение', async () => {
      await form.goto();
      await form.submit();
      await form.idle();
      await form.type('password', 'secret12');
      await form.idle();
      await expect(form.error('password')).toHaveText('Нужны заглавные, строчные буквы и цифры');
      await form.type('password', 'Secret12', { clear: true });
      await form.type('confirmPassword', 'Secret1');
      await form.idle();
      await expect(form.error('confirmPassword')).toHaveText('Пароли не совпадают');
      await form.type('password', 'Secret1', { clear: true });
      await form.idle();
      await expect(form.error('password')).toHaveText('Минимум 8 символов');
      await expect(form.error('confirmPassword')).toHaveCount(0);
    });

    test('занятые имя и email: ошибка от сервера, ровно одна проверка на итоговое значение', async () => {
      await form.goto();
      await form.submit();
      await form.idle();
      await form.type('username', 'johndoe');
      await form.type('email', 'john@example.com');
      await form.idle();
      await expect(form.error('username')).toHaveText('Имя уже занято');
      await expect(form.error('email')).toHaveText('Email уже зарегистрирован');
      const calls = await form.calls();
      expect(calls['check-username']).toBe(1);
      expect(calls['check-email']).toBe(1);
    });

    test('пока идёт серверная проверка поля, ошибки других полей остаются на экране', async () => {
      // Ответ сервера через 1 с: после debounce 300 мс проверка капчи висит в полёте.
      await form.goto({ latency: '1000' });
      await form.submit();
      await form.idle();
      await form.type('captcha', await form.captchaAnswer());
      await form.page.waitForTimeout(ASYNC_CHECK_DEBOUNCE_MS + 200);
      expect((await form.calls())['captcha-verify']).toBe(1);
      const { captcha: _inFlight, ...others } = await form.errors();
      const { captcha: _required, ...expected } = REQUIRED_ERRORS;
      expect(others).toEqual(expected);
      await form.idle();
      expect(await form.errors()).toEqual(expected);
    });

    test('маска телефона', async () => {
      await form.goto();
      await form.type('phone', VALID.phoneDigits);
      await expect(form.input('phone')).toHaveValue(VALID.phone);
    });

    test('капча: длина, неверный ответ, обновление очищает поле', async () => {
      await form.goto();
      await form.submit();
      await form.idle();
      await form.type('captcha', 'ABCDE');
      await form.idle();
      await expect(form.error('captcha')).toHaveText('Нужно 6 символов');
      await form.type('captcha', 'ABCDEF', { clear: true });
      await form.idle();
      await expect(form.error('captcha')).toHaveText('Символы не совпадают с картинкой');
      await form.refreshCaptcha();
      await form.idle();
      await expect(form.input('captcha')).toHaveValue('');
      expect((await form.calls()).captcha).toBe(2);
      await form.type('captcha', await form.captchaAnswer());
      await form.idle();
      await expect(form.error('captcha')).toHaveCount(0);
    });

    test('успешная регистрация: канонический payload', async () => {
      await form.goto();
      await form.fillValid();
      await form.submit();
      await form.idle();
      await expect(form.page.getByTestId('submit-result')).toBeVisible();
      expect(await form.errors()).toEqual({});
      const submissions = await form.submissions();
      expect(submissions).toEqual([
        {
          username: VALID.username,
          email: VALID.email,
          password: VALID.password,
          fullName: VALID.fullName,
          phone: VALID.phone,
          captcha: await form.captchaAnswer(),
          acceptTerms: true,
        },
      ]);
    });

    test('«Очистить» возвращает тихую фазу', async () => {
      await form.goto();
      await form.type('username', 'someone');
      await form.submit();
      await form.idle();
      expect(Object.keys(await form.errors()).length).toBeGreaterThan(0);
      await form.reset();
      await form.idle();
      expect(await form.errors()).toEqual({});
      await expect(form.input('username')).toHaveValue('');
      await form.type('username', 'ab');
      await form.blur();
      await form.idle();
      expect(await form.errors()).toEqual({});
    });

    test('приглашение: предзаполнение и «Очистить» возвращает его', async () => {
      await form.goto({ invite: 'welcome' });
      await expect(form.input('email')).toHaveValue('invited.user@example.com');
      await expect(form.input('fullName')).toHaveValue('Invited User');
      await form.type('fullName', 'Changed Name', { clear: true });
      await form.reset();
      await form.idle();
      await expect(form.input('fullName')).toHaveValue('Invited User');
    });
  });
}
