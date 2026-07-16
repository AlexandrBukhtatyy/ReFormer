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
} from '@reformer/ui-kit';
import { FileText, ImageIcon, X, Download } from 'lucide-react';
import type { ComponentDocConfig } from '../types';

/**
 * Attachment — не form-control: AI-примитив превью прикреплённого файла/чипа. Compound-набор
 * презентационных блоков (Attachment / AttachmentMedia / AttachmentContent / AttachmentTitle /
 * AttachmentDescription / AttachmentActions / AttachmentAction / AttachmentTrigger / AttachmentGroup).
 * Состояние загрузки задаётся через state, форма чипа — через size/orientation. Form-bound таба (api) нет.
 */
export const attachmentDocConfig: ComponentDocConfig = {
  name: 'Attachment',
  importFrom: '@reformer/ui-kit',
  description:
    'Чип-превью прикреплённого файла на shadcn. state отражает стадию загрузки (idle / uploading / processing / error / done), size и orientation задают форму, части (media / content / actions / trigger) собираются под нужный макет.',
  variants: [
    {
      id: 'orientation',
      title: 'Ориентация',
      description:
        'orientation: horizontal (иконка + текст в строку) или vertical (карточка-плитка).',
      render: () => (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Attachment orientation="horizontal">
            <AttachmentMedia>
              <FileText />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>отчёт.pdf</AttachmentTitle>
              <AttachmentDescription>1.2 МБ</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
          <Attachment orientation="vertical">
            <AttachmentMedia>
              <FileText />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>отчёт.pdf</AttachmentTitle>
              <AttachmentDescription>1.2 МБ</AttachmentDescription>
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
    <AttachmentDescription>1.2 МБ</AttachmentDescription>
  </AttachmentContent>
</Attachment>

<Attachment orientation="vertical">
  {/* ...те же части — карточка-плитка */}
</Attachment>`,
    },
    {
      id: 'sizes',
      title: 'Размеры',
      description: 'size: default / sm / xs — плотность отступов и размер медиа-иконки.',
      render: () => (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['default', 'sm', 'xs'] as const).map((size) => (
            <Attachment key={size} size={size}>
              <AttachmentMedia>
                <FileText />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>файл.docx</AttachmentTitle>
                <AttachmentDescription>{size}</AttachmentDescription>
              </AttachmentContent>
            </Attachment>
          ))}
        </div>
      ),
      code: `<Attachment size="default"> … </Attachment>
<Attachment size="sm"> … </Attachment>
<Attachment size="xs"> … </Attachment>`,
    },
    {
      id: 'states',
      title: 'Состояния',
      description:
        'state: uploading / processing анимируют заголовок (shimmer), error красит рамку и текст в destructive, idle рисует пунктирную рамку.',
      render: () => (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Attachment state="uploading">
            <AttachmentMedia>
              <FileText />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>загрузка.zip</AttachmentTitle>
              <AttachmentDescription>85%</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
          <Attachment state="error">
            <AttachmentMedia>
              <FileText />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>битый.bin</AttachmentTitle>
              <AttachmentDescription>Ошибка загрузки</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
        </div>
      ),
      code: `<Attachment state="uploading"> … </Attachment>
<Attachment state="error"> … </Attachment>`,
    },
  ],
  examples: [
    {
      id: 'image-preview',
      title: 'Превью изображения',
      description:
        'AttachmentMedia с variant="image" показывает миниатюру: <img> заполняет медиа-слот (object-cover), приглушается вне состояния done.',
      render: () => (
        <Attachment orientation="vertical" state="done">
          <AttachmentMedia variant="image">
            <img
              src="https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=200"
              alt="Превью"
            />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>обложка.png</AttachmentTitle>
            <AttachmentDescription>640×480</AttachmentDescription>
          </AttachmentContent>
        </Attachment>
      ),
      code: `<Attachment orientation="vertical" state="done">
  <AttachmentMedia variant="image">
    <img src={previewUrl} alt="Превью" />
  </AttachmentMedia>
  <AttachmentContent>
    <AttachmentTitle>обложка.png</AttachmentTitle>
    <AttachmentDescription>640×480</AttachmentDescription>
  </AttachmentContent>
</Attachment>`,
    },
    {
      id: 'actions',
      title: 'Действия (удалить / скачать)',
      description:
        'AttachmentActions — контейнер для кнопок; AttachmentAction по умолчанию рисует Button (ghost, icon-xs). z-index держит кнопки над AttachmentTrigger.',
      render: () => (
        <Attachment>
          <AttachmentMedia>
            <ImageIcon />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>скрин.png</AttachmentTitle>
            <AttachmentDescription>320 КБ</AttachmentDescription>
          </AttachmentContent>
          <AttachmentActions>
            <AttachmentAction aria-label="Скачать">
              <Download />
            </AttachmentAction>
            <AttachmentAction aria-label="Удалить">
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
    <AttachmentTitle>скрин.png</AttachmentTitle>
    <AttachmentDescription>320 КБ</AttachmentDescription>
  </AttachmentContent>
  <AttachmentActions>
    <AttachmentAction aria-label="Скачать" onClick={onDownload}>
      <Download />
    </AttachmentAction>
    <AttachmentAction aria-label="Удалить" onClick={onRemove}>
      <X />
    </AttachmentAction>
  </AttachmentActions>
</Attachment>`,
    },
    {
      id: 'trigger',
      title: 'Кликабельный чип (AttachmentTrigger)',
      description:
        'AttachmentTrigger растягивается на весь чип (absolute inset-0) — делает всю карточку кликабельной. asChild превращает его в ссылку.',
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
    <a href="/files/договор.pdf" aria-label="Открыть договор.pdf" />
  </AttachmentTrigger>
</Attachment>`,
    },
    {
      id: 'group',
      title: 'Лента вложений (AttachmentGroup)',
      description:
        'AttachmentGroup выстраивает чипы в горизонтальную прокручиваемую ленту со snap — удобно для списка приложенных файлов в сообщении.',
      render: () => (
        <AttachmentGroup>
          {['спека.pdf', 'логотип.png', 'данные.csv'].map((name) => (
            <Attachment key={name}>
              <AttachmentMedia>
                <FileText />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{name}</AttachmentTitle>
                <AttachmentDescription>вложение</AttachmentDescription>
              </AttachmentContent>
            </Attachment>
          ))}
        </AttachmentGroup>
      ),
      code: `<AttachmentGroup>
  {files.map((f) => (
    <Attachment key={f.id}>
      <AttachmentMedia>
        <FileText />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{f.name}</AttachmentTitle>
        <AttachmentDescription>вложение</AttachmentDescription>
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
      default: 'done',
      description:
        'Стадия загрузки. Управляет рамкой/цветом и shimmer-анимацией заголовка (через data-state).',
    },
    {
      name: 'size',
      type: "'default' | 'sm' | 'xs'",
      default: 'default',
      description: 'Плотность отступов и размер медиа-слота.',
    },
    {
      name: 'orientation',
      type: "'horizontal' | 'vertical'",
      default: 'horizontal',
      description: 'Раскладка: строка (иконка + текст) или плитка (медиа сверху).',
    },
    {
      name: 'AttachmentMedia.variant',
      type: "'icon' | 'image'",
      default: 'icon',
      description: 'icon — центрированная иконка; image — миниатюра (<img> с object-cover).',
    },
    {
      name: 'AttachmentAction.variant / size',
      type: 'ComponentProps<typeof Button>',
      default: "'ghost' / 'icon-xs'",
      description: 'Проброс в Button. По умолчанию призрачная квадратная кнопка-иконка.',
    },
    {
      name: 'AttachmentTrigger.asChild',
      type: 'boolean',
      default: 'false',
      description: 'Слить props на дочерний элемент (Radix Slot) — напр. сделать чип ссылкой.',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Доп. классы у любой части (tailwind-merge — класс вызывающего перекрывает).',
    },
  ],
};
