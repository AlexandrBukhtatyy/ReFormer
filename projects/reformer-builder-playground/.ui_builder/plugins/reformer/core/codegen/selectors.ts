/**
 * Трансформация КОПИИ схемы перед эмиссией: проставить стабильные `selector`-ы секциям,
 * массивам и шагам визарда, найти или вставить submit-триггер.
 *
 * Живая схема не трогается: экспорт не имеет права менять документ, который человек не просил
 * менять. Пользовательские селекторы сохраняются — с появлением `lib/form-model/selectors`
 * селектор стал управляемым и переживает экспорт, поэтому дедуп идёт ПОВЕРХ них, а не вместо.
 *
 * Зачем это вообще: поведение формы цепляется к узлам по селектору (отправка, `hideWhen`), а
 * поток шагов называет шаг селектором его узла (`flow.steps[].id`). Узел без селектора адресовать
 * нечем: правило видимости на нём стало бы no-op, а шаг потока не нашёл бы свою разметку — ни
 * ошибки, ни эффекта. Поэтому селектор получает КАЖДЫЙ узел-шаг, в том числе без заголовка.
 *
 * @module plugins/reformer/core/codegen/selectors
 */

import {
  collectSchemaSelectors,
  isArrayNode,
  isContainerNode,
  parseOperator,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import { kebab } from '@reformer/builder-toolkit';
import { isNodeLike, isStepsHost, isStepsHostName } from '../form-model/node-kind';
import { walkNodes } from '../form-model/query';

/** Узел в «сыром» виде: читаем и пишем динамические ключи схемы. */
interface AnyNode {
  component?: string;
  selector?: string;
  componentProps?: Record<string, unknown>;
  children?: unknown[];
  model?: string;
}

export interface SelectorInfo {
  /** Секции — кандидаты на условную видимость. */
  readonly sections: ReadonlyArray<{ readonly selector: string; readonly label: string }>;
  /** Узлы-массивы. */
  readonly arrays: ReadonlyArray<{ readonly selector: string; readonly path: string }>;
  /** Узел-цель submit. */
  readonly submitSelector: string;
  /**
   * Событие submit-цели. Кнопка шлёт `onClick`, визард — `onSubmit` со своего последнего шага:
   * кнопки отправки в схеме визарда нет вовсе, её рисует сам компонент. Поле нужно потому, что
   * поведение подписывается ИМЕНЕМ события — с `onClick` на визарде submit не сработал бы никогда.
   */
  readonly submitEvent: 'onClick' | 'onSubmit';
  /** Была ли вставлена новая кнопка submit (иначе найден существующий триггер). */
  readonly injectedSubmit: boolean;
}

export interface AssignResult {
  readonly schema: JsonFormSchema;
  readonly info: SelectorInfo;
}

/** Проставить селекторы и submit-триггер на копии схемы. */
export function assignSelectors(input: JsonFormSchema): AssignResult {
  const schema = structuredClone(input);
  // Занятые имена берём тем же обходом, которым `schema.node()` ищет узел в рантайме: свой
  // обход был бы вторым ответом на вопрос «какие селекторы есть».
  const used = new Set(collectSchemaSelectors(schema));
  const uniq = (base: string): string => {
    const root = base || 'node';
    let candidate = root;
    let i = 2;
    while (used.has(candidate)) {
      candidate = `${root}-${i}`;
      i += 1;
    }
    used.add(candidate);
    return candidate;
  };

  const sections: Array<{ selector: string; label: string }> = [];
  const arrays: Array<{ selector: string; path: string }> = [];
  let submitSelector = '';
  let submitEvent: SelectorInfo['submitEvent'] = 'onClick';
  // Узел шага → его номер (с единицы). Обход идёт сверху вниз, поэтому хозяин шагов встречается
  // раньше своих шагов и успевает их назвать.
  const stepNumbers = new Map<unknown, number>();

  walkNodes(schema, (node) => {
    const raw = node as unknown as AnyNode;
    const component = parseOperator(raw.component);

    if (isStepsHost(node)) {
      // Тот же отбор, что у раскладки модуля (`wizardStepsOf`): шаг — узел в `children` хозяина.
      (raw.children ?? []).filter(isNodeLike).forEach((step, index) => {
        stepNumbers.set(step, index + 1);
      });
    }

    if (isContainerNode(node)) {
      const title = raw.componentProps?.title;
      const isSection = component?.op === 'component' && component.arg === 'Section';
      if (isSection || typeof title === 'string') {
        if (raw.selector === undefined || raw.selector === '') {
          raw.selector = uniq(`${kebab(String(title ?? component?.arg ?? 'section'))}-section`);
        }
        sections.push({ selector: raw.selector, label: String(title ?? raw.selector) });
      }
    }

    if (isArrayNode(node)) {
      const parsed = parseOperator(raw.model);
      const path = parsed?.op === 'model' ? parsed.arg : 'items';
      if (raw.selector === undefined || raw.selector === '') raw.selector = uniq(kebab(path));
      arrays.push({ selector: raw.selector, path });
    }

    // Кто отправляет форму: кнопка или сам визард. Имя визарда берём из общего списка модели,
    // а не подстрокой: подстрока ловила бы и `StepIndicator`-подобные записи.
    const isWizard = component?.op === 'component' && isStepsHostName(component.arg);
    if (component?.op === 'component' && (component.arg === 'Button' || isWizard)) {
      // Имя по роли узла: у визарда кнопки нет вовсе, и `submit`-селектор на нём читался бы
      // в поведении и README как кнопка, которой в схеме не существует.
      if (raw.selector === undefined || raw.selector === '') {
        raw.selector = uniq(isWizard ? 'wizard' : 'submit');
      }
      // Отправляет первый визард, а без визарда — первая кнопка. Визард важнее кнопки, даже если
      // та стоит в схеме раньше: его последний шаг рисует свою кнопку отправки, и обработчик на
      // чужой кнопке оставил бы её без действия. Отсюда же следует, что у формы с шагами событие
      // отправки — всегда `onSubmit`: на это опирается раскладка валидации (у визарда нет набора
      // «все правила формы», которым кнопка проверяла бы форму сама).
      if (submitSelector === '' || (isWizard && submitEvent !== 'onSubmit')) {
        submitSelector = raw.selector;
        submitEvent = isWizard ? 'onSubmit' : 'onClick';
      }
    }

    // Шаг без заголовка секцией не считается и селектора выше не получил, а потоку шагов он
    // нужен: `id` шага — селектор его узла. Последним, чтобы имя по роли (секция, массив) победило.
    const stepNumber = stepNumbers.get(node);
    if (stepNumber !== undefined && (raw.selector === undefined || raw.selector === '')) {
      raw.selector = uniq(`step-${stepNumber}`);
    }
  });

  let injectedSubmit = false;
  if (submitSelector === '') {
    const root = schema.root as unknown as AnyNode;
    if (Array.isArray(root.children)) {
      submitSelector = uniq('submit');
      // Подпись — в `children` УЗЛА, а не в `componentProps`: рендерер отдаёт компоненту
      // содержимое из `children[]` и затирает им `componentProps.children`, поэтому кнопка
      // с текстом в пропсах выходит пустым (у ui-kit — чёрным) прямоугольником.
      root.children.push({
        component: '$component(Button)',
        selector: submitSelector,
        componentProps: { type: 'submit' },
        children: ['Отправить'],
      });
      injectedSubmit = true;
    } else if (isNodeLike(schema.root)) {
      // Корень не держит детей — вешаем submit прямо на него.
      if (root.selector === undefined || root.selector === '') root.selector = uniq('root');
      submitSelector = root.selector;
    }
  }

  return { schema, info: { sections, arrays, submitSelector, submitEvent, injectedSubmit } };
}
