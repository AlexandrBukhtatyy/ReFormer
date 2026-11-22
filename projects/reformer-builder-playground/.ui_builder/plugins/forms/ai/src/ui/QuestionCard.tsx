/**
 * Карточка вопросов модели (`ask_user`) — в ленте, на месте, где модель спросила.
 *
 * Пока ход ждёт ответа, карточка — форма: у каждого вопроса варианты (один или несколько) и
 * «Свой вариант» с полем для слов человека; «Ответить» доступна, когда отвечено на всё. После
 * ответа карточка остаётся в ленте записью: вопрос и что на него ответили, — иначе через пару
 * ходов было бы непонятно, почему форма сделана именно так. Остановленный ход снимает карточку.
 *
 * Собрано на `@reformer/ui-kit`: варианты — `RadioGroup` и `Checkbox` с `Label`, свой ответ —
 * `Input`, метка вопроса — `Badge`.
 *
 * @module plugins/forms/ai/ui/QuestionCard
 */

import { useId, useState, type ReactElement } from 'react';
import { Badge } from '@reformer/ui-kit/badge';
import { Button } from '@reformer/ui-kit/button';
import { Checkbox } from '@reformer/ui-kit/checkbox';
import { Input } from '@reformer/ui-kit/input';
import { Label } from '@reformer/ui-kit/label';
import { RadioGroup, RadioGroupItem } from '@reformer/ui-kit/radio-group';
import type { Translate } from '../host';
import type { AskCard } from '../session/session';
import type { FormAskAnswer, FormAskQuestion } from '@reformer/builder-plugin-api';

export interface QuestionCardProps {
  readonly card: AskCard;
  /** Карточка ждёт ответа: варианты можно выбирать. */
  readonly open: boolean;
  readonly t: Translate;
  readonly onAnswer: (answers: readonly FormAskAnswer[]) => void;
}

/** Что выбрано в вопросе, пока не отвечено. */
interface Draft {
  readonly selected: readonly string[];
  /** Выбран «Свой вариант». */
  readonly own: boolean;
  readonly text: string;
}

const EMPTY: Draft = { selected: [], own: false, text: '' };

/** Значение «Своего варианта» в группе — не совпадает ни с одной меткой: те короче и без скобок. */
const OWN = '[own]';

/** Отвечено ли на вопрос: выбран вариант или написан свой ответ. */
const answered = (draft: Draft): boolean =>
  draft.selected.length > 0 || (draft.own && draft.text.trim() !== '');

/** Ответ на вопрос из того, что выбрано. */
const answerOf = (draft: Draft): FormAskAnswer => ({
  selected: draft.selected,
  ...(draft.own && draft.text.trim() !== '' ? { text: draft.text.trim() } : {}),
});

/** Ответ человека словами — для карточки после ответа. */
function shownAnswer(answer: FormAskAnswer): string {
  return [answer.selected.join(', '), answer.text ?? ''].filter(Boolean).join(' — ');
}

export function QuestionCard({ card, open, t, onAnswer }: QuestionCardProps): ReactElement {
  const [drafts, setDrafts] = useState<readonly Draft[]>(() => card.questions.map(() => EMPTY));
  const ready = drafts.every(answered);

  const update = (index: number, change: (draft: Draft) => Draft): void => {
    setDrafts((current) => current.map((draft, at) => (at === index ? change(draft) : draft)));
  };

  return (
    <div
      data-testid="ai-question"
      className="border-border bg-muted/40 space-y-3 rounded-md border px-3 py-2.5"
    >
      {card.questions.map((question, index) => (
        <QuestionBlock
          key={question.question}
          question={question}
          draft={drafts[index] ?? EMPTY}
          answer={card.answers?.[index]}
          open={open}
          t={t}
          onChange={(change) => {
            update(index, change);
          }}
        />
      ))}

      {open && (
        <Button
          size="sm"
          data-testid="ai-question-submit"
          disabled={!ready}
          onClick={() => {
            onAnswer(drafts.map(answerOf));
          }}
        >
          {t('chat.question.submit')}
        </Button>
      )}
      {card.cancelled === true && (
        <p className="text-muted-foreground text-[11.5px] leading-4">
          {t('chat.question.cancelled')}
        </p>
      )}
    </div>
  );
}

interface QuestionBlockProps {
  readonly question: FormAskQuestion;
  readonly draft: Draft;
  readonly answer: FormAskAnswer | undefined;
  readonly open: boolean;
  readonly t: Translate;
  readonly onChange: (change: (draft: Draft) => Draft) => void;
}

/** Один вопрос карточки: заголовок и варианты либо уже данный ответ. */
function QuestionBlock({
  question,
  draft,
  answer,
  open,
  t,
  onChange,
}: QuestionBlockProps): ReactElement {
  const id = useId();
  const ownInput = draft.own && open && (
    <Input
      data-testid="ai-question-own"
      value={draft.text}
      placeholder={t('chat.question.ownPlaceholder')}
      onChange={(event) => {
        const text = event.target.value;
        onChange((current) => ({ ...current, text }));
      }}
      // Глобальные сочетания оболочки не должны срабатывать при наборе ответа.
      onKeyDown={(event) => {
        event.stopPropagation();
      }}
      className="h-7 text-[12px] md:text-[12px]"
    />
  );

  return (
    <fieldset data-testid="ai-question-item" className="min-w-0 space-y-1.5">
      <legend className="text-foreground mb-1.5 text-[12.5px] leading-5 font-medium wrap-anywhere">
        {question.header !== undefined && (
          <Badge variant="outline" className="mr-1.5 h-4 px-1 text-[10px]">
            {question.header}
          </Badge>
        )}
        {question.question}
      </legend>

      {!open && answer !== undefined && (
        <p
          data-testid="ai-question-answer"
          className="text-muted-foreground text-[12px] leading-5 wrap-anywhere"
        >
          {t('chat.question.answer', { answer: shownAnswer(answer) })}
        </p>
      )}

      {open && !question.multiSelect && (
        <RadioGroup
          value={draft.own ? OWN : (draft.selected[0] ?? '')}
          onValueChange={(value) => {
            onChange((current) =>
              value === OWN
                ? { ...current, selected: [], own: true }
                : { ...current, selected: [value], own: false }
            );
          }}
          className="gap-1.5"
        >
          {question.options.map((option, index) => (
            <OptionRow
              key={option.label}
              id={`${id}-${String(index)}`}
              label={option.label}
              description={option.description}
              control={<RadioGroupItem id={`${id}-${String(index)}`} value={option.label} />}
            />
          ))}
          <OptionRow
            id={`${id}-own`}
            label={t('chat.question.own')}
            control={<RadioGroupItem id={`${id}-own`} value={OWN} />}
          />
        </RadioGroup>
      )}

      {open && question.multiSelect && (
        <div className="grid gap-1.5">
          {question.options.map((option, index) => (
            <OptionRow
              key={option.label}
              id={`${id}-${String(index)}`}
              label={option.label}
              description={option.description}
              control={
                <Checkbox
                  id={`${id}-${String(index)}`}
                  checked={draft.selected.includes(option.label)}
                  onCheckedChange={(checked) => {
                    onChange((current) => ({
                      ...current,
                      selected:
                        checked === true
                          ? [...current.selected, option.label]
                          : current.selected.filter((label) => label !== option.label),
                    }));
                  }}
                />
              }
            />
          ))}
          <OptionRow
            id={`${id}-own`}
            label={t('chat.question.own')}
            control={
              <Checkbox
                id={`${id}-own`}
                checked={draft.own}
                onCheckedChange={(checked) => {
                  onChange((current) => ({ ...current, own: checked === true }));
                }}
              />
            }
          />
        </div>
      )}

      {ownInput}
    </fieldset>
  );
}

/** Строка варианта: переключатель и подпись с пояснением. */
function OptionRow({
  id,
  label,
  description,
  control,
}: {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly control: ReactElement;
}): ReactElement {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 flex-none">{control}</div>
      <Label htmlFor={id} className="block text-[12px] leading-5 font-normal wrap-anywhere">
        {label}
        {description !== undefined && (
          <span className="text-muted-foreground block text-[11.5px] leading-4">{description}</span>
        )}
      </Label>
    </div>
  );
}
