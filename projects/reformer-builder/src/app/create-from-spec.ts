/**
 * Форма по спеке: текст постановки → готовая вкладка со схемой и правилами.
 *
 * Разбор и построение целиком в `@reformer/mcp` (`intentFromSpec` → `buildLayoutJson`); здесь —
 * оркестрация и три вещи, которые обязан делать именно потребитель.
 *
 * Первая — гейт. Схема проходит тот же `validateSchema`, что и любая другая, причём в СТРОГОМ
 * режиме без baseline: форма родилась из текста, доверять её именам компонентов не на что.
 * Невалидная схема не открывается вовсе — вкладка с формой, которая не рисуется, хуже отказа.
 *
 * Вторая — честность про неизвлечённое. `plan_form` разбирает спеку эвристиками и сам это
 * говорит: формулы вычисляемых полей не угадываются, а массивы извлекаются по именам из одной
 * конкретной постановки. Предупреждения должны дойти до пользователя, иначе он примет
 * «форма создана» за «форма разобрана правильно».
 *
 * Третья — имя вкладки без коллизий: генерация не должна перетирать открытую работу.
 *
 * @module reformer-builder/app/create-from-spec
 */

import { intentFromSpec } from '@reformer/mcp/dist/core/generate/from-spec.js';
import { formFromIntent } from '../model/from-intent';
import { validateSchema } from '../io/validate';
import { editorActions, editorStore } from '../store';

export interface SpecFormResult {
  status: 'created' | 'invalid' | 'empty';
  /** Имя созданной вкладки — есть только при `created`. */
  tab?: string;
  /** Ошибки валидации схемы — есть только при `invalid`. */
  errors?: string[];
  /** Что не извлеклось из спеки. Пусто — не значит «разобрано верно», значит «нечего сказать». */
  warnings: string[];
}

/** Имя вкладки без коллизий с уже открытыми. */
function freeTabName(base: string): string {
  const used = new Set(editorStore.getState().order);
  let name = `${base}.json`;
  let n = 1;
  while (used.has(name)) name = `${base}-${++n}.json`;
  return name;
}

/** Латиница из имени формы для имени файла; кириллица и знаки схлопываются в дефис. */
function slug(formName: string): string {
  const s = formName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'spec-form';
}

/**
 * Построить форму из текста спеки и открыть её новой вкладкой.
 *
 * @param spec Текст постановки — markdown или свободное описание.
 */
export function createFormFromSpec(spec: string): SpecFormResult {
  const intent = intentFromSpec(spec, 'renderer-json');
  const { schema, rules, warnings } = formFromIntent(intent);

  // Пустой разбор — не ошибка формата, а ситуация «в тексте не нашлось полей». Вкладка-пустышка
  // выглядела бы как результат работы, поэтому её не создаём.
  if (intent.fields.length === 0 && intent.arrays.length === 0) {
    return { status: 'empty', warnings };
  }

  const check = validateSchema(schema, { strict: true });
  if (!check.valid) {
    return { status: 'invalid', errors: check.errors, warnings };
  }

  const tab = freeTabName(slug(intent.formName));
  editorActions.openFormWithRules(tab, { kind: 'new', name: tab }, schema, rules);
  return { status: 'created', tab, warnings };
}
