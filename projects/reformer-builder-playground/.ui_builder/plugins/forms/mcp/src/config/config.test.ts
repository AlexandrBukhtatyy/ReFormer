/**
 * Конфигурация серверов: `.mcp.json`, `server.json`, подстановки `${VAR}` и сведение источников.
 *
 * @module plugins/forms/mcp/config/config.test
 */

import { describe, expect, it } from 'vitest';
import { createFakeHost } from '../testing';
import { discoverServers } from './discover';
import { interpolate, literalSecretHeaders, resolveRemote, variablesOf } from './interpolate';
import { parseMcpJson } from './mcp-json';
import { parseServerJson } from './server-json';
import type { RemoteServerSpec } from './types';

const remote = (patch: Partial<RemoteServerSpec> = {}): RemoteServerSpec => ({
  kind: 'http',
  name: 'docs',
  url: 'https://example.com/mcp',
  headers: {},
  notes: [],
  ...patch,
});

describe('.mcp.json', () => {
  it('файла нет — серверов нет и замечаний нет', () => {
    expect(parseMcpJson(null)).toEqual({ servers: [], problems: [] });
  });

  it('битый JSON и отсутствие mcpServers — замечания, а не исключение', () => {
    expect(parseMcpJson('{').problems).toEqual(['.mcp.json не разбирается как JSON']);
    expect(parseMcpJson('{"servers": {}}').problems).toEqual(['.mcp.json: нет объекта mcpServers']);
  });

  it('виды записей: http, sse, stdio явно и по полям, как у Claude Code', () => {
    const { servers } = parseMcpJson(
      JSON.stringify({
        mcpServers: {
          http: {
            type: 'http',
            url: 'https://a.example/mcp',
            headers: { Authorization: 'Bearer ${TOKEN}' },
          },
          sse: { type: 'sse', url: 'https://b.example/sse' },
          reformer: { command: 'npx', args: ['@reformer/mcp'] },
          bare: { url: 'https://c.example/mcp', unknownField: true },
        },
      })
    );
    expect(servers).toEqual([
      {
        kind: 'http',
        name: 'http',
        url: 'https://a.example/mcp',
        headers: { Authorization: 'Bearer ${TOKEN}' },
        notes: [],
      },
      { kind: 'sse', name: 'sse', url: 'https://b.example/sse', headers: {}, notes: [] },
      { kind: 'stdio', name: 'reformer', command: 'npx' },
      {
        kind: 'http',
        name: 'bare',
        url: 'https://c.example/mcp',
        headers: {},
        notes: ['type не указан — подключение по http'],
      },
    ]);
  });

  it('битая запись — сервер вида invalid с причиной, остальные целы', () => {
    const { servers } = parseMcpJson(
      JSON.stringify({
        mcpServers: {
          'Bad Name': { url: 'https://a.example' },
          relative: { type: 'http', url: '/mcp' },
          headers: { type: 'http', url: 'https://a.example', headers: { X: 1 } },
          weird: { type: 'ws', url: 'wss://a.example' },
          fine: { type: 'http', url: 'https://ok.example/mcp' },
        },
      })
    );
    expect(servers.map((spec) => [spec.name, spec.kind])).toEqual([
      ['Bad Name', 'invalid'],
      ['relative', 'invalid'],
      ['headers', 'invalid'],
      ['weird', 'invalid'],
      ['fine', 'http'],
    ]);
  });

  it('адрес целиком из переменной — законен до подстановки', () => {
    const { servers } = parseMcpJson(
      JSON.stringify({ mcpServers: { env: { type: 'http', url: '${MCP_URL}' } } })
    );
    expect(servers[0]?.kind).toBe('http');
  });
});

describe('server.json', () => {
  it('нет файла или поля — умолчание без замечаний', () => {
    expect(parseServerJson(null)).toEqual({ notes: [] });
    expect(parseServerJson('{}')).toEqual({ notes: [] });
  });

  it('idleSeconds от 0 до часа принимается', () => {
    expect(parseServerJson('{"idleSeconds": 0}')).toEqual({ idleSeconds: 0, notes: [] });
    expect(parseServerJson('{"idleSeconds": 3600, "future": 1}')).toEqual({
      idleSeconds: 3600,
      notes: [],
    });
  });

  it('неверное значение — умолчание и замечание', () => {
    for (const text of [
      '{"idleSeconds": -1}',
      '{"idleSeconds": 3601}',
      '{"idleSeconds": 1.5}',
      '{"idleSeconds": "60"}',
    ]) {
      const settings = parseServerJson(text);
      expect(settings.idleSeconds).toBeUndefined();
      expect(settings.notes).toHaveLength(1);
    }
    expect(parseServerJson('[]').notes).toHaveLength(1);
    expect(parseServerJson('nope').notes).toHaveLength(1);
  });
});

describe('подстановки ${VAR}', () => {
  it('переменные без умолчания — по порядку, без повторов', () => {
    const spec = remote({
      url: 'https://${HOST}/mcp?key=${KEY}',
      headers: { Authorization: 'Bearer ${KEY}', 'X-Region': '${REGION:-eu}' },
    });
    expect(variablesOf(spec)).toEqual(['HOST', 'KEY']);
  });

  it('значение, умолчание и недостающие', () => {
    expect(interpolate('a ${A} b ${B:-bee}', { A: '1' })).toEqual({ ok: true, text: 'a 1 b bee' });
    expect(interpolate('${A}${C}', {})).toEqual({ ok: false, missing: ['A', 'C'] });
    // Пустое значение — как отсутствующее: заголовок «Bearer » сервер принял бы за попытку входа.
    expect(interpolate('${A}', { A: '' })).toEqual({ ok: false, missing: ['A'] });
  });

  it('адрес и заголовки сервера — вместе', () => {
    const spec = remote({
      url: 'https://${HOST}/mcp',
      headers: { Authorization: 'Bearer ${KEY}' },
    });
    expect(resolveRemote(spec, { HOST: 'a.example', KEY: 'k' })).toEqual({
      ok: true,
      url: 'https://a.example/mcp',
      headers: { Authorization: 'Bearer k' },
    });
    expect(resolveRemote(spec, { HOST: 'a.example' })).toEqual({ ok: false, missing: ['KEY'] });
  });

  it('буквальный секрет в заголовке — предупреждение', () => {
    expect(
      literalSecretHeaders(
        remote({
          headers: {
            Authorization: 'Bearer abcdef123456',
            'X-Api-Key': '${KEY}',
            Accept: 'application/json',
          },
        })
      )
    ).toEqual(['Authorization']);
  });
});

describe('обнаружение серверов', () => {
  it('без проекта — пусто', async () => {
    const host = createFakeHost({
      '.mcp.json': '{"mcpServers": {"a": {"url": "https://a.example"}}}',
    });
    host.setRoot(null);
    expect(await discoverServers(host)).toEqual({ servers: [], problems: [] });
  });

  it('бандлы с server.json и без server.js, затем записи .mcp.json', async () => {
    const host = createFakeHost({
      '.ui_builder/mcp/reformer/server.js': 'self.x = 1;',
      '.ui_builder/mcp/reformer/server.json': '{"idleSeconds": 600}',
      '.ui_builder/mcp/draft/README.md': 'не собран',
      '.ui_builder/mcp/Bad Dir/server.js': 'x',
      '.mcp.json': JSON.stringify({
        mcpServers: { zeta: { url: 'https://z.example' }, alpha: { command: 'node' } },
      }),
    });
    const { servers, problems } = await discoverServers(host);
    expect(servers.map((spec) => [spec.name, spec.kind])).toEqual([
      ['draft', 'bundle'],
      ['reformer', 'bundle'],
      ['alpha', 'stdio'],
      ['zeta', 'http'],
    ]);
    expect(servers[0]).toMatchObject({ script: null });
    expect(servers[1]).toMatchObject({
      script: 'project/.ui_builder/mcp/reformer/server.js',
      idleSeconds: 600,
    });
    expect(problems).toEqual([]);
  });

  it('одно имя в обоих источниках — побеждает бандл, запись .mcp.json — в замечаниях', async () => {
    const host = createFakeHost({
      '.ui_builder/mcp/reformer/server.js': 'x',
      '.mcp.json': JSON.stringify({
        mcpServers: { reformer: { command: 'npx', args: ['@reformer/mcp'] } },
      }),
    });
    const { servers, problems } = await discoverServers(host);
    expect(servers.map((spec) => spec.kind)).toEqual(['bundle']);
    expect(problems).toEqual(['«reformer» из .mcp.json замещён сервером .ui_builder/mcp/reformer']);
  });
});
