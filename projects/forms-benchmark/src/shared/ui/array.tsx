/**
 * Разметка секций и массивов, общая для всех реализаций (BENCH-CONTRACT §4). Состояния нет:
 * строки, их ключи и добавление/удаление держит библиотека.
 *
 * - `Section` — `<fieldset>` с заголовком: вложенная группа или условная секция шага;
 * - `ArrayFrame` — массив: заголовок, строки, «Добавить» (`btn-add-{path}`);
 * - `ArrayRow` — строка: «{rowTitle} {i+1}», «Удалить» (`btn-remove-{path}-{index}`), поля строки
 *   в сетке. Поля строки — `FieldFrame` с путём `{path}-{index}-{поле}`.
 */
import type { ReactNode } from 'react';
import { countRender, registerPrimitives } from './instrument';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  countRender('Section');
  return (
    <fieldset className="b-section">
      <legend>{title}</legend>
      {children}
    </fieldset>
  );
}

export interface ArrayFrameProps {
  /** Путь массива DOM-контракта: `properties`. */
  path: string;
  title: string;
  addLabel: string;
  onAdd: () => void;
  children: ReactNode;
}

export function ArrayFrame({ path, title, addLabel, onAdd, children }: ArrayFrameProps) {
  countRender('ArrayFrame');
  return (
    <fieldset className="b-section">
      <legend>{title}</legend>
      {children}
      <button
        type="button"
        className="b-button b-button--ghost"
        data-testid={`btn-add-${path}`}
        onClick={onAdd}
      >
        {addLabel}
      </button>
    </fieldset>
  );
}

export interface ArrayRowProps {
  path: string;
  index: number;
  title: string;
  onRemove: () => void;
  children: ReactNode;
}

export function ArrayRow({ path, index, title, onRemove, children }: ArrayRowProps) {
  countRender('ArrayRow');
  return (
    <div className="b-row">
      <div className="b-row__head">
        <span className="b-row__title">{`${title} ${index + 1}`}</span>
        <button
          type="button"
          className="b-button b-button--ghost"
          data-testid={`btn-remove-${path}-${index}`}
          onClick={onRemove}
        >
          Удалить
        </button>
      </div>
      <div className="b-row__fields">{children}</div>
    </div>
  );
}

registerPrimitives({ Section, ArrayFrame, ArrayRow });
