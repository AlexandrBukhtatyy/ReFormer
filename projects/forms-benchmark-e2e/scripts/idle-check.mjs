#!/usr/bin/env node
/**
 * Проверка машины перед долгим прогоном бенча: несколько секунд выборки процессов (и GPU на macOS),
 * затем вердикт — свободна или занята и чем. Тот же классификатор и пороги, что пишутся в каждый
 * прогон (lib/background.ts).
 *
 *   npm run bench:idle-check [-- --seconds 5]
 *
 * Код выхода: 0 — свободна, 1 — занята (можно склеить: `npm run bench:idle-check && npm run bench`),
 * 0 и пометка «недоступно» — на платформе без `ps` (Windows).
 */
import { BACKGROUND_THRESHOLDS, describeSample, sampleFor } from '../lib/background.ts';

const i = process.argv.indexOf('--seconds');
const seconds = i === -1 ? 3 : Number(process.argv[i + 1]) || 3;

console.log(`выборка ${seconds} с…`);
const sample = await sampleFor(seconds * 1000, process.pid);
for (const line of describeSample(sample)) console.log(line);
if (sample) {
  const t = BACKGROUND_THRESHOLDS;
  console.log(
    `пороги: Ollama и чужие автоматизированные браузеры ≥ ${t.ollamaPct} % ядра; инструменты Node, ` +
      `десктопные браузеры, Docker/VM ≥ ${t.toolingPct} %; прочий процесс ≥ ${t.otherPct} %; ` +
      `GPU ≥ ${t.gpuPct} %; чужая нагрузка в сумме ≥ ${t.foreignCores} ядра`
  );
  console.log(
    sample.dirty
      ? 'вердикт: ЗАНЯТА — замеры будут шумными; остановите соседей или запускайте с пониманием, что отчёт пометит прогон'
      : 'вердикт: свободна — можно запускать'
  );
}
process.exit(sample?.dirty ? 1 : 0);
