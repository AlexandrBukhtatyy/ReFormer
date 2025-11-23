/**
 * Скрипт генерации MSW handlers и Vite routes из OpenAPI спецификации
 *
 * 1. Читает JSDoc комментарии из resolvers/index.ts
 * 2. Генерирует OpenAPI spec через swagger-jsdoc
 * 3. Генерирует MSW handlers (generated/handlers.ts)
 * 4. Генерирует Vite routes (generated/routes.ts)
 */

import swaggerJsdoc from 'swagger-jsdoc';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..');
const MOCKS_DIR = path.join(ROOT, 'src/mocks');
const RESOLVERS_PATH = path.join(MOCKS_DIR, 'resolvers/index.ts');
const GENERATED_DIR = path.join(MOCKS_DIR, '_generated');

// Swagger-jsdoc конфигурация
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Mock API',
      version: '1.0.0',
      description: 'Автогенерированная документация Mock API',
    },
  },
  apis: [RESOLVERS_PATH],
};

interface OpenAPIOperation {
  operationId: string;
  summary?: string;
  tags?: string[];
  parameters?: Array<{
    name: string;
    in: 'query' | 'path';
    required?: boolean;
    schema?: { type: string };
  }>;
  requestBody?: {
    required?: boolean;
    content?: Record<string, unknown>;
  };
  responses?: Record<string, unknown>;
}

interface OpenAPISpec {
  paths: Record<string, Record<string, OpenAPIOperation>>;
}

interface RouteInfo {
  method: string;
  path: string;
  operationId: string;
  pathParams: string[];
  queryParams: string[];
  hasBody: boolean;
}

function parseRoutes(spec: OpenAPISpec): RouteInfo[] {
  const routes: RouteInfo[] = [];

  for (const [apiPath, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!operation.operationId) continue;

      const pathParams = (operation.parameters || [])
        .filter((p) => p.in === 'path')
        .map((p) => p.name);

      const queryParams = (operation.parameters || [])
        .filter((p) => p.in === 'query')
        .map((p) => p.name);

      routes.push({
        method: method.toUpperCase(),
        path: apiPath,
        operationId: operation.operationId,
        pathParams,
        queryParams,
        hasBody: !!operation.requestBody,
      });
    }
  }

  return routes;
}

function generateMSWHandlers(routes: RouteInfo[]): string {
  const handlers = routes.map((route) => {
    const { method, path: apiPath, operationId, pathParams, queryParams, hasBody } = route;
    const mswMethod = method.toLowerCase();

    // MSW использует :id вместо {id}
    const mswPath = apiPath.replace(/\{([^}]+)\}/g, ':$1');

    const parts: string[] = [];

    if (pathParams.length) {
      parts.push(`    const { ${pathParams.join(', ')} } = params;`);
    }

    if (queryParams.length) {
      parts.push(`    const url = new URL(request.url);`);
      queryParams.forEach((p) => {
        parts.push(`    const ${p} = url.searchParams.get('${p}');`);
      });
    }

    if (hasBody) {
      parts.push(`    const body = await request.json();`);
    }

    // Формируем аргументы для resolver
    const resolverArgs: string[] = [];
    if (pathParams.length || queryParams.length || hasBody) {
      if (pathParams.length) {
        pathParams.forEach((p) => resolverArgs.push(p));
      }
      if (queryParams.length) {
        queryParams.forEach((p) => resolverArgs.push(p));
      }
      if (hasBody) {
        resolverArgs.push('body');
      }
    }

    const resolverCall =
      resolverArgs.length > 0
        ? `resolvers.${operationId}(${resolverArgs.join(', ')})`
        : `resolvers.${operationId}()`;

    const asyncKeyword = hasBody ? 'async ' : '';
    const needsDestructure = pathParams.length > 0 || queryParams.length > 0 || hasBody;
    const destructure = needsDestructure
      ? pathParams.length > 0
        ? '{ params, request }'
        : '{ request }'
      : '';

    const paramsCode = parts.length > 0 ? parts.join('\n') + '\n' : '';
    const arrowFn = needsDestructure ? `(${destructure}) =>` : '() =>';

    return `  http.${mswMethod}('${mswPath}', ${asyncKeyword}${arrowFn} {
${paramsCode}    const result = ${resolverCall};
    if (result.status === 404) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(result.body, { status: result.status });
  })`;
  });

  return `/**
 * AUTO-GENERATED FILE - DO NOT EDIT
 * Generated from OpenAPI spec via scripts/generate-mocks.ts
 */

import { http, HttpResponse } from 'msw';
import * as resolvers from '../resolvers';

export const handlers = [
${handlers.join(',\n\n')}
];
`;
}

function generateViteRoutes(routes: RouteInfo[]): string {
  const routesDef = routes.map((route) => {
    const { method, path: apiPath, operationId, pathParams, queryParams, hasBody } = route;

    // Конвертируем OpenAPI path в regex: {id} → ([^/]+)
    let regexPath = apiPath.replace(/\{([^}]+)\}/g, '([^/]+)');
    regexPath = regexPath.replace(/\//g, '\\/');

    // Формируем аргументы для resolver
    const resolverArgs: string[] = [];

    pathParams.forEach((_p, i) => {
      resolverArgs.push(`params[${i}]`);
    });

    queryParams.forEach((p) => {
      resolverArgs.push(`query.get('${p}')`);
    });

    if (hasBody) {
      resolverArgs.push('body');
    }

    const resolverCall =
      resolverArgs.length > 0
        ? `resolvers.${operationId}(${resolverArgs.join(', ')})`
        : `resolvers.${operationId}()`;

    const handlerBody = hasBody
      ? `const body = await readBody(req);
      return ${resolverCall};`
      : `return ${resolverCall};`;

    return `  {
    method: '${method}',
    pattern: /^${regexPath}$/,
    handler: async (req: IncomingMessage, params: string[], query: URLSearchParams) => {
      ${handlerBody}
    },
  }`;
  });

  return `/**
 * AUTO-GENERATED FILE - DO NOT EDIT
 * Generated from OpenAPI spec via scripts/generate-mocks.ts
 */

import type { IncomingMessage } from 'http';
import * as resolvers from '../resolvers';

// Читает body из request
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

export const routes = [
${routesDef.join(',\n\n')}
];
`;
}

// Main
console.log('Generating mocks from OpenAPI spec...');

const spec = swaggerJsdoc(swaggerOptions) as OpenAPISpec;

// Сохраняем OpenAPI spec
fs.mkdirSync(GENERATED_DIR, { recursive: true });
fs.writeFileSync(path.join(GENERATED_DIR, 'openapi.json'), JSON.stringify(spec, null, 2));
console.log('✓ Generated openapi.json');

// Парсим роуты
const routes = parseRoutes(spec);
console.log(`  Found ${routes.length} routes`);

// Генерируем MSW handlers
const handlersCode = generateMSWHandlers(routes);
fs.writeFileSync(path.join(GENERATED_DIR, 'msw-handlers.ts'), handlersCode);
console.log('✓ Generated msw-handlers.ts');

// Генерируем Vite routes
const routesCode = generateViteRoutes(routes);
fs.writeFileSync(path.join(GENERATED_DIR, 'vite-plugin-mock-server-handlers.ts'), routesCode);
console.log('✓ Generated vite-plugin-mock-server-handlers.ts');

console.log('\nDone!');
