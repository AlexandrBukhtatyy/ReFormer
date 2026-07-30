import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { print } from './printer';

const here = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN = path.resolve(
  here,
  '../../../react-playground/src/pages/examples/complex-multy-step-form-renderer-json/json-schema.json'
);

describe('printer — round-trip (риск №1)', () => {
  it('identity: print(parse(raw)) === raw на реальной схеме репо', async () => {
    const raw = readFileSync(GOLDEN, 'utf8');
    const printed = await print(JSON.parse(raw));
    expect(printed).toBe(raw);
  });

  it('фикспойнт: print стабилен (print∘parse∘print = print)', async () => {
    const schema: JsonFormSchema = {
      version: '1.0',
      root: {
        component: '$component(Box)',
        componentProps: { className: 'space-y-4' },
        children: [
          {
            component: '$component(Section)',
            componentProps: { title: 'A' },
            children: [{ value: '$model(a.b.c)', component: '$component(Input)' }],
          },
          {
            array: '$model(items)',
            item: { $template: { component: '$component(Box)', children: [] } },
          },
        ],
      },
    };
    const once = await print(schema);
    const twice = await print(JSON.parse(once));
    expect(twice).toBe(once);
  });

  it('passthrough: неизвестные ключи/операторы сохраняются', async () => {
    const schema = {
      version: '1.0',
      $customTop: 'keep-me',
      root: {
        component: '$component(Box)',
        $weirdOp: '$futureOp(arg)',
        children: [
          {
            value: '$model(a)',
            component: '$component(Input)',
            unknownKey: 42,
            nested: { z: true },
          },
        ],
      },
    };
    const back = JSON.parse(await print(schema));
    expect(back.$customTop).toBe('keep-me');
    expect(back.root.$weirdOp).toBe('$futureOp(arg)');
    expect(back.root.children[0].unknownKey).toBe(42);
    expect(back.root.children[0].nested.z).toBe(true);
  });

  it('сохраняет порядок ключей', async () => {
    const schema = {
      root: { component: '$component(Box)', selector: 'x', componentProps: { zzz: 1, aaa: 2 } },
    };
    const printed = await print(schema);
    // selector объявлен после component, zzz перед aaa — порядок не сортируется
    expect(printed.indexOf('"component"')).toBeLessThan(printed.indexOf('"selector"'));
    expect(printed.indexOf('"zzz"')).toBeLessThan(printed.indexOf('"aaa"'));
  });
});
