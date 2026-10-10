/**
 * JsonFormRenderer с бандлом createJsonForm кладёт уровень формы в контекст сборки — визард в
 * схеме берёт из него форму, поток и отправку, как у бандла createForm.
 */

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { useFormBundleContext } from '@reformer/core/react';
import { createJsonForm } from '../create-json-form';
import { defineJsonSchemaV1 as defineJsonSchema } from '../types/json-schema-v1';
import { defineRegistry } from '../registry/component-registry';
import { JsonFormRenderer } from './json-form-renderer';

interface F {
  email: string;
}

/** Узел, который читает контекст сборки — как визард в схеме. */
const ContextProbe = () => {
  const bundle = useFormBundleContext<F>();
  return <s>{bundle && typeof bundle.submit === 'function' ? 'context-level' : 'no-context'}</s>;
};

const registry = defineRegistry((reg) => {
  reg.component('Probe', ContextProbe);
});

const schema = defineJsonSchema<F>({ version: '1.0', root: { component: '$component(Probe)' } });

describe('JsonFormRenderer — контекст сборки', () => {
  it('бандл createJsonForm пропом form — в контексте сборки', () => {
    const bundle = createJsonForm<F>({ initial: { email: '' }, schema, registry });

    expect(renderToString(<JsonFormRenderer<F> form={bundle} />)).toContain('context-level');
  });
});
