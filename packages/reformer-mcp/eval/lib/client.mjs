/**
 * Долгоживущий stdio-клиент MCP для eval.
 *
 * Отличие от scripts/mcp-call.mjs: тот поднимает сервер на КАЖДЫЙ вызов (удобно для ручной
 * отладки, но для 46 задач это 46 холодных стартов — измеряли бы стоимость запуска процесса,
 * а не работу сервера). Здесь один процесс на весь прогон — как в реальной сессии клиента.
 *
 * Считает то, за что платит агент: символы ответа (и производные токены), число вызовов,
 * latency. Токены оцениваем как chars/4 — грубо, но стабильно и сравнимо между прогонами;
 * точный токенайзер тут не нужен, важна ДЕЛЬТА между версиями сервера.
 */

import { spawn } from 'node:child_process';

/** Грубая оценка токенов. Одинаковая для baseline и для сравнения — важна сопоставимость. */
export function estimateTokens(text) {
  return Math.round(String(text).length / 4);
}

export class McpClient {
  #child;
  #buf = '';
  #pending = new Map();
  #nextId = 1;

  /** Накопленная статистика вызовов за прогон. */
  stats = { calls: 0, chars: 0, ms: 0 };

  constructor(serverPath, { env = {} } = {}) {
    this.#child = spawn(process.execPath, [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    });
    // stderr сервера — его логи; в stdout только JSON-RPC.
    this.#child.stderr.on('data', () => {});
    this.#child.stdout.on('data', (chunk) => this.#onData(chunk));
    this.#child.on('exit', (code) => {
      for (const { reject } of this.#pending.values()) {
        reject(new Error(`MCP server exited with code ${code}`));
      }
      this.#pending.clear();
    });
  }

  #onData(chunk) {
    this.#buf += chunk.toString('utf8');
    let nl;
    while ((nl = this.#buf.indexOf('\n')) >= 0) {
      const line = this.#buf.slice(0, nl).trim();
      this.#buf = this.#buf.slice(nl + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue; // не-JSON строка — лог сервера
      }
      if (msg.id == null) continue;
      const p = this.#pending.get(msg.id);
      if (!p) continue;
      this.#pending.delete(msg.id);
      p.resolve(msg);
    }
  }

  #send(method, params, timeoutMs) {
    const id = this.#nextId++;
    const req = { jsonrpc: '2.0', id, method, params };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`timeout: ${method} (${timeoutMs}ms)`));
      }, timeoutMs);
      this.#pending.set(id, {
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      this.#child.stdin.write(JSON.stringify(req) + '\n');
    });
  }

  /** Инициализация + handshake. Возвращает время до готовности сервера (мс). */
  async initialize() {
    const t0 = performance.now();
    const reply = await this.#send(
      'initialize',
      {
        protocolVersion: '2024-11-05',
        // Не объявляем sampling: eval должен мерить ДЕТЕРМИНИРОВАННЫЙ путь сервера,
        // а не уводить его в запросы к модели (их в CI всё равно некому обслужить).
        capabilities: {},
        clientInfo: { name: 'reformer-mcp-eval', version: '1.0.0' },
      },
      15000
    );
    if (reply.error) throw new Error(`initialize failed: ${JSON.stringify(reply.error)}`);
    this.#child.stdin.write(
      JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n'
    );
    return { ms: performance.now() - t0, serverInfo: reply.result?.serverInfo ?? null };
  }

  /**
   * Сырой вызов метода. Ошибка JSON-RPC не бросается, а возвращается — eval должен
   * измерять и неудачные обращения, а не падать на них.
   */
  async request(method, params = {}, timeoutMs = 60000) {
    const t0 = performance.now();
    const reply = await this.#send(method, params, timeoutMs);
    const ms = performance.now() - t0;
    const raw = JSON.stringify(reply.result ?? reply.error ?? null);
    this.stats.calls++;
    this.stats.chars += raw.length;
    this.stats.ms += ms;
    return { result: reply.result ?? null, error: reply.error ?? null, ms, chars: raw.length };
  }

  /** `tools/call`, с текстом ответа, склеенным в строку. */
  async callTool(name, args, timeoutMs = 60000) {
    const r = await this.request('tools/call', { name, arguments: args }, timeoutMs);
    const text = (r.result?.content ?? [])
      .map((c) => (typeof c.text === 'string' ? c.text : ''))
      .join('\n');
    return { ...r, text };
  }

  async readResource(uri, timeoutMs = 60000) {
    const r = await this.request('resources/read', { uri }, timeoutMs);
    const text = (r.result?.contents ?? [])
      .map((c) => (typeof c.text === 'string' ? c.text : ''))
      .join('\n');
    return { ...r, text };
  }

  close() {
    try {
      this.#child.kill();
    } catch {
      // процесс уже мёртв
    }
  }
}
