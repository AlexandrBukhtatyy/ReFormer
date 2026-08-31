/**
 * Модель мини-примера HTML-узлов: заявка на рассрочку в три поля.
 *
 * Специально маленькая — пример показывает не работу с данными, а презентационную вёрстку
 * прямо в схеме: заголовки, абзацы, разделители и текст, подставляющий значения модели.
 */

import { createModel, type FormModel } from '@reformer/core';

export interface InstallmentRequest {
  fullName: string;
  amount: number | null;
  months: number;
}

export const createInstallmentModel = (): FormModel<InstallmentRequest> =>
  createModel<InstallmentRequest>({
    fullName: '',
    amount: 60000,
    months: 12,
  });
