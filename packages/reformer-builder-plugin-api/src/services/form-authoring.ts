/**
 * Создание формы и генерация её кода — по заказу другого плагина.
 *
 * ## Почему это контракт, а не объявления плагинов
 *
 * Объявляют возможности генерация кода и шаблоны, берёт ассистент: «сгенерируй код» и «сделай
 * анкету» — его работа, а запись модуля обязана стать частью хода. Пока заказчик был один, он
 * держал структурные копии объявлений; копия, описывающая ПРЕДМЕТНОЕ, разъезжается с оригиналом
 * (урок Э6 журнала решений). А раскол плагинов на общий хозяин и вклад стека сделал заказчиком и
 * поставщиком плагины разных доменов — им общего кода, кроме этого пакета, не положено.
 *
 * ## Ни одна операция не бросает
 *
 * Отказ — в отчёте, с кодом (`error`, ключ словаря поставщика) и тем же отказом словами
 * действующей локали (`message`): заказчик показывает его человеку или отдаёт модели как есть.
 *
 * @module @reformer/builder-plugin-api/services/form-authoring
 */

import { defineCapability, type Capability } from '../primitives/capability.js';
import type { ResourceId } from '../primitives/resource.js';

/** Как заказчик пишет файл модуля: строка — отказ с этой причиной, `null` — записано. */
export type GenerateWrite = (id: ResourceId, text: string) => Promise<string | null>;

/** Заказ генерации. */
export interface GenerateRequest {
  /** Запись файла модуля; по умолчанию — рабочая копия, как у панели экспорта. */
  readonly write?: GenerateWrite;
  /** Имя формы; по умолчанию — введённое в панели либо выведенное из пути документа. */
  readonly formName?: string;
  /**
   * Записать только файлы этих целей — по `CodegenTarget.id`; цель из проекта, заменяющая одну
   * из них (`overrides`), считается ею. Нет — весь модуль.
   *
   * Печатается модуль всё равно целиком: имена и импорты файла не зависят от того, какие ещё
   * файлы пишутся в этот раз.
   */
  readonly only?: readonly string[];
  /**
   * Вход стеку, который печатает документ, — непрозрачный для хозяина: его форму описывает сам
   * стек (`stack` — его `CodegenStack.id`). Стеку другого формата он не передаётся.
   *
   * @since 1.1.0
   */
  readonly stackInput?: { readonly stack: string; readonly value: unknown };
}

/** Почему файл не записан: правки человека (как у панели) либо отказ записи заказчика. */
export type GenerateSkipReason = 'authored' | 'edited' | 'refused';

/** Отчёт прогона генерации. Пути файлов — от каталога модуля, `dir` — от корня проекта. */
export type GenerateReport =
  | {
      readonly ok: true;
      readonly formName: string;
      /** Каталог модуля — путь от корня проекта. */
      readonly dir: string;
      readonly written: readonly string[];
      readonly skipped: readonly {
        readonly path: string;
        readonly reason: GenerateSkipReason;
        readonly message?: string;
      }[];
      readonly failed: readonly { readonly path: string; readonly message: string }[];
    }
  | {
      readonly ok: false;
      /** Ключ словаря поставщика (`error.not-a-schema`, …) — стабильный код отказа. */
      readonly error: string;
      /** Тот же отказ словами действующей локали. */
      readonly message: string;
    };

export interface ModuleGeneratorService {
  /**
   * Напечатать модуль формы документа и записать его дверью заказчика
   * ({@link GenerateRequest.write}). Сохранять прогон по заказу не сохраняет — это решение
   * человека.
   */
  generate(documentId: ResourceId, request?: GenerateRequest): Promise<GenerateReport>;
}

/**
 * Возможность «сгенерировать код формы» — прогон панели экспорта по заказу другого плагина.
 *
 * Версия `1.0.0` — исходная. `1.1.0` — заказ части модуля ({@link GenerateRequest.only}) и вход
 * стеку ({@link GenerateRequest.stackInput}): так ассистент пишет правила формы в её код.
 */
export const ModuleGeneratorCapability: Capability<ModuleGeneratorService> =
  defineCapability<ModuleGeneratorService>({ id: 'reformer.codegen.generator', version: '1.1.0' });

/** Откуда шаблон: встроенный, из проекта (`.ui_builder/templates`) или локальный. */
export type TemplateSourceKind = 'builtin' | 'project' | 'local';

/** Шаблон в списке для заказчика: то, по чему его выбирают. */
export interface TemplateSummary {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly source: TemplateSourceKind;
}

/** Заказ новой формы. */
export interface CreateFormRequest {
  /** Имя формы — оно же имя каталога модуля. */
  readonly formName: string;
  /** Шаблон: идентификатор или имя. Без него — пустая форма. */
  readonly template?: string;
  /** Каталог для модуля — путь от корня проекта. Без него — рядом с `near` или каталог форм. */
  readonly folder?: string;
  /** Документ, рядом с которым кладётся форма, когда каталог не назван. */
  readonly near?: ResourceId;
}

/** Исход создания формы. */
export type CreateFormReport =
  | {
      readonly ok: true;
      /** Документ новой формы — его открывают. */
      readonly documentId: ResourceId;
      /** Путь документа от корня проекта. */
      readonly path: string;
      /** Имя шаблона; `null` — пустая форма. */
      readonly template: string | null;
    }
  | {
      readonly ok: false;
      /** Ключ словаря поставщика либо `error.unknown-template`. */
      readonly error: string;
      /** Тот же отказ словами действующей локали. */
      readonly message: string;
    };

export interface FormCreatorService {
  /** Шаблоны всех хранилищ, по порядку хранилищ. */
  templates(): Promise<readonly TemplateSummary[]>;
  /** Создать форму. */
  create(request: CreateFormRequest): Promise<CreateFormReport>;
}

/**
 * Возможность «создать форму» — так же, как из окна «Создать форму» шаблонов.
 *
 * Версия `1.0.0` — исходная.
 */
export const FormCreatorCapability: Capability<FormCreatorService> =
  defineCapability<FormCreatorService>({ id: 'reformer.templates.creator', version: '1.0.0' });
