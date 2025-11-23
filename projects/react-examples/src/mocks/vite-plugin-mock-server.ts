import type { Plugin, Connect } from 'vite';
import { handlers } from './handlers';
import { createMiddleware } from '@mswjs/http-middleware';

export function mockServerPlugin(): Plugin {
  return {
    name: 'vite-plugin-mock-server',
    configureServer(server) {
      // Используем MSW middleware напрямую в Vite dev server
      const mswMiddleware = createMiddleware(...handlers) as Connect.NextHandleFunction;

      // Добавляем middleware для /api routes
      server.middlewares.use('/api', (req, res, next) => {
        // Восстанавливаем полный URL для MSW
        req.url = '/api' + (req.url || '');
        mswMiddleware(req, res, next);
      });

      console.log('[MSW] Mock middleware enabled for /api routes');
    },
  };
}
