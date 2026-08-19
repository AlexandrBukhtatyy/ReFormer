import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listKits } from './registry';

/**
 * Страж связки «словарь кита ↔ CSS в бандле».
 *
 * Tailwind генерирует утилиту, только если увидел её имя при сканировании ИСХОДНИКОВ, а `className`
 * формы живёт в JSON-схеме пользователя. Поэтому словарь подсказок разворачивается в safelist
 * (`scripts/gen-kit-safelist.mjs` → `src/kit-safelist.gen.css`), и разъехаться им нельзя: подсказка
 * без правила в CSS — это класс, который в превью молча не действует.
 *
 * Проверяем сам АРТЕФАКТ, а не внутренности генератора: тест читает готовый CSS и сверяет его с
 * каталогами китов, которые вшивает реестр.
 */
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const safelistPath = join(root, 'src', 'kit-safelist.gen.css');

/** Классы, объявленные в сгенерированном файле. */
function safelistedClasses(css: string): Set<string> {
  return new Set([...css.matchAll(/@source inline\("(.+?)"\);/g)].map((m) => m[1]));
}

describe('kit-safelist.gen.css', () => {
  it('файл на диске не устарел', () => {
    const check = spawnSync('node', ['scripts/gen-kit-safelist.mjs', '--check'], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(check.stderr + check.stdout).toContain('kit-safelist.gen.css');
    expect(check.status, 'устарел — запусти `npm run generate:kit-safelist`').toBe(0);
  });

  it('покрывает словари ВСЕХ китов реестра, а не только кита по умолчанию', () => {
    const safelisted = safelistedClasses(readFileSync(safelistPath, 'utf8'));
    for (const kit of listKits()) {
      for (const group of kit.catalog.kit?.styles?.classNames ?? []) {
        for (const cls of group.classes) {
          expect(safelisted, `${kit.id}/${group.id}: ${cls}`).toContain(cls);
        }
      }
    }
  });

  it('брейкпоинт-варианты словаря попадают в safelist', () => {
    // Тот самый случай, ради которого safelist и заведён: `md:grid-cols-2` не встречается ни в
    // коде билдера, ни в коде кита — без директивы правила в бандле не будет.
    const safelisted = safelistedClasses(readFileSync(safelistPath, 'utf8'));
    for (const cls of ['sm:grid-cols-2', 'md:grid-cols-2', 'lg:grid-cols-4', 'md:col-span-full']) {
      expect(safelisted, cls).toContain(cls);
    }
  });

  it('index.css подключает сгенерированный файл', () => {
    // Без импорта safelist не участвует в сборке, а проверки выше остались бы зелёными.
    const indexCss = readFileSync(join(root, 'src', 'index.css'), 'utf8');
    expect(indexCss).toContain("@import './kit-safelist.gen.css';");
  });
});
