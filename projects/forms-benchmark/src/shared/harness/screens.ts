/**
 * Первый экран каждой формы для детектора готовности: какие контролы должны быть в DOM и с какими
 * значениями. Готовность определяет харнесс, а не реализация (BENCH-CONTRACT §6).
 */
import { REGISTRATION_FIELDS, REGISTRATION_INITIAL } from '../domain/registration';
import { REGISTRATION_PREFILL } from '../api/client';
import { serverConfig } from '../api/server';

export type FormId = 'registration' | 'credit' | 'calibration';

export interface ScreenExpectation {
  /** path → ожидаемое значение (`boolean` — для чекбокса). */
  values: Record<string, string | boolean>;
  /** Дополнительные селекторы, которые должны присутствовать. */
  selectors: string[];
}

export function expectedScreen(form: FormId): ScreenExpectation {
  switch (form) {
    case 'registration': {
      const values: Record<string, string | boolean> = {};
      for (const f of REGISTRATION_FIELDS) values[f] = REGISTRATION_INITIAL[f];
      if (serverConfig.invite) Object.assign(values, REGISTRATION_PREFILL);
      // Картинка капчи в готовность не входит: она зависит от латентности API и рисуется общим
      // виджетом одинаково у всех; её загрузку дожидается `idle()`.
      return { values, selectors: [] };
    }
    case 'calibration':
      return { values: {}, selectors: ['[data-testid="calibration-root"]'] };
    case 'credit': {
      // Шаг 1: всегда видимые поля с начальными значениями (`CREDIT_INITIAL_INPUT`) или данными
      // заявки `?application=1` (`CREDIT_APPLICATION_1`). Литералами, а не импортом: харнесс общий,
      // и код кредита не должен попадать в бандлы регистрации. Расхождение с fixture ловит
      // conformance (готовность не наступит). Справочники и вычисляемые поля ждёт `idle()`.
      const values =
        serverConfig.application === '1'
          ? {
              loanType: 'consumer',
              loanAmount: '500000',
              loanTerm: '24',
              loanPurpose: 'Ремонт квартиры',
            }
          : { loanType: 'consumer', loanAmount: '', loanTerm: '12', loanPurpose: '' };
      return { values, selectors: ['[data-testid="step-current"][data-step="1"]'] };
    }
  }
}

export function isScreenReady(root: ParentNode, exp: ScreenExpectation): boolean {
  for (const sel of exp.selectors) if (!root.querySelector(sel)) return false;
  for (const [path, expected] of Object.entries(exp.values)) {
    const el = root.querySelector<HTMLInputElement>(`[data-testid="input-${path}"]`);
    if (!el) return false;
    if (typeof expected === 'boolean') {
      if (el.checked !== expected) return false;
    } else if (el.value !== expected) return false;
  }
  return true;
}
