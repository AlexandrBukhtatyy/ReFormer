import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';

const __dirname = dirname(fileURLToPath(import.meta.url));

Handlebars.registerHelper('raw', function (this: unknown, options: Handlebars.HelperOptions) {
  return options.fn(this);
});

const rawCache = new Map<string, string>();
const compiledCache = new Map<string, Handlebars.TemplateDelegate>();

function getTemplatePaths(name: string): string[] {
  return [
    // Runtime: dist/utils/ -> dist/prompts/templates/
    resolve(__dirname, '../prompts/templates', `${name}.md`),
    // Monorepo dev (tsc --watch): dist/utils/ -> src/prompts/templates/
    resolve(__dirname, '../../src/prompts/templates', `${name}.md`),
    // CWD fallback (running from repo root)
    resolve(process.cwd(), 'packages/reformer-mcp/src/prompts/templates', `${name}.md`),
  ];
}

function loadRaw(name: string): string {
  const cached = rawCache.get(name);
  if (cached !== undefined) return cached;
  const candidates = getTemplatePaths(name);
  for (const p of candidates) {
    if (existsSync(p)) {
      const text = readFileSync(p, 'utf-8');
      rawCache.set(name, text);
      return text;
    }
  }
  throw new Error(
    `Prompt template "${name}.md" not found. Tried:\n${candidates.map((c) => `  - ${c}`).join('\n')}`
  );
}

function loadCompiled(name: string): Handlebars.TemplateDelegate {
  const cached = compiledCache.get(name);
  if (cached) return cached;
  const raw = loadRaw(name);
  try {
    const compiled = Handlebars.compile(raw, { noEscape: true, strict: true });
    compiledCache.set(name, compiled);
    return compiled;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to compile prompt template "${name}": ${msg}`);
  }
}

const RAW_BLOCK_RE = /\{\{\{\{raw\}\}\}\}[\s\S]*?\{\{\{\{\/raw\}\}\}\}/g;

/**
 * Every mustache in the template, with its optional escaping backslash.
 *
 * Must match what Handlebars itself lexes, not just well-formed variables — the old
 * `/\{\{\{?\s*([\w.]+)\s*\}?\}\}/` only matched identifier paths, so JSX double braces
 * (`settings={{ fieldWrapper: FormField }}`) slipped past the pre-flight check and blew up
 * later inside Handlebars with `strict: true` as `"fieldWrapper:" not defined`. That shipped:
 * `start-here` — the documented entry point of this server — and `to-renderer` returned
 * JSON-RPC -32603 to every client. Group 1 = escaping backslash, group 2 = inner text.
 */
const MUSTACHE_RE = /(\\?)\{\{\{?([^{}]*?)\}?\}\}/g;

/** A bare Handlebars path (`foo`, `foo.bar`) — the only form these templates use. */
const PATH_RE = /^[\w.$]+$/;

interface TemplateScan {
  /** Top-level variable names the template requires. */
  names: Set<string>;
  /** Unescaped mustaches Handlebars would parse as an expression but that name no variable. */
  invalid: string[];
}

/**
 * Classify every mustache: required variable, block/comment (passed through to Handlebars),
 * escaped (`\{{…}}` — emitted literally, used for JSX braces in code samples), or invalid.
 */
function scanTemplate(template: string): TemplateScan {
  const stripped = template.replace(RAW_BLOCK_RE, '');
  const names = new Set<string>();
  const invalid: string[] = [];
  let m: RegExpExecArray | null;
  MUSTACHE_RE.lastIndex = 0;
  while ((m = MUSTACHE_RE.exec(stripped)) !== null) {
    const escaped = m[1] !== '';
    const inner = m[2].trim();
    if (escaped || !inner) continue;
    // Block helpers, partials and comments are Handlebars' business, not ours.
    if (/^[#/^!>]/.test(inner)) continue;
    if (!PATH_RE.test(inner)) {
      invalid.push(inner);
      continue;
    }
    const top = inner.split('.')[0];
    if (top.startsWith('@') || top === 'this' || top === 'else') continue;
    names.add(top);
  }
  return { names, invalid };
}

export function renderPromptTemplate(name: string, vars: Record<string, unknown>): string {
  const raw = loadRaw(name);
  const { names: required, invalid } = scanTemplate(raw);
  if (invalid.length > 0) {
    throw new Error(
      `Prompt template "${name}.md" has ${invalid.length} unescaped mustache(s) that Handlebars ` +
        `parses as an expression but that name no variable: ${invalid.map((s) => `{{${s}}}`).join(', ')}. ` +
        `Usually this is JSX/TS code in prose — escape the opening brace as \\{{ so it renders ` +
        `literally, or wrap the block in {{{{raw}}}} … {{{{/raw}}}}.`
    );
  }
  const missing: string[] = [];
  for (const v of required) {
    if (!(v in vars)) missing.push(v);
  }
  if (missing.length > 0) {
    throw new Error(
      `Prompt template "${name}.md" missing variables: ${missing.join(', ')}. Provided: ${Object.keys(vars).join(', ') || '(none)'}`
    );
  }
  const compiled = loadCompiled(name);
  try {
    return compiled(vars);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to render prompt template "${name}": ${msg}`);
  }
}
