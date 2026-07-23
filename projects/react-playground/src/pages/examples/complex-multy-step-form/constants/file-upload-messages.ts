/**
 * Резолвер сообщений для кодов отбора FileUpload (fileType/maxFileSize/...).
 *
 * Отбор файлов выполняет CDK-компонент и отдаёт коды (`FileError.code`) — тексты
 * живут здесь и подключаются через `ValidationMessagesProvider` на корне примера.
 * Общий для всех трёх вариантов complex-form (core / renderer-react / renderer-json).
 */

import { createMessageResolver } from '@reformer/cdk';

export const fileUploadMessages = createMessageResolver({
  maxFiles: (p) => `Максимум ${p?.maxFiles} файла(ов)`,
  minFiles: (p) => `Минимум ${p?.minFiles} файла(ов)`,
  fileType: (p) => `Недопустимый тип файла (разрешено: ${p?.accept})`,
  maxFileSize: () => 'Файл больше 10 МБ',
  minFileSize: () => 'Файл пустой',
  maxTotalFileSize: () => 'Превышен суммарный размер файлов',
  fileExists: (p) => `Файл ${p?.fileName} уже добавлен`,
  uploadFailed: (p) => `Не удалось загрузить: ${p?.reason ?? 'ошибка сети'}`,
  uploadAborted: () => 'Загрузка прервана',
});
