import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

// Standalone mock server без зависимости от MSW
// Используется в StackBlitz где BroadcastChannel не поддерживается

import {
  resolveRegions,
  resolveCities,
  resolveCarModels,
  resolveDictionaries,
  resolveCreditApplication,
  createCreditApplication,
} from './resolvers';

type RouteHandler = (
  req: IncomingMessage,
  params: Record<string, string>,
  query: URLSearchParams
) => Promise<{ status: number; body: unknown }>;

const routes: Array<{ method: string; pattern: RegExp; handler: RouteHandler }> = [
  // GET /api/v1/regions
  {
    method: 'GET',
    pattern: /^\/api\/v1\/regions$/,
    handler: async () => resolveRegions(),
  },

  // GET /api/v1/cities?region={region}
  {
    method: 'GET',
    pattern: /^\/api\/v1\/cities$/,
    handler: async (_req, _params, query) => resolveCities(query.get('region')),
  },

  // GET /api/v1/car-models?brand={brand}
  {
    method: 'GET',
    pattern: /^\/api\/v1\/car-models$/,
    handler: async (_req, _params, query) => resolveCarModels(query.get('brand')),
  },

  // GET /api/v1/dictionaries
  {
    method: 'GET',
    pattern: /^\/api\/v1\/dictionaries$/,
    handler: async () => resolveDictionaries(),
  },

  // GET /api/v1/credit-applications/:id
  {
    method: 'GET',
    pattern: /^\/api\/v1\/credit-applications\/([^/]+)$/,
    handler: async (_req, params) => resolveCreditApplication(params['0']),
  },

  // POST /api/v1/credit-applications
  {
    method: 'POST',
    pattern: /^\/api\/v1\/credit-applications$/,
    handler: async (req) => {
      const body = await readBody(req);
      return createCreditApplication(body);
    },
  },
];

async function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk: Buffer) => (data += chunk.toString()));
    req.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
  });
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const urlObj = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = urlObj.pathname;
  const method = req.method || 'GET';

  for (const route of routes) {
    if (route.method !== method) continue;

    const match = pathname.match(route.pattern);
    if (!match) continue;

    const params: Record<string, string> = {};
    match.slice(1).forEach((value, index) => {
      params[String(index)] = value;
    });

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

      console.log('[Mock Server] Enabled for /api routes (StackBlitz mode)');
    },
  };
}
