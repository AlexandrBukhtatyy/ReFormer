/**
 * Рамка поля — единственная допустимая разметка вокруг контрола (BENCH-CONTRACT §4):
 * `field-{path}` → label → контрол → `error-{path}`. Пропсы для самого контрола (id, testid, aria)
 * даёт `controlAttrs`, их реализация кладёт на свой элемент.
 */
import type { ReactNode } from 'react';
import { countRender, registerPrimitives } from './instrument';

export interface FieldFrameProps {
  path: string;
  label: string;
  error?: string | null;
  /** Подпись справа от контрола (чекбокс). */
  inline?: boolean;
  children: ReactNode;
}

export function FieldFrame({ path, label, error, inline, children }: FieldFrameProps) {
  countRender('FieldFrame');
  const labelEl = (
    <label className="b-label" htmlFor={controlId(path)}>
      {label}
    </label>
  );
  return (
    <div className={inline ? 'b-field b-field--inline' : 'b-field'} data-testid={`field-${path}`}>
      {inline ? null : labelEl}
      {children}
      {inline ? labelEl : null}
      {error ? (
        <p className="b-error" role="alert" id={errorId(path)} data-testid={`error-${path}`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const controlId = (path: string) => `f-${path}`;
export const errorId = (path: string) => `e-${path}`;

/** id, testid и aria для контрола поля `path`. */
export function controlAttrs(path: string, error?: string | null) {
  return {
    id: controlId(path),
    'data-testid': `input-${path}`,
    'aria-invalid': error ? (true as const) : undefined,
    'aria-errormessage': error ? errorId(path) : undefined,
  };
}

registerPrimitives({ FieldFrame });
