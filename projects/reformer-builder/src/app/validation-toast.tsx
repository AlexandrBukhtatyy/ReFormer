/**
 * Тост невалидной схемы — ЕДИНЫЙ рендер ошибок валидации для всех путей (кнопка «Валидация» и
 * гейт сохранения, спека §6/§14). Заголовок со склонением + список ошибок, где путь узла —
 * кликабельная ссылка (открывает raw-JSON и прыгает на строку). Путь моноширинный/подчёркнутый,
 * текст диагностики приглушённый, но читаемый (в отличие от почти прозрачного `description`-слота).
 *
 * Модуль-лист (не зависит от `save-actions`/`FloatingActions`) — чтобы оба пути могли его
 * переиспользовать без циклического импорта.
 *
 * @module reformer-builder/app/validation-toast
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import { toast } from '@reformer/ui-kit/sonner';
import { editorActions } from '../store';
import { errorLine, splitErrorMessage } from '../io/error-path';

/** Русское склонение «ошибка/ошибки/ошибок». */
function pluralErrors(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'ошибка';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'ошибки';
  return 'ошибок';
}

/** В тосте показываем не больше — остальные схлопываем в «…и ещё N». */
const MAX_SHOWN_ERRORS = 6;

/**
 * Разметка тоста невалидной схемы: заголовок + список ошибок, где путь узла — кликабельная ссылка
 * (открывает raw-JSON и прыгает на строку). Путь моноширинный/подчёркнутый, текст диагностики —
 * приглушённый, но читаемый (в отличие от почти прозрачного `description`-слота по умолчанию).
 *
 * Render-функция (не компонент — без хуков/состояния): вызывается напрямую, чтобы модуль оставался
 * утилитой с единственным не-компонентным экспортом (fast-refresh-boundary тут не нужен).
 */
function renderValidationErrors(errors: string[], onPick: (message: string) => void) {
  const shown = errors.slice(0, MAX_SHOWN_ERRORS);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[13px] font-semibold text-foreground">
        Невалидная схема: {errors.length} {pluralErrors(errors.length)}
      </div>
      <ul className="flex flex-col gap-1">
        {shown.map((err, i) => {
          const { path, rest } = splitErrorMessage(err);
          return (
            <li key={i} className="text-[11.5px] leading-snug">
              <button
                type="button"
                onClick={() => onPick(err)}
                title="Открыть строку в raw-JSON"
                className="break-all text-left font-mono font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:decoration-primary"
              >
                {path}
              </button>
              {rest && <span className="text-muted-foreground">{rest}</span>}
            </li>
          );
        })}
      </ul>
      {errors.length > MAX_SHOWN_ERRORS && (
        <div className="text-[11px] text-muted-foreground">
          …и ещё {errors.length - MAX_SHOWN_ERRORS}
        </div>
      )}
    </div>
  );
}

/** Показать тост со списком ошибок; клик по пути → reveal строки в raw-JSON (по захваченной схеме). */
export function showValidationErrors(errors: string[], schema: JsonFormSchema): void {
  toast.error(
    renderValidationErrors(errors, (message) =>
      editorActions.revealRawLine(errorLine(schema, message) ?? 1)
    ),
    { duration: 12000, closeButton: true }
  );
}
