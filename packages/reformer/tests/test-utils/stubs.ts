/**
 * Заглушки компонентов для схем в тестах ядра.
 *
 * Ядро `component` не интерпретирует — нужен лишь стабильный объект. `displayName` попадает в
 * снапшоты скомпилированной схемы, поэтому у каждой заглушки своё имя.
 *
 * @module test-utils/stubs
 */

/** Заглушка компонента с именем. */
export function stub(name: string): () => null {
  const component = (): null => null;
  component.displayName = name;
  return component;
}

export const InputStub = stub('Input');
export const SelectStub = stub('Select');
export const CheckboxStub = stub('Checkbox');
export const SectionStub = stub('Section');
export const StepStub = stub('Step');
export const WizardStub = stub('Wizard');
export const FieldArrayStub = stub('FieldArray');
