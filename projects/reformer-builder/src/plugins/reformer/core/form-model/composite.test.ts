import { describe, expect, it } from 'vitest';
import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import {
  STEP_SCHEMA_MARKER,
  isFormStepSchema,
  joinFormSchema,
  splitFormSchema,
  stepDirOfRef,
  stepRefsOf,
} from './composite';

function step(id: string, title: string, field: string): JsonNode {
  return {
    component: '$component(Step)',
    componentProps: { title },
    children: [
      { value: `$model(${field})`, component: '$component(Input)', $nodeId: `${id.slice(0, 6)}0f` },
    ],
    $nodeId: id,
  } as JsonNode;
}

function form(steps: unknown[]): JsonFormSchema {
  return {
    $schema: './form-schema.schema.json',
    version: '1.0',
    root: {
      component: '$component(Box)',
      $nodeId: 'root0000',
      children: [
        {
          component: '$component(Wizard)',
          $nodeId: 'wizard00',
          componentProps: { steps },
        } as unknown as JsonNode,
      ],
    },
  } as JsonFormSchema;
}

function stepsOf(schema: JsonFormSchema): unknown[] {
  const root = schema.root as unknown as { children: { componentProps: { steps: unknown[] } }[] };
  return root.children[0].componentProps.steps;
}

const dannye = step('dannye00', 'Данные', 'name');
const kontakty = step('kontakt0', 'Контакты', 'email');

const REF_A = './steps/dannye/form.schema.json';
const REF_B = './steps/kontakty/form.schema.json';

function printed(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

describe('joinFormSchema', () => {
  it('подставляет шаги из файлов и помнит, откуда каждый', () => {
    const { schema, origins } = joinFormSchema(
      form([{ $ref: REF_A }, { $ref: REF_B }]),
      new Map<string, unknown>([
        [REF_A, { $schema: STEP_SCHEMA_MARKER, node: dannye }],
        ['steps/kontakty/form.schema.json', { node: kontakty }],
      ])
    );
    expect(stepsOf(schema)).toEqual([dannye, kontakty]);
    expect(origins.get('dannye00')).toEqual({ ref: REF_A, $schema: STEP_SCHEMA_MARKER });
    expect(origins.get('kontakt0')).toEqual({ ref: REF_B });
  });

  it('двойники идентификаторов между файлами разводятся', () => {
    const twin = { ...kontakty, $nodeId: 'dannye00' };
    const { schema, origins } = joinFormSchema(
      form([{ $ref: REF_A }, { $ref: REF_B }]),
      new Map<string, unknown>([
        [REF_A, { node: dannye }],
        [REF_B, { node: twin }],
      ])
    );
    const [first, second] = stepsOf(schema) as { $nodeId: string }[];
    expect(first.$nodeId).toBe('dannye00');
    expect(second.$nodeId).not.toBe('dannye00');
    expect(origins.get(second.$nodeId)?.ref).toBe(REF_B);
  });

  it('нет файла или файл не шаг — ошибка', () => {
    expect(() => joinFormSchema(form([{ $ref: REF_A }]), new Map())).toThrow(/нет среди частей/);
    expect(() => joinFormSchema(form([{ $ref: REF_A }]), new Map([[REF_A, form([])]]))).toThrow(
      /не похож на шаг/
    );
  });
});

describe('splitFormSchema', () => {
  it('split ∘ join — те же байты скелета и частей', () => {
    const skeleton = form([{ $ref: REF_A }, { $ref: REF_B }]);
    const parts = new Map<string, unknown>([
      [REF_A, { $schema: STEP_SCHEMA_MARKER, node: dannye }],
      [REF_B, { node: kontakty }],
    ]);
    const joined = joinFormSchema(skeleton, parts);
    const split = splitFormSchema(joined.schema, joined.origins);
    expect(printed(split.skeleton)).toBe(printed(skeleton));
    expect([...split.parts.keys()]).toEqual([REF_A, REF_B]);
    for (const [ref, part] of split.parts) expect(printed(part)).toBe(printed(parts.get(ref)));
  });

  it('новый шаг разбитого визарда сразу получает свой файл', () => {
    const joined = joinFormSchema(
      form([{ $ref: REF_A }]),
      new Map<string, unknown>([[REF_A, { node: dannye }]])
    );
    const withNew = form([...stepsOf(joined.schema), kontakty]);
    const split = splitFormSchema(withNew, joined.origins);
    expect(stepsOf(split.skeleton)).toEqual([{ $ref: REF_A }, { $ref: REF_B }]);
    expect(split.parts.get(REF_B)).toEqual({ $schema: STEP_SCHEMA_MARKER, node: kontakty });
    expect(split.origins.get('kontakt0')?.ref).toBe(REF_B);
  });

  it('переименованный шаг остаётся в своём файле; совпавшая папка разводится', () => {
    const joined = joinFormSchema(
      form([{ $ref: REF_A }]),
      new Map<string, unknown>([[REF_A, { node: dannye }]])
    );
    const renamed = { ...dannye, componentProps: { title: 'Анкета' } };
    const sameTitle = step('second00', 'Данные', 'age');
    const split = splitFormSchema(form([renamed, sameTitle]), joined.origins);
    expect(stepsOf(split.skeleton)).toEqual([
      { $ref: REF_A },
      { $ref: './steps/dannye-2/form.schema.json' },
    ]);
  });

  it('без происхождения схема не разбивается; с all — разбивается первый визард', () => {
    const inline = form([dannye, kontakty]);
    expect(splitFormSchema(inline, new Map()).skeleton).toBe(inline);
    expect(splitFormSchema(inline, new Map()).parts.size).toBe(0);

    const split = splitFormSchema(inline, new Map(), { all: true });
    expect(stepsOf(split.skeleton)).toEqual([{ $ref: REF_A }, { $ref: REF_B }]);
    expect(split.parts.size).toBe(2);
  });
});

describe('вспомогательное', () => {
  it('stepRefsOf — ссылки в порядке шагов', () => {
    expect(stepRefsOf(form([{ $ref: REF_A }, dannye, { $ref: REF_B }]))).toEqual([REF_A, REF_B]);
  });

  it('isFormStepSchema — node без root', () => {
    expect(isFormStepSchema({ node: dannye })).toBe(true);
    expect(isFormStepSchema({ node: dannye, root: dannye })).toBe(false);
    expect(isFormStepSchema(form([]))).toBe(false);
  });

  it('stepDirOfRef — только канонический путь', () => {
    expect(stepDirOfRef(REF_B)).toBe('kontakty');
    expect(stepDirOfRef('./parts/a.json')).toBeNull();
  });
});
