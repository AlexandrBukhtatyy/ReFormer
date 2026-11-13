/**
 * Объявление API сервера для Code Mode: инструменты `tools/list` → TypeScript.
 *
 * Метод — из статьи Cloudflare «Code Mode» (blog.cloudflare.com/code-mode): схема каждого
 * инструмента превращается в типизированную функцию с doc-комментарием, и модель пишет код против
 * этого API вместо того, чтобы вызывать инструменты по одному. Объявление строится из ТЕХ ЖЕ
 * определений, что отдаёт `tools/list` обычного режима: описания инструментов и параметров
 * переносятся дословно. Поэтому замер «обычный режим против Code Mode» сравнивает форму подачи, а не
 * объём знания — у модели та же информация.
 *
 * Имя функции — имя инструмента в camelCase (`form_build` → `formBuild`), аргумент — объект по
 * `inputSchema`, результат — текст ответа инструмента (`Promise<string>`).
 *
 * @module reformer-mcp/core/codemode/declaration
 */

import type { ToolDefinition } from '../server/tool-catalog.js';

/** Имя функции API для инструмента: `form_build` → `formBuild`. */
export function functionName(toolName: string): string {
  return toolName.replace(/_([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
}

type JsonSchema = Record<string, unknown>;

const asSchema = (value: unknown): JsonSchema =>
  value !== null && typeof value === 'object' ? (value as JsonSchema) : {};

/** Однострочный doc-комментарий; `*\/` внутри текста экранируется. */
function docLine(text: string, indent: string): string {
  return `${indent}/** ${text.replace(/\*\//g, '*\\/').replace(/\s+/g, ' ').trim()} */\n`;
}

/** Многострочный doc-комментарий для описания инструмента. */
function docBlock(text: string, indent: string): string {
  const lines = text.replace(/\*\//g, '*\\/').split('\n');
  return `${indent}/**\n${lines.map((line) => `${indent} * ${line}`.trimEnd()).join('\n')}\n${indent} */\n`;
}

/** Тип TypeScript по JSON Schema — то подмножество, которое встречается в инструментах сервера. */
function typeOf(schemaValue: unknown, indent: string): string {
  const schema = asSchema(schemaValue);
  const variants = (schema.anyOf ?? schema.oneOf) as unknown[] | undefined;
  if (Array.isArray(variants)) {
    return [...new Set(variants.map((variant) => typeOf(variant, indent)))].join(' | ');
  }
  if (Array.isArray(schema.enum)) {
    return schema.enum.map((value) => JSON.stringify(value)).join(' | ');
  }
  const type = schema.type;
  if (Array.isArray(type)) {
    return type.map((one) => typeOf({ ...schema, type: one }, indent)).join(' | ');
  }
  switch (type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'array': {
      const item = typeOf(schema.items, indent);
      return /[|&]/.test(item) ? `Array<${item}>` : `${item}[]`;
    }
    case 'object':
      return objectType(schema, indent);
    default:
      return 'unknown';
  }
}

/** Объект с полями — построчно, с описанием каждого поля. */
function objectType(schema: JsonSchema, indent: string): string {
  const properties = asSchema(schema.properties);
  const names = Object.keys(properties);
  if (names.length === 0) return 'Record<string, unknown>';
  const required = new Set(Array.isArray(schema.required) ? (schema.required as string[]) : []);
  const inner = `${indent}  `;
  const fields = names.map((name) => {
    const property = asSchema(properties[name]);
    const doc =
      typeof property.description === 'string' ? docLine(property.description, inner) : '';
    const key = /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
    return `${doc}${inner}${key}${required.has(name) ? '' : '?'}: ${typeOf(property, inner)};\n`;
  });
  return `{\n${fields.join('')}${indent}}`;
}

/** Объявление одной функции API. */
function functionDeclaration(tool: ToolDefinition, indent: string): string {
  const schema = asSchema(tool.inputSchema);
  const required = Array.isArray(schema.required) && schema.required.length > 0;
  const args = objectType(schema, indent);
  const parameter =
    args === 'Record<string, unknown>' ? 'args?: {}' : `args${required ? '' : '?'}: ${args}`;
  return `${docBlock(tool.description, indent)}${indent}${functionName(tool.name)}(${parameter}): Promise<string>;\n`;
}

/**
 * Объявление глобального `reformer` для модели: по функции на инструмент, в порядке `tools/list`.
 */
export function apiDeclaration(tools: readonly ToolDefinition[]): string {
  return `declare const reformer: {\n${tools.map((tool) => functionDeclaration(tool, '  ')).join('\n')}};`;
}
