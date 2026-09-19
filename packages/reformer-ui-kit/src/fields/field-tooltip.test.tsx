import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ComponentProps } from 'react';
import {
  withFieldTooltip,
  mergeIds,
  tooltipText,
  INSIDE_INPUT,
  OUTSIDE_CENTER,
} from './field-tooltip';
import { withFormControl } from './with-form-control';
import { nativeInputAdapter } from './adapters';

/** Локальный аналог shadcn-примитива Input (React-19 ref-as-prop plain-функция). */
function Input(props: ComponentProps<'input'>) {
  return <input data-slot="input" {...props} />;
}

describe('tooltipText / mergeIds', () => {
  it('подсказка есть только у непустой строки', () => {
    expect(tooltipText('Текст')).toBe('Текст');
    expect(tooltipText('')).toBeUndefined();
    expect(tooltipText(undefined)).toBeUndefined();
    expect(tooltipText(42)).toBeUndefined();
  });

  it('mergeIds склеивает id и отбрасывает пустые', () => {
    expect(mergeIds('a', undefined, false, 'b')).toBe('a b');
    expect(mergeIds(undefined, null)).toBeUndefined();
  });
});

describe('withFieldTooltip', () => {
  const Inside = withFieldTooltip(Input, INSIDE_INPUT);
  const Outside = withFieldTooltip(Input, OUTSIDE_CENTER);

  it('без tooltip и с пустой строкой разметка РАВНА разметке голого примитива', () => {
    const bare = renderToStaticMarkup(<Input id="a" className="w-10" />);
    expect(renderToStaticMarkup(<Inside id="a" className="w-10" />)).toBe(bare);
    expect(renderToStaticMarkup(<Inside id="a" className="w-10" tooltip="" />)).toBe(bare);
  });

  it('inside: обёртка, резерв в className контрола, иконка с позицией', () => {
    const html = renderToStaticMarkup(
      <Inside id="a" className="w-10" data-testid="input-email" tooltip="Только латиница" />
    );
    expect(html).toMatch(/^<div data-slot="field-tooltip" class="relative w-full">/);
    expect(html).toMatch(/<input[^>]*class="w-10 pr-9"/);
    expect(html).toMatch(/<button[^>]*class="[^"]*absolute top-1\/2 right-3[^"]*"/);
    expect(html).toContain('data-testid="input-email-tooltip"');
  });

  it('outside: flex-обёртка, className контрола не трогается', () => {
    const html = renderToStaticMarkup(<Outside className="w-10" tooltip="Подсказка" />);
    expect(html).toMatch(/^<div data-slot="field-tooltip" class="flex w-fit items-center gap-2">/);
    expect(html).toMatch(/<input[^>]*class="w-10"/);
  });

  it('id скрытого текста дописывается к входящему aria-describedby', () => {
    const html = renderToStaticMarkup(
      <Inside id="control-x" aria-describedby="desc-x" tooltip="Текст подсказки" />
    );
    expect(html).toContain('aria-describedby="desc-x control-x-tooltip"');
    expect(html).toContain('<span id="control-x-tooltip" hidden="">Текст подсказки</span>');
  });

  it('проп tooltip не течёт в DOM контрола', () => {
    const html = renderToStaticMarkup(<Inside tooltip="Секрет" />);
    expect(html.match(/<input[^>]*>/)?.[0]).not.toMatch(/\stooltip=/);
  });

  it('сохраняет displayName примитива — Field(Input) остаётся Field(Input)', () => {
    expect(Inside.displayName).toBe('Input');
    expect(withFormControl(Inside, nativeInputAdapter).displayName).toBe('Field(Input)');
  });

  it('под withFormControl: value-контракт цел, иконка на месте', () => {
    const Field = withFormControl(Inside, nativeInputAdapter);
    const html = renderToStaticMarkup(<Field value="привет" tooltip="Подсказка" />);
    expect(html).toContain('value="привет"');
    expect(html).toContain('data-slot="info-hint"');
  });
});
