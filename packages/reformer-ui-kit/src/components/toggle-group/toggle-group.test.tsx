import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ToggleGroup,
  ToggleGroupItem,
  ToggleGroupField,
  ToggleGroupMulti,
  ToggleGroupMultiField,
} from './index';

const GENDER = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];

describe('ToggleGroup (base, pure shadcn)', () => {
  it('контейнер рендерит data-slot + data-variant/data-size', () => {
    const html = renderToStaticMarkup(
      <ToggleGroup type="single" variant="outline" size="sm">
        <ToggleGroupItem value="a">A</ToggleGroupItem>
      </ToggleGroup>
    );
    expect(html).toContain('data-slot="toggle-group"');
    expect(html).toContain('data-variant="outline"');
    expect(html).toContain('data-size="sm"');
  });

  it('single-режим: контейнер role=radiogroup, Item role=radio + data-slot', () => {
    const html = renderToStaticMarkup(
      <ToggleGroup type="single">
        <ToggleGroupItem value="a">A</ToggleGroupItem>
      </ToggleGroup>
    );
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('role="radio"');
    expect(html).toContain('data-slot="toggle-group-item"');
  });
});

describe('ToggleGroupField (вариант base, рендерит options)', () => {
  it('рендерит по одному Item на опцию + подписи', () => {
    const html = renderToStaticMarkup(<ToggleGroupField value={null} options={GENDER} />);
    const items = html.match(/role="radio"/g) ?? [];
    expect(items).toHaveLength(2);
    expect(html).toContain('Мужской');
    expect(html).toContain('Женский');
  });

  it('per-option data-testid = input-<field>-<value>', () => {
    const html = renderToStaticMarkup(
      <ToggleGroupField value={null} options={GENDER} data-testid="input-gender" />
    );
    expect(html).toContain('data-testid="input-gender-male"');
    expect(html).toContain('data-testid="input-gender-female"');
  });

  it('value → выбран только соответствующий Item (data-state=on)', () => {
    const html = renderToStaticMarkup(<ToggleGroupField value="female" options={GENDER} />);
    const on = html.match(/data-state="on"/g) ?? [];
    const off = html.match(/data-state="off"/g) ?? [];
    expect(on).toHaveLength(1);
    expect(off).toHaveLength(1);
  });

  it('value=null (null-coerce) → ничего не выбрано (нет on)', () => {
    const html = renderToStaticMarkup(<ToggleGroupField value={null} options={GENDER} />);
    expect(html).not.toContain('data-state="on"');
  });

  it('variant прокидывается в data-variant контейнера', () => {
    const html = renderToStaticMarkup(
      <ToggleGroupField value={null} options={GENDER} variant="outline" />
    );
    expect(html).toContain('data-variant="outline"');
  });

  it('strip control: renderer-путь не течёт в DOM', () => {
    const html = renderToStaticMarkup(
      <ToggleGroupField value="male" options={GENDER} control={{ id: 1 } as never} />
    );
    expect(html).not.toContain('[object Object]');
    expect(html).not.toContain('control=');
  });

  it('data-testid контейнера + per-option, НЕ на wrapper (Root — контейнер)', () => {
    const html = renderToStaticMarkup(
      <ToggleGroupField value={null} options={GENDER} data-testid="input-gender" />
    );
    // Root-контейнер несёт префикс, Item — суффикс -<value>.
    expect(html).toContain('data-testid="input-gender"');
    expect(html).toContain('data-testid="input-gender-male"');
  });

  it('прокидывает id/aria-* на контейнер (seam-контракт)', () => {
    const html = renderToStaticMarkup(
      <ToggleGroupField
        value="male"
        options={GENDER}
        id="control-x"
        aria-labelledby="label-x"
        aria-invalid
      />
    );
    expect(html).toContain('id="control-x"');
    expect(html).toContain('aria-labelledby="label-x"');
  });
});

const TAGS = [
  { value: 'a', label: 'Альфа' },
  { value: 'b', label: 'Бета' },
  { value: 'c', label: 'Гамма' },
];

describe('ToggleGroupMulti (вариант multi, множественный выбор)', () => {
  it('multiple-режим даёт роли toolbar/button + aria-pressed (не radiogroup/radio, как single)', () => {
    const html = renderToStaticMarkup(<ToggleGroupMulti options={TAGS} value={['a']} />);
    expect(html).toContain('role="toolbar"');
    expect(html).not.toContain('role="radio"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
  });

  it('отмечает КАЖДОЕ выбранное значение, а не одно', () => {
    const html = renderToStaticMarkup(<ToggleGroupMulti options={TAGS} value={['a', 'c']} />);
    expect(html.match(/data-state="on"/g) ?? []).toHaveLength(2);
    expect(html.match(/data-state="off"/g) ?? []).toHaveLength(1);
  });

  it('пустой выбор: ни один Item не нажат, рендер не падает', () => {
    const html = renderToStaticMarkup(<ToggleGroupMulti options={TAGS} value={[]} />);
    expect(html).not.toContain('data-state="on"');
    expect(html.match(/aria-pressed="false"/g) ?? []).toHaveLength(3);
  });

  it('per-option data-testid = input-<field>-<value> (конвенция POM)', () => {
    const html = renderToStaticMarkup(
      <ToggleGroupMulti options={TAGS} value={[]} data-testid="input-tags" />
    );
    expect(html).toContain('data-testid="input-tags"');
    expect(html).toContain('data-testid="input-tags-a"');
    expect(html).toContain('data-testid="input-tags-c"');
  });

  it('maxItems гасит только НЕвыбранные (иначе снять лишнее было бы нечем)', () => {
    const html = renderToStaticMarkup(
      <ToggleGroupMulti options={TAGS} value={['a']} maxItems={1} />
    );
    // Пробел перед атрибутом обязателен: data-disabled="" содержит disabled="" подстрокой.
    expect(html.match(/ disabled=""/g) ?? []).toHaveLength(2);
    // Выбранный Item остаётся кликабельным. Проверяем именно АТРИБУТ: слово disabled есть ещё и
    // в tailwind-классах (disabled:opacity-50), поэтому подстроку искать нельзя.
    const selected = html.slice(html.indexOf('aria-pressed="true"'));
    expect(selected.slice(0, selected.indexOf('</button>'))).not.toMatch(/ disabled=""/);
  });

  it('без maxItems ничего не выключается', () => {
    const html = renderToStaticMarkup(<ToggleGroupMulti options={TAGS} value={['a']} />);
    expect(html).not.toContain(' disabled=""');
  });
});

describe('ToggleGroupMultiField (field-версия, значение string[] | null)', () => {
  it('null из формы не роняет рендер — адаптер разворачивает его в []', () => {
    const html = renderToStaticMarkup(<ToggleGroupMultiField value={null} options={TAGS} />);
    expect(html.match(/aria-pressed="false"/g) ?? []).toHaveLength(3);
  });

  it('массив из формы доезжает до контрола', () => {
    const html = renderToStaticMarkup(<ToggleGroupMultiField value={['b']} options={TAGS} />);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('Бета');
  });

  it('control (renderer-путь) не протекает в DOM', () => {
    const html = renderToStaticMarkup(
      <ToggleGroupMultiField value={null} options={TAGS} control={{} as never} />
    );
    expect(html).not.toContain('control=');
  });
});
