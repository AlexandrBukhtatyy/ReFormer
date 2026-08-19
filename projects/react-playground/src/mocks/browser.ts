import { setupWorker } from 'msw/browser';
import { handlers } from './_generated/msw-handlers';
import { formSchemaHandlers } from './form-schema-handlers';

// Рукописные обработчики идут ПЕРВЫМИ: MSW берёт первый подошедший, и так наши маршруты не
// перехватит случайный шаблон из сгенерированного набора.
export const worker = setupWorker(...formSchemaHandlers, ...handlers);
