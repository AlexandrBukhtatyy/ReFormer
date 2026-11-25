/**
 * Действия формы, которые документ выразить не может: JSON не несёт функций. Страница отдаёт их
 * через `provide`, компонент `Form` реестра (./layout.ts) берёт оттуда обработчик отправки.
 */
import type { InjectionKey } from 'vue';

export interface FormActions {
  /** Обработчик отправки валидной формы; возвращает текст подтверждения. */
  submit(values: unknown): Promise<string>;
}

export const FORM_ACTIONS: InjectionKey<FormActions> = Symbol('form-actions');

/** «Очистить» формы, внутри которой стоит кнопка. */
export const FORM_RESET: InjectionKey<() => void> = Symbol('form-reset');
