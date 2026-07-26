/**
 * Имена компонентов, которые Runtime-preview умеет рендерить настоящим `@reformer/ui-kit`
 * (спека §9: дефолтный registry — ui-kit). Список — чистые данные (без импорта React), чтобы
 * unknown-детект (`unknown.ts`) работал в node/тестах. Компоненты — в `known-components.tsx`.
 *
 * У части палитровых компонентов нет `*Field`-алиаса в ui-kit (InputOTP, Combobox, DatePicker,
 * Calendar) — в preview они станут плейсхолдером (best-effort, §13: точность — на dev-сервере).
 *
 * @module reformer-builder/preview-runtime/known-names
 */

/** Компоненты, покрытые дефолтным ui-kit-реестром preview. */
export const KNOWN_COMPONENT_NAMES = [
  // поля (есть *Field-алиас)
  'Input',
  'InputPassword',
  'InputMask',
  'Textarea',
  'Select',
  'NativeSelect',
  'Checkbox',
  'RadioGroup',
  'Switch',
  'Slider',
  'FileUpload',
  'FileUploadAvatar',
  'Toggle',
  'ToggleGroup',
  // контейнеры/системные
  'Box',
  'Section',
  'Collapsible',
  'FormField',
  'Button',
  'AsyncBoundary',
  'Step',
] as const;

/** Множество известных имён (для быстрого unknown-детекта). */
export const KNOWN_COMPONENT_NAME_SET: ReadonlySet<string> = new Set(KNOWN_COMPONENT_NAMES);
