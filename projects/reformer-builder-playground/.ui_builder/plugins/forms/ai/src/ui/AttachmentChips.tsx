/**
 * Чипы прикреплённых ресурсов — над полем ввода (со снятием) и под репликой пользователя.
 *
 * Чип показывает имя и адрес, а не содержимое: содержимое уходит модели и человеку здесь не
 * нужно. Непрочитанное вложение остаётся чипом с ошибкой, а не исчезает: «прикрепил, а модель
 * не увидела» без следа было бы худшим исходом.
 *
 * @module plugins/forms/ai/ui/AttachmentChips
 */

import type { ReactElement } from 'react';
import { FileText, X } from 'lucide-react';
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from '@reformer/ui-kit/attachment';
import type { Translate } from '../host';
import type { AttachmentRef } from '../session/session';

export interface AttachmentChipsProps {
  readonly attachments: readonly AttachmentRef[];
  readonly t: Translate;
  /** Снять вложение. Без него чипы только показываются — так под отправленной репликой. */
  readonly onRemove?: (uri: string) => void;
  readonly className?: string;
}

export function AttachmentChips({
  attachments,
  t,
  onRemove,
  className,
}: AttachmentChipsProps): ReactElement | null {
  if (attachments.length === 0) return null;
  return (
    <AttachmentGroup className={className}>
      {attachments.map((ref) => (
        <Attachment
          key={ref.uri}
          size="xs"
          state={ref.error === undefined ? 'done' : 'error'}
          title={ref.error === undefined ? ref.uri : t('chat.attach.failed', { error: ref.error })}
          data-testid="ai-attachment"
          className="min-w-0"
        >
          <AttachmentMedia>
            <FileText />
          </AttachmentMedia>
          <AttachmentContent className="min-w-0">
            <AttachmentTitle className="truncate text-[11.5px]">{ref.name}</AttachmentTitle>
            {ref.error !== undefined && (
              <AttachmentDescription className="truncate text-[10.5px]">
                {t('chat.attach.failed', { error: ref.error })}
              </AttachmentDescription>
            )}
          </AttachmentContent>
          {onRemove !== undefined && (
            <AttachmentActions>
              <AttachmentAction
                aria-label={t('chat.attach.remove', { name: ref.name })}
                title={t('chat.attach.remove', { name: ref.name })}
                onClick={() => {
                  onRemove(ref.uri);
                }}
              >
                <X />
              </AttachmentAction>
            </AttachmentActions>
          )}
        </Attachment>
      ))}
    </AttachmentGroup>
  );
}
