/**
 * Превью: поверхности, которые рисуют документ, и живой вид, которым их показывают редакторы.
 *
 * ## Почему это контракт, а не объявления плагина превью
 *
 * Поверхности вносят РАЗНЫЕ плагины: стек ReFormer рисует схему `@reformer/renderer-json`,
 * другой стек — свой формат. Пока поставщик был один, точка жила структурной копией в плагине
 * превью; второй поставщик копию обязан был бы повторить, а копия, описывающая ПРЕДМЕТНОЕ,
 * разъезжается с оригиналом (урок Э6 журнала решений: копия сузила `DocumentModelProvider<unknown>`
 * до своей модели). Поэтому контракт здесь, а плагины его реэкспортируют.
 *
 * ## Модель документа здесь `unknown`, и это решение
 *
 * Превью не знает формата: какой провайдер модели разобрал документ, та поверхность и берётся
 * (`applies` смотрит на {@link DocumentRef.providerId}), и она же сужает модель своей проверкой.
 * Сузь контракт до одной схемы — второй стек не смог бы внести поверхность, не соврав в типе.
 *
 * ## Состояние превью живёт вне поверхности
 *
 * Схема, выделение, мок-данные и приёмник находок приходят поверхности ИЗВНЕ, методами
 * {@link PreviewContext}. Поверхность не владеет ничем, что должно пережить её размонтирование,
 * поэтому переключение поверхностей свободно, а смонтированной держат одну.
 *
 * @module @reformer/builder-plugin-api/services/preview
 */

import { defineCapability, type Capability } from '../primitives/capability.js';
import type { Disposable } from '../primitives/disposable.js';
import { defineExtensionPoint, type ExtensionPoint } from '../primitives/extension-point.js';
import type { ResourceId } from '../primitives/resource.js';
import type { TextRange } from './diagnostics/types.js';
import type { NodeId } from '../workspace/model/provider.js';
import type { DocumentRef } from './validation/types.js';

/**
 * Что поверхность умеет. Каждый признак отвечает на вопрос, который обязаны задать ДО
 * монтирования: правило выбора ранжирует по ним поверхности и сверяет их с правами источника.
 */
export interface PreviewCapabilities {
  /** Можно ли трогать форму: вводить значения, нажимать кнопки. */
  readonly interactive: boolean;
  /** Выбор узла кликом. */
  readonly hitTest: boolean;
  /** Принимает ли дроп с палитры. */
  readonly dragSource: boolean;
  /** Исполняет ли код документа. Только по этому признаку работает запрет по источнику. */
  readonly executesCode: boolean;
  /** Тот же realm, что у оболочки. Исполняющая поверхность обязана отвечать `true`. */
  readonly sameRealm: boolean;
}

/** На чём споткнулись. */
export type PreviewProblemPhase =
  /** Документ не разобрался в схему формы. */
  | 'schema'
  /** Импорт не привязался. */
  | 'resolve'
  /** Движок транспиляции отказался. */
  | 'transpile'
  /** Модуль исполнился и бросил. */
  | 'evaluate'
  /** Сборка формы или отрисовка. */
  | 'render';

/**
 * Сбой превью — данные, а не исключение.
 *
 * `resource` и `range` — адрес для службы диагностик: по ним находка становится подчёркиванием
 * в редакторе того файла, где чинить. Оба необязательны: сбой без файла относится к документу.
 */
export interface PreviewProblem {
  readonly file: string;
  readonly phase: PreviewProblemPhase;
  readonly message: string;
  readonly resource?: ResourceId;
  readonly range?: TextRange;
}

/** Значения модели формы. Форма приходит из схемы, и сузить её нечем. */
export type PreviewValues = Record<string, unknown>;

/** Мок-данные формы: значения модели и значения источников. Авторский артефакт. */
export interface PreviewMock {
  readonly model: Record<string, unknown>;
  readonly dataSources: Record<string, unknown>;
}

/**
 * Собранная форма в объёме, нужном наблюдателю (панели модели): модель и реестр. Шире — значит
 * дать наблюдателю пересобирать форму, а этим занята поверхность.
 */
export interface PreviewFormHandle {
  readonly model: unknown;
  readonly registry?: unknown;
}

/**
 * Что поверхность получает на монтирование.
 *
 * Схема — метод, а не поле: документ правят, пока превью открыто, и поверхность обязана читать
 * то, что есть СЕЙЧАС. `null` — документ не разобрался; это законное состояние, а не ошибка.
 */
export interface PreviewContext {
  readonly doc: DocumentRef;

  /**
   * Модель документа, как её разобрал провайдер (`doc.providerId`), либо `null`. Ссылка
   * стабильна, пока документ не менялся. Форму знает поверхность и сужает её сама.
   */
  schema(): unknown;
  onDidChangeSchema(cb: () => void): Disposable;

  /** Выделенные узлы — те же адреса, которыми оперирует редактор документа. */
  selection(): readonly NodeId[];
  onDidChangeSelection(cb: () => void): Disposable;
  /** Обратная связь хит-теста: поверхность сообщает, куда ткнули. */
  select(ids: readonly NodeId[]): void;

  /** Мок-данные или `null`, если автор их не задавал (тогда поверхность синтезирует свои). */
  mock(): PreviewMock | null;

  /** Что человек успел ввести в прежнюю сборку этой формы; `undefined` — не начинали. */
  values(): PreviewValues | undefined;

  /**
   * Отдать значения на хранение: перед пересборкой формы и при размонтировании. Не позовёт
   * поверхность — потеряет набранное человеком, и никто, кроме него, этого не заметит.
   */
  keepValues(values: PreviewValues): void;

  /** Отдать собранную форму наблюдателям; `null` — формы сейчас нет. Необязателен. */
  publishForm?(form: PreviewFormHandle | null): void;

  /** Куда уходят находки сборки. Список от одного `source` ЗАМЕЩАЕТСЯ целиком. */
  report(source: string, problems: readonly PreviewProblem[]): void;
}

/** Поверхность превью — вклад в точку {@link PreviewSurfacePoint}. */
export interface PreviewSurface {
  /** Уникален среди поверхностей: он же имя источника диагностик. */
  readonly id: string;

  /**
   * Берётся ли поверхность за такой документ. Синхронная и дешёвая, решает по адресу, виду
   * и провайдеру модели — содержимого здесь нет, выбор не должен стоить разбора текста.
   */
  applies(doc: DocumentRef): boolean;

  readonly capabilities: PreviewCapabilities;

  mount(host: HTMLElement, ctx: PreviewContext): Disposable;

  /**
   * Имя для человека, УЖЕ переведённое. Функция, а не ключ: словарь принадлежит внёсшему
   * плагину, а спрашивает имя чужой (живой вид редактора). Нет — показывают `id`.
   */
  title?(): string;
}

/** Точка расширения поверхностей превью. Заполняется только вкладами. */
export const PreviewSurfacePoint: ExtensionPoint<PreviewSurface> =
  defineExtensionPoint<PreviewSurface>('preview.surface');

/**
 * Что живой вид даёт поверхности: схему из МОДЕЛИ редактора (буфер перерисовывается с задержкой,
 * пока печатают), выделение и обратную связь хит-теста. Остальное достраивает провайдер.
 */
export interface LiveSurfaceContext {
  /** Разобранная модель документа; `null` — не разбирается. Ссылка обязана быть стабильной. */
  schema(): unknown;
  onDidChangeSchema(cb: () => void): Disposable;
  selection(): readonly NodeId[];
  onDidChangeSelection(cb: () => void): Disposable;
  select(ids: readonly NodeId[]): void;
}

/** Чем нарисован документ — в объёме, которым живой вид принимает решения. */
export interface LiveSurfaceInfo {
  readonly id: string;
  /** Уже переведённое имя. */
  readonly title: string;
  readonly hitTest: boolean;
  readonly sameRealm: boolean;
  readonly executesCode: boolean;
  /** Уже переведённая причина, по которой выбрана не самая способная поверхность. */
  readonly notice: string | null;
}

/**
 * Живой вид: выбрать поверхность для документа по общему правилу и смонтировать её.
 *
 * Одно правило на всех, кто показывает документ, — поэтому «чем нарисована эта форма» имеет
 * один ответ, где бы её ни показывали, а введённые значения и находки не раздваиваются.
 */
export interface PreviewLiveService {
  /** Есть ли кому рисовать вовсе. */
  available(): boolean;
  /** Чем будет нарисован документ; `null` — показывать нечем. */
  chosen(documentId: ResourceId): LiveSurfaceInfo | null;
  /** Смонтировать поверхность в элемент; `null` — не за что было взяться. */
  mount(documentId: ResourceId, element: HTMLElement, ctx: LiveSurfaceContext): Disposable | null;
  /** Состав поверхностей для этого документа изменился. */
  onDidChange(documentId: ResourceId, cb: () => void): Disposable;
  /** Форма, которую опубликовала смонтированная поверхность; `null` — формы нет. */
  formOf(documentId: ResourceId): PreviewFormHandle | null;
  /** Опубликованная форма документа сменилась. */
  onDidChangeForm(documentId: ResourceId, cb: () => void): Disposable;
}

/**
 * Живой вид превью. Провайдер — плагин превью (`reformer.preview`), потребители — редакторы
 * любых стеков. Необязателен у каждого потребителя: превью выключаемо.
 */
export const PreviewLiveCapability: Capability<PreviewLiveService> =
  defineCapability<PreviewLiveService>({ id: 'reformer.preview.live', version: '1.0.0' });
