/**
 * Отрисовка запросов к человеку: одно поле ввода или одно подтверждение.
 *
 * Правила живут в `../services/prompt`, здесь — окно и ввод. Разделение то же, что у диалога
 * слияния: очередь запросов, отмена как законный исход и проверка значения проверяются
 * в `node`, а модальное окно — только в браузере.
 *
 * ## Почему это компонент оболочки, а не панели
 *
 * Запрос принадлежит КОМАНДЕ, а команду зовут откуда угодно — из меню дерева, с клавиши,
 * из палитры, ассистентом. Панель, которой в этот момент может не быть на экране, показать
 * его не может; оболочка — может, потому что она есть всегда.
 *
 * ## Ввод и подтверждение — разные окна кита
 *
 * `dialog` для ввода и `alert-dialog` для подтверждения, а не одно окно с двумя режимами:
 * у подтверждения другая семантика доступности (`alertdialog` для скринридера, фокус
 * на кнопке, а не на поле) — то есть ровно то, ради чего в ките есть оба.
 *
 * @module host/ui/PromptHost
 */

import { useCallback, useRef, useState, useSyncExternalStore, type ReactElement } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@reformer/ui-kit/alert-dialog';
import { Button } from '@reformer/ui-kit/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@reformer/ui-kit/dialog';
import { Input } from '@reformer/ui-kit/input';
import { Label } from '@reformer/ui-kit/label';
import type { RootI18nService } from '../services/i18n/i18n';
import { DIALOG_SCOPE, useScope, type ScopeStack } from './scope';
import type { PendingPrompt, PromptService } from '../services/prompt';
import { splitName } from '../workspace/resource-names';
import { useLocale } from './usePanels';

export interface PromptHostProps {
  /**
   * Служба запросов. Отсутствие означает, что запросы показывать некому — законная сборка
   * (тест оболочки, встраивание), а не поломка.
   */
  readonly prompt?: PromptService | null;
  /** Стек областей: пока запрос показан, его клавиши принадлежат ему. */
  readonly scopes?: ScopeStack;
  readonly i18n: RootI18nService;
}

/**
 * Текущий запрос как состояние React.
 *
 * Подписка внешнего хранилища: снимок службы стабилен между изменениями, поэтому сравнение
 * ссылкой работает само. Эффект с `setState` дал бы лишний каскад отрисовок и первый кадр
 * без запроса — между монтированием и эффектом успевает пройти отрисовка.
 */
function usePendingPrompt(prompt: PromptService | null | undefined): PendingPrompt | null {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (prompt === undefined || prompt === null) return () => undefined;
      const subscription = prompt.observe(listener);
      return () => {
        subscription.dispose();
      };
    },
    [prompt]
  );

  const snapshot = useCallback((): PendingPrompt | null => prompt?.current() ?? null, [prompt]);

  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function PromptHost({ prompt, scopes, i18n }: PromptHostProps): ReactElement | null {
  const pending = usePendingPrompt(prompt);
  useScope(scopes, pending === null ? null : DIALOG_SCOPE);
  useLocale(i18n);

  const translate = useCallback(
    (key: string | undefined, fallbackKey: string): string => {
      const target = key ?? fallbackKey;
      const owner = pending?.pluginId;
      const service = owner === undefined ? i18n : i18n.forPlugin(owner);
      return service.t(target, pending?.params);
    },
    [i18n, pending]
  );

  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Запрос, которому выделение уже поставлено: второй раз спорить с кареткой не надо. */
  const selectedFor = useRef<string | null>(null);

  /** Запрос, под который набрано нынешнее значение поля. */
  const [filledFor, setFilledFor] = useState<PendingPrompt | null>(null);

  // Новый запрос — новое значение поля. Сравнение по объекту запроса, а не по значению:
  // повторный показ того же запроса не должен стирать набранное. Правка состояния ПРИ
  // ОТРИСОВКЕ, а не эффектом: иначе первый кадр нового запроса показывал бы чужой текст.
  if (pending !== filledFor) {
    setFilledFor(pending);
    if (pending !== null && pending.kind === 'input') {
      setValue(pending.value ?? '');
      setTouched(false);
    }
  }

  if (prompt === undefined || prompt === null || pending === null) return null;

  const close = (answer: string | boolean | null): void => {
    prompt.resolve(pending.id, answer);
  };

  const title = translate(pending.titleKey, pending.titleKey);
  const description =
    pending.descriptionKey === undefined ? null : translate(pending.descriptionKey, '');

  if (pending.kind === 'confirm') {
    return (
      <AlertDialog
        open
        onOpenChange={(open) => {
          // Escape и щелчок мимо окна равны отмене: у подтверждения нет исхода по умолчанию.
          if (!open) close(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            {description !== null && <AlertDialogDescription>{description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                close(null);
              }}
            >
              {translate(pending.cancelKey, 'shell.prompt.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              data-variant={pending.tone === 'danger' ? 'destructive' : undefined}
              className={
                pending.tone === 'danger'
                  ? 'bg-destructive text-white hover:bg-destructive/90'
                  : undefined
              }
              onClick={() => {
                close(true);
              }}
            >
              {translate(pending.confirmKey, 'shell.prompt.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  const rejection = pending.validate?.(value) ?? null;
  // Ошибку показываем только после первой правки: подсвечивать красным поле, в которое
  // человек ещё не притронулся, — это ругаться до того, как он что-то сделал.
  const error = touched && rejection !== null ? translate(rejection, rejection) : null;

  const submit = (): void => {
    if (rejection !== null) {
      setTouched(true);
      return;
    }
    close(value);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close(null);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description !== null && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="prompt-value">{translate(pending.labelKey, 'shell.prompt.value')}</Label>
          <Input
            id="prompt-value"
            ref={inputRef}
            autoFocus
            value={value}
            aria-invalid={error !== null}
            onFocus={(event) => {
              // Один раз на запрос: человек мог сам поставить каретку в середину имени,
              // и возвращать выделение при каждом возврате фокуса значило бы спорить с ним.
              if (selectedFor.current === pending.id) return;
              selectedFor.current = pending.id;
              const initial = pending.value ?? '';
              // Имя БЕЗ расширения: переименовывая «schema.json», меняют «schema», и просить
              // каждый раз дописывать «.json» — значит делать частое действие долгим.
              const end =
                pending.select === 'stem' ? splitName(initial).stem.length : initial.length;
              event.currentTarget.setSelectionRange(0, end);
            }}
            onChange={(event) => {
              setValue(event.target.value);
              setTouched(true);
            }}
            onKeyDown={(event) => {
              // Enter подтверждает — иначе до кнопки приходится добираться мышью после
              // каждого имени; Escape закрывает силами самого окна.
              if (event.key !== 'Enter') return;
              event.preventDefault();
              submit();
            }}
          />
          {error !== null && <p className="text-destructive text-[12px]">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              close(null);
            }}
          >
            {translate(pending.cancelKey, 'shell.prompt.cancel')}
          </Button>
          <Button disabled={rejection !== null} onClick={submit}>
            {translate(pending.confirmKey, 'shell.prompt.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
