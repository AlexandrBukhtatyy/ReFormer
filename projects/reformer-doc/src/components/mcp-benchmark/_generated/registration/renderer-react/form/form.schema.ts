// @reformer-form-build 21219b25d8576404 собран сервером ReFormer из form.intent.json: форму меняют через сервер (form_build; в guided — form_start, затем form_edit), а не этот файл — правка руками отсоединит его от сборки, guided её отменит
/**
 * Схема формы «Форма регистрации» — одно дерево узлов на все способы реализации.
 *
 * Узел привязан к модели ключом `model`: поле, массив под-форм (`item`) или подформа
 * (`part`). По этому дереву сборка `createForm` строит форму, а `FormRenderer` рисует
 * разметку. Кто рисует разметку сам, в JSX, берёт из схемы только поля.
 */
import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Box, Button, Input, InputPassword } from '@reformer/ui-kit';
import type { FormaRegistratsiiShape } from './model';

export const formSchema = (model: FormModel<FormaRegistratsiiShape>): FormSchemaNode => ({
  component: Box,
  children: [
    {
      selector: 'login',
      model: model.$.login,
      component: Input,
      componentProps: { label: 'Логин', testId: 'login' },
    },
    {
      selector: 'email',
      model: model.$.email,
      component: Input,
      componentProps: { label: 'Email', testId: 'email' },
    },
    {
      selector: 'password',
      model: model.$.password,
      component: InputPassword,
      componentProps: { label: 'Пароль', testId: 'password' },
    },
    {
      selector: 'confirmPassword',
      model: model.$.confirmPassword,
      component: InputPassword,
      componentProps: { label: 'Повтор пароля', testId: 'confirmPassword' },
    },
    {
      selector: 'captcha',
      model: model.$.captcha,
      component: Input,
      componentProps: { label: 'Код с картинки', testId: 'captcha' },
    },
    {
      selector: 'submit',
      component: Button,
      componentProps: { type: 'button' },
      children: [ 'Зарегистрироваться' ],
    },
  ],
});
