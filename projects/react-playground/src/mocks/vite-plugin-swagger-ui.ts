/**
 * Vite plugin для Swagger UI
 * Доступен по адресу /api-docs
 */

import type { Plugin } from 'vite';
import * as fs from 'fs';
import * as path from 'path';

export function swaggerUIPlugin(): Plugin {
  return {
    name: 'vite-plugin-swagger-ui',
    configureServer(server) {
      // Serve OpenAPI spec
      server.middlewares.use('/api-docs/openapi.json', (_req, res) => {
        const specPath = path.resolve(process.cwd(), 'src/mocks/_generated/openapi.json');
        if (fs.existsSync(specPath)) {
          res.setHeader('Content-Type', 'application/json');
          res.end(fs.readFileSync(specPath, 'utf-8'));
        } else {
          res.statusCode = 404;
          res.end('OpenAPI spec not found. Run npm run generate:mocks first.');
        }
      });

      // Serve Swagger UI
      server.middlewares.use('/api-docs', (_req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.end(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mock API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: '/api-docs/openapi.json',
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>
        `);
      });

      console.log('[Swagger UI] Available at http://localhost:5173/api-docs');
    },
  };
}
