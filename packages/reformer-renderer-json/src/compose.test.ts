import { describe, expect, it } from 'vitest';
import Ajv from 'ajv';
import { composeJsonFormSchema, isJsonStepRef, normalizeStepRef } from './compose';
import { buildFormStepMetaSchema, FORM_STEP_SCHEMA_ID } from './schema';
import { validateFormSchema } from './validate';
import type { JsonFormSchema, JsonNode } from './types/json-schema';

const stepA: JsonNode = {
  component: '$component(Step)',
  componentProps: { title: 'A' },
  children: [{ model: '$model(a)', component: '$component(Input)' }],
};
const stepB: JsonNode = {
  component: '$component(Step)',
  componentProps: { title: 'B' },
  children: [{ model: '$model(b)', component: '$component(Input)' }],
};

/** Корневая схема: визард внутри контейнера, шаги (узлы и ссылки) — его дети. */
function skeleton(steps: unknown[]): JsonFormSchema {
  return {
    $schema: './form-schema.schema.json',
    format: 2,
    root: {
      component: '$component(Box)',
      children: [{ component: '$component(FormWizard)', children: steps } as JsonNode],
    },
  };
}

function stepsOf(schema: JsonFormSchema): unknown[] {
  const root = schema.root as unknown as { children: { children: unknown[] }[] };
  return root.children[0].children;
}

describe('composeJsonFormSchema', () => {
  it('подставляет узлы шагов на место ссылок, с ./ и без', () => {
    const composed = composeJsonFormSchema(
      skeleton([{ $ref: './steps/a/form.schema.json' }, { $ref: 'steps/b/form.schema.json' }]),
      {
        'steps/a/form.schema.json': { node: stepA },
        './steps/b/form.schema.json': stepB,
      }
    );
    expect(stepsOf(composed)).toEqual([stepA, stepB]);
  });

  it('инлайн-шаги рядом со ссылками остаются, неизменные поддеревья — по ссылке', () => {
    const source = skeleton([stepA, { $ref: './steps/b/form.schema.json' }]);
    const composed = composeJsonFormSchema(source, {
      './steps/b/form.schema.json': { node: stepB },
    });
    const steps = stepsOf(composed);
    expect(steps[0]).toBe(stepA);
    expect(steps[1]).toBe(stepB);
    expect(composed).not.toBe(source);
  });

  it('схема без ссылок возвращается той же', () => {
    const source = skeleton([stepA, stepB]);
    expect(composeJsonFormSchema(source, {})).toBe(source);
  });

  it('неизвестная ссылка — ошибка с путём', () => {
    expect(() =>
      composeJsonFormSchema(skeleton([{ $ref: './steps/x/form.schema.json' }]), {})
    ).toThrow(/root\.children\[0\]\.children\[0\].*steps\/x\/form\.schema\.json/);
  });

  it('`steps` в componentProps — обычный проп: ссылка там не разворачивается', () => {
    const ref = { $ref: './steps/a/form.schema.json' };
    const source: JsonFormSchema = {
      format: 2,
      root: { component: '$component(Stepper)', componentProps: { steps: [ref] } },
    };
    const composed = composeJsonFormSchema(source, { './steps/a/form.schema.json': stepA });
    expect(composed).toBe(source);
  });
});

describe('isJsonStepRef / normalizeStepRef', () => {
  it('ссылка — объект ровно с одним строковым $ref', () => {
    expect(isJsonStepRef({ $ref: './a.json' })).toBe(true);
    expect(isJsonStepRef({ $ref: './a.json', title: 'x' })).toBe(false);
    expect(isJsonStepRef(stepA)).toBe(false);
    expect(isJsonStepRef(null)).toBe(false);
  });

  it('ведущий ./ не различает ссылки', () => {
    expect(normalizeStepRef('././steps/a.json')).toBe('steps/a.json');
  });
});

describe('мета-схема файла шага', () => {
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(buildFormStepMetaSchema({ componentNames: ['Step', 'Input'] }));

  it('принимает { $schema, node } и отвергает root', () => {
    expect(validate({ $schema: '../../form-step.schema.json', node: stepA })).toBe(true);
    expect(validate({ root: stepA })).toBe(false);
  });

  it('сужение имён компонентов действует и в файле шага', () => {
    expect(validate({ node: { ...stepA, component: '$component(Unknown)' } })).toBe(false);
  });

  it('свой $id', () => {
    expect(buildFormStepMetaSchema().$id).toBe(FORM_STEP_SCHEMA_ID);
  });
});

describe('validateFormSchema на несобранной схеме', () => {
  it('сообщает о ссылке на шаг', () => {
    const { valid, errors } = validateFormSchema(
      skeleton([{ $ref: './steps/a/form.schema.json' }])
    );
    expect(valid).toBe(false);
    expect(errors.join('\n')).toMatch(/children\[0\].*not resolved.*composeJsonFormSchema/);
  });
});
