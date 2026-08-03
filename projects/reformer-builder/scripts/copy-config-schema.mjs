#!/usr/bin/env node
/**
 * Копирует authored-схему runtime-конфига из src/ в корень пакета для публикации: клиенты ссылаются
 * на неё в `$schema` (`./node_modules/@reformer/builder/runtime-config.schema.json`). Единый источник
 * истины — `src/config/runtime-config.schema.json` (её же импортит `src/config/load.ts`). Рутовая
 * копия — build-артефакт (в .gitignore), пересоздаётся на `build`/`prepack`.
 */

import { copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
await copyFile(
  join(root, 'src/config/runtime-config.schema.json'),
  join(root, 'runtime-config.schema.json')
);
