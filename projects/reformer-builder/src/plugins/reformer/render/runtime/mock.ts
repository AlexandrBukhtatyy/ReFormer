/**
 * Мок-данные превью — РЕЭКСПОРТ доменного синтеза, а не своя реализация.
 *
 * По контракту мок-данные формы это авторский артефакт: человек пишет их руками, они живут
 * рядом с рабочей копией, и поверхность их только читает. Синтез нужен ровно для случая
 * «автор ничего не написал».
 *
 * Само правило синтеза домену и принадлежит: «какое начальное значение у поля с таким
 * контролом» — не вопрос превью. Второй потребитель — генератор, печатающий `model.ts`:
 * разойдись копии, превью показывало бы **не ту форму**, которую экспортирует генератор.
 * Копии успели разойтись на 29 строк, прежде чем это заметили.
 *
 * @module plugins/reformer/render/runtime/mock
 */

export {
  classifyDataSources,
  collectFieldDefaults,
  defaultForField,
  mockOptions,
  synthMock,
} from '@reformer/builder-stack-reformer/form-mock';
export type {
  DataSourceClasses,
  FieldDefault,
  MockOption,
} from '@reformer/builder-stack-reformer/form-mock';
export type { FormMock } from '@reformer/builder-stack-reformer/codegen';
