/**
 * Модель данных реестра форм.
 *
 * Ключевое разделение, из которого следует всё остальное: **форма — это один файл данных
 * из десяти**. Канонический пакет формы состоит из `renderer.schema.json` (данные) и девяти
 * файлов кода — `validation.ts`, `form.behavior.ts`, `renderer.behavior.ts`, `api.ts`,
 * `registry.ts`, `data-sources.ts`, `model.ts`, `types.ts`, `index.tsx`. Секции валидации
 * в мета-схеме JSON-DSL нет вовсе: верхний уровень схемы — только `$schema`, `id`, `version`,
 * `meta`, `root`.
 *
 * Поэтому форму **нельзя доставить по сети целиком**. По сети едет схема, обращающаяся к коду
 * по имени (`$component`/`$dataSource`/`$fn`/`$locale`) и по `selector`. Запись реестра
 * якорится кодом: микрофронт, несущий поведение и валидацию, обязан быть загружен.
 *
 * @module reformer/form-registry/types
 */

import type { FormModel, FormProxy } from '@reformer/core';
import type { FormBehavior } from '@reformer/core/behaviors';
import type { ValidationSchema } from '@reformer/core/validation';
import type { ComponentRegistry, JsonFormSchema } from '@reformer/renderer-json';
import type { RenderBehaviorFn } from '@reformer/renderer-react';

/**
 * Источник ДАННЫХ: сериализуем, поэтому может приехать по сети.
 *
 * Применим к схеме и начальным значениям — единственным частям формы, которые не являются кодом.
 */
export type DataSource<T> =
  | { kind: 'inline'; value: T }
  | { kind: 'module'; load: () => Promise<T> }
  | { kind: 'http'; url: string; init?: RequestInit };

/**
 * Источник КОДА: только из бандла.
 *
 * Варианта `'http'` здесь намеренно НЕТ — тянуть поведение или валидацию по сети означало бы
 * исполнять удалённый код. Всё, что описано функциями, приходит статическим или динамическим
 * импортом внутри микрофронта.
 */
export type CodeSource<T> =
  | { kind: 'inline'; value: T }
  | { kind: 'module'; load: () => Promise<T> };

/**
 * Валидация формы.
 *
 * `createJsonForm` её НЕ принимает — валидация подключается отдельно, тремя путями, и все три
 * сходятся в один движок `validateModel`: инъекция в визард через `patchProps({validateStep,
 * validateAll})`, прямой вызов в submit-обработчике, живая стратегия `createFormValidation`.
 * Реестр не изобретает четвёртый путь, а передаёт эти правила в фабрику `renderBehavior` —
 * туда, где связывание происходит сегодня.
 *
 * ⚠️ `schema` и значения `steps` обязаны быть **стабильными ссылками**: гашение и отмена
 * устаревших прогонов ключатся по паре `(model, schema)` через `WeakMap`. Инлайн-стрелка
 * ломает дедупликацию — валидация начнёт возвращать `false` от отменённых прогонов.
 */
export interface FormValidation<T> {
  /** Полный набор правил — для submit и `validateAll`. */
  schema?: ValidationSchema<T>;
  /**
   * Пошаговая валидация визарда: ключ = `selector` узла `Step` в JSON-схеме.
   * `null` означает «шаг без правил» ЯВНО — чтобы опечатка в ключе не выглядела как пустой шаг.
   * Совпадение ключей с селекторами проверяется preflight'ом (этап 2): сегодня эта
   * договорённость не проверяется нигде.
   */
  steps?: Record<string, ValidationSchema<T> | null>;
  /** Когда запускать живую валидацию. По умолчанию `'submit'`. */
  strategy?: 'submit' | 'blur' | 'change' | 'afterFirstSubmit';
  debounce?: number;
}

/** Ключ формы: идентификатор плюс версия. */
export interface FormKey {
  id: string;
  version?: string;
}

/** Куда и когда форму разрешено рендерить. */
export interface FormPlacement {
  /** Именованные слоты хоста: `'checkout.sidebar'`, `'profile.tabs.documents'`. */
  slots?: readonly string[];
  /** Шаблоны маршрутов: `'/loans/:id/apply'`. Компилируются в RegExp при регистрации. */
  routes?: readonly string[];
  /** Порядок внутри слота, по убыванию. По умолчанию 0. */
  priority?: number;
}

/** Гейт доступа. Пустой объект и отсутствие поля означают «доступно всем». */
export interface FormAccess {
  /** Нужны ВСЕ перечисленные права. */
  permissions?: readonly string[];
  /** Нужны ВСЕ перечисленные флаги. */
  flags?: readonly string[];
  /** Escape-hatch для сложной логики. Обязана быть чистой и синхронной. */
  canRender?: (ctx: ResolveContext) => boolean;
}

/** Что делать, если схема ссылается на незарегистрированный компонент. */
export type DegradePolicy =
  /** Не показывать форму, нарисовать панель ошибки. Безопасно для значимых форм. */
  | 'error'
  /** Отрисовать форму, на месте узла — нейтральный стаб плюс диагностика. */
  | 'placeholder';

/** Запись реестра форм. */
export interface FormEntry<T extends object = Record<string, unknown>> {
  /** Стабильный идентификатор. Сверяется со `schema.id`, если тот задан. */
  id: string;
  /** Версия записи (semver). Сверяется со `schema.version`, если тот задан. */
  version: string;
  /** Кто зарегистрировал — для диагностики коллизий `id` между микрофронтами. */
  owner: string;

  /** Схема формы. Единственная часть, которую можно тянуть по сети. */
  schema: DataSource<JsonFormSchema<T>>;
  /**
   * Диапазон версий схемы, с которыми совместим ЭТОТ код (semver-range).
   * Закрывает режим отказа «схема ушла вперёд кода»: CDN отдал v2, а микрофронт
   * с поведением v1 ещё не выкачен.
   */
  compatibleSchema?: string;

  /** Начальные значения — данные. */
  initial?: DataSource<T>;
  /** Готовая фабрика модели — код. Приоритетнее `initial`. */
  model?: CodeSource<() => FormModel<T>>;

  /** Расширение реестра компонентов поверх базового. */
  registry?: CodeSource<ComponentRegistry>;
  /** Поведение модели: compute/copyFrom/enableWhen/onChange. */
  behavior?: CodeSource<FormBehavior<T>>;
  /** Правила валидации. См. {@link FormValidation} про стабильность ссылок. */
  validation?: CodeSource<FormValidation<T>>;
  /**
   * Фабрика render-behavior. Получает готовые form/model и правила валидации —
   * связывание валидации с формой происходит здесь.
   *
   * Четвёртый параметр — настройки МЕСТА МОНТИРОВАНИЯ, а не формы: колбэки вроде `onResult`
   * принадлежат хосту (он решает, где и как показать результат), поэтому в записи реестра их
   * быть не может — она одна на все места, где форму покажут. Хост передаёт их пропом
   * `renderBehaviorOptions` у `FormOutlet`/`FormSlot`.
   *
   * Без этого канала фабрики вида `(form, model, options)` — а именно такие генерирует билдер —
   * получали бы в третий аргумент `FormValidation`, что и не компилируется, и молча ломает
   * семантику: `onResult` не доехал бы никогда.
   */
  renderBehavior?: CodeSource<
    (
      form: FormProxy<T>,
      model: FormModel<T>,
      validation?: FormValidation<T>,
      options?: Record<string, unknown>
    ) => RenderBehaviorFn<T>
  >;

  placement?: FormPlacement;
  access?: FormAccess;
  /** Политика деградации для ЭТОЙ формы. Дефолт реестра — `'error'`. */
  degrade?: DegradePolicy;

  /** Каталожные метаданные: выбор формы в UI, поиск, админка. */
  meta?: { name?: string; description?: string; tags?: readonly string[] };
}

/** Контекст разрешения. Подаёт хост: реестр не знает ни о роутере, ни о модели прав. */
export interface ResolveContext {
  permissions: ReadonlySet<string>;
  flags: ReadonlySet<string>;
  /** Текущий маршрут — из роутера хоста, каким бы он ни был. */
  route?: { path: string; params?: Readonly<Record<string, string>> };
  locale?: string;
}

/** Способ адресации формы. Права и флаги — не часть запроса, а общий фильтр. */
export type FormQuery =
  | { by: 'id'; id: string; version?: string }
  | { by: 'slot'; slot: string }
  | { by: 'route'; path: string }
  | { by: 'tag'; tag: string };

/** Диагностическое сообщение реестра (конфликт id, промах preflight, дубль рантайма). */
export interface Diagnostic {
  level: 'warn' | 'error';
  code: string;
  message: string;
  entry?: Pick<FormEntry, 'id' | 'version' | 'owner'>;
}
