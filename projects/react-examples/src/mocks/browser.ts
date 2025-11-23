import { setupWorker } from 'msw/browser';
import { handlers } from './_generated/msw-handlers';

export const worker = setupWorker(...handlers);
