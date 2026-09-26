/**
 * Что тема знает о ките — структурно, без зависимости от пакетов билдера.
 *
 * Тема — рантайм-библиотека: её берёт и превью билдера, и напечатанная форма в приложении. Поэтому
 * кит описан здесь своими словами, в объёме каталога кита (`component-catalog.json`): записи
 * компонентов, рамка поля и уточнения `kit.renderers.rjsf`. Каталог любого кита под это подходит
 * как есть.
 *
 * @module @reformer/rjsf-kit-theme/types
 */

/** Запись каталога кита в объёме, нужном теме. */
export interface KitThemeRecord {
  /** Имя компонента в каталоге (`Checkbox`). */
  readonly name: string;
  /** Роль записи: виджетами становятся только поля (`field`). */
  readonly role: string;
  /** Имя экспорта, если оно отличается от имени записи (`CheckboxWithLabel`). */
  readonly exportName?: string;
  /**
   * Пропсы компонента. Тема смотрит одно: объявлен ли `options` — тогда контрол получает варианты
   * выбора RJSF. Схемы нет — варианты получает всё, кроме флажка.
   */
  readonly propsSchema?: Readonly<Record<string, unknown>>;
}

/** Шаблоны RJSF, которые тема строит из кита, и имена компонентов, которые их заменяют. */
export interface KitThemeTemplates {
  /** Шаблон поля; по умолчанию — рамка поля кита (`slots.fieldFrame`). */
  readonly field?: string;
  /** Шаблон объекта; по умолчанию — `Box`. */
  readonly object?: string;
  /** Кнопка отправки; по умолчанию — `Button`. */
  readonly submit?: string;
}

export interface KitThemeInput {
  /** Пространство имён кита: имя экспорта → компонент. Пустое — кита нет, тема стандартная. */
  readonly namespace: Readonly<Record<string, unknown>>;
  /** Записи каталога кита. */
  readonly components: readonly KitThemeRecord[];
  /** Инфраструктура кита: рамка поля (`kit.infra.fieldFrame`). */
  readonly slots?: { readonly fieldFrame?: string };
  /** Уточнения кита (`kit.renderers.rjsf.widgets`): виджет RJSF → имя компонента кита. */
  readonly widgets?: Readonly<Record<string, string>>;
  /** Уточнения кита (`kit.renderers.rjsf.templates`). */
  readonly templates?: KitThemeTemplates;
}

/**
 * Почему часть темы осталась стандартной. Не ошибка отрисовки: форма рисуется, просто этот кусок —
 * виджетом или шаблоном RJSF по умолчанию. Список нужен, чтобы расхождение было видно, а не угадано.
 */
export type KitThemeProblem =
  /** Для виджета RJSF в ките нет подходящего поля — остаётся виджет по умолчанию. */
  | { readonly code: 'widget-default'; readonly widget: string }
  /** Кит назвал компонент (в `renderers.rjsf` или `slots`), а в каталоге или пространстве имён его нет. */
  | { readonly code: 'component-missing'; readonly target: string; readonly component: string }
  /** Шаблон RJSF остался стандартным: в ките нет компонента под него. */
  | { readonly code: 'template-default'; readonly template: string };

/** Пропсы рамки поля кита — та же форма, что `KitFieldFrameProps` контракта китов. */
export interface KitFieldFrameProps {
  readonly id?: string;
  readonly label?: unknown;
  readonly description?: unknown;
  readonly required?: boolean;
  readonly errors?: readonly string[];
  readonly inlineLabel?: boolean;
  readonly hidden?: boolean;
  readonly className?: string;
  readonly children?: unknown;
}
