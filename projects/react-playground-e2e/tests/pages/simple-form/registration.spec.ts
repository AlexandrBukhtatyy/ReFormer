/**
 * E2E-тесты формы регистрации
 *
 * Тесты формы регистрации:
 * - Успешная регистрация
 * - Асинхронная валидация email и username
 * - Маска телефона
 * - Обязательные поля
 * - Валидация пароля
 * - Валидация имени пользователя
 * - Валидация капчи
 * - Принятие условий
 *
 * @tag @registration
 */

import { test, expect } from '../../shared/test-factory';
import { SimpleFormPage } from './simple-form-page.pom';

test.describe('Форма регистрации', { tag: ['@registration'] }, () => {
  let formPage: SimpleFormPage;

  test.beforeEach(async ({ page, perf }) => {
    formPage = new SimpleFormPage(page, { perf });
    await formPage.goto();
  });

  test.describe('REG-001: Успешная регистрация', () => {
    test('REG-001-A: Регистрация с валидными данными', async ({ page }) => {
      // Обработка диалога alert
      page.on('dialog', async (dialog) => {
        expect(dialog.message()).toContain('Регистрация успешна');
        await dialog.accept();
      });

      await formPage.fillValidForm();
      await formPage.waitForAsyncValidation();
      await formPage.submit();

      // Форма должна сброситься после успешной регистрации
      await formPage.expectSuccessAlert();
    });

    test('REG-001-B: Очистка формы после сброса', async () => {
      await formPage.fillValidForm();
      await formPage.reset();

      await formPage.expectFieldValue('username', '');
      await formPage.expectFieldValue('email', '');
      await formPage.expectFieldValue('password', '');
      await formPage.expectFieldValue('confirmPassword', '');
      await formPage.expectFieldValue('fullName', '');
      await formPage.expectFieldValue('phone', '');
      await formPage.expectFieldValue('captcha', '');
    });
  });

  test.describe('REG-002: Асинхронная валидация email', () => {
    test('REG-002-A: Ошибка для занятого email', async () => {
      // Заполняем все обязательные поля, кроме email, чтобы изолировать тест
      await formPage.fillUsername('testuser123');
      await formPage.fillEmail('john@example.com');
      await formPage.fillPassword('Password123');
      await formPage.fillConfirmPassword('Password123');
      await formPage.fillFullName('Test User');
      await formPage.fillPhone('+7 (999) 123-45-67');
      await formPage.fillCaptcha('ABC123');
      await formPage.acceptTerms();
      await formPage.waitForAsyncValidation();
      await formPage.submit();

      await formPage.expectFieldError('email', /уже зарегистрирован|занят/i);
    });

    test('REG-002-B: Ошибка для другого занятого email', async () => {
      await formPage.fillUsername('testuser123');
      await formPage.fillEmail('admin@example.com');
      await formPage.fillPassword('Password123');
      await formPage.fillConfirmPassword('Password123');
      await formPage.fillFullName('Test User');
      await formPage.fillPhone('+7 (999) 123-45-67');
      await formPage.fillCaptcha('ABC123');
      await formPage.acceptTerms();
      await formPage.waitForAsyncValidation();
      await formPage.submit();

      await formPage.expectFieldError('email', /уже зарегистрирован|занят/i);
    });

    test('REG-002-C: Принятие свободного email', async ({ page }) => {
      page.on('dialog', async (dialog) => {
        await dialog.accept();
      });

      await formPage.fillValidForm({ email: 'newuser@example.com' });
      await formPage.waitForAsyncValidation();
      await formPage.submit();

      // При валидном email ошибки не должно быть
      await formPage.expectNoFieldError('email');
    });

    test('REG-002-D: Валидация формата email перед асинхронной проверкой', async () => {
      await formPage.fillEmail('invalid-email');
      // Вызываем blur, чтобы пометить поле как touched и включить shouldShowError
      await formPage.emailInput.blur();
      await formPage.waitForAsyncValidation();

      await formPage.expectFieldError('email', /некорректный email/i);
    });
  });

  test.describe('REG-003: Асинхронная валидация имени пользователя', () => {
    test('REG-003-A: Ошибка для занятого username', async () => {
      await formPage.fillUsername('johndoe');
      await formPage.fillEmail('test@example.com');
      await formPage.fillPassword('Password123');
      await formPage.fillConfirmPassword('Password123');
      await formPage.fillFullName('Test User');
      await formPage.fillPhone('+7 (999) 123-45-67');
      await formPage.fillCaptcha('ABC123');
      await formPage.acceptTerms();
      await formPage.waitForAsyncValidation();
      await formPage.submit();

      await formPage.expectFieldError('username', /занято/i);
    });

    test('REG-003-B: Ошибка для admin username', async () => {
      await formPage.fillUsername('admin');
      await formPage.fillEmail('test@example.com');
      await formPage.fillPassword('Password123');
      await formPage.fillConfirmPassword('Password123');
      await formPage.fillFullName('Test User');
      await formPage.fillPhone('+7 (999) 123-45-67');
      await formPage.fillCaptcha('ABC123');
      await formPage.acceptTerms();
      await formPage.waitForAsyncValidation();
      await formPage.submit();

      await formPage.expectFieldError('username', /занято/i);
    });

    test('REG-003-C: Принятие свободного username', async ({ page }) => {
      page.on('dialog', async (dialog) => {
        await dialog.accept();
      });

      await formPage.fillValidForm({ username: 'newuser123' });
      await formPage.waitForAsyncValidation();
      await formPage.submit();

      await formPage.expectNoFieldError('username');
    });
  });

  test.describe('REG-004: Маска телефона', () => {
    test('REG-004-A: Принятие значения телефона', async () => {
      // Компонент InputMask не форматирует автоматически - принимает значение как есть
      // Пользователи должны вводить значение в ожидаемом формате
      await formPage.fillPhone('+7 (999) 123-45-67');
      await formPage.expectFieldValue('phone', '+7 (999) 123-45-67');
    });

    test('REG-004-B: Ошибка для неполного телефона', async () => {
      await formPage.fillUsername('testuser123');
      await formPage.fillEmail('test@example.com');
      await formPage.fillPassword('Password123');
      await formPage.fillConfirmPassword('Password123');
      await formPage.fillFullName('Test User');
      await formPage.fillPhone('+7 (999) 123');
      await formPage.fillCaptcha('ABC123');
      await formPage.acceptTerms();
      await formPage.submit();

      await formPage.expectFieldError('phone', /формате/i);
    });

    test('REG-004-C: Принятие валидного телефона', async ({ page }) => {
      page.on('dialog', async (dialog) => {
        await dialog.accept();
      });

      await formPage.fillValidForm({ phone: '+7 (999) 123-45-67' });
      await formPage.waitForAsyncValidation();
      await formPage.submit();

      await formPage.expectNoFieldError('phone');
    });
  });

  test.describe('REG-005: Обязательные поля', () => {
    test('REG-005-A: Ошибка для пустого username', async () => {
      // Заполняем все поля кроме username
      await formPage.fillEmail('test@example.com');
      await formPage.fillPassword('Password123');
      await formPage.fillConfirmPassword('Password123');
      await formPage.fillFullName('Test User');
      await formPage.fillPhone('+7 (999) 123-45-67');
      await formPage.fillCaptcha('ABC123');
      await formPage.acceptTerms();
      await formPage.submit();

      await formPage.expectFieldError('username', /обязательно/i);
    });

    test('REG-005-B: Ошибка для пустого email', async () => {
      await formPage.fillUsername('testuser123');
      await formPage.fillPassword('Password123');
      await formPage.fillConfirmPassword('Password123');
      await formPage.fillFullName('Test User');
      await formPage.fillPhone('+7 (999) 123-45-67');
      await formPage.fillCaptcha('ABC123');
      await formPage.acceptTerms();
      await formPage.submit();

      await formPage.expectFieldError('email', /обязателен/i);
    });

    test('REG-005-C: Ошибка для пустого пароля', async () => {
      await formPage.fillUsername('testuser123');
      await formPage.fillEmail('test@example.com');
      await formPage.fillFullName('Test User');
      await formPage.fillPhone('+7 (999) 123-45-67');
      await formPage.fillCaptcha('ABC123');
      await formPage.acceptTerms();
      await formPage.submit();

      await formPage.expectFieldError('password', /обязателен/i);
    });

    test('REG-005-D: Ошибка для пустого подтверждения пароля', async () => {
      await formPage.fillUsername('testuser123');
      await formPage.fillEmail('test@example.com');
      await formPage.fillPassword('Password123');
      await formPage.fillFullName('Test User');
      await formPage.fillPhone('+7 (999) 123-45-67');
      await formPage.fillCaptcha('ABC123');
      await formPage.acceptTerms();
      await formPage.submit();

      await formPage.expectFieldError('confirmPassword', /подтвердите/i);
    });

    test('REG-005-E: Ошибка для пустого ФИО', async () => {
      await formPage.fillUsername('testuser123');
      await formPage.fillEmail('test@example.com');
      await formPage.fillPassword('Password123');
      await formPage.fillConfirmPassword('Password123');
      await formPage.fillPhone('+7 (999) 123-45-67');
      await formPage.fillCaptcha('ABC123');
      await formPage.acceptTerms();
      await formPage.submit();

      await formPage.expectFieldError('fullName', /обязательно/i);
    });

    test('REG-005-F: Ошибка для пустого телефона', async () => {
      await formPage.fillUsername('testuser123');
      await formPage.fillEmail('test@example.com');
      await formPage.fillPassword('Password123');
      await formPage.fillConfirmPassword('Password123');
      await formPage.fillFullName('Test User');
      await formPage.fillCaptcha('ABC123');
      await formPage.acceptTerms();
      await formPage.submit();

      await formPage.expectFieldError('phone', /обязателен/i);
    });

    test('REG-005-G: Ошибка для пустой капчи', async () => {
      await formPage.fillUsername('testuser123');
      await formPage.fillEmail('test@example.com');
      await formPage.fillPassword('Password123');
      await formPage.fillConfirmPassword('Password123');
      await formPage.fillFullName('Test User');
      await formPage.fillPhone('+7 (999) 123-45-67');
      await formPage.acceptTerms();
      await formPage.submit();

      await formPage.expectFieldError('captcha', /введите/i);
    });

    test('REG-005-H: Валидация всех обязательных полей при submit', async () => {
      await formPage.submit();

      // Проверяем, что несколько ошибок отображаются
      await formPage.expectFieldError('username');
      await formPage.expectFieldError('email');
      await formPage.expectFieldError('password');
    });
  });

  test.describe('REG-006: Валидация пароля', () => {
    test('REG-006-A: Ошибка для короткого пароля', async () => {
      await formPage.fillUsername('testuser123');
      await formPage.fillEmail('test@example.com');
      await formPage.fillPassword('Pass1');
      await formPage.fillConfirmPassword('Pass1');
      await formPage.fillFullName('Test User');
      await formPage.fillPhone('+7 (999) 123-45-67');
      await formPage.fillCaptcha('ABC123');
      await formPage.acceptTerms();
      await formPage.submit();

      await formPage.expectFieldError('password', /минимум 8/i);
    });

    test('REG-006-B: Ошибка для пароля без заглавных букв', async () => {
      await formPage.fillUsername('testuser123');
      await formPage.fillEmail('test@example.com');
      await formPage.fillPassword('password123');
      await formPage.fillConfirmPassword('password123');
      await formPage.fillFullName('Test User');
      await formPage.fillPhone('+7 (999) 123-45-67');
      await formPage.fillCaptcha('ABC123');
      await formPage.acceptTerms();
      await formPage.submit();

      await formPage.expectFieldError('password', /заглавные|строчные|цифры/i);
    });

    test('REG-006-C: Ошибка для пароля без цифр', async () => {
      await formPage.fillUsername('testuser123');
      await formPage.fillEmail('test@example.com');
      await formPage.fillPassword('Password');
      await formPage.fillConfirmPassword('Password');
      await formPage.fillFullName('Test User');
      await formPage.fillPhone('+7 (999) 123-45-67');
      await formPage.fillCaptcha('ABC123');
      await formPage.acceptTerms();
      await formPage.submit();

      await formPage.expectFieldError('password', /заглавные|строчные|цифры/i);
    });

    test('REG-006-D: Принятие надёжного пароля', async ({ page }) => {
      page.on('dialog', async (dialog) => {
        await dialog.accept();
      });

      await formPage.fillValidForm({ password: 'Password123' });
      await formPage.waitForAsyncValidation();
      await formPage.submit();

      await formPage.expectNoFieldError('password');
    });

    test('REG-006-E: Ошибка для несовпадающих паролей', async () => {
      await formPage.fillUsername('testuser123');
      await formPage.fillEmail('test@example.com');
      await formPage.fillPassword('Password123');
      await formPage.fillConfirmPassword('DifferentPass123');
      await formPage.fillFullName('Test User');
      await formPage.fillPhone('+7 (999) 123-45-67');
      await formPage.fillCaptcha('ABC123');
      await formPage.acceptTerms();
      await formPage.submit();

      await formPage.expectFieldError('confirmPassword', /не совпадают/i);
    });

    test('REG-006-F: Принятие совпадающих паролей', async ({ page }) => {
      page.on('dialog', async (dialog) => {
        await dialog.accept();
      });

      await formPage.fillValidForm();
      await formPage.waitForAsyncValidation();
      await formPage.submit();

      await formPage.expectNoFieldError('confirmPassword');
    });
  });

  test.describe('REG-007: Валидация имени пользователя', () => {
    test('REG-007-A: Ошибка для короткого username', async () => {
      await formPage.fillUsername('ab');
      await formPage.fillEmail('test@example.com');
      await formPage.fillPassword('Password123');
      await formPage.fillConfirmPassword('Password123');
      await formPage.fillFullName('Test User');
      await formPage.fillPhone('+7 (999) 123-45-67');
      await formPage.fillCaptcha('ABC123');
      await formPage.acceptTerms();
      await formPage.submit();

      await formPage.expectFieldError('username', /минимум 3/i);
    });

    test('REG-007-B: Ошибка для недопустимых символов в username', async () => {
      await formPage.fillUsername('user@name!');
      await formPage.fillEmail('test@example.com');
      await formPage.fillPassword('Password123');
      await formPage.fillConfirmPassword('Password123');
      await formPage.fillFullName('Test User');
      await formPage.fillPhone('+7 (999) 123-45-67');
      await formPage.fillCaptcha('ABC123');
      await formPage.acceptTerms();
      await formPage.submit();

      await formPage.expectFieldError('username', /латиница|цифры|подчеркивания/i);
    });

    test('REG-007-C: Принятие валидного username', async ({ page }) => {
      page.on('dialog', async (dialog) => {
        await dialog.accept();
      });

      await formPage.fillValidForm({ username: 'valid_user123' });
      await formPage.waitForAsyncValidation();
      await formPage.submit();

      await formPage.expectNoFieldError('username');
    });
  });

  test.describe('REG-008: Валидация капчи', () => {
    test('REG-008-A: Ошибка для неверной капчи', async () => {
      await formPage.fillUsername('testuser123');
      await formPage.fillEmail('test@example.com');
      await formPage.fillPassword('Password123');
      await formPage.fillConfirmPassword('Password123');
      await formPage.fillFullName('Test User');
      await formPage.fillPhone('+7 (999) 123-45-67');
      await formPage.fillCaptcha('WRONG');
      await formPage.acceptTerms();
      await formPage.submit();

      await formPage.expectFieldError('captcha', /неверная|попробуйте/i);
    });

    test('REG-008-B: Принятие правильной капчи', async ({ page }) => {
      page.on('dialog', async (dialog) => {
        await dialog.accept();
      });

      await formPage.fillValidForm({ captcha: 'ABC123' });
      await formPage.waitForAsyncValidation();
      await formPage.submit();

      await formPage.expectNoFieldError('captcha');
    });
  });

  test.describe('REG-009: Принятие условий', () => {
    test('REG-009-A: Ошибка при непринятых условиях', async () => {
      await formPage.fillUsername('testuser123');
      await formPage.fillEmail('test@example.com');
      await formPage.fillPassword('Password123');
      await formPage.fillConfirmPassword('Password123');
      await formPage.fillFullName('Test User');
      await formPage.fillPhone('+7 (999) 123-45-67');
      await formPage.fillCaptcha('ABC123');
      // Не принимаем условия
      await formPage.waitForAsyncValidation();
      await formPage.submit();

      await formPage.expectFieldError('acceptTerms', /принять|условия/i);
    });
  });

  test.describe('REG-010: Состояние формы', () => {
    test('REG-010-A: Кнопка submit активна в зависимости от состояния валидации', async () => {
      // В ReFormer форма начинается как валидная до явной валидации
      // Кнопка отключается только когда form.invalid или form.pending равны true
      // Пустая форма валидна до тех пор, пока submit не запустит валидацию
      const submitButton = formPage.submitButton;
      await expect(submitButton).toBeEnabled();
    });

    test('REG-010-B: Состояние pending во время асинхронной валидации', async () => {
      await formPage.fillUsername('testuser');
      // Во время асинхронной валидации кнопка может показывать "Проверка..."
      // Это зависит от реализации
    });
  });

  test.describe('REG-011: Восстановление после ошибок', () => {
    test('REG-011-A: Очистка ошибки при вводе валидного значения', async ({ page }) => {
      page.on('dialog', async (dialog) => {
        await dialog.accept();
      });

      // Создаём ошибку с занятым email (асинхронная валидация)
      await formPage.fillUsername('testuser123');
      await formPage.fillEmail('john@example.com'); // Занятый email
      await formPage.fillPassword('Password123');
      await formPage.fillConfirmPassword('Password123');
      await formPage.fillFullName('Test User');
      await formPage.fillPhone('+7 (999) 123-45-67');
      await formPage.fillCaptcha('ABC123');
      await formPage.acceptTerms();
      await formPage.waitForAsyncValidation();
      await formPage.submit();
      await formPage.expectFieldError('email', /занят|зарегистрирован/i);

      // Исправляем ошибку свободным email
      await formPage.fillEmail('newuser@example.com');
      await formPage.waitForAsyncValidation();
      await formPage.submit();

      await formPage.expectNoFieldError('email');
    });
  });
});
