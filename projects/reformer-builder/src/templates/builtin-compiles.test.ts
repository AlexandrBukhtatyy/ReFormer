/**
 * Встроенные шаблоны — не текст, а рабочий код: генерируем каждый шаблон целиком во временную
 * папку внутри репозитория и прогоняем tsc с реальными типами @reformer/*. Проверки на вхождение
 * подстрок не отличают валидный TypeScript от мусора — этот тест отличает.
 */
import { describe, expect, it } from 'vitest';
import { builtinTemplates } from './builtin';
import { materializeFiles } from './generate';

/** Заглушка vite-типов: шаблоны читают `import.meta.env.DEV`, vite/client в песочнице нет. */
const IMPORT_META_ENV_DTS = `interface ImportMetaEnv { readonly DEV: boolean }
interface ImportMeta { readonly env: ImportMetaEnv }
`;

describe.each(builtinTemplates().map((t) => [t.name, t] as const))(
  'встроенный шаблон «%s»',
  (_name, template) => {
    it('генерируется в компилируемый TypeScript', async () => {
      const { mkdtempSync, writeFileSync, rmSync, mkdirSync } = await import('node:fs');
      const { join, dirname } = await import('node:path');
      const ts = (await import('typescript')).default;

      // Песочница ВНУТРИ репозитория: снаружи @reformer/* не резолвятся и tsc сыплет ложными
      // ошибками вместо настоящих.
      mkdirSync(join(process.cwd(), '.tmp'), { recursive: true });
      const dir = mkdtempSync(join(process.cwd(), '.tmp', 'builtin-template-'));
      try {
        const files = materializeFiles(
          template,
          template.files.map((f) => f.path),
          'user-profile'
        );
        for (const f of files) {
          const target = join(dir, f.path);
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, f.content);
        }
        writeFileSync(join(dir, 'env.d.ts'), IMPORT_META_ENV_DTS);

        const entries = files
          .filter((f) => f.path.endsWith('.ts') || f.path.endsWith('.tsx'))
          .map((f) => join(dir, f.path));
        const program = ts.createProgram([...entries, join(dir, 'env.d.ts')], {
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          esModuleInterop: true,
          resolveJsonModule: true,
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          target: ts.ScriptTarget.ES2022,
          baseUrl: process.cwd(),
        });

        const sandbox = dir.replace(/\\/g, '/');
        const errors = ts
          .getPreEmitDiagnostics(program)
          .filter((d) => d.file?.fileName.replace(/\\/g, '/').startsWith(sandbox))
          .map(
            (d) =>
              `${d.file?.fileName.replace(/\\/g, '/').slice(sandbox.length + 1)} TS${d.code}: ` +
              ts.flattenDiagnosticMessageText(d.messageText, ' ')
          );

        expect(errors).toEqual([]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }, 60_000);
  }
);
