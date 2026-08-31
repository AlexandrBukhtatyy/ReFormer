/**
 * Фикстура формы — авторский артефакт, которым её наполняют в предпросмотре.
 *
 * Чистая предметная часть: формат, слияние слоёв, адреса файлов, печать скелета и построение
 * подменяемого окружения. Ни рабочей области, ни OPFS, ни React здесь нет — читает и исполняет
 * фикстуру плагин превью, пишет её кодоген, а знание «что такое фикстура» одно на всех.
 *
 * Это тот же довод, по которому в `lib/` уже живёт `form-mock`: разъехавшиеся копии дали бы
 * превью и генератору РАЗНЫЕ формы, и заметить это можно было бы только сравнив две программы
 * вручную.
 *
 * @module reformer-builder/lib/form-fixture
 */

export {
  createAmbient,
  createFixedDate,
  createFixedMath,
  createFixtureFetch,
  resolveNow,
  ruleMatches,
  unmatchedRequestMessage,
} from './ambient';
export { deepMerge, mergeFormData, type MergedData } from './merge';
export { emitFixture, type FixtureSeed } from './emit';
export {
  FIXTURE_FILE,
  fixtureDirOf,
  fixturePathOf,
  isFixturePath,
  joinFixtureDir,
  normalizeResourcePath,
} from './paths';
export {
  FIXTURE_EXPORT,
  type FixtureClock,
  type FixtureHttpResponse,
  type FixtureHttpRule,
  type FixtureModel,
  type FormFixture,
} from './types';
