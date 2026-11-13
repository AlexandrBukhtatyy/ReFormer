/**
 * Общая разметка страницы и кнопок. Реализации используют эти компоненты, чтобы DOM вокруг формы
 * был одинаковым, а testid — из контракта.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { countRender, registerPrimitives } from './instrument';

export function Page({ title, children }: { title: string; children: ReactNode }) {
  countRender('Page');
  return (
    <main className="b-page">
      <h1 className="b-title">{title}</h1>
      {children}
    </main>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function SubmitButton({ children = 'Отправить', ...rest }: ButtonProps) {
  countRender('SubmitButton');
  return (
    <button type="submit" className="b-button" data-testid="btn-submit" {...rest}>
      {children}
    </button>
  );
}

export function ResetButton({ children = 'Очистить', ...rest }: ButtonProps) {
  countRender('ResetButton');
  return (
    <button type="button" className="b-button b-button--ghost" data-testid="btn-reset" {...rest}>
      {children}
    </button>
  );
}

export function Actions({ children }: { children: ReactNode }) {
  return <div className="b-actions">{children}</div>;
}

export function SubmitResult({ children }: { children: ReactNode }) {
  countRender('SubmitResult');
  return (
    <p className="b-result" role="status" data-testid="submit-result">
      {children}
    </p>
  );
}

registerPrimitives({ Page, SubmitButton, ResetButton, Actions, SubmitResult });
