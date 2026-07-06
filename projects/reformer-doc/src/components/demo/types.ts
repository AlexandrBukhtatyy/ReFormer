import type { ComponentType, ReactNode } from 'react';

/** Описание одного knob (переключателя props) в табе API. */
export type KnobDef =
  | { name: string; label?: string; type: 'boolean'; default: boolean }
  | { name: string; label?: string; type: 'text'; default: string }
  | { name: string; label?: string; type: 'select'; options: string[]; default: string };

/** Значения knobs, собранные из панели. */
export type KnobValues = Record<string, string | boolean>;

/** Готовый пресет компонента (таб Variants) — «скопировал и вставил». */
export interface VariantDef {
  id: string;
  title: string;
  description?: string;
  /** Живой рендер варианта. Это React-компонент (внутри можно использовать хуки). */
  render: ComponentType;
  /** Copy-paste сниппет конкретной конфигурации. */
  code: string;
  /** Язык подсветки сниппета. По умолчанию `tsx`. */
  language?: string;
  /** Подсказка (tooltip) у правого края шапки превью. Иконка — только если задана. */
  hint?: ReactNode;
}

/** Контекстный сценарий использования (таб Examples). */
export interface ExampleDef {
  id: string;
  title: string;
  description?: string;
  render: ComponentType;
  code: string;
  language?: string;
}

/** Строка таблицы props (таб API). */
export interface PropRow {
  name: string;
  type: string;
  default?: string;
  description: string;
}

/** Интерактивная площадка props (таб API). */
export interface PlaygroundDef {
  knobs: KnobDef[];
  /** Рендерит компонент от текущих значений knobs. Это React-компонент. */
  render: ComponentType<KnobValues>;
  /** Собирает сниппет от текущих значений knobs. */
  code: (values: KnobValues) => string;
  language?: string;
}

// ─── Богатый таб API (стиль TaigaUI) ──────────────────────────────────────

/**
 * Строка-контрол пропа в табе API: имя + тип + описание + интерактивный контрол.
 * `readonly` — только документируется (напр. value/onChange), без виджета.
 * Каждый `prop` маппится на `componentProps[prop]` (кроме `disabled` →
 * `control.disable()/enable()`).
 */
export type ApiControl =
  | {
      prop: string;
      type: string;
      description?: string;
      group?: string;
      kind: 'boolean';
      default: boolean;
    }
  | {
      prop: string;
      type: string;
      description?: string;
      group?: string;
      kind: 'text';
      default: string;
    }
  | {
      prop: string;
      type: string;
      description?: string;
      group?: string;
      kind: 'number';
      default: number;
      min?: number;
      max?: number;
      step?: number;
    }
  | {
      prop: string;
      type: string;
      description?: string;
      group?: string;
      kind: 'enum';
      options: string[];
      default: string;
    }
  | {
      prop: string;
      type: string;
      description?: string;
      group?: string;
      kind: 'readonly';
      default?: string;
    };

/** Значения контролов таба API. */
export type ApiValues = Record<string, string | number | boolean>;

/** Пресет значения формы для дропдауна «change ▾». */
export interface ValuePreset {
  label: string;
  value: unknown;
}

/**
 * Конфиг богатого таба API в стиле TaigaUI: живой form-bound превью с тулбаром
 * (Dark mode / Background), панель «Form data», контролы значения (Reset/Submit,
 * опц. «change»), и сгруппированные строки-контролы пропсов.
 */
export interface ApiConfig {
  /** Компонент ui-kit. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: any;
  /** Начальное значение поля формы (для form-data и Reset). */
  initialValue: unknown;
  /** Статичные componentProps, не управляемые контролами (напр. options у Select). */
  baseComponentProps?: Record<string, unknown>;
  /** Валидаторы (для Submit). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validators?: any[];
  /** Контролы пропсов (interactive + readonly), группируются по `group`. */
  controls: ApiControl[];
  /** Пресеты для «change ▾» (задать значение формы напрямую). */
  valuePresets?: ValuePreset[];
  /** Сниппет ReFormer (schema-нода) от текущих значений контролов. */
  code: (values: ApiValues) => string;
  /**
   * Опц. кастомный React-сниппет («сырое» использование компонента). Если не
   * задан — генерируется автоматически из компонента и текущих настроек.
   */
  codeReact?: (values: ApiValues) => string;
  language?: string;
}

/** Полная конфигурация страницы компонента (три таба). */
export interface ComponentDocConfig {
  /** Имя компонента, напр. `Input`. */
  name: string;
  /** Из какого пакета импортируется, напр. `@reformer/ui-kit`. */
  importFrom?: string;
  /** Краткое описание под заголовком. */
  description?: ReactNode;
  variants: VariantDef[];
  examples: ExampleDef[];
  /** Богатый таб API (стиль TaigaUI). Приоритетнее устаревшего `playground`. */
  api?: ApiConfig;
  /** @deprecated Устаревший простой playground. Используйте `api`. */
  playground?: PlaygroundDef;
  /** @deprecated Таблица props. При `api` не нужна (props — часть `api.controls`). */
  props?: PropRow[];
}
