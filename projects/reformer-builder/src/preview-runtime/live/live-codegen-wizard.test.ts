/**
 * Каталог визарда, сгенерированный КОДОГЕНОМ (экспорт примера), — не только компилируется, но и
 * исполняется: шим `renderer.wizard.tsx` подтягивается импортом из `registry.ts`, и в собранном
 * реестре под `Wizard`/`Step` лежат настоящие компоненты.
 *
 * Компиляция (`example-compiles.test.ts`) этого не доказывает: `reg.component('Wizard', Placeholder)`
 * тоже прекрасно компилировался — именно в таком виде экспорт визарда и уезжал пользователю
 * (ReFormer-8vn). Отказ был рантаймовым: шаги не рисовались, submit было некому послать.
 *
 * @module reformer-builder/preview-runtime/live/live-codegen-wizard.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { buildExampleFiles } from '../../codegen';
import { wizardSchema } from '../../codegen/__fixtures__/wizard-schema';
import { synthMock } from '../mock-synth';
import { buildLivePreview } from './build-live-preview';
import { compileForm } from './compile-form';

/** Форма данных фикстуры визарда. */
interface WizardShape extends Record<string, unknown> {
  fullName: string;
  email: string;
  city: string;
  address: string;
  agree: boolean;
}

/** Сгенерировать каталог и исполнить его так же, как это делает живое превью. */
async function runGeneratedWizard() {
  const mock = synthMock(wizardSchema, { now: new Date('2026-01-01T00:00:00Z') });
  const files = buildExampleFiles(wizardSchema, mock, 'onboarding');

  // Превью исполняет TS-соседей схемы, кроме страницы-обёртки (см. sibling-sources).
  const sources = Object.fromEntries(
    files
      .filter((f) => /\.tsx?$/.test(f.path) && f.path !== 'index.tsx')
      .map((f) => [f.path, f.content])
  );
  const schema = JSON.parse(
    files.find((f) => f.path === 'renderer.schema.json')!.content
  ) as JsonFormSchema;

  const compiled = await compileForm({ dir: 'forms/onboarding', files: sources, fromEditor: [] });
  const bundle = buildLivePreview<WizardShape>({ schema, compiled, dataSources: {} });
  return { compiled, bundle };
}

describe('каталог визарда из кодогена', () => {
  it('компилируется и исполняется: шим резолвится импортом из registry.ts', async () => {
    const { compiled, bundle } = await runGeneratedWizard();
    expect(compiled.errors).toEqual([]);
    expect(bundle.errors).toEqual([]);
    expect(bundle.applied).toContain('registry');
  });

  it('в реестре под Wizard и Step лежат компоненты, а не заглушка', async () => {
    const { bundle } = await runGeneratedWizard();
    for (const name of ['Wizard', 'Step']) {
      const entry = bundle.registry.get(name);
      expect(entry?.type, name).toBe('component');
      expect(typeof entry?.component, name).toBe('function');
    }
  });

  // Модель здесь НЕ проверяется намеренно: живое превью ищет в `model.ts` экспорт
  // `initialFormModel` (контракт шаблонов), а кодоген печатает фабрику `create<Форма>Model` —
  // расхождение контрактов существует независимо от wizard-шима и заведено отдельно.
  it('модель фикстуры доезжает до бандла хотя бы дефолтами схемы', async () => {
    const { bundle } = await runGeneratedWizard();
    expect(bundle.model.get()).toMatchObject({ fullName: expect.any(String) });
  });
});
