import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// MSW Node server для тестов
// Не запускать автоматически - используется в тестовом окружении
export const server = setupServer(...handlers);
