import {
  Attachment,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
  AttachmentTrigger,
  Spinner,
} from '@reformer/ui-kit';
import { FileText, ImageIcon, X, Download } from 'lucide-react';
import type { ComponentDocConfig } from '../types';

/**
 * Attachment — не поле формы: карточка приложенного файла (Attachment / AttachmentMedia /
 * AttachmentContent / AttachmentTitle / AttachmentDescription / AttachmentActions /
 * AttachmentAction / AttachmentTrigger / AttachmentGroup). Variants — раскладка, размер и
 * состояние, Examples — миниатюра, кнопки, кликабельная карточка и лента, API — таблица props.
 * Обёртка `<div style>` в render — рамка демо, в `code` её нет.
 */

// Миниатюра без сети: картинка встроена в модуль. В приложении это, например,
// URL.createObjectURL(file).
const previewUrl =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#60a5fa"/><stop offset="1" stop-color="#a78bfa"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/></svg>'
  );

const row = { display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' } as const;

export const attachmentDocConfig: ComponentDocConfig = {
  name: 'Attachment',
  importFrom: '@reformer/ui-kit',
  description:
    'Карточка приложенного файла: значок или миниатюра, имя, подпись и кнопки. Стадию загрузки показывает state.',
  variants: [
    {
      id: 'orientation',
      title: 'Раскладка (orientation)',
      description: 'horizontal — значок и текст в строку, vertical — плитка с медиа сверху.',
      render: () => (
        <div style={row}>
          <Attachment orientation="horizontal">
            <AttachmentMedia>
              <FileText />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>отчёт.pdf</AttachmentTitle>
              <AttachmentDescription>1,2 МБ</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
          <Attachment orientation="vertical">
            <AttachmentMedia>
              <FileText />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>отчёт.pdf</AttachmentTitle>
              <AttachmentDescription>1,2 МБ</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
        </div>
      ),
      code: `<Attachment orientation="horizontal">
  <AttachmentMedia>
    <FileText />
  </AttachmentMedia>
  <AttachmentContent>
    <AttachmentTitle>отчёт.pdf</AttachmentTitle>
    <AttachmentDescription>1,2 МБ</AttachmentDescription>
  </AttachmentContent>
</Attachment>

<Attachment orientation="vertical">
  <AttachmentMedia>
    <FileText />
  </AttachmentMedia>
  <AttachmentContent>
    <AttachmentTitle>отчёт.pdf</AttachmentTitle>
    <AttachmentDescription>1,2 МБ</AttachmentDescription>
  </AttachmentContent>
</Attachment>`,
    },
    {
      id: 'sizes',
      title: 'Размер (size)',
      description: 'default / sm / xs — плотность отступов, кегль и размер значка.',
      render: () => (
        <div style={row}>
          <Attachment size="default">
            <AttachmentMedia>
              <FileText />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>анкета.docx</AttachmentTitle>
              <AttachmentDescription>default</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
          <Attachment size="sm">
            <AttachmentMedia>
              <FileText />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>анкета.docx</AttachmentTitle>
              <AttachmentDescription>sm</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
          <Attachment size="xs">
            <AttachmentMedia>
              <FileText />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>анкета.docx</AttachmentTitle>
              <AttachmentDescription>xs</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
        </div>
      ),
      code: `<Attachment size="default">
  <AttachmentMedia>
    <FileText />
  </AttachmentMedia>
  <AttachmentContent>
    <AttachmentTitle>анкета.docx</AttachmentTitle>
    <AttachmentDescription>default</AttachmentDescription>
  </AttachmentContent>
</Attachment>

<Attachment size="sm">
  <AttachmentMedia>
    <FileText />
  </AttachmentMedia>
  <AttachmentContent>
    <AttachmentTitle>анкета.docx</AttachmentTitle>
    <AttachmentDescription>sm</AttachmentDescription>
  </AttachmentContent>
</Attachment>

<Attachment size="xs">
  <AttachmentMedia>
    <FileText />
  </AttachmentMedia>
  <AttachmentContent>
    <AttachmentTitle>анкета.docx</AttachmentTitle>
    <AttachmentDescription>xs</AttachmentDescription>
  </AttachmentContent>
</Attachment>`,
    },
    {
      id: 'states',
      title: 'Стадия загрузки (state)',
      description:
        'idle — пунктирная рамка (файл выбран, но не отправлен), uploading — идёт загрузка, error — красная рамка и подпись. По умолчанию done.',
      render: () => (
        <div style={row}>
          <Attachment state="idle">
            <AttachmentMedia>
              <FileText />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>справка.pdf</AttachmentTitle>
              <AttachmentDescription>Ждёт отправки</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
          <Attachment state="uploading">
            <AttachmentMedia>
              <Spinner />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>выписка.zip</AttachmentTitle>
              <AttachmentDescription>85 %</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
          <Attachment state="error">
            <AttachmentMedia>
              <FileText />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>скан.tiff</AttachmentTitle>
              <AttachmentDescription>Формат не поддерживается</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
        </div>
      ),
      code: `<Attachment state="idle">
  <AttachmentMedia>
    <FileText />
  </AttachmentMedia>
  <AttachmentContent>
    <AttachmentTitle>справка.pdf</AttachmentTitle>
    <AttachmentDescription>Ждёт отправки</AttachmentDescription>
  </AttachmentContent>
</Attachment>

<Attachment state="uploading">
  <AttachmentMedia>
    <Spinner />
  </AttachmentMedia>
  <AttachmentContent>
    <AttachmentTitle>выписка.zip</AttachmentTitle>
    <AttachmentDescription>85 %</AttachmentDescription>
  </AttachmentContent>
</Attachment>

<Attachment state="error">
  <AttachmentMedia>
    <FileText />
  </AttachmentMedia>
  <AttachmentContent>
    <AttachmentTitle>скан.tiff</AttachmentTitle>
    <AttachmentDescription>Формат не поддерживается</AttachmentDescription>
  </AttachmentContent>
</Attachment>`,
    },
  ],
  examples: [
    {
      id: 'image-preview',
      title: 'Миниатюра изображения',
      description:
        'AttachmentMedia variant="image": картинка заполняет квадрат медиа. Пока state не done или idle, миниатюра приглушена.',
      render: () => (
        <Attachment orientation="vertical">
          <AttachmentMedia variant="image">
            <img src={previewUrl} alt="" />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>обложка.png</AttachmentTitle>
            <AttachmentDescription>640×480</AttachmentDescription>
          </AttachmentContent>
        </Attachment>
      ),
      code: `// previewUrl — адрес картинки, например URL.createObjectURL(file)
<Attachment orientation="vertical">
  <AttachmentMedia variant="image">
    <img src={previewUrl} alt="" />
  </AttachmentMedia>
  <AttachmentContent>
    <AttachmentTitle>обложка.png</AttachmentTitle>
    <AttachmentDescription>640×480</AttachmentDescription>
  </AttachmentContent>
</Attachment>`,
    },
    {
      id: 'actions',
      title: 'Кнопки «Скачать» и «Удалить»',
      description:
        'AttachmentActions — место для кнопок справа, AttachmentAction — кнопка-значок (Button ghost, icon-xs). Подпись для скринридера — aria-label.',
      render: () => (
        <Attachment>
          <AttachmentMedia>
            <ImageIcon />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>скриншот.png</AttachmentTitle>
            <AttachmentDescription>320 КБ</AttachmentDescription>
          </AttachmentContent>
          <AttachmentActions>
            <AttachmentAction aria-label="Скачать скриншот.png" onClick={() => {}}>
              <Download />
            </AttachmentAction>
            <AttachmentAction aria-label="Удалить скриншот.png" onClick={() => {}}>
              <X />
            </AttachmentAction>
          </AttachmentActions>
        </Attachment>
      ),
      code: `<Attachment>
  <AttachmentMedia>
    <ImageIcon />
  </AttachmentMedia>
  <AttachmentContent>
    <AttachmentTitle>скриншот.png</AttachmentTitle>
    <AttachmentDescription>320 КБ</AttachmentDescription>
  </AttachmentContent>
  <AttachmentActions>
    <AttachmentAction aria-label="Скачать скриншот.png" onClick={download}>
      <Download />
    </AttachmentAction>
    <AttachmentAction aria-label="Удалить скриншот.png" onClick={remove}>
      <X />
    </AttachmentAction>
  </AttachmentActions>
</Attachment>`,
    },
    {
      id: 'trigger',
      title: 'Кликабельная карточка (AttachmentTrigger)',
      description:
        'AttachmentTrigger растягивается на всю карточку. По умолчанию это <button>, с asChild — ваша ссылка. Кнопки AttachmentActions остаются поверх него.',
      render: () => (
        <Attachment>
          <AttachmentMedia>
            <FileText />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>договор.pdf</AttachmentTitle>
            <AttachmentDescription>Открыть в новой вкладке</AttachmentDescription>
          </AttachmentContent>
          <AttachmentTrigger asChild>
            <a href="#договор" aria-label="Открыть договор.pdf" />
          </AttachmentTrigger>
        </Attachment>
      ),
      code: `<Attachment>
  <AttachmentMedia>
    <FileText />
  </AttachmentMedia>
  <AttachmentContent>
    <AttachmentTitle>договор.pdf</AttachmentTitle>
    <AttachmentDescription>Открыть в новой вкладке</AttachmentDescription>
  </AttachmentContent>
  <AttachmentTrigger asChild>
    <a href="#договор" aria-label="Открыть договор.pdf" />
  </AttachmentTrigger>
</Attachment>`,
    },
    {
      id: 'group',
      title: 'Лента вложений (AttachmentGroup)',
      description:
        'AttachmentGroup ставит карточки в ряд с горизонтальной прокруткой — например, под репликой с несколькими файлами.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <AttachmentGroup>
            {['паспорт.pdf', 'снилс.png', 'справка.pdf'].map((name) => (
              <Attachment key={name} size="sm">
                <AttachmentMedia>
                  <FileText />
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>{name}</AttachmentTitle>
                </AttachmentContent>
              </Attachment>
            ))}
          </AttachmentGroup>
        </div>
      ),
      code: `<AttachmentGroup>
  {['паспорт.pdf', 'снилс.png', 'справка.pdf'].map((name) => (
    <Attachment key={name} size="sm">
      <AttachmentMedia>
        <FileText />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{name}</AttachmentTitle>
      </AttachmentContent>
    </Attachment>
  ))}
</AttachmentGroup>`,
    },
  ],
  props: [
    {
      name: 'state',
      type: "'idle' | 'uploading' | 'processing' | 'error' | 'done'",
      default: "'done'",
      description:
        'Стадия файла. Меняет только оформление: idle — пунктирная рамка, error — красные рамка, значок и подпись, кроме done и idle — приглушённая миниатюра.',
    },
    {
      name: 'size',
      type: "'default' | 'sm' | 'xs'",
      default: "'default'",
      description: 'Плотность отступов, кегль и размер значка.',
    },
    {
      name: 'orientation',
      type: "'horizontal' | 'vertical'",
      default: "'horizontal'",
      description:
        'horizontal — значок и текст в строку, vertical — плитка шириной 96 px (120 px с текстом) с медиа сверху.',
    },
    {
      name: 'AttachmentMedia.variant',
      type: "'icon' | 'image'",
      default: "'icon'",
      description: 'icon — значок по центру квадрата, image — картинка <img> на весь квадрат.',
    },
    {
      name: 'AttachmentAction.variant',
      type: 'ButtonProps["variant"]',
      default: "'ghost'",
      description: 'Вид кнопки — те же значения, что у Button.',
    },
    {
      name: 'AttachmentAction.size',
      type: 'ButtonProps["size"]',
      default: "'icon-xs'",
      description: 'Размер кнопки — те же значения, что у Button. По умолчанию квадрат 24 px.',
    },
    {
      name: 'AttachmentTrigger.asChild',
      type: 'boolean',
      default: 'false',
      description:
        'Отдать поведение дочернему элементу вместо <button>, например ссылке <a>. Без asChild кнопка получает type="button".',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы любой части. Сливаются через tailwind-merge: ваш класс побеждает встроенный.',
    },
  ],
};
