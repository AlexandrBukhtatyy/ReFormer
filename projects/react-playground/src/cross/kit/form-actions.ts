/**
 * Действия формы, которые документ выразить не может: JSON не несёт функций. Страница отдаёт их
 * контекстом, компонент `Form` реестра (./layout.tsx) берёт оттуда обработчик отправки.
 */
import { createContext } from 'react';

export interface FormActions {
  /** Обработчик отправки валидной формы; возвращает текст подтверждения. */
  submit(values: unknown): Promise<string>;
}

export const FormActionsContext = createContext<FormActions | null>(null);

/** «Очистить» формы, внутри которой стоит кнопка. */
export const ResetContext = createContext<(() => void) | null>(null);
