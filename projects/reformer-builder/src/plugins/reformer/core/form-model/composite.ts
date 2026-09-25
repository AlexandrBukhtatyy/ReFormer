/**
 * Схема визарда, разбитая по шагам: сборка частей в одну модель и обратное разбиение.
 *
 * ```text
 * form.schema.json                       steps/kontakty/form.schema.json
 * { "root": { … "componentProps": {       { "$schema": "../../form-step.schema.json",
 *     "steps": [                            "node": { "component": "$component(Step)", … } }
 *       { "$ref": "./steps/kontakty/form.schema.json" } ] } } }
 * ```
 *
 * Редактор, превью, кодоген и ассистент работают с СОБРАННОЙ схемой — обычной
 * `JsonFormSchema`, где шаги лежат узлами. Какие шаги пришли из файлов, помнит карта
 * {@link StepOrigins} (`$nodeId` шага → файл): по ней разбиение кладёт каждый шаг обратно в его
 * файл, даже если заголовок шага переименовали.
 *
 * Обратимость — требование: `splitFormSchema(joinFormSchema(скелет, части))` даёт те же скелет
 * и части, поэтому открыть и сохранить разбитую форму без правок — ноль изменений в файлах.
 *
 * Ссылки разрешаются только в корневой схеме: файл шага ссылок не держит.
 *
 * @module plugins/reformer/core/form-model/composite
 */

import {
  isJsonStepRef,
  normalizeStepRef,
  type JsonFormSchema,
  type JsonFormStep,
  type JsonNode,
} from '@reformer/renderer-json';
import { isNodeLike } from './node-kind';
import { ensureNodeIds, type NodeIdFactory } from './node-id';
import { stepDirName, uniqueStepDir } from './step-dir';

/** Папка файлов шагов от корня формы. */
export const STEP_PARTS_DIR = 'steps';

/** Имя файла схемы шага внутри папки шага. */
export const STEP_SCHEMA_FILE = 'form.schema.json';

/** `$schema` нового файла шага: мета-схема шага лежит рядом с мета-схемой формы. */
export const STEP_SCHEMA_MARKER = '../../form-step.schema.json';

/** Откуда пришёл шаг собранной схемы. */
export interface StepOrigin {
  /** Спецификатор из `$ref` корня — как записан (`./steps/kontakty/form.schema.json`). */
  readonly ref: string;
  /** `$schema` файла шага; нет — в файле его не было. */
  readonly $schema?: string;
}

/** `$nodeId` шага → его файл. */
export type StepOrigins = ReadonlyMap<string, StepOrigin>;

/** Результат {@link joinFormSchema}. */
export interface JoinedFormSchema {
  readonly schema: JsonFormSchema;
  readonly origins: StepOrigins;
}

/** Результат {@link splitFormSchema}. */
export interface SplitFormSchema {
  /** Корневая схема со ссылками на месте вынесенных шагов. */
  readonly skeleton: JsonFormSchema;
  /** Файлы шагов по спецификатору `$ref` (как в скелете). */
  readonly parts: ReadonlyMap<string, JsonFormStep>;
  /** Карта происхождения после разбиения — с файлами, выданными новым шагам. */
  readonly origins: StepOrigins;
}

type Path = readonly (string | number)[];

/**
 * Похоже ли значение на файл шага: объект с узлом в `node` и БЕЗ `root`.
 *
 * `root` отсекается явно: файл с обоими ключами — форма, а не шаг.
 */
export function isFormStepSchema(value: unknown): value is JsonFormStep {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return !('root' in record) && isNodeLike(record.node);
}

/** Спецификатор файла шага для папки: `./steps/<dir>/form.schema.json`. */
export function stepRefFor(dir: string): string {
  return `./${STEP_PARTS_DIR}/${dir}/${STEP_SCHEMA_FILE}`;
}

/**
 * Папка шага по спецификатору — если файл лежит по канону `steps/<dir>/form.schema.json`.
 *
 * @returns Имя папки либо `null`, если файл лежит где-то ещё.
 */
export function stepDirOfRef(ref: string): string | null {
  const match = /^steps\/([^/]+)\/form\.schema\.json$/.exec(normalizeStepRef(ref));
  return match === null ? null : match[1];
}

/**
 * Ссылки шагов ПЕРВОГО визарда скелета по позициям: у вынесенного шага — спецификатор, у
 * инлайн-шага — `null`. Первый визард — тот же, что берёт раскладка модуля кодогена.
 */
export function firstWizardStepRefs(skeleton: JsonFormSchema): readonly (string | null)[] {
  const path = firstStepsPath(skeleton.root, ['root']);
  if (path === null) return [];
  const steps = valueAt(skeleton, path);
  if (!Array.isArray(steps)) return [];
  return steps.map((step) => (isJsonStepRef(step) ? step.$ref : null));
}

/**
 * Все ссылки на файлы шагов в схеме, в порядке обхода.
 *
 * Нужны до сборки: по ним читаются файлы частей.
 */
export function stepRefsOf(schema: JsonFormSchema): readonly string[] {
  const refs: string[] = [];
  forEachStepsArray(schema.root, ['root'], (steps) => {
    for (const step of steps) if (isJsonStepRef(step)) refs.push(step.$ref);
  });
  return refs;
}

/**
 * Собирает форму из корневой схемы и файлов шагов.
 *
 * Идентификаторы узлов выдаются по СОБРАННОЙ схеме: двойники между файлами разводятся так же,
 * как внутри одного.
 *
 * @param skeleton - Корневая схема со ссылками.
 * @param parts - Разобранные файлы шагов по спецификатору (с `./` или без).
 * @param next - Генератор идентификаторов (тесты).
 * @throws Error если файла для ссылки нет или он не похож на шаг.
 */
export function joinFormSchema(
  skeleton: JsonFormSchema,
  parts: ReadonlyMap<string, unknown>,
  next?: NodeIdFactory
): JoinedFormSchema {
  const byRef = new Map<string, unknown>();
  for (const [ref, part] of parts) byRef.set(normalizeStepRef(ref), part);

  const placed: { path: Path; origin: StepOrigin }[] = [];
  const root = mapStepsArrays(skeleton.root, ['root'], (steps, path) =>
    steps.map((step, index) => {
      if (!isJsonStepRef(step)) return step;
      const part = byRef.get(normalizeStepRef(step.$ref));
      if (part === undefined) {
        throw new Error(`файла шага "${step.$ref}" нет среди частей формы`);
      }
      if (!isFormStepSchema(part)) {
        throw new Error(`файл "${step.$ref}" не похож на шаг: нужен объект с узлом в "node"`);
      }
      const $schema = typeof part.$schema === 'string' ? part.$schema : undefined;
      placed.push({
        path: [...path, index],
        origin: $schema === undefined ? { ref: step.$ref } : { ref: step.$ref, $schema },
      });
      return part.node;
    })
  );

  const composed = root === skeleton.root ? skeleton : { ...skeleton, root: root as JsonNode };
  const schema = ensureNodeIds(composed, next);
  const origins = new Map<string, StepOrigin>();
  for (const { path, origin } of placed) {
    const id = (valueAt(schema, path) as { $nodeId?: unknown } | undefined)?.$nodeId;
    if (typeof id === 'string') origins.set(id, origin);
  }
  return { schema, origins };
}

/** Опции {@link splitFormSchema}. */
export interface SplitOptions {
  /**
   * Вынести в файлы ВСЕ шаги первого визарда — команда «Разбить по шагам». Без неё выносятся
   * шаги только тех визардов, где уже есть вынесенный шаг: форма остаётся той структуры,
   * какой её сделали.
   */
  readonly all?: boolean;
}

/**
 * Раскладывает собранную схему обратно по файлам.
 *
 * Шаг с известным происхождением уходит в свой файл. Новый шаг визарда, у которого шаги уже
 * вынесены, получает файл `./steps/<kebab(заголовка)>/form.schema.json` — «новый шаг сразу в своём
 * файле». Пустые `origins` без `all` — схема не разбивается вовсе: так «Собрать в один файл».
 */
export function splitFormSchema(
  schema: JsonFormSchema,
  origins: StepOrigins,
  options: SplitOptions = {}
): SplitFormSchema {
  const firstHost = options.all === true ? firstStepsPath(schema.root, ['root']) : null;
  const taken = new Set<string>();
  for (const origin of origins.values()) {
    const dir = stepDirOfRef(origin.ref);
    if (dir !== null) taken.add(dir);
  }

  const parts = new Map<string, JsonFormStep>();
  const nextOrigins = new Map<string, StepOrigin>();
  const root = mapStepsArrays(schema.root, ['root'], (steps, path) => {
    const split =
      (firstHost !== null && samePath(path, firstHost)) ||
      steps.some((step) => origins.has(nodeIdOf(step) ?? ''));
    if (!split) return steps;
    return steps.map((step, index) => {
      if (!isNodeLike(step)) return step;
      const id = nodeIdOf(step);
      let origin = id === null ? undefined : origins.get(id);
      if (origin === undefined) {
        const raw = step as { selector?: unknown; componentProps?: { title?: unknown } };
        const selector =
          typeof raw.selector === 'string' && raw.selector !== '' ? raw.selector : null;
        const dir = uniqueStepDir(
          stepDirName(index + 1, raw.componentProps?.title, selector),
          taken
        );
        origin = { ref: stepRefFor(dir), $schema: STEP_SCHEMA_MARKER };
      }
      parts.set(origin.ref, partOf(step, origin));
      if (id !== null) nextOrigins.set(id, origin);
      return { $ref: origin.ref };
    });
  });

  const skeleton = root === schema.root ? schema : { ...schema, root: root as JsonNode };
  return { skeleton, parts, origins: nextOrigins };
}

/** Файл шага: `$schema` первым — так его пишет и кодоген, и человек. */
function partOf(node: JsonNode, origin: StepOrigin): JsonFormStep {
  return origin.$schema === undefined ? { node } : { $schema: origin.$schema, node };
}

function nodeIdOf(value: unknown): string | null {
  const id = (value as { $nodeId?: unknown } | null)?.$nodeId;
  return typeof id === 'string' ? id : null;
}

function samePath(a: Path, b: Path): boolean {
  return a.length === b.length && a.every((segment, i) => segment === b[i]);
}

function valueAt(value: unknown, path: Path): unknown {
  let current: unknown = value;
  for (const segment of path) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string | number, unknown>)[segment];
  }
  return current;
}

/**
 * Обход всех `componentProps.steps` дерева с заменой: `map` получает массив шагов и путь до него
 * (`[..., 'componentProps', 'steps']`). Неизменённые поддеревья возвращаются по ссылке.
 *
 * В шаги спускается по результату `map`: шаг, пришедший из файла, сам может держать визард.
 */
function mapStepsArrays(
  node: unknown,
  path: Path,
  map: (steps: readonly unknown[], path: Path) => readonly unknown[]
): unknown {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return node;
  const record = node as Record<string, unknown>;
  let changed = false;
  const patch: Record<string, unknown> = {};

  const props = record.componentProps as Record<string, unknown> | undefined;
  const steps: unknown = props?.steps;
  if (props !== undefined && props !== null && Array.isArray(steps)) {
    const stepsPath = [...path, 'componentProps', 'steps'];
    const mapped = map(steps, stepsPath);
    const walked = mapped.map((step, i) => mapStepsArrays(step, [...stepsPath, i], map));
    const same = walked.length === steps.length && walked.every((step, i) => step === steps[i]);
    if (!same) {
      patch.componentProps = { ...props, steps: walked };
      changed = true;
    }
  }

  const children = record.children;
  if (Array.isArray(children)) {
    const walked = children.map((child, i) => mapStepsArrays(child, [...path, 'children', i], map));
    if (walked.some((child, i) => child !== children[i])) {
      patch.children = walked;
      changed = true;
    }
  }

  const item = record.item as { $template?: unknown } | undefined;
  if (item !== undefined && item !== null && typeof item === 'object') {
    const template = mapStepsArrays(item.$template, [...path, 'item', '$template'], map);
    if (template !== item.$template) {
      patch.item = { ...item, $template: template };
      changed = true;
    }
  }

  return changed ? { ...record, ...patch } : node;
}

/** Обход без замены. */
function forEachStepsArray(
  node: unknown,
  path: Path,
  visit: (steps: readonly unknown[], path: Path) => void
): void {
  mapStepsArrays(node, path, (steps, at) => {
    visit(steps, at);
    return steps;
  });
}

/** Путь до шагов первого визарда — того же, что находит кодоген (`wizardStepsOf`). */
function firstStepsPath(node: unknown, path: Path): Path | null {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return null;
  const record = node as { componentProps?: { steps?: unknown }; children?: unknown };
  if (Array.isArray(record.componentProps?.steps)) return [...path, 'componentProps', 'steps'];
  if (!Array.isArray(record.children)) return null;
  for (let i = 0; i < record.children.length; i += 1) {
    const child: unknown = record.children[i];
    if (!isNodeLike(child)) continue;
    const found = firstStepsPath(child, [...path, 'children', i]);
    if (found !== null) return found;
  }
  return null;
}
