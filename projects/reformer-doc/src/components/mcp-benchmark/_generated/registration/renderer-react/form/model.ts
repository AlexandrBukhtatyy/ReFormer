// @reformer-form-build 824a82bb3f053650 собран сервером ReFormer из form.intent.json: форму меняют через сервер (form_build; в guided — form_start, затем form_edit), а не этот файл — правка руками отсоединит его от сборки, guided её отменит
/**
 * Модель формы «Форма регистрации» — источник истины для всех остальных файлов.
 * Валидация, поведение и схема ссылаются на ЭТИ пути; менять их надо здесь.
 */
import { createModel } from '@reformer/core';

export type FormaRegistratsiiShape = {
  /** Логин */
  login: string;
  /** Email */
  email: string;
  /** Пароль */
  password: string;
  /** Повтор пароля */
  confirmPassword: string;
  /** Код с картинки */
  captcha: string;
};

/** Модель формы — по одной на сборку: `createForm({ model: createFormModel(), … })`. */
export const createFormModel = () =>
  createModel<FormaRegistratsiiShape>({
    login: "",
    email: "",
    password: "",
    confirmPassword: "",
    captcha: "",
  });
