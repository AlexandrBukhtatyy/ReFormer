/**
 * Коды диагностик, которые до этого ни разу не встречались в проверках: RF007, RF008, RF009 и
 * стоящие за ними коды кросс-проверки C2, C3, C6, C8. У каждого — случай, где код срабатывает, и
 * случай, где он обязан молчать: проверка, которая всегда находит ошибку, бесполезна так же, как
 * та, что не находит никогда.
 */

import { describe, expect, it } from 'vitest';
import { validateFormTool } from '../src/core/tools/validate-form';
import { cliKnowledge } from '../src/platform/cli/knowledge';

const knowledge = cliKnowledge();
const codes = (text: string) => [...text.matchAll(/\*\*(RF\d{3})\*\*/g)].map((match) => match[1]);

async function checkBundle(args: Record<string, unknown>): Promise<string> {
  const { content } = await validateFormTool({ kind: 'bundle', ...args }, knowledge);
  return content[0].text;
}

const fieldIntent = {
  formName: 'Order',
  fields: [{ name: 'city', type: 'string', component: 'Select' }],
};

const layoutWith = (field: Record<string, unknown>) => ({
  root: { component: '$component(Box)', children: [field] },
});

describe('RF008 / C2 — компонент разметки не зарегистрирован', () => {
  const schema = layoutWith({ value: '$model(city)', component: '$component(GhostPicker)' });

  it('с componentNames незнакомый компонент — ошибка', async () => {
    const text = await checkBundle({ intent: fieldIntent, schema, componentNames: ['Box'] });
    expect(codes(text)).toContain('RF008');
    expect(text).toContain('GhostPicker');
    expect(text).toMatch(/## Errors|❌/);
  });

  it('без componentNames — предупреждение: это может быть прикладной контейнер', async () => {
    const text = await checkBundle({ intent: fieldIntent, schema });
    expect(codes(text)).toContain('RF008');
    expect(text).toMatch(/## Warnings/);
    expect(text).not.toMatch(/## Errors/);
  });

  it('компонент, объявленный полем intent, не ругается', async () => {
    const text = await checkBundle({
      intent: fieldIntent,
      schema: layoutWith({ value: '$model(city)', component: '$component(Select)' }),
      componentNames: ['Box'],
    });
    expect(codes(text)).not.toContain('RF008');
  });
});

describe('RF009 / C3 — источник данных не объявлен', () => {
  const schemaWithSource = layoutWith({
    value: '$model(city)',
    component: '$component(Select)',
    componentProps: { options: '$dataSource(cities)' },
  });

  it('незнакомый источник — ошибка с его именем', async () => {
    const text = await checkBundle({ intent: fieldIntent, schema: schemaWithSource });
    expect(codes(text)).toContain('RF009');
    expect(text).toContain('cities');
  });

  it('объявленный источник не ругается', async () => {
    const text = await checkBundle({
      intent: { ...fieldIntent, dataSources: [{ name: 'cities', kind: 'static', value: [] }] },
      schema: schemaWithSource,
    });
    expect(codes(text)).not.toContain('RF009');
  });
});

describe('RF007 / C6, C8 — некорректная разметка', () => {
  it('C6: видимость адресует несуществующий selector', async () => {
    const text = await checkBundle({
      intent: {
        ...fieldIntent,
        visibility: [{ selector: '#ghost', when: 'city === "x"', mode: 'hide' }],
      },
      schema: layoutWith({ value: '$model(city)', component: '$component(Select)' }),
    });
    expect(codes(text)).toContain('RF007');
    expect(text).toContain('#ghost');
  });

  it('C8: шаблон строки массива не должен быть списком', async () => {
    const text = await checkBundle({
      intent: {
        formName: 'Order',
        fields: [],
        arrays: [
          {
            name: 'items',
            itemInterfaceName: 'OrderItem',
            initialValue: [],
            itemFields: [{ name: 'sku', type: 'string', component: 'Input' }],
          },
        ],
      },
      schema: {
        root: {
          component: '$component(Box)',
          children: [{ array: '$model(items)', initialValue: [], item: { children: [] } }],
        },
      },
    });
    expect(codes(text)).toContain('RF007');
    expect(text).toMatch(/initialValue/);
  });

  it('корректная разметка RF007 не даёт', async () => {
    const text = await checkBundle({
      intent: fieldIntent,
      schema: layoutWith({ value: '$model(city)', component: '$component(Select)' }),
    });
    expect(codes(text)).not.toContain('RF007');
  });
});
