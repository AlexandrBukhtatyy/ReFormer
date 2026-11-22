/**
 * Общие пути пайплайна диаграмм.
 *
 * Все шаги считают пути от корня репозитория (а не от cwd), поэтому запускать
 * их можно из любого каталога. Промежуточные артефакты живут в .tmp/code-viz/
 * — каталог в .gitignore, в репозиторий попадают только сами скрипты.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Каталог промежуточных артефактов (gitignored). */
export const VIZ_DIR = path.join(ROOT, '.tmp', 'code-viz');

/** Структура пакетов: каталоги → файлы → символы (шаг 1). */
export const CODE_STRUCTURE = path.join(VIZ_DIR, 'code-structure.json');

/** Реальные вызовы методов и функций через type checker (шаг 2). */
export const CALLS = path.join(VIZ_DIR, 'calls.json');

/** Готовая модель диаграммы (шаг 3) — вход для gen-excalidraw. */
export const CODE_MODEL = path.join(VIZ_DIR, 'code-model.json');

/** Куда писать .excalidraw.md, если путь не задан явно. */
export const DEFAULT_OUT = path.join(VIZ_DIR, 'Reformer-all.excalidraw.md');

/**
 * Итоговый путь диаграммы: аргумент CLI → REFORMER_DIAGRAM_OUT → .tmp/code-viz/.
 *
 * Obsidian-vault у каждого свой, поэтому в репозитории его пути нет: задайте
 * REFORMER_DIAGRAM_OUT (например, в .env или settings.json), чтобы команда
 * писала прямо в vault.
 */
export function resolveOut(argvPath) {
  return argvPath || process.env.REFORMER_DIAGRAM_OUT || DEFAULT_OUT;
}

/** Создаёт .tmp/code-viz/, если его ещё нет. */
export function ensureVizDir() {
  fs.mkdirSync(VIZ_DIR, { recursive: true });
}
