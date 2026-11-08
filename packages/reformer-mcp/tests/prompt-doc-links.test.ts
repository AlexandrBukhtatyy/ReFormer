/**
 * Ссылки промптов на документацию открываются.
 *
 * Промпты (`src/prompts/**`) отправляют агента читать `reformer://docs/<пакет>/<раздел>`. Раздел
 * переименовали — ссылка молча умирает: агент получает «Unknown section», тратит вызов на поиск и
 * часто идёт дальше без рецепта. Так в шаблонах накопились ссылки на `formarrayhandle-api`,
 * `cycle-detection-prevention-checklist` и другие разделы, которых давно нет.
 *
 * Проверяется тем же каталогом ресурсов, который сервер вешает на `resources/read`, — без
 * подъёма сервера.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createResourceCatalog } from '../src/core/server/resource-catalog';
import { cliKnowledge } from '../src/platform/cli/knowledge';
import { listAvailablePackages } from '../src/utils/docs-parser';
import { precondition } from './support/preconditions';

const PROMPTS_DIR = resolve(__dirname, '../src/prompts');

/** `reformer://docs/<пакет>` или `reformer://docs/<пакет>/<раздел>`; многоточие — заглушка в тексте. */
const LINK = /reformer:\/\/docs\/[a-z-]+(?:\/[a-z0-9-]+)?/g;

const hasDocs = precondition(
  'документация пакетов',
  listAvailablePackages().length > 0,
  'npm run build в пакетах (нужны llms.txt и llms-index.json)'
);

function promptFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return promptFiles(path);
    return /\.(md|ts)$/.test(entry.name) ? [path] : [];
  });
}

describe('промпты — ссылки на документацию', () => {
  it.runIf(hasDocs)('каждая reformer://docs/… из промптов открывается', () => {
    const resources = createResourceCatalog(cliKnowledge);
    const broken: string[] = [];
    let checked = 0;

    for (const file of promptFiles(PROMPTS_DIR)) {
      const text = readFileSync(file, 'utf8');
      for (const uri of new Set(text.match(LINK) ?? [])) {
        checked += 1;
        try {
          resources.read(uri);
        } catch {
          broken.push(`${relative(PROMPTS_DIR, file)}: ${uri}`);
        }
      }
    }

    expect(checked).toBeGreaterThan(20);
    expect(broken, `не открываются:\n${broken.join('\n')}`).toEqual([]);
  });

  it.runIf(hasDocs)('каждая reformer://docs/… из рецептов docs/llms открывается', () => {
    // Рецепт ссылается на соседний раздел так же, как промпт, и переименование раздела убивает
    // ссылку так же молча.
    const packagesDir = resolve(__dirname, '../..');
    const resources = createResourceCatalog(cliKnowledge);
    const broken: string[] = [];
    let checked = 0;

    for (const dir of readdirSync(packagesDir)) {
      const llms = join(packagesDir, dir, 'docs/llms');
      if (!existsSync(llms)) continue;
      for (const file of readdirSync(llms).filter((f) => f.endsWith('.md'))) {
        const text = readFileSync(join(llms, file), 'utf8');
        for (const uri of new Set(text.match(LINK) ?? [])) {
          checked += 1;
          try {
            resources.read(uri);
          } catch {
            broken.push(`${dir}/docs/llms/${file}: ${uri}`);
          }
        }
      }
    }

    expect(checked).toBeGreaterThan(10);
    expect(broken, `не открываются:\n${broken.join('\n')}`).toEqual([]);
  });
});
