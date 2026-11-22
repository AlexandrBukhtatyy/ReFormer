// @reformer-form-build 483a8ad402aae1bf собран сервером ReFormer из form.intent.json: форму меняют через сервер (form_build; в guided — form_start, затем form_edit), а не этот файл — правка руками отсоединит его от сборки, guided её отменит
/**
 * Отправка формы «Регистрация» — функция из `operators` `form.intent.json`, её зовёт
 * кнопка формы. Пока файл не правлен, сборка обновляет заготовку под intent; первая правка
 * делает его твоим.
 */
import type { RegistratsiyaShape } from './model';

/**
 * Отправка формы: заглушка сервера — значения формы уходят в консоль. Замени тело запросом к
 * серверу: первая правка делает файл твоим.
 */
export async function submitForm(values: RegistratsiyaShape): Promise<void> {
  console.info('submitForm', values);
}
