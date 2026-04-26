#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
if (argv.length === 0) {
  process.stderr.write(
    [
      'Usage:',
      '  node scripts/mcp-call.mjs <method> [<json-args> | -]',
      '',
      'Examples:',
      '  node scripts/mcp-call.mjs tools/list',
      '  node scripts/mcp-call.mjs prompts/list',
      '  node scripts/mcp-call.mjs tools/call \'{"name":"find_recipe","arguments":{"topic":"copyFrom"}}\'',
      '  node scripts/mcp-call.mjs prompts/get \'{"name":"create-form","arguments":{"description":"...","target":"core"}}\'',
      '  node scripts/mcp-call.mjs resources/read \'{"uri":"reformer://docs/cdk"}\'',
      '  cat args.json | node scripts/mcp-call.mjs prompts/get -',
      '',
    ].join('\n')
  );
  process.exit(2);
}

const method = argv[0];
let paramsRaw = argv.slice(1).join(' ').trim();
if (paramsRaw === '-') paramsRaw = readFileSync(0, 'utf8').trim();
const params = paramsRaw ? JSON.parse(paramsRaw) : {};

const SERVER_PATH = 'packages/reformer-mcp/dist/index.js';
const child = spawn(process.execPath, [SERVER_PATH], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: { ...process.env },
});

let buf = '';
const responses = new Map();

child.stdout.on('data', (chunk) => {
  buf += chunk.toString('utf8');
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id != null) responses.set(msg.id, msg);
    } catch {
      // Non-JSON line — server log; ignore.
    }
  }
});

function send(req) {
  child.stdin.write(JSON.stringify(req) + '\n');
}

function waitFor(id, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const r = responses.get(id);
      if (r) return resolve(r);
      if (Date.now() - start > timeoutMs) return reject(new Error(`timeout waiting for id=${id}`));
      setTimeout(tick, 25);
    };
    tick();
  });
}

(async () => {
  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'mcp-call.mjs', version: '0.1.0' },
    },
  });
  await waitFor(1, 5000);
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method, params });
  const reply = await waitFor(2, 60000);
  if (reply.error) {
    process.stderr.write('JSON-RPC error: ' + JSON.stringify(reply.error, null, 2) + '\n');
    child.kill();
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(reply.result, null, 2));
  child.kill();
})().catch((err) => {
  process.stderr.write('Helper failed: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  try {
    child.kill();
  } catch {}
  process.exit(1);
});
