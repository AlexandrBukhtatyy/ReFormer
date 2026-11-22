// @reformer-form-build 518e3fa956703f48 собран сервером ReFormer из form.intent.json: форму меняют через сервер (form_build; в guided — form_start, затем form_edit), а не этот файл — правка руками отсоединит его от сборки, guided её отменит
/**
 * Тексты замечаний формы «Форма регистрации»: правило несёт код, строку по коду даёт словарь.
 * Подключение: `<ValidationMessagesProvider messages={formMessages}>` (`@reformer/cdk`) над формой.
 */
import { defineIssueMessages } from '@reformer/core/i18n';

export const formMessages = defineIssueMessages({
  'captcha.async': 'Символы не совпадают',
  'confirmPassword.cross': 'Пароли не совпадают',
  'login.required': 'Только латиница, цифры и _',
  'login.minLength': 'Только латиница, цифры и _',
  'login.maxLength': 'Только латиница, цифры и _',
  'login.pattern': 'Только латиница, цифры и _',
});
