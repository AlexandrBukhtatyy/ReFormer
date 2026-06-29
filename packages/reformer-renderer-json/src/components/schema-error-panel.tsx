/**
 * SchemaErrorPanel — панель ошибок валидации JSON-схемы формы.
 *
 * Рендерится {@link JsonFormRenderer} вместо формы, когда `validate` включён и схема невалидна
 * (невалидную схему всё равно нельзя сконвертировать — `resolveComponent` бросил бы исключение).
 *
 * @module reformer/renderer-json/components
 */

import type { ReactNode } from 'react';

/** Props of {@link SchemaErrorPanel}. */
export interface SchemaErrorPanelProps {
  /** Человекочитаемые ошибки (`validateFormSchema().errors`). */
  errors: string[];
}

/** Список ошибок схемы (path + message), с пометкой источника. Без внешних UI-зависимостей. */
export function SchemaErrorPanel({ errors }: SchemaErrorPanelProps): ReactNode {
  return (
    <div
      role="alert"
      data-testid="schema-error-panel"
      style={{
        border: '1px solid #f5a9a9',
        background: '#fff5f5',
        color: '#9b1c1c',
        borderRadius: 8,
        padding: '16px 20px',
        font: '14px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
      }}
    >
      <strong style={{ display: 'block', marginBottom: 8, fontSize: 15 }}>
        Невалидная JSON-схема формы ({errors.length})
      </strong>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {errors.map((e, i) => (
          <li key={i} style={{ marginBottom: 4 }}>
            {e}
          </li>
        ))}
      </ul>
    </div>
  );
}
