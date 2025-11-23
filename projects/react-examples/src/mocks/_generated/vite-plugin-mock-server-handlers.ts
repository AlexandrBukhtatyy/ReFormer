/**
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
  {
    method: 'GET',
    pattern: /^\/api\/v1\/regions$/,
    handler: async (req: IncomingMessage, params: string[], query: URLSearchParams) => {
      return resolvers.getRegions();
    },
  },

  {
    method: 'GET',
    pattern: /^\/api\/v1\/cities$/,
    handler: async (req: IncomingMessage, params: string[], query: URLSearchParams) => {
      return resolvers.getCities(query.get('region'));
    },
  },

  {
    method: 'GET',
    pattern: /^\/api\/v1\/car-models$/,
    handler: async (req: IncomingMessage, params: string[], query: URLSearchParams) => {
      return resolvers.getCarModels(query.get('brand'));
    },
  },

  {
    method: 'GET',
    pattern: /^\/api\/v1\/dictionaries$/,
    handler: async (req: IncomingMessage, params: string[], query: URLSearchParams) => {
      return resolvers.getDictionaries();
    },
  },

  {
    method: 'GET',
    pattern: /^\/api\/v1\/credit-applications\/([^\/]+)$/,
    handler: async (req: IncomingMessage, params: string[], query: URLSearchParams) => {
      return resolvers.getCreditApplication(params[0]);
    },
  },

  {
    method: 'POST',
    pattern: /^\/api\/v1\/credit-applications$/,
    handler: async (req: IncomingMessage, params: string[], query: URLSearchParams) => {
      const body = await readBody(req);
      return resolvers.createCreditApplication(body);
    },
  }
];
