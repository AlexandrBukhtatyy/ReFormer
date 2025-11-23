/**
 * Vite plugin для mock сервера
 * Используется в StackBlitz где Service Worker не поддерживается
 *
 * Использует автогенерированные routes из generated/routes.ts
 */

import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import { routes } from './_generated/vite-plugin-mock-server-handlers';

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const urlObj = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = urlObj.pathname;
  const method = req.method || 'GET';

  for (const route of routes) {
    if (route.method !== method) continue;

    const match = pathname.match(route.pattern);
    if (!match) continue;

    // Извлекаем параметры из regex групп
    const params = match.slice(1);

    const result = await route.handler(req, params, urlObj.searchParams);

    res.statusCode = result.status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result.body));
    return true;
  }

  return false;
}

export function mockServerPlugin(): Plugin {
  return {
    name: 'vite-plugin-mock-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api')) {
          return next();
        }

        try {
          const handled = await handleRequest(req, res);
          if (!handled) {
            next();
          }
        } catch (error) {
          console.error('[Mock Server] Error:', error);
          next();
        }
      });

      console.log(`[Mock Server] Enabled with ${routes.length} routes (StackBlitz mode)`);
    },
  };
}
