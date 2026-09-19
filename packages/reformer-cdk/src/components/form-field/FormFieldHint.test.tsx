/**
 * Unit-тесты FormField.Hint — элемент с ids.hintId для aria-describedby.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FieldNode, FormValue } from '@reformer/core';
import { FormFieldContext } from './FormFieldContext';
import { FormFieldHint } from './FormFieldHint';
import type { FormFieldContextValue } from './types';

const ctx = {
  ids: {
    controlId: 'control-x',
    labelId: 'label-x',
    descriptionId: 'desc-x',
    errorId: 'error-x',
    hintId: 'hint-x',
  },
  control: {} as FieldNode<FormValue>,
} as unknown as FormFieldContextValue;

function render(node: React.ReactNode): string {
  return renderToStaticMarkup(
    <FormFieldContext.Provider value={ctx}>{node}</FormFieldContext.Provider>
  );
}

describe('FormField.Hint', () => {
  it('рендерит span с ids.hintId', () => {
    expect(render(<FormFieldHint>Текст</FormFieldHint>)).toBe('<span id="hint-x">Текст</span>');
  });

  it('пробрасывает hidden: скрытый элемент остаётся целью aria-describedby', () => {
    expect(render(<FormFieldHint hidden>Текст</FormFieldHint>)).toBe(
      '<span id="hint-x" hidden="">Текст</span>'
    );
  });

  it('asChild кладёт id на дочерний элемент', () => {
    expect(
      render(
        <FormFieldHint asChild>
          <em>Текст</em>
        </FormFieldHint>
      )
    ).toBe('<em id="hint-x">Текст</em>');
  });
});
