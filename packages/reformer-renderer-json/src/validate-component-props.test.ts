import { describe, it, expect } from 'vitest';
import { validateFormSchema } from './validate';
import type { ComponentPropsSchema } from './schema';

/**
 * Фаза (d) валидации DSL — проверка `componentProps` по карте `propSchemas`.
 *
 * Фикстуры заданы ПРЯМО здесь (без импорта `@reformer/ui-kit`): renderer-json не зависит от ui-kit,
 * а карта `propSchemas` — это уже слитая `mergeFieldPropsSchema` схема (враппер `label`/`required`/
 * `testId` + пропы варианта). `x-doc`/`x-runtimeProps`/`x-registryName` намеренно вписаны, чтобы
 * доказать, что `stripDocExtensions` вырезает их до компиляции ajv (иначе strict бросил бы).
 */

// Слитая схема Select (враппер + вариант async): строгая (`additionalProperties: false`).
const selectPropsSchema: ComponentPropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Select',
  'x-runtimeProps': {
    value: { group: 'Control', type: 'string | null', description: 'резолвит seam' },
  },
  properties: {
    // контракт враппера
    label: { type: 'string', description: 'Подпись поля' },
    required: { type: 'boolean' },
    testId: { type: 'string' },
    // контракт варианта примитива
    className: {
      type: 'string',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
    placeholder: {
      type: 'string',
      default: 'Select an option...',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    clearable: {
      type: 'boolean',
      default: false,
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
    options: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          value: { type: ['string', 'number'] },
          label: { type: 'string' },
        },
      },
      'x-doc': { group: 'Options', type: 'Array<{ value; label }>', kind: 'readonly' },
    },
  },
};

// Слитая схема Input — с union-типами (min/max/step), проверяет allowUnionTypes при компиляции.
const inputPropsSchema: ComponentPropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Input',
  properties: {
    label: { type: 'string' },
    required: { type: 'boolean' },
    testId: { type: 'string' },
    type: { type: 'string', enum: ['text', 'number', 'email', 'password'] },
    min: { type: ['number', 'string'] },
    max: { type: ['number', 'string'] },
    step: { type: ['number', 'string'] },
  },
};

const propSchemas = { Select: selectPropsSchema, Input: inputPropsSchema };

describe('validateFormSchema — componentProps (phase d)', () => {
  it('(1a) catches a typo in componentProps of a component node', () => {
    const schema = {
      root: {
        value: '$model(loanType)',
        component: '$component(Select)',
        componentProps: { label: 'Тип', lable: 'oops', options: '$dataSource(LOAN_TYPES)' },
      },
    };
    const { valid, errors } = validateFormSchema(schema, { propSchemas });
    expect(valid).toBe(false);
    expect(errors.join('\n')).toMatch(/has unknown property "lable"/);
  });

  it('(1b) reaches a component node nested inside componentProps.steps (reachability regress)', () => {
    const schema = {
      root: {
        // мастер: сам НЕ в карте propSchemas → его props пропускаются, но обход доходит до шагов
        component: '$component(Wizard)',
        componentProps: {
          steps: [
            {
              value: '$model(amount)',
              component: '$component(Input)',
              componentProps: { label: 'Сумма', maxx: 100 },
            },
          ],
        },
      },
    };
    const { valid, errors } = validateFormSchema(schema, { propSchemas });
    expect(valid).toBe(false);
    expect(errors.join('\n')).toMatch(/has unknown property "maxx"/);
    // путь указывает на вложенную ноду, а не на корень
    expect(errors.join('\n')).toMatch(/steps\[0\]\.componentProps/);
  });

  it('(2) accepts an operator string in place of a literal prop value ($dataSource)', () => {
    const schema = {
      root: {
        value: '$model(loanType)',
        component: '$component(Select)',
        componentProps: { options: '$dataSource(LOAN_TYPES)' },
      },
    };
    expect(validateFormSchema(schema, { propSchemas }).valid).toBe(true);
  });

  it('(3) skips a component that is absent from the propSchemas map', () => {
    const schema = {
      root: {
        value: '$model(x)',
        component: '$component(Custom)',
        componentProps: { whatever: 123, nonsense: true },
      },
    };
    expect(validateFormSchema(schema, { propSchemas }).valid).toBe(true);
  });

  it('(4) is unchanged (backward compatible) when propSchemas is not provided', () => {
    const schema = {
      root: {
        value: '$model(loanType)',
        component: '$component(Select)',
        componentProps: { lable: 'typo', clearable: 'not-a-bool' },
      },
    };
    // Без propSchemas фаза (d) не запускается — структурно схема валидна.
    expect(validateFormSchema(schema, {}).valid).toBe(true);
    // Регресс-контроль: те же данные С картой — уже невалидно (фаза (d) сработала).
    expect(validateFormSchema(schema, { propSchemas }).valid).toBe(false);
  });

  it('(5) names the mistyped prop and leaks no operatorOp/anyOf noise', () => {
    const schema = {
      root: {
        value: '$model(loanType)',
        component: '$component(Select)',
        componentProps: { lable: 'typo', clearable: 'yes' },
      },
    };
    const { valid, errors } = validateFormSchema(schema, { propSchemas });
    expect(valid).toBe(false);
    const joined = errors.join('\n');
    // называет опечатанный проп
    expect(joined).toMatch(/has unknown property "lable"/);
    // честная ветка сохранена: clearable должен быть boolean
    expect(joined).toMatch(/clearable/);
    expect(joined).toMatch(/boolean/i);
    // шум escape-hatch'а операторов НЕ течёт
    expect(joined).not.toMatch(/operatorOp/i);
    expect(joined).not.toMatch(/anyOf/i);
    expect(joined).not.toMatch(/must match pattern/i);
  });
});
