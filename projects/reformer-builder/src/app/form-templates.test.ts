import { describe, expect, it } from 'vitest';
import { registryTsTemplate, indexTsxTemplate } from './form-templates';

describe('registryTsTemplate', () => {
  const src = registryTsTemplate('profile');
  it('обёртка полей + Input→InputField', () => {
    expect(src).toContain('reg.component(FIELD_WRAPPER, FormField)');
    expect(src).toContain("reg.component('Input', InputField)");
  });
  it('импорты ui-kit + renderer-json, экспорт createRegistry', () => {
    expect(src).toContain("from '@reformer/ui-kit'");
    expect(src).toContain("from '@reformer/renderer-json'");
    expect(src).toContain('export function createRegistry(): ComponentRegistry');
  });
  // `data-sources.ts` существует не ради галочки в каноне: реестр — единственное место, где
  // значение справочника встречается с именем из `$dataSource(...)` схемы.
  it('справочник из data-sources.ts связан с именем в схеме', () => {
    expect(src).toContain("import { contactMethods } from './data-sources'");
    expect(src).toContain("reg.component('Select', SelectField)");
    expect(src).toContain("reg.dataSource('contactMethods', contactMethods)");
  });
});

describe('indexTsxTemplate', () => {
  const src = indexTsxTemplate('profile');
  it('default-export компонент с PascalCase-именем', () => {
    expect(src).toContain('export default function ProfileForm()');
  });
  it('собирает форму одним проходом: createJsonForm + renderer.schema.json + registry + behavior → JsonFormRenderer', () => {
    expect(src).toContain("import rawSchema from './renderer.schema.json'");
    expect(src).toContain("import { createRegistry } from './registry'");
    // Канон раскладки делит роли: тип формы живёт в types.ts, начальные значения — в model.ts,
    // поэтому импортов два, а не один.
    expect(src).toContain("import { initialFormModel } from './model'");
    expect(src).toContain("import type { FormShape } from './types'");
    expect(src).toContain("import { formBehavior } from './form.behavior'");
    expect(src).toContain("import { formRenderBehavior } from './renderer.behavior'");
    expect(src).toContain('createJsonForm<FormShape>(');
    expect(src).toContain('useJsonForm(');
    expect(src).toContain('<JsonFormRenderer<FormShape>');
    expect(src).toContain('form={jsonForm}');
    // Поведение приезжает бандлом, а не отдельным пропом рендерера.
    expect(src).toContain('renderBehavior: () => formRenderBehavior');
    expect(src).not.toContain('renderBehavior={');
  });
  it('стратегия валидации берётся из validation.ts, submit — штатным useFormValidation', () => {
    // Одна точка истины: тот же `validationOptions` читает Renderer-превью билдера, поэтому в
    // превью форма валидируется ровно так же, как в приложении.
    expect(src).toContain("import { formValidation, validationOptions } from './validation'");
    expect(src).toContain('useFormValidation({');
    expect(src).toContain('...validationOptions');
    expect(src).toContain('await validation.submit()');
  });
  // Запросы — только через api.ts: страница не знает ни про fetch, ни про эндпоинты.
  it('отправка идёт через api.ts, а не через console.info на месте', () => {
    expect(src).toContain("import { submitForm } from './api'");
    expect(src).toContain('await submitForm(jsonForm.model.get())');
    expect(src).not.toContain('TODO: отправка на бэкенд');
  });
  it('PascalCase: дефис/пробел → одно имя, ведущая цифра защищена, суффикс не задваивается', () => {
    expect(indexTsxTemplate('loan-application')).toContain(
      'export default function LoanApplicationForm()'
    );
    expect(indexTsxTemplate('2fa form')).toContain('export default function Form2faForm()');
    expect(indexTsxTemplate('profile form')).toContain('export default function ProfileForm()');
  });
});
