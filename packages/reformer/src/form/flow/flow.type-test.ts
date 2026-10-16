/**
 * Compile-time тест потока шагов `FormFlow`. Проверяется `tsc` (файл под `src`,
 * `include: ["src"]`); vitest его НЕ запускает — нет суффикса `.test.`.
 *
 * Убеждается, что:
 *  - итог перехода `FlowTransition` сужается по `status`: у `moved` — откуда и куда, у `stayed` —
 *    шаг, причина и (если шаг проверялся) результат проверки; причины — закрытый список;
 *  - состояние потока — сигналы только для чтения, а `next()` асинхронный, `previous()` и `goTo()` —
 *    синхронные;
 *  - шаги в конфиге сборки (`FormFlowConfig`) — список `{ id, rules }` правил той же формы данных,
 *    `rules: null` и шаг без поля `rules` — шаги без правил.
 */

import type { ReadonlySignal } from '@preact/signals-core';
import type { FlowStep, FormFlowConfig } from '../form-level';
import type { ValidationDefinition, ValidationResult } from '../validation/types';
import {
  createFormFlow,
  type FlowStayReason,
  type FlowTransition,
  type FormFlow,
  type FormFlowOptions,
} from './flow';

interface Application {
  amount: number;
  email: string;
}
interface Address {
  city: string;
}

declare const loanRules: ValidationDefinition<Application>;
declare const addressRules: ValidationDefinition<Address>;
declare const checked: ValidationResult;

/** Описание перехода: сужение по `status`, полнота разбора. */
export function describeTransition(transition: FlowTransition): string {
  switch (transition.status) {
    case 'moved': {
      const from: string = transition.from;
      const to: string = transition.to;
      // @ts-expect-error — у перехода причины нет: она бывает только у `stayed`
      void transition.reason;
      return `${from} → ${to}`;
    }
    case 'stayed': {
      const step: string = transition.step;
      const reason: FlowStayReason = transition.reason;
      const validation: ValidationResult | undefined = transition.validation;
      // @ts-expect-error — у оставшегося на шаге нет `to`
      void transition.to;
      return `${step}: ${reason}, ${validation?.status ?? 'без проверки'}`;
    }
    default: {
      const exhaustive: never = transition;
      return exhaustive;
    }
  }
}

export function transitionTypeChecks(transition: FlowTransition): void {
  // @ts-expect-error — без сужения по `status` причины нет
  void transition.reason;
  // @ts-expect-error — итог перехода только для чтения
  transition.status = 'moved';

  const reasons: FlowStayReason[] = ['invalid', 'error', 'cancelled', 'edge', 'locked'];
  // @ts-expect-error — причины — закрытый список
  const unknownReason: FlowStayReason = 'timeout';
  const moved: FlowTransition = { status: 'moved', from: 'loan', to: 'contacts' };
  const locked: FlowTransition = { status: 'stayed', step: 'loan', reason: 'locked' };
  // @ts-expect-error — у `moved` нет причины
  const movedWithReason: FlowTransition = { status: 'moved', from: 'a', to: 'b', reason: 'edge' };
  // @ts-expect-error — у `stayed` причина обязательна
  const stayedWithoutReason: FlowTransition = { status: 'stayed', step: 'loan' };

  void [reasons, unknownReason, moved, locked, movedWithReason, stayedWithoutReason];
}

/** Поток: сигналы только для чтения и методы переходов. */
export async function flowTypeChecks(flow: FormFlow): Promise<void> {
  const steps: readonly string[] = flow.steps;
  const current: ReadonlySignal<string> = flow.current;
  const index: number = flow.index.value;
  const completed: ReadonlySet<string> = flow.completed.value;
  const edges: boolean = flow.isFirst.value || flow.isLast.value;
  const validating: boolean = flow.validating.value;
  const canGo: boolean = flow.canGoTo('contacts');
  // Переход дальше проверяет шаг — асинхронно; назад и по идентификатору — сразу.
  const next: FlowTransition = await flow.next();
  const back: FlowTransition = flow.previous();
  const jump: FlowTransition = flow.goTo('loan');
  flow.reset();

  // @ts-expect-error — `next()` асинхронный: итог — промис
  const notAwaited: FlowTransition = flow.next();
  // @ts-expect-error — шаг меняют переходы, а не запись в сигнал
  flow.current.value = 'contacts';
  // @ts-expect-error — список шагов только для чтения
  flow.steps.push('summary');
  // @ts-expect-error — пройденные шаги только для чтения
  flow.completed.value.add('contacts');
  // @ts-expect-error — шаг — идентификатор, а не номер
  flow.goTo(2);
  // поведение под вопросом [ReFormer-hn34]: шаги потока — строки без связи со списком шагов сборки:
  // `goTo('summary')` компилируется и бросает исключение в рантайме.
  flow.goTo('summary');

  void [steps, current, index, completed, edges, validating, canGo, next, back, jump, notAwaited];
}

/** Шаги в конфиге сборки: правила той же формы данных, шаги без правил. */
export function flowConfigTypeChecks(): void {
  const config: FormFlowConfig<Application> = {
    steps: [{ id: 'loan', rules: loanRules }, { id: 'review', rules: null }, { id: 'done' }],
  };
  const step: FlowStep<Application> = { id: 'loan', rules: loanRules };
  const fromList: FormFlowConfig<Application> = {
    steps: ['loan', 'review'].map((id) => ({ id, rules: id === 'loan' ? loanRules : null })),
  };

  // @ts-expect-error — у шага обязателен идентификатор
  const withoutId: FlowStep<Application> = { rules: loanRules };
  // @ts-expect-error — правила шага — схема той же формы данных
  const foreignRules: FlowStep<Application> = { id: 'address', rules: addressRules };
  // @ts-expect-error — шаги — список `{ id, rules }`, а не идентификаторы строками
  const idsOnly: FormFlowConfig<Application> = { steps: ['loan', 'review'] };
  // @ts-expect-error — шаги только для чтения
  config.steps.push({ id: 'extra' });

  // Поток без сборки: идентификаторы шагов и необязательная проверка шага.
  const options: FormFlowOptions = {
    steps: ['loan', 'review'] as const,
    validateStep: async () => checked,
  };
  const flow: FormFlow = createFormFlow(options);
  const positional: FormFlow = createFormFlow({ steps: ['first', 'second'] });
  // @ts-expect-error — шаги — список идентификаторов
  createFormFlow({ steps: 'loan' });
  // @ts-expect-error — проверка шага возвращает результат проверки, а не `boolean`
  createFormFlow({ steps: ['loan'], validateStep: async () => true });

  void [step, fromList, withoutId, foreignRules, idsOnly, flow, positional];
}
