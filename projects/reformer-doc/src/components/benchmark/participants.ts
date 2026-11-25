/**
 * Набор участников отчёта: порядок, подписи и роли. Графики берут его из контекста, поэтому одни и
 * те же компоненты рисуют и отчёт библиотек (/benchmark/forms — набор по умолчанию), и отчёт стеков
 * (/benchmark/frameworks — страница оборачивает себя своим набором).
 */
import { createContext, useContext } from 'react';
import { LIB_ORDER } from './colors';
import { libLabel, roleOf, type Role } from './types';

export interface ParticipantSet {
  /** Порядок участников в графиках и легендах. */
  order: readonly string[];
  label(id: string): string;
  /** Короткая подпись — на концах линий трейсов, где колонка узкая. */
  short(id: string): string;
  role(id: string): Role;
}

/** Отчёт библиотек форм: ReFormer, конкуренты и baseline. */
export const FORMS_SET: ParticipantSet = {
  order: LIB_ORDER,
  label: libLabel,
  short: (lib) =>
    lib === 'reformer-core' ? 'core' : lib === 'reformer-json' ? 'JSON' : libLabel(lib),
  role: roleOf,
};

const STACK_LABELS: Record<string, string> = { react: 'React', vue: 'Vue', angular: 'Angular' };

/**
 * Отчёт стеков: ReFormer в React, Vue и Angular. Все три — сам ReFormer, поэтому роль одна: цвет
 * различает стеки, а не выделяет кого-то.
 */
export const FRAMEWORKS_SET: ParticipantSet = {
  order: ['react', 'vue', 'angular'],
  label: (id) => STACK_LABELS[id] ?? id,
  short: (id) => STACK_LABELS[id] ?? id,
  role: () => 'subject',
};

/** Сценариев кросс-e2e, прошедших на prod-сборках стеков перед замерами: 34 на стек. */
export const FRAMEWORKS_PARITY_TESTS = 102;

export const ParticipantContext = createContext<ParticipantSet>(FORMS_SET);

export const useParticipants = (): ParticipantSet => useContext(ParticipantContext);
