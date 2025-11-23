import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import { handlers } from './handlers';

// Простой middleware для обработки MSW handlers в Vite
async function handleMswRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const method = req.method || 'GET';

  // Собираем body для POST/PUT запросов
  let body: string | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    body = await new Promise<string>((resolve) => {
      let data = '';
      req.on('data', (chunk: Buffer) => (data += chunk.toString()));
      req.on('end', () => resolve(data));
    });
  }

  const request = new Request(url.toString(), {
    method,
    headers: Object.fromEntries(
      Object.entries(req.headers).filter(([, v]) => v !== undefined) as [string, string][]
    ),
    body: body || undefined,
  });

  // Пробуем каждый handler
  for (const handler of handlers) {
    const result = await handler.parse({ request });

    if (result.match) {
      // Handler совпал, получаем response
      const response = await handler.run({
        request: request as any,
        requestId: crypto.randomUUID(),
      });

      if (response?.response) {
        res.statusCode = response.response.status;
        response.response.headers.forEach((value: string, key: string) => {
          res.setHeader(key, value);
        });
        const responseBody = await response.response.text();
        res.end(responseBody);
        return true;
      }
    }
  }

  return false;
}

export function mockServerPlugin(): Plugin {
  return {
    name: 'vite-plugin-mock-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Обрабатываем только /api запросы
        if (!req.url?.startsWith('/api')) {
          return next();
        }

        try {
          const handled = await handleMswRequest(req, res);
          if (!handled) {
            next();
          }
        } catch (error) {
          console.error('[MSW] Error handling request:', error);
          next();
        }
      });

      console.log('[MSW] Mock middleware enabled for /api routes');
    },
  };
}
