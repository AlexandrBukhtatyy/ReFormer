// @reformer-form-build b24a599a1ea44695 собран сервером ReFormer из form.intent.json: форму меняют через сервер (form_build; в guided — form_start, затем form_edit), а не этот файл — правка руками отсоединит его от сборки, guided её отменит
/**
 * Модель формы «Регистрация» — источник истины для всех остальных файлов.
 * Валидация, поведение и схема ссылаются на ЭТИ пути; менять их надо здесь.
 */
import { createModel } from '@reformer/core';

export type RegistratsiyaShape = {
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
  createModel<RegistratsiyaShape>({
    login: "",
    email: "",
    password: "",
    confirmPassword: "",
    captcha: "",
  });
