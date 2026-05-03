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
const VAR_RE = /\{\{\{?\s*([\w.]+)\s*\}?\}\}/g;

function collectVarNames(template: string): Set<string> {
  const stripped = template.replace(RAW_BLOCK_RE, '');
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  VAR_RE.lastIndex = 0;
  while ((m = VAR_RE.exec(stripped)) !== null) {
    const top = m[1].split('.')[0];
    if (top.startsWith('@') || top === 'this' || top === 'else') continue;
    names.add(top);
  }
  return names;
}

export function renderPromptTemplate(name: string, vars: Record<string, unknown>): string {
  const raw = loadRaw(name);
  const required = collectVarNames(raw);
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

export function clearPromptTemplateCache(): void {
  rawCache.clear();
  compiledCache.clear();
}
