import { describe, expect, it } from 'vitest';
import { ALLOWED_HTML_TAGS } from '@reformer/renderer-json';
import { HTML_TAG_SPECS, htmlPropsSchema, htmlTagSpec } from './html-tags';
import { makeNodeFor } from './make-node';
import { kindOf } from '../model';

describe('HTML_TAG_SPECS', () => {
  it('каждый тег палитры разрешён рендерером (подмножество ALLOWED_HTML_TAGS)', () => {
    // Ключевой инвариант: тег вне whitelist renderer-json отвергнется валидатором при рендере.
    for (const spec of HTML_TAG_SPECS) {
      expect(ALLOWED_HTML_TAGS.has(spec.tag), `тег ${spec.tag} нет в whitelist`).toBe(true);
    }
  });

  it('теги уникальны', () => {
    const tags = HTML_TAG_SPECS.map((s) => s.tag);
    expect(new Set(tags).size).toBe(tags.length);
  });

  it('покрывает заголовки h1–h6 (текстовые теги)', () => {
    for (const h of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
      expect(htmlTagSpec(h)?.content).toBe('text');
    }
  });

  it('htmlTagSpec: неизвестный тег → undefined', () => {
    expect(htmlTagSpec('script')).toBeUndefined();
    expect(htmlTagSpec('div')).toBeDefined();
  });
});

describe('htmlPropsSchema', () => {
  it('className есть у всех тегов', () => {
    for (const spec of HTML_TAG_SPECS) {
      expect(htmlPropsSchema(spec).properties).toHaveProperty('className');
    }
  });

  it('text есть только у текстовых тегов', () => {
    for (const spec of HTML_TAG_SPECS) {
      const props = htmlPropsSchema(spec).properties ?? {};
      expect(Object.hasOwn(props, 'text')).toBe(spec.content === 'text');
    }
  });

  it('тег-специфичные props попадают в схему', () => {
    const a = htmlPropsSchema(htmlTagSpec('a')!).properties!;
    expect(a).toHaveProperty('href');
    expect(a).toHaveProperty('target');
    expect(a.target.enum).toEqual(['_self', '_blank', '_parent', '_top']);

    const img = htmlPropsSchema(htmlTagSpec('img')!).properties!;
    expect(img).toHaveProperty('src');
    expect(img).toHaveProperty('alt');
    expect(img.width.type).toBe('number');

    const ol = htmlPropsSchema(htmlTagSpec('ol')!).properties!;
    expect(ol.reversed.type).toBe('boolean');

    expect(htmlPropsSchema(htmlTagSpec('blockquote')!).properties).toHaveProperty('cite');
    expect(htmlPropsSchema(htmlTagSpec('label')!).properties).toHaveProperty('htmlFor');
  });

  it('каждый проп несёт x-doc.group (секцию инспектора)', () => {
    for (const spec of HTML_TAG_SPECS) {
      const props = htmlPropsSchema(spec).properties ?? {};
      for (const [key, prop] of Object.entries(props)) {
        expect(prop['x-doc']?.group, `${spec.tag}.${key} без x-doc.group`).toBeTruthy();
      }
    }
  });
});

describe('узел-по-умолчанию для каждого тега', () => {
  it('kindOf всегда container (роль $html-записи)', () => {
    for (const spec of HTML_TAG_SPECS) {
      expect(kindOf(makeNodeFor(`$html(${spec.tag})`, 'container'))).toBe('container');
    }
  });

  it('container несёт children и defaultClass; text несёт text; void — пустые props', () => {
    const div = makeNodeFor('$html(div)', 'container') as unknown as Record<string, unknown>;
    expect(div.children).toEqual([]);
    expect((div.componentProps as Record<string, unknown>).className).toBe('flex gap-4');

    const h1 = makeNodeFor('$html(h1)', 'container') as unknown as Record<string, unknown>;
    expect(h1.text).toBe('Заголовок');
    expect(h1.children).toBeUndefined();

    const hr = makeNodeFor('$html(hr)', 'container') as unknown as Record<string, unknown>;
    expect(hr.componentProps).toEqual({});
    expect(hr.text).toBeUndefined();
  });
});
