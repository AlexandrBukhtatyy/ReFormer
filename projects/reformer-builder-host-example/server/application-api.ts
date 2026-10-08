/**
 * API приложения — прямо в dev-сервере.
 *
 * Отдельного бэкенда у образца нет, но запросы настоящие: форма ходит по сети, а не читает
 * заглушку из своего же модуля. Это и показывает встроенный билдер — в его превью форму рисует
 * приложение, и словарь в ней пришёл оттуда же, откуда придёт у пользователя.
 *
 * - `GET /api/cities` — словарь городов. Файл читается на каждый запрос: правка данных видна
 *   без перезапуска сервера.
 * - `POST /api/contact-requests` — приём обращения; отвечает его номером.
 *
 * @module server/application-api
 */

import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Plugin } from 'vite';

const sendJson = (response: ServerResponse, status: number, body: unknown): void => {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
};

const readBody = (request: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });

export function applicationApi(): Plugin {
  let received = 0;

  return {
    name: 'host-example:application-api',
    configureServer(server) {
      const citiesFile = path.resolve(server.config.root, 'server/cities.json');

      server.middlewares.use('/api/cities', (request, response, next) => {
        if (request.method !== 'GET') return next();
        void readFile(citiesFile, 'utf8').then(
          (text) => sendJson(response, 200, JSON.parse(text)),
          (error: Error) => sendJson(response, 500, { error: error.message })
        );
      });

      server.middlewares.use('/api/contact-requests', (request, response, next) => {
        if (request.method !== 'POST') return next();
        void readBody(request).then(
          (body) => {
            try {
              JSON.parse(body);
            } catch {
              sendJson(response, 400, { error: 'Тело запроса — не JSON' });
              return;
            }
            received += 1;
            sendJson(response, 201, { id: `REQ-${String(received).padStart(4, '0')}` });
          },
          (error: Error) => sendJson(response, 500, { error: error.message })
        );
      });
    },
  };
}
